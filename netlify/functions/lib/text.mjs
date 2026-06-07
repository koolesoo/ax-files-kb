const GENERIC = [
  "вебинары записываются и индексируются",
  "интеграция с crm позволяет подтягивать",
  "команды используют ax.files как единую",
  "умные ответы строятся только на одобренных",
  "поиск учитывает синонимы тегов",
];

export function queryTokens(q) {
  const qn = q.trim().toLowerCase();
  const tokens = q.split(/\W+/).map((t) => t.toLowerCase()).filter((t) => t.length > 2);
  if (qn.length >= 3 && !tokens.includes(qn)) tokens.unshift(qn);
  return tokens;
}

export function stemRoots(token) {
  const roots = new Set([token]);
  if (token.length >= 7) roots.add(token.slice(0, 6));
  if (token.length >= 6) roots.add(token.slice(0, 5));
  return [...roots];
}

export function textHitsQuery(q, hay) {
  if (!hay) return false;
  const hayL = hay.toLowerCase();
  const qn = q.trim().toLowerCase();
  if (qn.length >= 3 && hayL.includes(qn)) return true;
  for (const token of queryTokens(q)) {
    for (const root of stemRoots(token)) {
      if (hayL.includes(root)) return true;
    }
  }
  return false;
}

export function classifyMatch(q, title, section, text) {
  if (textHitsQuery(q, title)) return [3, "title"];
  if (textHitsQuery(q, section || "")) return [2, "section"];
  if (textHitsQuery(q, text)) return [1, "content"];
  return [0, "semantic"];
}

export function classifyExpertMatch(q, name, role, bio) {
  if (textHitsQuery(q, role)) return [3, "role"];
  if (textHitsQuery(q, name)) return [3, "name"];
  if (textHitsQuery(q, bio)) return [1, "content"];
  return [0, "semantic"];
}

export function extractSnippet(text, q, width = 220) {
  const textL = text.toLowerCase();
  let pos = -1;
  let matchLen = 3;
  const qn = q.trim().toLowerCase();
  if (qn.length >= 3) {
    const i = textL.indexOf(qn);
    if (i >= 0) {
      pos = i;
      matchLen = qn.length;
    }
  }
  if (pos < 0) {
    for (const token of queryTokens(q)) {
      for (const root of stemRoots(token)) {
        const i = textL.indexOf(root);
        if (i >= 0) {
          pos = i;
          matchLen = root.length;
          break;
        }
      }
      if (pos >= 0) break;
    }
  }
  if (pos < 0) {
    const snip = text.slice(0, width).trim();
    return text.length > width ? snip + "…" : snip;
  }
  const start = Math.max(0, pos - 70);
  const end = Math.min(text.length, pos + matchLen + width - 70);
  let snip = text.slice(start, end).trim();
  if (start > 0) snip = "…" + snip;
  if (end < text.length) snip = snip + "…";
  return snip;
}

export function snippetIsGeneric(snip) {
  const s = snip.toLowerCase().replace(/…/g, "").trim();
  return GENERIC.some((m) => s.includes(m));
}

export function buildDocSnippet(q, title, section, body, matchIn) {
  if (matchIn === "title" || matchIn === "section") return "";
  return extractSnippet(body, q);
}

export function titleHighlightPart(title, q) {
  const parts = title.split(/\s*·\s*/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (textHitsQuery(q, part)) return part;
  }
  return parts[0] || title;
}

export function titleShort(title) {
  const parts = title.split(/\s*·\s*/).map((p) => p.trim()).filter(Boolean);
  return parts[0] || title;
}

export function keywordBoostScore(q, base, title, text) {
  const tokens = queryTokens(q);
  if (!tokens.length) return base;
  const hay = `${title} ${text}`.toLowerCase();
  const hits = tokens.filter((t) => hay.includes(t)).length;
  return base + 0.08 * hits;
}

export function parseStructuredAnswer(raw) {
  const text = (raw || "").trim();
  const mSummary = text.match(/##\s*Кратко\s*([\s\S]*?)(?=##\s*Подробнее|$)/i);
  const mDetail = text.match(/##\s*Подробнее\s*([\s\S]*)$/i);
  const summary = mSummary ? mSummary[1].trim() : "";
  const detail = mDetail ? mDetail[1].trim() : "";
  if (summary || detail) {
    return [summary, detail, `## Кратко\n\n${summary}\n\n## Подробнее\n\n${detail}`.trim()];
  }
  return [text, "", text];
}
