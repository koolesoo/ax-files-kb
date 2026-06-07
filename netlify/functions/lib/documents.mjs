import { getCorpus } from "./corpus.mjs";

const DOC_TYPE_MATERIAL = {
  policy: "Проектные материалы",
  spec: "Проектные материалы",
  presentation: "Ассеты",
  video: "Ассеты",
  case: "Кейсы",
  checklist: "Исследования",
  doc: "Исследования",
};

const DOC_TYPE_EXT = {
  policy: "pdf",
  spec: "docx",
  presentation: "pptx",
  video: "mp4",
  case: "pdf",
  checklist: "xlsx",
  doc: "pdf",
};

function docAuthor(doc, experts) {
  const body = doc.body || "";
  for (const exp of experts) {
    if (body.includes(exp.name)) return exp.name;
  }
  if (experts.length) {
    const n = [...(doc.id || "")].reduce((s, c) => s + c.charCodeAt(0), 0);
    return experts[n % experts.length].name;
  }
  return "—";
}

function serializeDocument(doc, experts) {
  const excerpt = doc.body.length > 220 ? doc.body.slice(0, 220) + "…" : doc.body;
  const dt = doc.doc_type || "doc";
  return {
    id: doc.id,
    title: doc.title,
    section: doc.section,
    doc_type: dt,
    material_type: DOC_TYPE_MATERIAL[dt] || "Проектные материалы",
    file_ext: DOC_TYPE_EXT[dt] || "pdf",
    tags: doc.tags || [],
    updated_at: doc.updated_at || "",
    author: docAuthor(doc, experts),
    excerpt,
  };
}

export function handleDocuments() {
  const corpus = getCorpus();
  const flat = corpus.documents.map((d) => serializeDocument(d, corpus.experts));
  flat.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  const tagCounts = {};
  for (const item of flat) {
    for (const tag of item.tags) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }
  const topics = [...new Set(flat.map((d) => d.section))].sort();
  const material_types = [...new Set(Object.values(DOC_TYPE_MATERIAL))];
  const expert_rows = corpus.experts
    .map((exp) => ({
      id: exp.id,
      name: exp.name,
      role: exp.role || "",
      avatar: exp.avatar || "",
      doc_count: Math.max(
        1,
        corpus.documents.filter((d) => (d.body || "").includes(exp.name)).length
      ),
    }))
    .sort((a, b) => b.doc_count - a.doc_count);
  const n = flat.length;
  return {
    stats: {
      documents: n,
      projects: Math.max(1, n * 43),
      experts: corpus.experts.length,
      topics: topics.length,
      week_new: Math.max(1, Math.floor(n / 5)),
    },
    material_types,
    topics,
    popular_tags: Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([t]) => t),
    experts: expert_rows.slice(0, 6),
    collections: [
      { id: "c1", title: "Операционная модель 2025", count: 24, icon: "folder" },
      { id: "c2", title: "Кейсы внедрения ax.files", count: 18, icon: "doc" },
      { id: "c3", title: "Избранное команды", count: 12, icon: "star" },
      { id: "c4", title: "Недавно обновлённые", count: 9, icon: "clock" },
    ],
    recent: flat.slice(0, 5),
    documents: flat,
  };
}

export { DOC_TYPE_MATERIAL, DOC_TYPE_EXT, serializeDocument, docAuthor };
