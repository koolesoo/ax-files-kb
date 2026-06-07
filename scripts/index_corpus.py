#!/usr/bin/env python3
"""Build search index (embeddings) from synthetic.json → data/index.json."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

ROOT = Path(__file__).resolve().parents[1]
SYNTHETIC = ROOT / "data" / "synthetic.json"
OUT = ROOT / "data" / "index.json"

CHUNK_SIZE = 700
CHUNK_OVERLAP = 120
EMBED_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
BATCH = 64


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


def embed_batch(client: OpenAI, texts: list[str]) -> list[list[float]]:
    resp = client.embeddings.create(model=EMBED_MODEL, input=texts)
    return [d.embedding for d in sorted(resp.data, key=lambda x: x.index)]


def find_mentions(body: str, expert: dict) -> list[str]:
    name = expert["name"]
    snippets = []
    for m in re.finditer(re.escape(name), body, re.IGNORECASE):
        start = max(0, m.start() - 100)
        end = min(len(body), m.end() + 100)
        snippets.append(body[start:end].strip())
    return snippets


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rebuild", action="store_true")
    args = parser.parse_args()

    load_dotenv(ROOT / ".env")
    if not SYNTHETIC.exists():
        print("Run generate_synthetic.py first.", file=sys.stderr)
        sys.exit(1)
    if OUT.exists() and not args.rebuild:
        print(f"{OUT} exists; use --rebuild to overwrite.")
        return

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    corpus = json.loads(SYNTHETIC.read_text(encoding="utf-8"))
    client = OpenAI(api_key=api_key)

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

    print(f"Embedding {len(texts)} items...")
    all_embeddings: list[list[float]] = []
    for i in range(0, len(texts), BATCH):
        batch = texts[i : i + BATCH]
        all_embeddings.extend(embed_batch(client, batch))
        print(f"  {min(i + BATCH, len(texts))}/{len(texts)}")

    items = []
    for meta, emb in zip(items_meta, all_embeddings):
        items.append({**meta, "embedding": emb})

    OUT.write_text(
        json.dumps({"model": EMBED_MODEL, "items": items}, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Wrote index with {len(items)} items → {OUT}")


if __name__ == "__main__":
    main()
