import { getCorpus, searchItems, expertsMatchingQuery } from "./corpus.mjs";
import { embedQuery } from "./openai.mjs";
import {
  classifyMatch,
  classifyExpertMatch,
  extractSnippet,
  snippetIsGeneric,
  buildDocSnippet,
  titleHighlightPart,
  keywordBoostScore,
  textHitsQuery,
} from "./text.mjs";
import { DOC_TYPE_MATERIAL, DOC_TYPE_EXT, docAuthor } from "./documents.mjs";

export async function handleSearch(q, limit = 6) {
  const corpus = getCorpus();
  if (!corpus.matrix.length) {
    throw new Error("Индекс не найден");
  }
  const qvec = await embedQuery(q);
  const docMeta = Object.fromEntries(corpus.documents.map((d) => [d.id, d]));
  const matchedExperts = expertsMatchingQuery(corpus, q);
  const matchedIds = new Set(matchedExperts.map((e) => e.id));
  const personSearch = matchedExperts.length > 0;

  const chunkScored = [];
  for (const [it, score] of searchItems(corpus, qvec, "chunk", limit * 5)) {
    const section = it.section || "";
    const [priority, matchIn] = classifyMatch(q, it.title, section, it.text);
    const tierBoost = { 3: 0.65, 2: 0.45, 1: 0.22, 0: 0 }[priority];
    let boosted = keywordBoostScore(q, score + tierBoost, it.title, it.text);
    if (personSearch) {
      const names = matchedExperts.map((e) => e.name).join(" ").toLowerCase();
      if (!it.text.toLowerCase().includes(names) && !it.title.toLowerCase().includes(names) && boosted < 0.12) continue;
    } else if (priority === 0 && boosted < 0.1) continue;
    else if (priority === 1 && !textHitsQuery(q, it.title) && !textHitsQuery(q, section)) {
      if (snippetIsGeneric(extractSnippet(it.text, q))) boosted *= 0.45;
    }
    chunkScored.push([it, boosted, priority, matchIn]);
  }
  chunkScored.sort((a, b) => b[2] - a[2] || b[1] - a[1]);
  const topChunk = chunkScored[0]?.[1] || 0;
  const filtered = chunkScored.filter((x) => x[1] >= Math.max(0.05, topChunk * 0.3)).slice(0, limit * 2);

  const chunksByDoc = {};
  for (const row of filtered) {
    const did = row[0].document_id;
    if (!chunksByDoc[did]) chunksByDoc[did] = [];
    chunksByDoc[did].push(row);
  }

  const docHits = {};
  for (const [did, chunks] of Object.entries(chunksByDoc)) {
    const chunkKey = (c) => {
      const snip = extractSnippet(c[0].text, q);
      return [c[2], textHitsQuery(q, snip) ? 1 : 0, c[1]];
    };
    let [bestIt, boosted, priority, matchIn] = chunks.reduce((a, b) =>
      chunkKey(b) > chunkKey(a) ? b : a
    );
    const fullTitle = bestIt.title;
    let snippet = buildDocSnippet(q, fullTitle, bestIt.section || "", bestIt.text, matchIn);
    if (matchIn === "content") {
      if (!textHitsQuery(q, snippet)) {
        const better = chunks.filter((c) =>
          textHitsQuery(q, buildDocSnippet(q, c[0].title, c[0].section || "", c[0].text, c[3]))
        );
        if (better.length) [bestIt, boosted, priority, matchIn] = better.reduce((a, b) => (chunkKey(b) > chunkKey(a) ? b : a));
        else if (priority < 2) continue;
        snippet = buildDocSnippet(q, bestIt.title, bestIt.section || "", bestIt.text, matchIn);
      } else if (snippetIsGeneric(snippet) && !textHitsQuery(q, fullTitle)) continue;
    }
    const src = docMeta[did] || {};
    const dt = src.doc_type || bestIt.doc_type || "doc";
    docHits[did] = {
      id: did,
      title: fullTitle,
      title_hit: titleHighlightPart(fullTitle, q),
      section: bestIt.section || "",
      tags: src.tags || [],
      doc_type: dt,
      material_type: DOC_TYPE_MATERIAL[dt] || "Проектные материалы",
      file_ext: DOC_TYPE_EXT[dt] || "pdf",
      updated_at: src.updated_at || "",
      author: src.body ? docAuthor(src, corpus.experts) : "—",
      excerpt: (src.body || bestIt.text).slice(0, 220),
      snippet,
      match_in: matchIn,
      match_priority: priority,
      score: Math.round(boosted * 10000) / 10000,
    };
  }

  let documents = Object.values(docHits).sort(
    (a, b) => b.match_priority - a.match_priority || b.score - a.score
  );
  const titleHits = documents.filter((d) => d.match_priority >= 3).length;
  const sectionHits = documents.filter((d) => d.match_priority === 2).length;
  const contentCap = titleHits + sectionHits >= 2 ? 2 : 4;
  const seenSnip = new Set();
  let contentCount = 0;
  documents = documents.filter((doc) => {
    if (doc.match_priority === 1) {
      if (contentCount >= contentCap) return false;
      const key = doc.snippet.slice(0, 70).toLowerCase().replace(/…/g, "").trim();
      if (seenSnip.has(key)) return false;
      seenSnip.add(key);
      contentCount++;
    }
    return true;
  }).slice(0, limit);

  let experts;
  if (personSearch) {
    experts = matchedExperts.slice(0, limit).map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role || "",
      avatar: e.avatar || "",
      snippet: (e.bio || "").slice(0, 200),
      score: 1,
    }));
  } else {
    const expertScored = [];
    for (const [it, score] of searchItems(corpus, qvec, "expert", limit * 2)) {
      const [priority, matchIn] = classifyExpertMatch(q, it.name || "", it.role || "", it.text);
      const tierBoost = { 3: 0.65, 2: 0.45, 1: 0.22, 0: 0 }[priority];
      const boosted = keywordBoostScore(q, score + tierBoost, it.name, it.text);
      if (priority === 0 && boosted < 0.08) continue;
      if (priority === 1) continue;
      expertScored.push([it, boosted, priority, matchIn]);
    }
    expertScored.sort((a, b) => b[2] - a[2] || b[1] - a[1]);
    const topSc = expertScored[0]?.[1] || 0;
    experts = expertScored
      .filter((x) => x[1] >= Math.max(0.06, topSc * 0.35))
      .slice(0, 3)
      .map(([it, sc, , mi]) => ({
        id: it.expert_id,
        name: it.name,
        role: it.role || "",
        avatar: it.avatar || "",
        snippet: mi === "content" ? extractSnippet(it.text, q) : "",
        match_in: mi,
        score: Math.round(sc * 10000) / 10000,
      }));
  }

  const mentionScored = [];
  for (const [it, score] of searchItems(corpus, qvec, "mention", limit * 3)) {
    if (personSearch && !matchedIds.has(it.expert_id)) continue;
    const [priority, matchIn] = classifyMatch(q, it.document_title || "", it.expert_name || "", it.text);
    const tierBoost = { 3: 0.65, 2: 0.45, 1: 0.22, 0: 0 }[priority];
    const boosted = keywordBoostScore(q, score + tierBoost, it.document_title || "", it.text);
    if (priority === 0 && boosted < 0.08) continue;
    mentionScored.push([it, boosted, priority, matchIn]);
  }
  mentionScored.sort((a, b) => b[2] - a[2] || b[1] - a[1]);
  const topM = mentionScored[0]?.[1] || 0;
  const mentionFiltered = mentionScored.filter(
    (x) => x[1] >= Math.max(0.06, topM * (personSearch ? 0.5 : 0.35))
  );
  const seenMentionDocs = new Set();
  const mentions = [];
  for (const [it, sc, , mi] of mentionFiltered) {
    if (seenMentionDocs.has(it.document_id)) continue;
    const snip = extractSnippet(it.text, q);
    if (!textHitsQuery(q, snip)) continue;
    seenMentionDocs.add(it.document_id);
    const src = docMeta[it.document_id] || {};
    mentions.push({
      expert_id: it.expert_id,
      expert_name: it.expert_name,
      document_id: it.document_id,
      document_title: it.document_title,
      section: src.section || "",
      tags: src.tags || [],
      snippet: snip,
      match_in: mi,
      score: Math.round(sc * 10000) / 10000,
    });
    if (mentions.length >= Math.min(limit, 4)) break;
  }

  return { query: q, documents, experts: experts || [], mentions };
}
