import { handleDocuments } from "./lib/documents.mjs";
import { handleSearch } from "./lib/search.mjs";
import { handleAsk } from "./lib/ask.mjs";
import { getCorpus } from "./lib/corpus.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

function err(message, status = 500) {
  return json({ detail: message }, status);
}

function apiPath(url) {
  let path = url.pathname;
  if (path.startsWith("/.netlify/functions/api")) {
    path = "/api" + path.slice("/.netlify/functions/api".length);
  }
  return path;
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(request.url);
  const path = apiPath(url);

  try {
    if (path === "/api/health") {
      const corpus = getCorpus();
      return json({ ok: true, documents: corpus.documents.length, index_items: corpus.items.length });
    }

    if (path === "/api/documents" && request.method === "GET") {
      return json(handleDocuments());
    }

    if (path === "/api/search" && request.method === "GET") {
      const q = (url.searchParams.get("q") || "").trim();
      if (!q) return err("Пустой запрос", 400);
      const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get("limit") || "6", 10)));
      return json(await handleSearch(q, limit));
    }

    if (path === "/api/ask" && request.method === "POST") {
      const body = await request.json();
      const question = (body.question || "").trim();
      if (question.length < 2) return err("Вопрос слишком короткий", 400);
      return json(await handleAsk(question));
    }

    return err("Not found", 404);
  } catch (e) {
    console.error(e);
    return err(e.message || "Internal error", e.message?.includes("OPENAI") ? 503 : 500);
  }
};
