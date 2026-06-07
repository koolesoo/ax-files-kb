function norm(vec) {
  const n = Math.sqrt(vec.reduce((s, x) => s + x * x, 0));
  return n > 0 ? vec.map((x) => x / n) : vec;
}

export async function embedQuery(text) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY не задан");
  const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: text }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || res.statusText);
  return norm(data.data[0].embedding);
}

export async function chatCompletion(messages) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY не задан");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 900,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || res.statusText);
  return data.choices[0].message.content || "";
}
