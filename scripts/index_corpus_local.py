#!/usr/bin/env python3
"""Build search index locally (TF-IDF, no OpenAI). For demo search without API key."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

ROOT = Path(__file__).resolve().parents[1]
SYNTHETIC = ROOT / "data" / "synthetic.json"
OUT = ROOT / "data" / "index.json"
VECTORIZER_PATH = ROOT / "data" / "vectorizer.joblib"

CHUNK_SIZE = 700
CHUNK_OVERLAP = 120


def chunk_text(text: str) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        if len(current) + len(para) + 2 <= CHUNK_SIZE:
            current = f"{current}\n\n{para}".strip() if current else para
        else:
            if current:
                chunks.append(current)
            if len(para) <= CHUNK_SIZE:
                current = para
            else:
                for i in range(0, len(para), CHUNK_SIZE - CHUNK_OVERLAP):
                    chunks.append(para[i : i + CHUNK_SIZE])
                current = ""
    if current:
        chunks.append(current)
    return chunks or [text[:CHUNK_SIZE]]


def find_mentions(body: str, expert: dict) -> list[str]:
    name = expert["name"]
    snippets = []
    for m in re.finditer(re.escape(name), body, re.IGNORECASE):
        start = max(0, m.start() - 100)
        end = min(len(body), m.end() + 100)
        snippets.append(body[start:end].strip())
    return snippets


def main() -> None:
    if not SYNTHETIC.exists():
        print("Run generate_synthetic.py first.", file=sys.stderr)
        sys.exit(1)

    corpus = json.loads(SYNTHETIC.read_text(encoding="utf-8"))
    items_meta: list[dict] = []
    texts: list[str] = []

    for doc in corpus["documents"]:
        for i, ch in enumerate(chunk_text(doc["body"])):
            items_meta.append(
                {
                    "type": "chunk",
                    "document_id": doc["id"],
                    "title": doc["title"],
                    "section": doc["section"],
                    "doc_type": doc.get("doc_type", "doc"),
                    "chunk_index": i,
                    "text": ch,
                }
            )
            texts.append(f"{doc['title']}\n{ch}")

    for exp in corpus["experts"]:
        text = f"{exp['name']}. {exp['role']}. {exp['bio']}. Навыки: {', '.join(exp.get('skills', []))}"
        items_meta.append(
            {
                "type": "expert",
                "expert_id": exp["id"],
                "name": exp["name"],
                "role": exp["role"],
                "avatar": exp.get("avatar", ""),
                "text": text,
            }
        )
        texts.append(text)

    for doc in corpus["documents"]:
        for exp in corpus["experts"]:
            for snip in find_mentions(doc["body"], exp):
                mention_text = f"{exp['name']} упоминается в «{doc['title']}»: {snip}"
                items_meta.append(
                    {
                        "type": "mention",
                        "expert_id": exp["id"],
                        "expert_name": exp["name"],
                        "document_id": doc["id"],
                        "document_title": doc["title"],
                        "text": mention_text,
                    }
                )
                texts.append(mention_text)

    print(f"TF-IDF on {len(texts)} items...")
    vectorizer = TfidfVectorizer(max_features=2048, ngram_range=(1, 2), sublinear_tf=True)
    matrix = vectorizer.fit_transform(texts)

    items = []
    for i, meta in enumerate(items_meta):
        row = matrix.getrow(i).toarray()[0].astype(np.float32)
        items.append({**meta, "embedding": row.tolist()})

    VECTORIZER_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(vectorizer, VECTORIZER_PATH)
    OUT.write_text(
        json.dumps({"model": "local-tfidf", "items": items}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Wrote {len(items)} items → {OUT}")
    print(f"Vectorizer → {VECTORIZER_PATH}")


if __name__ == "__main__":
    main()
