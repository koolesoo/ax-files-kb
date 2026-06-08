import { getCorpus } from "./corpus.mjs";
import { serializeDocument } from "./documents.mjs";

const MATERIAL_TITLES = [
  "Гайд по операционной модели ax.files",
  "Регламент модерации экспертных материалов",
  "Шаблон карточки эксперта для базы знаний",
  "Чек-лист публикации проектных материалов",
  "Методика оценки качества контента",
  "Протокол экспертной сети",
];
const MONTHS = ["Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сейчас"];
const VERIFY_AREAS = [
  "Операционная эффективность",
  "Управление проектами",
  "Контент и знания",
  "Интеграции",
  "Данные и ИИ",
  "Продажи и кейсы",
];

const DEPARTMENTS = [
  "Проектный офис",
  "Технологии",
  "Контент",
  "Продажи",
  "HR",
  "Операции",
  "Аналитика",
  "Качество",
  "ИБ",
  "Коммуникации",
  "Финансы",
  "Цифровизация",
];

const SPECIALIZATIONS = [
  "Управление проектами",
  "Операционная эффективность",
  "Данные и ИИ",
  "Интеграции",
  "Контент и знания",
  "Продажи и кейсы",
];

const ROLES = [
  "Руководитель проектного офиса",
  "Архитектор процессов",
  "Методолог PMO",
  "Руководитель программ",
  "Технический писатель",
  "Руководитель интеграций",
  "Аналитик данных",
  "Эксперт по качеству",
  "Куратор знаний",
  "Product owner",
];

const SKILL_POOL = [
  "операционная модель",
  "регламенты",
  "PMO",
  "процессы",
  "интеграции",
  "API",
  "данные",
  "ИИ",
  "онбординг",
  "кейсы",
  "модерация",
  "roadmap",
  "UX",
  "аудит",
  "шаблоны",
];

const FIRST_NAMES = [
  "Наталья", "Игорь", "Дарья", "Андрей", "Елена", "Денис", "Павел", "Ольга",
  "Сергей", "Анна", "Михаил", "Юлия", "Алексей", "Мария", "Виктор", "София",
  "Тимур", "Кирилл", "Вера", "Роман", "Екатерина", "Николай", "Полина", "Артём",
];

const LAST_NAMES = [
  "Морозова", "Никонов", "Орлова", "Козлов", "Петрова", "Смирнов", "Волков", "Лебедева",
  "Семёнов", "Васильева", "Орлов", "Крылова", "Назаров", "Ахметов", "Данилов", "Морозов",
  "Кузнецов", "Соколов", "Попов", "Новиков", "Фёдоров", "Медведев", "Егоров", "Павлов",
];

const ACTIVITY_TEMPLATES = [
  { type: "publish", text: "опубликовал новый материал" },
  { type: "update", text: "обновил 3 материала" },
  { type: "join", text: "присоединился как новый эксперт" },
  { type: "verify", text: "прошёл верификацию" },
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function initials(name) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function enrichExpert(exp, idx, corpus) {
  const seed = hash(exp.id || exp.name || String(idx));
  const dept = exp.department || pick(DEPARTMENTS, seed);
  const spec = pick(SPECIALIZATIONS, seed + 3);
  const docCount = Math.max(
    1,
    corpus.documents.filter((d) => (d.body || "").includes(exp.name)).length
  );
  const baseDocs = docCount > 1 ? docCount : 8 + (seed % 90);
  const views = baseDocs * (120 + (seed % 380));
  const verified = 88 + (seed % 12);
  const isTop = idx < 12 || seed % 7 === 0;
  const isNew = seed % 11 === 0;
  const activeToday = seed % 5 === 0 || idx < 4;
  const skills = exp.skills?.length
    ? exp.skills.slice(0, 4)
    : [pick(SKILL_POOL, seed), pick(SKILL_POOL, seed + 1), pick(SKILL_POOL, seed + 2)].slice(0, 2 + (seed % 2));

  return {
    id: exp.id || `exp-gen-${idx}`,
    name: exp.name,
    role: exp.role || pick(ROLES, seed),
    department: dept,
    specialization: spec,
    skills,
    avatar: exp.avatar || "",
    initials: initials(exp.name),
    doc_count: baseDocs,
    views,
    verified_pct: verified,
    is_verified: verified >= 90 || idx < 20,
    is_top: isTop,
    is_new: isNew,
    active_today: activeToday,
    subscribed: seed % 9 === 0,
    last_active_hours: activeToday ? seed % 8 : 12 + (seed % 72),
    activity_score: baseDocs * 10 + views / 50 + (activeToday ? 200 : 0),
  };
}

function generateExperts(corpus) {
  const real = corpus.experts.map((e, i) => enrichExpert(e, i, corpus));
  const seen = new Set(real.map((e) => e.name));
  const generated = [];
  let i = 0;
  while (real.length + generated.length < 348) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const suffix = Math.floor(i / (FIRST_NAMES.length * LAST_NAMES.length));
    const name = `${ln} ${fn}` + (suffix ? ` ${suffix}` : "");
    if (!seen.has(name)) {
      seen.add(name);
      const seed = hash(name);
      generated.push(
        enrichExpert(
          {
            id: `exp-gen-${real.length + generated.length}`,
            name,
            role: pick(ROLES, seed),
            department: pick(DEPARTMENTS, seed),
            skills: [pick(SKILL_POOL, seed), pick(SKILL_POOL, seed + 2)],
          },
          real.length + generated.length,
          corpus
        )
      );
    }
    i += 1;
    if (i > 5000) break;
  }
  return [...real, ...generated].sort((a, b) => b.activity_score - a.activity_score);
}

function departmentCounts(experts) {
  const counts = {};
  for (const e of experts) {
    counts[e.department] = (counts[e.department] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function buildActivity(experts) {
  const items = [];
  for (let i = 0; i < 6; i++) {
    const exp = experts[i * 3 + 1] || experts[i];
    const tpl = pick(ACTIVITY_TEMPLATES, i + hash(exp.name));
    const hours = 1 + (hash(exp.id) % 48);
    items.push({
      id: `act-${i}`,
      name: exp.name,
      action: tpl.text,
      type: tpl.type,
      hours_ago: hours,
    });
  }
  return items;
}

function buildAbout(exp, corpus) {
  const raw = corpus.experts.find((e) => e.id === exp.id || e.name === exp.name);
  if (raw?.bio) return raw.bio;
  const seed = hash(exp.id);
  return (
    `${exp.name} — ${exp.role.toLowerCase()} в направлении «${exp.department}». ` +
    `Более ${5 + (seed % 8)} лет опыта в корпоративных трансформациях и развитии практик ax.files. ` +
    `Курирует экспертную сеть, помогает командам оформлять и публиковать материалы в базе знаний. ` +
    `Специализация: ${exp.skills.join(", ")}.`
  );
}

function buildMaterials(exp, corpus) {
  const linked = corpus.documents
    .filter((d) => (d.body || "").includes(exp.name))
    .slice(0, 4)
    .map((d, i) => {
      const doc = serializeDocument(d, corpus.experts);
      const seed = hash(d.id);
      return {
        id: doc.id,
        title: doc.title,
        file_ext: doc.file_ext,
        section: doc.section,
        updated_at: doc.updated_at,
        views: 800 + (seed % 4200),
        status: i === 0 ? "new" : i === 1 ? "updated" : "",
      };
    });
  if (linked.length >= 3) return linked;
  const seed = hash(exp.id);
  const out = [...linked];
  for (let i = linked.length; i < 4; i++) {
    const s = seed + i * 17;
    out.push({
      id: `mat-${exp.id}-${i}`,
      title: MATERIAL_TITLES[s % MATERIAL_TITLES.length],
      file_ext: ["pdf", "docx", "pptx", "pdf"][i],
      section: exp.department,
      updated_at: `2025-0${4 + (i % 3)}-${10 + (s % 18)}`,
      views: 600 + (s % 5000),
      status: i === 0 ? "new" : i === 2 ? "updated" : "",
    });
  }
  return out;
}

function buildActivityWeeks(exp) {
  const seed = hash(exp.id);
  return MONTHS.map((label, i) => ({
    label,
    value: 20 + ((seed + i * 13) % 80),
    is_current: i === MONTHS.length - 1,
  }));
}

function buildContacts(exp) {
  const parts = exp.name.toLowerCase().replace(/\s+/g, ".").replace(/ё/g, "e");
  const slug = parts.split(".").reverse().join(".");
  return {
    email: `${slug}@company.ru`,
    telegram: `@${slug.replace(/\./g, "_")}`,
    office: `Москва, офис ${3 + (hash(exp.id) % 4)} · ${exp.department}`,
  };
}

function buildVerifyAreas(exp) {
  const seed = hash(exp.id);
  const areas = [exp.specialization, ...exp.skills.slice(0, 2)];
  return areas.slice(0, 3).map((name, i) => ({
    name: VERIFY_AREAS.includes(name) ? name : VERIFY_AREAS[(seed + i) % VERIFY_AREAS.length],
    rating: (4.5 + ((seed + i * 7) % 6) / 10).toFixed(1),
  }));
}

function buildSimilar(all, exp) {
  return all
    .filter((e) => e.id !== exp.id && (e.department === exp.department || e.specialization === exp.specialization))
    .slice(0, 3)
    .map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      initials: e.initials,
      avatar: e.avatar,
    }));
}

export function handleExpertDetail(id) {
  const corpus = getCorpus();
  const all = generateExperts(corpus);
  const exp = all.find((e) => e.id === id);
  if (!exp) return null;
  const seed = hash(exp.id);
  const verifiedDate = `2024-${String(3 + (seed % 8)).padStart(2, "0")}-${10 + (seed % 18)}`;
  return {
    ...exp,
    about: buildAbout(exp, corpus),
    verified_date: verifiedDate,
    contacts: buildContacts(exp),
    verification_areas: buildVerifyAreas(exp),
    activity_weeks: buildActivityWeeks(exp),
    materials: buildMaterials(exp, corpus),
    similar: buildSimilar(all, exp),
  };
}

export function handleExperts(params = {}) {
  const corpus = getCorpus();
  const all = generateExperts(corpus);
  const totalDocs = all.reduce((s, e) => s + e.doc_count, 0);
  const verifiedCount = all.filter((e) => e.is_verified).length;
  const deptCounts = departmentCounts(all);

  let filtered = all.slice();

  const q = (params.q || "").trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.skills.some((s) => s.toLowerCase().includes(q))
    );
  }

  const department = params.department || "";
  if (department) {
    filtered = filtered.filter((e) => e.department === department);
  }

  const specialization = params.specialization || "";
  if (specialization) {
    filtered = filtered.filter((e) => e.specialization === specialization);
  }

  const status = params.status || "";
  if (status === "verified") filtered = filtered.filter((e) => e.is_verified);
  if (status === "top") filtered = filtered.filter((e) => e.is_top);
  if (status === "new") filtered = filtered.filter((e) => e.is_new);
  if (status === "active") filtered = filtered.filter((e) => e.active_today);

  const sort = params.sort || "activity";
  if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  else if (sort === "docs") filtered.sort((a, b) => b.doc_count - a.doc_count);
  else if (sort === "views") filtered.sort((a, b) => b.views - a.views);
  else filtered.sort((a, b) => b.activity_score - a.activity_score);

  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = Math.min(24, Math.max(6, parseInt(params.limit || "12", 10)));
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const slice = filtered.slice((page - 1) * limit, page * limit);

  return {
    stats: {
      experts: all.length,
      materials: totalDocs,
      verified_pct: Math.round((verifiedCount / all.length) * 100),
      departments: deptCounts.length,
      new_month: 12,
    },
    departments: ["", ...DEPARTMENTS],
    specializations: SPECIALIZATIONS,
    statuses: [
      { id: "", label: "Все" },
      { id: "verified", label: "Верифицированные" },
      { id: "top", label: "Топ-эксперты" },
      { id: "new", label: "Новые" },
      { id: "active", label: "Активны сегодня" },
    ],
    recent: all.slice(0, 6).map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      doc_count: e.doc_count,
      initials: e.initials,
      avatar: e.avatar,
      hours_ago: e.last_active_hours,
    })),
    top_month: all.slice(0, 5).map((e, i) => ({
      rank: i + 1,
      id: e.id,
      name: e.name,
      doc_count: e.doc_count,
      views: e.views,
      delta: 3 + (hash(e.id) % 12),
      initials: e.initials,
      avatar: e.avatar,
    })),
    by_department: deptCounts.slice(0, 8),
    activity: buildActivity(all),
    experts: slice,
    pagination: { page, limit, total, pages },
  };
}
