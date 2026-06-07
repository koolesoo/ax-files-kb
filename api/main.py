"""ax.files demo API: documents catalog, semantic search, RAG answers."""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

SYNTHETIC_PATH = ROOT / "data" / "synthetic.json"
INDEX_PATH = ROOT / "data" / "index.json"
VECTORIZER_PATH = ROOT / "data" / "vectorizer.joblib"

CHAT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
EMBED_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
SCORE_THRESHOLD = float(os.getenv("RAG_SCORE_THRESHOLD", "0.32"))
ASK_MIN_SCORE = float(os.getenv("RAG_ASK_MIN_SCORE", "0.12"))
TOP_K = 8
ASK_TOP_K = 5

app = FastAPI(
    title="ax.files Demo API",
    description="Поиск и умные ответы по синтетической базе знаний",
    version="0.1.0",
)

def _cors_origins() -> list[str]:
    if os.getenv("NETLIFY") or os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        return ["*"]
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3080",
    )
    return [o.strip() for o in raw.split(",") if o.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AskRequest(BaseModel):
    question: str = Field(min_length=2, max_length=2000)


class AskResponse(BaseModel):
    answer: str
    summary: str = ""
    detail: str = ""
    sources: list[dict[str, Any]]
    confidence: str


class SearchResponse(BaseModel):
    query: str
    documents: list[dict[str, Any]]
    experts: list[dict[str, Any]]
    mentions: list[dict[str, Any]]


class Corpus:
    def __init__(self) -> None:
        self.documents: list[dict] = []
        self.experts: list[dict] = []
        self.items: list[dict] = []
        self.matrix: np.ndarray | None = None
        self.index_model: str = ""
        self._vectorizer: Any = None
        self.reload()

    def reload(self) -> None:
        if SYNTHETIC_PATH.exists():
            data = json.loads(SYNTHETIC_PATH.read_text(encoding="utf-8"))
            self.documents = data.get("documents", [])
            self.experts = data.get("experts", [])
        if INDEX_PATH.exists():
            idx = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
            self.index_model = idx.get("model", "openai")
            self.items = idx.get("items", [])
            if self.index_model == "local-tfidf" and VECTORIZER_PATH.exists():
                import joblib

                self._vectorizer = joblib.load(VECTORIZER_PATH)
            if self.items:
                self.matrix = np.array([it["embedding"] for it in self.items], dtype=np.float32)
                norms = np.linalg.norm(self.matrix, axis=1, keepdims=True)
                norms[norms == 0] = 1
                self.matrix = self.matrix / norms
            else:
                self.matrix = None
        else:
            self.items = []
            self.matrix = None
            self.index_model = ""

    def embed_query(self, client: OpenAI | None, q: str) -> np.ndarray:
        if self.index_model == "local-tfidf" and self._vectorizer is not None:
            row = self._vectorizer.transform([q]).toarray()[0].astype(np.float32)
            n = np.linalg.norm(row)
            return row / n if n > 0 else row
        if client is None:
            raise HTTPException(503, "OPENAI_API_KEY не задан для этого индекса")
        resp = client.embeddings.create(model=EMBED_MODEL, input=q)
        vec = np.array(resp.data[0].embedding, dtype=np.float32)
        n = np.linalg.norm(vec)
        return vec / n if n > 0 else vec

    def score_threshold(self) -> float:
        if self.index_model == "local-tfidf":
            return float(os.getenv("RAG_SCORE_THRESHOLD_LOCAL", "0.06"))
        return SCORE_THRESHOLD

    def search_items(self, query_vec: np.ndarray, item_type: str | None, limit: int) -> list[tuple[dict, float]]:
        if self.matrix is None or not self.items:
            return []
        scores = self.matrix @ query_vec
        ranked = []
        for i, score in enumerate(scores):
            it = self.items[i]
            if item_type and it.get("type") != item_type:
                continue
            ranked.append((it, float(score)))
        ranked.sort(key=lambda x: x[1], reverse=True)
        return ranked[:limit]

    def keyword_boost(self, q: str, base_score: float, title: str, text: str) -> float:
        tokens = [t for t in re.split(r"\W+", q.lower()) if len(t) > 2]
        if not tokens:
            return base_score
        hay = f"{title} {text}".lower()
        hits = sum(1 for t in tokens if t in hay)
        return base_score + 0.08 * hits

    def experts_matching_query(self, q: str) -> list[dict]:
        qn = q.strip().lower()
        if len(qn) < 3:
            return []
        stop = {
            "кто",
            "такая",
            "такой",
            "такое",
            "такие",
            "это",
            "что",
            "какой",
            "какая",
            "какие",
            "где",
            "когда",
            "зачем",
            "почему",
            "расскажи",
            "покажи",
            "найди",
            "есть",
            "ли",
        }
        matched: list[dict] = []
        for exp in self.experts:
            name = exp["name"].lower()
            parts = [p for p in name.split() if len(p) > 2]
            if name in qn or qn in name:
                matched.append(exp)
                continue
            if len(parts) >= 2 and all(p in qn for p in parts):
                matched.append(exp)
                continue
            # Одно имя/фамилия, если в запросе нет другой фамилии эксперта
            hits = [p for p in parts if p in qn and p not in stop]
            if len(hits) == 1:
                other = [e for e in self.experts if e["id"] != exp["id"] and hits[0] in e["name"].lower()]
                if not other:
                    matched.append(exp)
        return matched


def filter_ranked(
    ranked: list[tuple[dict, float]],
    *,
    min_relative: float = 0.35,
    floor: float = 0.04,
    max_items: int = 6,
) -> list[tuple[dict, float]]:
    if not ranked:
        return []
    top = ranked[0][1]
    if top <= 0:
        return []
    cutoff = max(floor, top * min_relative)
    out = [(it, sc) for it, sc in ranked if sc >= cutoff]
    return out[:max_items]


def query_tokens(q: str) -> list[str]:
    tokens = [t for t in re.split(r"\W+", q.lower()) if len(t) > 2]
    qn = q.strip().lower()
    if len(qn) >= 3 and qn not in tokens:
        tokens.insert(0, qn)
    return tokens


def stem_roots(token: str) -> list[str]:
    """Корень для русских словоформ: вебинары → вебинар."""
    if len(token) < 5:
        return [token]
    roots = {token}
    if len(token) >= 7:
        roots.add(token[:6])
    if len(token) >= 6:
        roots.add(token[:5])
    return list(roots)


def text_hits_query(q: str, hay: str) -> bool:
    if not hay:
        return False
    hay_l = hay.lower()
    qn = q.strip().lower()
    if len(qn) >= 3 and qn in hay_l:
        return True
    for token in query_tokens(q):
        for root in stem_roots(token):
            if root in hay_l:
                return True
    return False


def classify_match(q: str, title: str, section: str, text: str) -> tuple[int, str]:
    """Приоритет: название (3) → раздел (2) → текст (1) → только семантика (0)."""
    if text_hits_query(q, title):
        return 3, "title"
    if text_hits_query(q, section or ""):
        return 2, "section"
    if text_hits_query(q, text):
        return 1, "content"
    return 0, "semantic"


def extract_snippet(text: str, q: str, width: int = 220) -> str:
    """Фрагмент текста вокруг первого вхождения запроса (с учётом словоформ)."""
    text_l = text.lower()
    pos = -1
    match_len = 3
    qn = q.strip().lower()
    if len(qn) >= 3:
        i = text_l.find(qn)
        if i >= 0:
            pos, match_len = i, len(qn)
    if pos < 0:
        for token in query_tokens(q):
            for root in stem_roots(token):
                i = text_l.find(root)
                if i >= 0:
                    pos, match_len = i, len(root)
                    break
            if pos >= 0:
                break
    if pos < 0:
        snip = text[:width].strip()
        return (snip + "…") if len(text) > width else snip
    start = max(0, pos - 70)
    end = min(len(text), pos + match_len + width - 70)
    snip = text[start:end].strip()
    if start > 0:
        snip = "…" + snip
    if end < len(text):
        snip = snip + "…"
    return snip


def title_highlight_part(title: str, q: str) -> str:
    """Часть названия для UI: сегмент после «·», где есть совпадение, или целиком."""
    parts = [p.strip() for p in re.split(r"\s*·\s*", title) if p.strip()]
    for part in parts:
        if text_hits_query(q, part):
            return part
    return parts[0] if parts else title


# Общие абзацы из generate_synthetic — дают ложные совпадения «в тексте»
GENERIC_BODY_MARKERS = (
    "вебинары записываются и индексируются",
    "интеграция с crm позволяет подтягивать",
    "команды используют ax.files как единую",
    "умные ответы строятся только на одобренных",
    "поиск учитывает синонимы тегов",
)


def snippet_is_generic(snip: str) -> bool:
    s = snip.lower().replace("…", "").strip()
    return any(m in s for m in GENERIC_BODY_MARKERS)


def build_doc_snippet(q: str, title: str, section: str, body: str, match_in: str) -> str:
    """Фрагмент тела — только для совпадения в тексте (название/раздел в UI отдельно)."""
    if match_in in ("title", "section"):
        return ""
    return extract_snippet(body, q)


def classify_expert_match(q: str, name: str, role: str, bio: str) -> tuple[int, str]:
    if text_hits_query(q, role):
        return 3, "role"
    if text_hits_query(q, name):
        return 3, "name"
    if text_hits_query(q, bio):
        return 1, "content"
    return 0, "semantic"


def keyword_boost_score(q: str, base_score: float, title: str, text: str) -> float:
    tokens = query_tokens(q)
    if not tokens:
        return base_score
    hay = f"{title} {text}".lower()
    hits = sum(1 for t in tokens if t in hay)
    return base_score + 0.08 * hits


corpus = Corpus()
_openai: OpenAI | None = None


def get_openai() -> OpenAI:
    global _openai
    if _openai is None:
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            raise HTTPException(503, "OPENAI_API_KEY не задан")
        _openai = OpenAI(api_key=key)
    return _openai


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "documents": len(corpus.documents),
        "index_items": len(corpus.items),
    }


DOC_TYPE_MATERIAL = {
    "policy": "Проектные материалы",
    "spec": "Проектные материалы",
    "presentation": "Ассеты",
    "video": "Ассеты",
    "case": "Кейсы",
    "checklist": "Исследования",
    "doc": "Исследования",
}

DOC_TYPE_EXT = {
    "policy": "pdf",
    "spec": "docx",
    "presentation": "pptx",
    "video": "mp4",
    "case": "pdf",
    "checklist": "xlsx",
    "doc": "pdf",
}


def doc_author(doc: dict) -> str:
    body = doc.get("body", "")
    for exp in corpus.experts:
        if exp["name"] in body:
            return exp["name"]
    if corpus.experts:
        return corpus.experts[sum(ord(c) for c in doc.get("id", "")) % len(corpus.experts)]["name"]
    return "—"


def serialize_document(doc: dict) -> dict:
    excerpt = doc["body"][:220] + "…" if len(doc["body"]) > 220 else doc["body"]
    dt = doc.get("doc_type", "doc")
    return {
        "id": doc["id"],
        "title": doc["title"],
        "section": doc["section"],
        "doc_type": dt,
        "material_type": DOC_TYPE_MATERIAL.get(dt, "Проектные материалы"),
        "file_ext": DOC_TYPE_EXT.get(dt, "pdf"),
        "tags": doc.get("tags", []),
        "updated_at": doc.get("updated_at", ""),
        "author": doc_author(doc),
        "excerpt": excerpt,
    }


@app.get("/api/documents")
def list_documents() -> dict:
    from collections import Counter

    sections: dict[str, list] = {}
    flat: list[dict] = []
    tag_counts: Counter[str] = Counter()
    for doc in corpus.documents:
        item = serialize_document(doc)
        flat.append(item)
        sections.setdefault(doc["section"], []).append(item)
        for tag in item["tags"]:
            tag_counts[tag] += 1

    flat.sort(key=lambda d: d.get("updated_at", ""), reverse=True)
    topics = sorted({d["section"] for d in flat})
    material_types = list(dict.fromkeys(DOC_TYPE_MATERIAL.values()))

    expert_rows = []
    for exp in corpus.experts:
        name = exp["name"]
        doc_count = sum(1 for d in corpus.documents if name in d.get("body", ""))
        expert_rows.append(
            {
                "id": exp["id"],
                "name": name,
                "role": exp.get("role", ""),
                "avatar": exp.get("avatar", ""),
                "doc_count": max(doc_count, 1),
            }
        )
    expert_rows.sort(key=lambda x: -x["doc_count"])

    n_docs = len(flat)
    return {
        "stats": {
            "documents": n_docs,
            "projects": max(1, n_docs * 43),
            "experts": len(corpus.experts),
            "topics": len(topics),
            "week_new": max(1, n_docs // 5),
        },
        "material_types": material_types,
        "topics": topics,
        "popular_tags": [t for t, _ in tag_counts.most_common(14)],
        "experts": expert_rows[:6],
        "collections": [
            {"id": "c1", "title": "Операционная модель 2025", "count": 24, "icon": "folder"},
            {"id": "c2", "title": "Кейсы внедрения ax.files", "count": 18, "icon": "doc"},
            {"id": "c3", "title": "Избранное команды", "count": 12, "icon": "star"},
            {"id": "c4", "title": "Недавно обновлённые", "count": 9, "icon": "clock"},
        ],
        "recent": flat[:5],
        "documents": flat,
        "sections": [{"name": k, "documents": v} for k, v in sections.items()],
    }


@app.get("/api/search", response_model=SearchResponse)
def search(q: str = Query(min_length=1, max_length=500), limit: int = Query(6, ge=1, le=20)) -> SearchResponse:
    q = q.strip()
    if not q:
        raise HTTPException(400, "Пустой запрос")

    if corpus.matrix is None:
        raise HTTPException(503, "Индекс не найден. Запустите: npm run index")

    client = get_openai() if corpus.index_model != "local-tfidf" else None
    qvec = corpus.embed_query(client, q)
    doc_meta = {d["id"]: d for d in corpus.documents}
    matched_experts = corpus.experts_matching_query(q)
    matched_ids = {e["id"] for e in matched_experts}
    person_search = len(matched_experts) > 0

    # --- Документы (сначала совпадение в названии, затем в разделе, затем в тексте) ---
    chunk_scored: list[tuple[dict, float, int, str]] = []
    for it, score in corpus.search_items(qvec, "chunk", limit * 5):
        section = it.get("section", "")
        priority, match_in = classify_match(q, it["title"], section, it["text"])
        tier_boost = {3: 0.65, 2: 0.45, 1: 0.22, 0: 0.0}[priority]
        boosted = keyword_boost_score(q, score + tier_boost, it["title"], it["text"])

        if person_search:
            names = " ".join(e["name"] for e in matched_experts).lower()
            if names not in it["text"].lower() and names not in it["title"].lower():
                if boosted < 0.12:
                    continue
        elif priority == 0 and boosted < 0.1:
            continue
        elif priority == 1 and not text_hits_query(q, it["title"]) and not text_hits_query(q, section):
            snip_probe = extract_snippet(it["text"], q)
            if snippet_is_generic(snip_probe):
                boosted *= 0.45

        chunk_scored.append((it, boosted, priority, match_in))

    chunk_scored.sort(key=lambda x: (-x[2], -x[1]))
    chunk_scored = [
        (it, sc, pr, mi)
        for it, sc, pr, mi in chunk_scored
        if sc >= max(0.05, (chunk_scored[0][1] if chunk_scored else 0) * 0.3)
    ][: limit * 2]

    doc_hits: dict[str, dict] = {}
    chunks_by_doc: dict[str, list[tuple[dict, float, int, str]]] = {}
    for it, boosted, priority, match_in in chunk_scored:
        chunks_by_doc.setdefault(it["document_id"], []).append((it, boosted, priority, match_in))

    for did, chunks in chunks_by_doc.items():
        def chunk_key(item: tuple[dict, float, int, str]) -> tuple:
            it, boosted, priority, match_in = item
            snip = extract_snippet(it["text"], q)
            has_snip = text_hits_query(q, snip)
            return (priority, 1 if has_snip else 0, boosted)

        best_it, boosted, priority, match_in = max(chunks, key=chunk_key)
        section = best_it.get("section", "")
        full_title = best_it["title"]
        snippet = build_doc_snippet(q, full_title, section, best_it["text"], match_in)

        if match_in == "content":
            if not text_hits_query(q, snippet):
                better = [
                    c
                    for c in chunks
                    if text_hits_query(q, build_doc_snippet(q, c[0]["title"], c[0].get("section", ""), c[0]["text"], c[3]))
                ]
                if better:
                    best_it, boosted, priority, match_in = max(better, key=chunk_key)
                    snippet = build_doc_snippet(q, best_it["title"], best_it.get("section", ""), best_it["text"], match_in)
                elif priority < 2:
                    continue
            elif snippet_is_generic(snippet) and not text_hits_query(q, full_title):
                continue

        src = doc_meta.get(did, {})
        dt = src.get("doc_type", best_it.get("doc_type", "doc"))
        doc_hits[did] = {
            "id": did,
            "title": full_title,
            "title_hit": title_highlight_part(full_title, q),
            "section": section,
            "tags": src.get("tags", []),
            "doc_type": dt,
            "material_type": DOC_TYPE_MATERIAL.get(dt, "Проектные материалы"),
            "file_ext": DOC_TYPE_EXT.get(dt, "pdf"),
            "updated_at": src.get("updated_at", ""),
            "author": doc_author(src) if src else "—",
            "excerpt": src.get("body", best_it["text"])[:220],
            "snippet": snippet,
            "match_in": match_in,
            "match_priority": priority,
            "score": round(boosted, 4),
        }

    documents = sorted(
        doc_hits.values(),
        key=lambda x: (-x["match_priority"], -x["score"]),
    )

    # Убрать дубли шаблонных сниппетов; ограничить «в тексте», если есть попадания в названии
    seen_snip: set[str] = set()
    deduped: list[dict] = []
    title_hits = sum(1 for d in documents if d["match_priority"] >= 3)
    section_hits = sum(1 for d in documents if d["match_priority"] == 2)
    content_cap = 2 if title_hits + section_hits >= 2 else 4
    content_count = 0
    for doc in documents:
        if doc["match_priority"] == 1:
            if content_count >= content_cap:
                continue
            key = doc["snippet"][:70].lower().replace("…", "").strip()
            if key in seen_snip:
                continue
            seen_snip.add(key)
            content_count += 1
        deduped.append(doc)
    documents = deduped[:limit]

    # --- Эксперты ---
    if person_search:
        experts = [
            {
                "id": e["id"],
                "name": e["name"],
                "role": e.get("role", ""),
                "avatar": e.get("avatar", ""),
                "snippet": e.get("bio", "")[:200],
                "score": 1.0,
            }
            for e in matched_experts[:limit]
        ]
    else:
        expert_scored: list[tuple[dict, float, int, str]] = []
        for it, score in corpus.search_items(qvec, "expert", limit * 2):
            name = it.get("name", "")
            role = it.get("role", "")
            priority, match_in = classify_expert_match(q, name, role, it["text"])
            tier_boost = {3: 0.65, 2: 0.45, 1: 0.22, 0: 0.0}[priority]
            boosted = keyword_boost_score(q, score + tier_boost, name, it["text"])
            if priority == 0 and boosted < 0.08:
                continue
            if priority == 1 and not person_search:
                continue
            expert_scored.append((it, boosted, priority, match_in))
        expert_scored.sort(key=lambda x: (-x[2], -x[1]))
        if expert_scored:
            top_sc = expert_scored[0][1]
            expert_scored = [x for x in expert_scored if x[1] >= max(0.06, top_sc * 0.35)][:limit]
        experts = [
            {
                "id": it["expert_id"],
                "name": it["name"],
                "role": it.get("role", ""),
                "avatar": it.get("avatar", ""),
                "snippet": extract_snippet(it["text"], q) if mi == "content" else "",
                "match_in": mi,
                "score": round(sc, 4),
            }
            for it, sc, _, mi in expert_scored[:3]
        ]

    # --- Упоминания ---
    mention_scored: list[tuple[dict, float, int, str]] = []
    for it, score in corpus.search_items(qvec, "mention", limit * 3):
        if person_search and it.get("expert_id") not in matched_ids:
            continue
        priority, match_in = classify_match(
            q, it.get("document_title", ""), it.get("expert_name", ""), it["text"]
        )
        tier_boost = {3: 0.65, 2: 0.45, 1: 0.22, 0: 0.0}[priority]
        boosted = keyword_boost_score(
            q, score + tier_boost, it.get("document_title", ""), it["text"]
        )
        if priority == 0 and boosted < 0.08:
            continue
        mention_scored.append((it, boosted, priority, match_in))
    mention_scored.sort(key=lambda x: (-x[2], -x[1]))
    if mention_scored:
        top_m = mention_scored[0][1]
        mention_scored = [
            x for x in mention_scored if x[1] >= max(0.06, top_m * (0.5 if person_search else 0.35))
        ][:limit]
    seen_mention_docs: set[str] = set()
    mentions = []
    for it, sc, _, mi in mention_scored:
        if it["document_id"] in seen_mention_docs:
            continue
        snip = extract_snippet(it["text"], q)
        if not text_hits_query(q, snip):
            continue
        seen_mention_docs.add(it["document_id"])
        src = doc_meta.get(it["document_id"], {})
        mentions.append(
            {
                "expert_id": it["expert_id"],
                "expert_name": it["expert_name"],
                "document_id": it["document_id"],
                "document_title": it["document_title"],
                "section": src.get("section", ""),
                "tags": src.get("tags", []),
                "snippet": snip,
                "match_in": mi,
                "score": round(sc, 4),
            }
        )
        if len(mentions) >= min(limit, 4):
            break

    return SearchResponse(query=q, documents=documents, experts=experts, mentions=mentions)


def title_short(title: str) -> str:
    parts = [p.strip() for p in re.split(r"\s*·\s*", title) if p.strip()]
    return parts[0] if parts else title


def _ask_context_label(kind: str, it: dict) -> str:
    if kind == "expert_profile":
        return f"Профиль эксперта: {it.get('name', '')}"
    if kind == "expert":
        return f"Эксперт: {it.get('name', '')} — {it.get('role', '')}"
    if kind == "mention":
        return f"Упоминание: {it.get('expert_name', '')} в «{title_short(it.get('document_title', ''))}»"
    return title_short(it.get("title", "Документ"))


def _ask_context_body(kind: str, it: dict) -> str:
    if kind == "expert_profile":
        skills = ", ".join(it.get("skills", []))
        return (
            f"{it.get('name', '')}, {it.get('role', '')}, направление «{it.get('department', '')}». "
            f"Специализация: {skills}. {it.get('bio', '')}"
        ).strip()
    return it.get("_ask_text", it.get("text", ""))


def _build_ask_chunk_text(question: str, it: dict, doc_by_id: dict[str, dict]) -> tuple[str, int]:
    title = it.get("title", "")
    section = it.get("section", "")
    chunk_text = it.get("text", "")
    priority, _ = classify_match(question, title, section, chunk_text)

    full = doc_by_id.get(it.get("document_id", ""), {})
    body = full.get("body", chunk_text)

    if priority >= 3:
        paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
        relevant = [
            p
            for p in paragraphs
            if text_hits_query(question, p) and not snippet_is_generic(p)
        ]
        if not relevant:
            relevant = [p for p in paragraphs if not snippet_is_generic(p)]
        if not relevant:
            relevant = paragraphs
        intro = f"Документ «{title_short(title)}» (раздел: {section or '—'})."
        return intro + "\n\n" + "\n\n".join(relevant[:6]), priority

    snip = extract_snippet(body, question)
    if snippet_is_generic(snip) and priority < 2:
        return "", priority
    if not snip or (snippet_is_generic(snip) and priority < 1):
        snip = chunk_text
    return snip, priority


def gather_ask_context(
    question: str, qvec: np.ndarray
) -> tuple[list[tuple[dict, float, str, int]], float, bool]:
    """Собрать фрагменты для RAG с приоритетом совпадения в названии и без шаблонного шума."""
    doc_by_id = {d["id"]: d for d in corpus.documents}
    matched_experts = corpus.experts_matching_query(question)
    matched_ids = {e["id"] for e in matched_experts}
    person_search = len(matched_experts) > 0

    pool: list[tuple[dict, float, str, int]] = []

    for doc in corpus.documents:
        if text_hits_query(question, doc["title"]):
            text, priority = _build_ask_chunk_text(
                question,
                {
                    "document_id": doc["id"],
                    "title": doc["title"],
                    "section": doc.get("section", ""),
                    "text": doc.get("body", "")[:400],
                },
                doc_by_id,
            )
            if text:
                pool.append(
                    (
                        {
                            "document_id": doc["id"],
                            "title": doc["title"],
                            "section": doc.get("section", ""),
                            "_ask_text": text,
                        },
                        0.92,
                        "chunk",
                        priority,
                    )
                )

    for it, sc in corpus.search_items(qvec, "chunk", ASK_TOP_K * 3):
        text, priority = _build_ask_chunk_text(question, it, doc_by_id)
        if not text and priority < 2:
            continue
        tier = {3: 0.5, 2: 0.32, 1: 0.12, 0: 0.0}[priority]
        boosted = keyword_boost_score(question, sc + tier, it["title"], text)
        if snippet_is_generic(text) and priority < 3:
            boosted *= 0.4
        it = {**it, "_ask_text": text}
        pool.append((it, boosted, "chunk", priority))

    for it, sc in corpus.search_items(qvec, "expert", 4):
        if person_search and it.get("expert_id") not in matched_ids:
            continue
        name = it.get("name", "")
        role = it.get("role", "")
        boosted = keyword_boost_score(question, sc, f"{name} {role}", it["text"])
        pool.append((it, boosted, "expert", 3 if text_hits_query(question, role) else 1))

    for it, sc in corpus.search_items(qvec, "mention", 6):
        if person_search and it.get("expert_id") not in matched_ids:
            continue
        title = it.get("document_title", "")
        boosted = keyword_boost_score(question, sc, title, it["text"])
        if snippet_is_generic(it["text"]) and not text_hits_query(question, title):
            boosted *= 0.45
        pool.append((it, boosted, "mention", 2 if text_hits_query(question, title) else 1))

    for exp in matched_experts:
        pool.append((exp, 0.99, "expert_profile", 3))

    pool.sort(key=lambda x: (-x[3], -x[1]))

    floor = ASK_MIN_SCORE if corpus.index_model != "local-tfidf" else float(
        os.getenv("RAG_ASK_MIN_SCORE_LOCAL", "0.04")
    )

    selected: list[tuple[dict, float, str, int]] = []
    seen_keys: set[str] = set()
    seen_doc: set[str] = set()
    title_hit_seen = False
    semantic_only = 0
    mention_count = 0

    for it, sc, kind, priority in pool:
        if kind == "expert_profile":
            key = f"profile:{it.get('id', '')}"
        elif kind == "expert":
            key = f"expert:{it.get('expert_id', '')}"
        elif kind == "mention":
            key = f"mention:{it.get('document_id', '')}:{it.get('expert_id', '')}"
        else:
            did = it.get("document_id", "")
            if did in seen_doc:
                continue
            seen_doc.add(did)
            key = f"chunk:{did}"

        if key in seen_keys:
            continue
        if kind == "mention" and title_hit_seen and mention_count >= 1:
            continue
        if kind == "mention" and snippet_is_generic(it.get("text", "")) and priority < 2:
            continue

        if sc < floor and priority < 2 and not person_search:
            continue
        if priority == 0 and title_hit_seen and semantic_only >= 1:
            continue
        if priority >= 3:
            title_hit_seen = True
        if priority == 0:
            semantic_only += 1
        if kind == "mention":
            mention_count += 1

        seen_keys.add(key)
        selected.append((it, sc, kind, priority))
        if len(selected) >= ASK_TOP_K:
            break

    if not selected and pool:
        for row in pool[:3]:
            selected.append(row)

    max_score = selected[0][1] if selected else (pool[0][1] if pool else 0.0)
    has_title_hit = any(p >= 3 for _, _, _, p in selected)
    return selected, max_score, has_title_hit


def parse_structured_answer(raw: str) -> tuple[str, str, str]:
    """Разобрать ответ модели на краткий и подробный блоки."""
    text = (raw or "").strip()
    m_summary = re.search(r"##\s*Кратко\s*(.*?)(?=##\s*Подробнее|$)", text, re.S | re.I)
    m_detail = re.search(r"##\s*Подробнее\s*(.*)$", text, re.S | re.I)
    summary = (m_summary.group(1).strip() if m_summary else "")
    detail = (m_detail.group(1).strip() if m_detail else "")
    if summary or detail:
        full = f"## Кратко\n\n{summary}\n\n## Подробнее\n\n{detail}".strip()
        return summary, detail, full
    return text, "", text


@app.post("/api/ask", response_model=AskResponse)
def ask(body: AskRequest) -> AskResponse:
    question = body.question.strip()
    if corpus.matrix is None:
        raise HTTPException(503, "Индекс не найден. Запустите: npm run index")

    client = get_openai()
    qvec = corpus.embed_query(
        client if corpus.index_model != "local-tfidf" else None, question
    )
    selected, max_score, has_title_hit = gather_ask_context(question, qvec)
    threshold = corpus.score_threshold()
    floor = ASK_MIN_SCORE if corpus.index_model != "local-tfidf" else float(os.getenv("RAG_ASK_MIN_SCORE_LOCAL", "0.04"))

    if not selected or max_score < floor * 0.5:
        return AskResponse(
            answer="В базе знаний не нашлось достаточно релевантных материалов по вашему вопросу. Попробуйте переформулировать запрос или воспользуйтесь поиском.",
            summary="",
            detail="",
            sources=[],
            confidence="low",
        )

    doc_by_id = {d["id"]: d for d in corpus.documents}
    context_parts = []
    sources = []
    for n, (it, sc, kind, priority) in enumerate(selected, start=1):
        label = _ask_context_label(kind, it)
        body = _ask_context_body(kind, it)
        context_parts.append(f"[{n}] {label}\n{body}")
        doc_title = title_short(it.get("title", "")) if kind == "chunk" else label
        src: dict[str, Any] = {
            "title": doc_title,
            "quote": body[:360],
            "score": round(sc, 4),
            "ref": n,
            "kind": kind,
            "match_priority": priority,
        }
        if kind == "chunk":
            src["document_id"] = it["document_id"]
            src["chunk_index"] = it.get("chunk_index", 0)
            src["document_title"] = it.get("title", doc_title)
        elif kind in ("expert", "expert_profile"):
            src["expert_id"] = it.get("id") or it.get("expert_id", "")
        elif kind == "mention":
            src["document_id"] = it.get("document_id", "")
            src["expert_id"] = it.get("expert_id", "")
            src["document_title"] = title_short(it.get("document_title", ""))
        did = src.get("document_id", "")
        if did and did in doc_by_id:
            meta = serialize_document(doc_by_id[did])
            src.update(
                {
                    "file_ext": meta["file_ext"],
                    "material_type": meta["material_type"],
                    "author": meta["author"],
                    "updated_at": meta["updated_at"],
                    "tags": meta["tags"],
                    "section": meta["section"],
                }
            )
        sources.append(src)

    weak = max_score < threshold and not has_title_hit
    system = (
        "Ты ассистент корпоративной базы знаний ax.files. Отвечай только на основе контекста, на русском.\n\n"
        "Формат ответа (строго):\n"
        "## Кратко\n"
        "2–4 предложения: прямой ответ на вопрос. Если детальных требований в тексте нет — скажи честно, "
        "но перечисли, что всё же известно из базы (например, про индексацию вебинаров).\n\n"
        "## Подробнее\n"
        "Развёрнутый ответ (минимум 6–10 предложений): по пунктам, с деталями из контекста. "
        "Ссылайся на источники [1][2] в конце соответствующих абзацев.\n\n"
        "Правила:\n"
        "- Документ с названием по теме вопроса — главный источник; в подробном ответе в первую очередь ссылайся на [1].\n"
        "- Не пиши «в базе нет данных», если в контексте есть хоть частичная информация по теме.\n"
        "- Не выдумывай требования, цифры и процедуры, которых нет в контексте.\n"
        "- Для вопросов «кто такой/такая …» опирайся на профиль эксперта."
    )
    if weak:
        system += "\n- Релевантность источников может быть невысокой — будь осторожен."
    user = f"Контекст:\n\n" + "\n\n---\n\n".join(context_parts) + f"\n\nВопрос: {question}"

    completion = client.chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.35,
        max_tokens=900,
    )
    raw_answer = completion.choices[0].message.content or ""
    summary, detail, answer = parse_structured_answer(raw_answer)

    if max_score >= threshold + 0.05 or has_title_hit:
        confidence = "high" if max_score >= threshold else "medium"
    elif max_score >= floor:
        confidence = "medium" if not weak else "low"
    else:
        confidence = "low"

    return AskResponse(answer=answer, summary=summary, detail=detail, sources=sources, confidence=confidence)
