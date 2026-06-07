export default async (request, context) => {
  const base = (Netlify.env.get("API_PROXY_URL") || "").replace(/\/$/, "");
  if (!base) {
    return new Response("API_PROXY_URL is not configured on Netlify", { status: 503 });
  }
  const url = new URL(request.url);
  const target = `${base}${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  const init = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }
  return fetch(target, init);
};
