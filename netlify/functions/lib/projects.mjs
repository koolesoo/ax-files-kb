import { getCorpus } from "./corpus.mjs";
import { serializeDocument } from "./documents.mjs";

const FOLDER_NAMES = [
  ["Аналитика и исследования", "42 файла", false],
  ["Регламенты и политики", "18 файлов · ограниченный доступ", true],
  ["Рабочие материалы", "12 файлов", false],
];

const FOCUS_TOPICS = [
  "Цифровизация проектного документооборота",
  "Внедрение регламентов и политик",
  "Кейс клиента и отраслевые материалы",
  "Операционная эффективность команды",
];

const ACCESS_ROLES = [
  { role: "owner", role_label: "Владелец" },
  { role: "editor", role_label: "Редактор" },
  { role: "reader", role_label: "Читатель", is_you: true },
  { role: "editor", role_label: "Редактор" },
];

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

function titleShort(title) {
  return String(title).split(/\s*·\s*/)[0].trim();
}

function formatDateRu(iso) {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${parseInt(parts[2], 10)} ${months[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
}

function formatChangedLabel(iso, seed) {
  if (!iso) return "Недавно";
  const now = new Date("2025-05-19");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Math.floor((now - d) / 86400000);
  if (diff <= 0) return `Сегодня в ${10 + (seed % 10)}:${seed % 2 ? "45" : "05"}`;
  if (diff === 1) return `Вчера в ${18 + (seed % 5)}:${seed % 2 ? "05" : "30"}`;
  return formatDateRu(iso);
}

function formatSize(seed) {
  const sizes = ["88 КБ", "240 КБ", "540 КБ", "2,1 МБ", "4,8 МБ", "8,4 МБ"];
  return sizes[seed % sizes.length];
}

function sectionProjectIds(corpus) {
  const map = {};
  const bySection = {};
  for (const doc of corpus.documents) {
    const sec = doc.section || "Прочее";
    if (!bySection[sec]) bySection[sec] = [];
    bySection[sec].push(doc);
  }
  for (const [sec, docs] of Object.entries(bySection)) {
    docs.sort((a, b) => a.id.localeCompare(b.id));
    map[sec] = docs[0].id;
  }
  return map;
}

export function isProjectDoc(doc, sectionProjects) {
  if (doc.doc_type === "project") return true;
  return sectionProjects[doc.section] === doc.id;
}

export function listProjectDocs(corpus) {
  const sectionProjects = sectionProjectIds(corpus);
  return corpus.documents.filter((d) => isProjectDoc(d, sectionProjects));
}

function personFromExpert(exp) {
  return {
    name: exp.name,
    initials: initials(exp.name),
    avatar: exp.avatar || "",
  };
}

function personFromName(name) {
  return { name, initials: initials(name), avatar: "" };
}

export function buildProjectDetail(projectId, corpus) {
  const raw = corpus.documents.find((d) => d.id === projectId);
  if (!raw) return null;

  const sectionProjects = sectionProjectIds(corpus);
  if (!isProjectDoc(raw, sectionProjects)) return null;

  const base = serializeDocument(raw, corpus.experts, sectionProjects);
  const seed = hash(projectId);
  const title = titleShort(raw.title);
  const ownerName = base.author;
  const ownerExpert = corpus.experts.find((e) => e.name === ownerName) || corpus.experts[seed % corpus.experts.length];

  const sectionDocs = corpus.documents
    .filter((d) => d.section === raw.section && d.id !== projectId)
    .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));

  const folderItems = FOLDER_NAMES.slice(0, 2).map(([name, subtext, restricted], i) => {
    const authorExp = corpus.experts[(seed + i) % corpus.experts.length];
    const countLabel = subtext.split(" · ")[0];
    return {
      type: "folder",
      id: `fld-${projectId}-${i}`,
      name,
      subtext: restricted ? countLabel : subtext,
      access_restricted: restricted,
      access_label: restricted ? "Доступ по запросу" : null,
      author: personFromExpert(authorExp),
      changed: formatDateRu(sectionDocs[i]?.updated_at || raw.updated_at),
      size: null,
      restricted,
    };
  });

  const fileItems = sectionDocs.slice(0, 4).map((d, i) => {
    const s = serializeDocument(d, corpus.experts, sectionProjects);
    const titleLower = (d.title || "").toLowerCase();
    const restricted =
      i === 3 ||
      /nda|конфиденци|строго конфиденци/i.test(titleLower);
    return {
      type: "file",
      id: `file-${d.id}`,
      name: titleShort(d.title) + (s.file_ext && s.file_ext !== "folder" ? `.${s.file_ext}` : ""),
      file_ext: s.file_ext,
      author: personFromName(s.author),
      changed: formatChangedLabel(d.updated_at, seed + i),
      size: formatSize(seed + i),
      doc_id: restricted ? null : d.id,
      access_restricted: restricted,
      access_label: restricted ? "Доступ по запросу" : null,
    };
  });

  const items = [...folderItems, ...fileItems];
  const fileCount = 40 + (seed % 220);

  const accessUsers = ACCESS_ROLES.map((r, i) => {
    const exp = corpus.experts[(seed + i) % corpus.experts.length];
    const isOwner = r.role === "owner";
    return {
      name: isOwner ? ownerName : exp.name,
      initials: isOwner ? initials(ownerName) : initials(exp.name),
      avatar: isOwner ? ownerExpert?.avatar || "" : exp.avatar || "",
      role: r.role,
      role_label: r.role_label,
      is_you: r.is_you || false,
    };
  });

  const badges = [];
  const body = (raw.body || "").toLowerCase();
  if (body.includes("конфиденци") || (raw.tags || []).some((t) => /конфиденци/i.test(t))) {
    badges.push({ label: "В конфиденциально", type: "confidential" });
  } else if (seed % 3 !== 0) {
    badges.push({ label: "В конфиденциально", type: "confidential" });
  }
  if (seed % 2 === 0) badges.push({ label: "Категория А", type: "category" });

  const firstFile = fileItems[0];
  const activity = [
    {
      dot: "green",
      text: `${ownerName} загрузил${ownerName.endsWith("а") ? "а" : ""} «${firstFile?.name || title}»`,
      time: formatChangedLabel(raw.updated_at, seed),
    },
    {
      dot: "blue",
      text: `${accessUsers[3]?.name || "Коллега"} обновил${(accessUsers[3]?.name || "").endsWith("а") ? "а" : ""} материал в папке`,
      time: formatChangedLabel(sectionDocs[0]?.updated_at, seed + 1),
    },
    {
      dot: "orange",
      text: "Запрос на доступ одобрен",
      time: formatDateRu(sectionDocs[1]?.updated_at || raw.updated_at),
    },
    {
      dot: "gray",
      text: `${accessUsers[1]?.name || "Куратор"} изменил права в папке «${folderItems[1]?.name || "Регламенты"}»`,
      time: formatDateRu(sectionDocs[2]?.updated_at || raw.updated_at),
    },
  ];

  return {
    id: projectId,
    title,
    subtitle: FOCUS_TOPICS[seed % FOCUS_TOPICS.length],
    badges,
    owner: {
      name: ownerName,
      initials: initials(ownerName),
      avatar: ownerExpert?.avatar || "",
    },
    file_count: fileCount,
    updated_label: `Обновлено ${formatChangedLabel(raw.updated_at, seed).toLowerCase()}`,
    about: (raw.body || "").split("\n\n")[0] || base.excerpt,
    tags: (raw.tags || []).slice(0, 4),
    access_count: 4 + (seed % 4),
    access_users: accessUsers,
    activity,
    items,
    breadcrumbs: [
      { label: "База знаний", href: "knowledge.html" },
      { label: "Проекты", href: "knowledge.html?q=Проект" },
      { label: title },
    ],
  };
}

export function handleProjects() {
  const corpus = getCorpus();
  const projects = listProjectDocs(corpus);
  return {
    projects: projects.map((doc) => {
      const sectionProjects = sectionProjectIds(corpus);
      const base = serializeDocument(doc, corpus.experts, sectionProjects);
      const seed = hash(doc.id);
      return {
        id: doc.id,
        title: titleShort(doc.title),
        subtitle: FOCUS_TOPICS[seed % FOCUS_TOPICS.length],
        file_count: 40 + (seed % 220),
        owner: base.author,
        updated_label: `Обновлено ${formatChangedLabel(doc.updated_at, seed).toLowerCase()}`,
      };
    }),
  };
}

export function handleProjectDetail(id) {
  const corpus = getCorpus();
  return buildProjectDetail(id, corpus);
}
