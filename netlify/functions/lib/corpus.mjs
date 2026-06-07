import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));

function readData(name) {
  const candidates = [
    join(process.cwd(), "data", name),
    join(here, "..", "..", "..", "data", name),
    join(here, "..", "..", "data", name),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  throw new Error(`data/${name} не найден`);
}

let cache = null;

export function getCorpus() {
  if (cache) return cache;
  const synthetic = JSON.parse(readData("synthetic.json"));
  const index = JSON.parse(readData("index.json"));
  const items = index.items || [];
  const matrix = items.map((it) => {
    const emb = it.embedding;
    const n = Math.sqrt(emb.reduce((s, x) => s + x * x, 0)) || 1;
    return emb.map((x) => x / n);
  });
  cache = {
    documents: synthetic.documents || [],
    experts: synthetic.experts || [],
    items,
    matrix,
    indexModel: index.model || "openai",
  };
  return cache;
}

export function searchItems(corpus, queryVec, itemType, limit) {
  const scored = [];
  for (let i = 0; i < corpus.items.length; i++) {
    const it = corpus.items[i];
    if (itemType && it.type !== itemType) continue;
    const row = corpus.matrix[i];
    let score = 0;
    for (let j = 0; j < queryVec.length; j++) score += row[j] * queryVec[j];
    scored.push([it, score]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, limit);
}

const STOP = new Set([
  "кто", "такая", "такой", "такое", "такие", "это", "что", "какой", "какая", "какие",
  "где", "когда", "зачем", "почему", "расскажи", "покажи", "найди", "есть", "ли",
]);

export function expertsMatchingQuery(corpus, q) {
  const qn = q.trim().toLowerCase();
  if (qn.length < 3) return [];
  const matched = [];
  for (const exp of corpus.experts) {
    const name = exp.name.toLowerCase();
    const parts = name.split(/\s+/).filter((p) => p.length > 2);
    if (name.includes(qn) || qn.includes(name)) {
      matched.push(exp);
      continue;
    }
    if (parts.length >= 2 && parts.every((p) => qn.includes(p))) {
      matched.push(exp);
      continue;
    }
    const hits = parts.filter((p) => qn.includes(p) && !STOP.has(p));
    if (hits.length === 1) {
      const other = corpus.experts.filter(
        (e) => e.id !== exp.id && e.name.toLowerCase().includes(hits[0])
      );
      if (!other.length) matched.push(exp);
    }
  }
  return matched;
}
