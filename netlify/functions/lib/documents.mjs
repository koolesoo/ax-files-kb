import { getCorpus } from "./corpus.mjs";

const DOC_TYPE_MATERIAL = {
  project: "Проект",
  policy: "Проектные материалы",
  spec: "Проектные материалы",
  presentation: "Ассеты",
  video: "Ассеты",
  case: "Кейсы",
  checklist: "Исследования",
  doc: "Исследования",
};

const DOC_TYPE_EXT = {
  project: "folder",
  policy: "pdf",
  spec: "docx",
  presentation: "pptx",
  video: "mp4",
  case: "pdf",
  checklist: "xlsx",
  doc: "pdf",
};

function sectionProjectIds(documents) {
  const bySection = {};
  for (const doc of documents) {
    const sec = doc.section || "Прочее";
    if (!bySection[sec]) bySection[sec] = [];
    bySection[sec].push(doc);
  }
  const map = {};
  for (const [sec, docs] of Object.entries(bySection)) {
    docs.sort((a, b) => a.id.localeCompare(b.id));
    map[sec] = docs[0].id;
  }
  return map;
}

function isProjectDoc(doc, sectionProjects) {
  if (doc.doc_type === "project") return true;
  return sectionProjects[doc.section] === doc.id;
}

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

function serializeDocument(doc, experts, sectionProjects) {
  const excerpt = doc.body.length > 220 ? doc.body.slice(0, 220) + "…" : doc.body;
  const dt = doc.doc_type || "doc";
  const isProject = sectionProjects ? isProjectDoc(doc, sectionProjects) : dt === "project";
  return {
    id: doc.id,
    title: doc.title,
    section: doc.section,
    doc_type: isProject ? "project" : dt,
    material_type: isProject ? "Проект" : DOC_TYPE_MATERIAL[dt] || "Проектные материалы",
    file_ext: isProject ? "folder" : DOC_TYPE_EXT[dt] || "pdf",
    is_project: isProject,
    tags: doc.tags || [],
    updated_at: doc.updated_at || "",
    author: docAuthor(doc, experts),
    excerpt,
  };
}

export function handleDocuments() {
  const corpus = getCorpus();
  const sectionProjects = sectionProjectIds(corpus.documents);
  const flat = corpus.documents.map((d) => serializeDocument(d, corpus.experts, sectionProjects));
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
      ...flat
        .filter((d) => d.is_project)
        .slice(0, 6)
        .map((d) => ({
          id: d.id,
          title: d.title.split(" · ")[0].trim(),
          count: 40 + (hash(d.id) % 220),
          icon: "folder",
          project_id: d.id,
        })),
      { id: "c-star", title: "Избранное команды", count: 12, icon: "star" },
      { id: "c-clock", title: "Недавно обновлённые", count: 9, icon: "clock" },
    ],
    recent: flat.slice(0, 5),
    documents: flat,
  };
}

const DOC_TYPE_BADGE = {
  policy: "Регламент",
  spec: "Спецификация",
  presentation: "Презентация",
  video: "Видео",
  case: "Кейс",
  checklist: "Чек-лист",
  doc: "Документ",
};

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function findAuthorExpert(corpus, authorName) {
  return corpus.experts.find((e) => e.name === authorName) || null;
}

export function handleDocumentDetail(id) {
  const corpus = getCorpus();
  const raw = corpus.documents.find((d) => d.id === id);
  if (!raw) return null;

  const sectionProjects = sectionProjectIds(corpus.documents);
  const base = serializeDocument(raw, corpus.experts, sectionProjects);
  const seed = hash(id);
  const paragraphs = (raw.body || "").split("\n\n").filter(Boolean);
  const authorExpert = findAuthorExpert(corpus, base.author);
  const sectionTitles = [
    "О документе",
    "Ключевые принципы",
    "Процедура согласования",
    "Сроки ответа по запросам",
  ];
  const sections = sectionTitles
    .map((title, i) => ({ title, content: paragraphs[i] || paragraphs[paragraphs.length - 1] || "" }))
    .filter((s) => s.content);

  const flat = corpus.documents.map((d) => serializeDocument(d, corpus.experts, sectionProjects));
  const similar = flat
    .filter((d) => d.id !== id && (d.section === base.section || d.doc_type === base.doc_type))
    .slice(0, 3)
    .map((d) => ({
      id: d.id,
      title: d.title.split(" · ")[0],
      file_ext: d.file_ext,
      section: d.section,
    }));

  const attachNames = [
    ["Шаблон_процесса.xlsx", "xlsx", "420 КБ", "2025-03-18"],
    ["Презентация_для_команд.pptx", "pptx", "1,8 МБ", "2025-02-04"],
    ["Чек-лист_внедрения.docx", "docx", "240 КБ", "2025-01-22"],
  ];
  const published = `2024-${String(6 + (seed % 4)).padStart(2, "0")}-15`;
  const focusTopics = [
    "Отклонения от регламента",
    "Сроки согласования",
    "Качество материалов",
    "Доступы и роли",
  ];
  const summaryPoints = (paragraphs.length ? paragraphs.slice(0, 4) : [base.excerpt])
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    ...base,
    title_short: base.title.split(" · ")[0].trim(),
    body: raw.body,
    summary: paragraphs[0] || base.excerpt,
    summary_title: "Краткое содержание",
    summary_points: summaryPoints,
    sections,
    type_label: DOC_TYPE_BADGE[raw.doc_type] || "Документ",
    is_verified: true,
    is_approved: true,
    category: base.section,
    published_at: published,
    file_size: `${(1.2 + (seed % 18) / 10).toFixed(1).replace(".", ",")} МБ`,
    views: 180 + (seed % 820),
    thanks_count: 8 + (seed % 24),
    comments_count: 8,
    attachments: attachNames.map(([name, ext, size, date], i) => ({
      id: `att-${id}-${i}`,
      name,
      file_ext: ext,
      size,
      date,
    })),
    versions: [
      {
        version: "3.1",
        date: base.updated_at,
        status: "current",
        label: "Текущая",
        author: base.author,
      },
      { version: "3.0", date: "2025-03-12", status: "archive", author: base.author },
      { version: "2.4", date: "2025-01-28", status: "archive", author: base.author },
    ],
    comments: [
      {
        id: "c1",
        author: "Ирина Козлова",
        initials: "ИК",
        role: "Методолог PMO",
        text: "Отличный регламент — используем как эталон при онбординге новых кураторов.",
        hours_ago: 5,
        is_author: false,
      },
      {
        id: "c2",
        author: base.author,
        initials: initials(base.author),
        role: authorExpert?.role || "Эксперт",
        text: "Добавил уточнение по срокам согласования в разделе 3. Обратная связь приветствуется.",
        hours_ago: 28,
        is_author: true,
      },
      {
        id: "c3",
        author: "Мария Некрасова",
        initials: "МН",
        role: "Аналитик",
        text: "Можно ли добавить пример заполнения карточки материала?",
        hours_ago: 52,
        is_author: false,
      },
    ],
    thanks_users: [
      { initials: "ДО", name: "Дмитрий Орлов" },
      { initials: "ЕК", name: "Елена Крылова" },
      { initials: "ИС", name: "Игорь Семёнов" },
      { initials: "МП", name: "Мария Петрова" },
    ],
    parameters: {
      type: DOC_TYPE_BADGE[raw.doc_type] || base.material_type,
      format: `${base.file_ext.toUpperCase()} + ${attachNames.length} файла`,
      subject: base.section,
      focus: focusTopics[seed % focusTopics.length],
      status: "Согласовано",
      access: "Доступ: все сотрудники",
      created: published,
      published,
      updated: base.updated_at,
      views: 180 + (seed % 820),
    },
    similar: similar.map((s) => ({
      ...s,
      updated_at: flat.find((d) => d.id === s.id)?.updated_at || "",
    })),
    author_expert: authorExpert
      ? {
          id: authorExpert.id,
          name: authorExpert.name,
          role: authorExpert.role,
          department: authorExpert.department,
          avatar: authorExpert.avatar,
          initials: initials(authorExpert.name),
          is_top: seed % 3 !== 0,
          is_verified: authorExpert.is_verified ?? true,
        }
      : {
          id: null,
          name: base.author,
          role: "Автор материала",
          department: base.section,
          avatar: "",
          initials: initials(base.author),
          is_top: false,
          is_verified: false,
        },
    breadcrumbs: [
      { label: "Все файлы", href: "knowledge.html" },
      { label: base.section, href: `knowledge.html?q=${encodeURIComponent(base.section)}` },
      { label: base.title.split(" · ")[0].trim() },
    ],
  };
}

export { DOC_TYPE_MATERIAL, DOC_TYPE_EXT, serializeDocument, docAuthor };
