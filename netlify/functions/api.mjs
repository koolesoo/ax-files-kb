import { handleDocuments, handleDocumentDetail } from "./lib/documents.mjs";
import { handleProjects, handleProjectDetail } from "./lib/projects.mjs";
import { handleExperts, handleExpertDetail } from "./lib/experts.mjs";
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

    const docDetail = path.match(/^\/api\/documents\/([^/]+)$/);
    if (docDetail && request.method === "GET") {
      const detail = handleDocumentDetail(decodeURIComponent(docDetail[1]));
      if (!detail) return err("Документ не найден", 404);
      return json(detail);
    }

    if (path === "/api/projects" && request.method === "GET") {
      return json(handleProjects());
    }

    const projectDetail = path.match(/^\/api\/projects\/([^/]+)$/);
    if (projectDetail && request.method === "GET") {
      const detail = handleProjectDetail(decodeURIComponent(projectDetail[1]));
      if (!detail) return err("Проект не найден", 404);
      return json(detail);
    }

    const expertDetail = path.match(/^\/api\/experts\/([^/]+)$/);
    if (expertDetail && request.method === "GET") {
      const detail = handleExpertDetail(decodeURIComponent(expertDetail[1]));
      if (!detail) return err("Эксперт не найден", 404);
      return json(detail);
    }

    if (path === "/api/experts" && request.method === "GET") {
      return json(
        handleExperts({
          q: url.searchParams.get("q") || "",
          department: url.searchParams.get("department") || "",
          specialization: url.searchParams.get("specialization") || "",
          status: url.searchParams.get("status") || "",
          sort: url.searchParams.get("sort") || "activity",
          page: url.searchParams.get("page") || "1",
          limit: url.searchParams.get("limit") || "12",
        })
      );
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
