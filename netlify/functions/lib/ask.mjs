import { getCorpus, searchItems, expertsMatchingQuery } from "./corpus.mjs";
import { embedQuery, chatCompletion } from "./openai.mjs";
import {
  classifyMatch,
  extractSnippet,
  snippetIsGeneric,
  keywordBoostScore,
  textHitsQuery,
  titleShort,
  parseStructuredAnswer,
} from "./text.mjs";
import { serializeDocument } from "./documents.mjs";

const ASK_TOP_K = 5;
const SCORE_THRESHOLD = parseFloat(process.env.RAG_SCORE_THRESHOLD || "0.32");
const ASK_MIN_SCORE = parseFloat(process.env.RAG_ASK_MIN_SCORE || "0.12");

function askContextLabel(kind, it) {
  if (kind === "expert_profile") return `Профиль эксперта: ${it.name || ""}`;
  if (kind === "expert") return `Эксперт: ${it.name || ""} — ${it.role || ""}`;
  if (kind === "mention") return `Упоминание: ${it.expert_name || ""} в «${titleShort(it.document_title || "")}»`;
  return titleShort(it.title || "Документ");
}

function askContextBody(kind, it) {
  if (kind === "expert_profile") {
    const skills = (it.skills || []).join(", ");
    return `${it.name || ""}, ${it.role || ""}, направление «${it.department || ""}». Специализация: ${skills}. ${it.bio || ""}`.trim();
  }
  return it._ask_text || it.text || "";
}

function buildAskChunkText(question, it, docById) {
  const title = it.title || "";
  const section = it.section || "";
  const chunkText = it.text || "";
  const [priority] = classifyMatch(question, title, section, chunkText);
  const full = docById[it.document_id] || {};
  const body = full.body || chunkText;

  if (priority >= 3) {
    const paragraphs = body.split("\n\n").map((p) => p.trim()).filter(Boolean);
    let relevant = paragraphs.filter((p) => textHitsQuery(question, p) && !snippetIsGeneric(p));
    if (!relevant.length) relevant = paragraphs.filter((p) => !snippetIsGeneric(p));
    if (!relevant.length) relevant = paragraphs;
    const intro = `Документ «${titleShort(title)}» (раздел: ${section || "—"}).`;
    return [intro + "\n\n" + relevant.slice(0, 6).join("\n\n"), priority];
  }
  let snip = extractSnippet(body, question);
  if (snippetIsGeneric(snip) && priority < 2) return ["", priority];
  if (!snip || (snippetIsGeneric(snip) && priority < 1)) snip = chunkText;
  return [snip, priority];
}

function gatherAskContext(question, qvec, corpus) {
  const docById = Object.fromEntries(corpus.documents.map((d) => [d.id, d]));
  const matchedExperts = expertsMatchingQuery(corpus, question);
  const matchedIds = new Set(matchedExperts.map((e) => e.id));
  const personSearch = matchedExperts.length > 0;
  const pool = [];

  for (const doc of corpus.documents) {
    if (textHitsQuery(question, doc.title)) {
      const [text, priority] = buildAskChunkText(
        question,
        {
          document_id: doc.id,
          title: doc.title,
          section: doc.section || "",
          text: (doc.body || "").slice(0, 400),
        },
        docById
      );
      if (text) {
        pool.push([
          { document_id: doc.id, title: doc.title, section: doc.section || "", _ask_text: text },
          0.92,
          "chunk",
          priority,
        ]);
      }
    }
  }

  for (const [it, sc] of searchItems(corpus, qvec, "chunk", ASK_TOP_K * 3)) {
    const [text, priority] = buildAskChunkText(question, it, docById);
    if (!text && priority < 2) continue;
    const tier = { 3: 0.5, 2: 0.32, 1: 0.12, 0: 0 }[priority];
    let boosted = keywordBoostScore(question, sc + tier, it.title, text);
    if (snippetIsGeneric(text) && priority < 3) boosted *= 0.4;
    pool.push([{ ...it, _ask_text: text }, boosted, "chunk", priority]);
  }

  for (const [it, sc] of searchItems(corpus, qvec, "expert", 4)) {
    if (personSearch && !matchedIds.has(it.expert_id)) continue;
    const boosted = keywordBoostScore(question, sc, `${it.name} ${it.role}`, it.text);
    pool.push([it, boosted, "expert", textHitsQuery(question, it.role) ? 3 : 1]);
  }

  for (const [it, sc] of searchItems(corpus, qvec, "mention", 6)) {
    if (personSearch && !matchedIds.has(it.expert_id)) continue;
    let boosted = keywordBoostScore(question, sc, it.document_title || "", it.text);
    if (snippetIsGeneric(it.text) && !textHitsQuery(question, it.document_title || "")) boosted *= 0.45;
    pool.push([it, boosted, "mention", textHitsQuery(question, it.document_title || "") ? 2 : 1]);
  }

  for (const exp of matchedExperts) pool.push([exp, 0.99, "expert_profile", 3]);
  pool.sort((a, b) => b[3] - a[3] || b[1] - a[1]);

  const selected = [];
  const seenKeys = new Set();
  const seenDoc = new Set();
  let titleHitSeen = false;
  let semanticOnly = 0;
  let mentionCount = 0;

  for (const [it, sc, kind, priority] of pool) {
    let key;
    if (kind === "expert_profile") key = `profile:${it.id}`;
    else if (kind === "expert") key = `expert:${it.expert_id}`;
    else if (kind === "mention") key = `mention:${it.document_id}:${it.expert_id}`;
    else {
      const did = it.document_id;
      if (seenDoc.has(did)) continue;
      seenDoc.add(did);
      key = `chunk:${did}`;
    }
    if (seenKeys.has(key)) continue;
    if (kind === "mention" && titleHitSeen && mentionCount >= 1) continue;
    if (kind === "mention" && snippetIsGeneric(it.text || "") && priority < 2) continue;
    if (sc < ASK_MIN_SCORE && priority < 2 && !personSearch) continue;
    if (priority === 0 && titleHitSeen && semanticOnly >= 1) continue;
    if (priority >= 3) titleHitSeen = true;
    if (priority === 0) semanticOnly++;
    if (kind === "mention") mentionCount++;
    seenKeys.add(key);
    selected.push([it, sc, kind, priority]);
    if (selected.length >= ASK_TOP_K) break;
  }

  if (!selected.length && pool.length) selected.push(...pool.slice(0, 3));
  const maxScore = selected[0]?.[1] ?? pool[0]?.[1] ?? 0;
  const hasTitleHit = selected.some((x) => x[3] >= 3);
  return [selected, maxScore, hasTitleHit];
}

export async function handleAsk(question) {
  const corpus = getCorpus();
  if (!corpus.matrix.length) throw new Error("Индекс не найден");
  const qvec = await embedQuery(question);
  const [selected, maxScore, hasTitleHit] = gatherAskContext(question, qvec, corpus);

  if (!selected.length || maxScore < ASK_MIN_SCORE * 0.5) {
    return {
      answer: "В базе знаний не нашлось достаточно релевантных материалов по вашему вопросу. Попробуйте переформулировать запрос или воспользуйтесь поиском.",
      summary: "",
      detail: "",
      sources: [],
      confidence: "low",
    };
  }

  const docById = Object.fromEntries(corpus.documents.map((d) => [d.id, d]));
  const contextParts = [];
  const sources = [];

  selected.forEach(([it, sc, kind, priority], i) => {
    const n = i + 1;
    const label = askContextLabel(kind, it);
    const body = askContextBody(kind, it);
    contextParts.push(`[${n}] ${label}\n${body}`);
    const docTitle = kind === "chunk" ? titleShort(it.title || "") : label;
    const src = {
      title: docTitle,
      quote: body.slice(0, 360),
      score: Math.round(sc * 10000) / 10000,
      ref: n,
      kind,
      match_priority: priority,
    };
    if (kind === "chunk") {
      src.document_id = it.document_id;
      src.chunk_index = it.chunk_index || 0;
      src.document_title = it.title || docTitle;
    } else if (kind === "expert" || kind === "expert_profile") {
      src.expert_id = it.id || it.expert_id || "";
    } else if (kind === "mention") {
      src.document_id = it.document_id || "";
      src.expert_id = it.expert_id || "";
      src.document_title = titleShort(it.document_title || "");
    }
    const did = src.document_id;
    if (did && docById[did]) {
      const meta = serializeDocument(docById[did], corpus.experts);
      Object.assign(src, {
        file_ext: meta.file_ext,
        material_type: meta.material_type,
        author: meta.author,
        updated_at: meta.updated_at,
        tags: meta.tags,
        section: meta.section,
      });
    }
    sources.push(src);
  });

  const weak = maxScore < SCORE_THRESHOLD && !hasTitleHit;
  let system =
    "Ты ассистент корпоративной базы знаний ax.files. Отвечай только на основе контекста, на русском.\n\n" +
    "Формат ответа (строго):\n## Кратко\n2–4 предложения.\n\n## Подробнее\nРазвёрнутый ответ с [1][2].\n\n" +
    "Правила:\n- Не выдумывай факты.\n- Ссылайся на источники.";
  if (weak) system += "\n- Релевантность может быть невысокой.";
  const user = `Контекст:\n\n${contextParts.join("\n\n---\n\n")}\n\nВопрос: ${question}`;
  const raw = await chatCompletion([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  const [summary, detail, answer] = parseStructuredAnswer(raw);
  let confidence;
  if (maxScore >= SCORE_THRESHOLD + 0.05 || hasTitleHit) confidence = maxScore >= SCORE_THRESHOLD ? "high" : "medium";
  else if (maxScore >= ASK_MIN_SCORE) confidence = weak ? "low" : "medium";
  else confidence = "low";

  return { answer, summary, detail, sources, confidence };
}
