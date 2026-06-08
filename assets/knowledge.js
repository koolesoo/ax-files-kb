(function () {
  var API =
    (typeof window.__API_BASE__ === "string" && window.__API_BASE__) ||
    (location.hostname === "127.0.0.1" || location.hostname === "localhost"
      ? "http://127.0.0.1:8000"
      : location.protocol + "//" + location.host);
  var PAGE_SIZE = 5;

  var heroInput = document.getElementById("kb-search-input");
  var searchBtn = document.getElementById("kb-search-btn");
  var catalogEl = document.getElementById("kb-catalog");
  var resultsEl = document.getElementById("kb-results");
  var recentEl = document.getElementById("kb-recent");
  var recentSection = document.getElementById("kb-recent-section");
  var paginationEl = document.getElementById("kb-pagination");
  var listTitle = document.getElementById("kb-list-title");
  var listCount = document.getElementById("kb-list-count");
  var statsEl = document.getElementById("kb-stats");
  var filterTypeEl = document.getElementById("kb-filter-type");
  var filterTopicEl = document.getElementById("kb-filter-topic");
  var expertsListEl = document.getElementById("kb-sidebar-experts-list");
  var tagsEl = document.getElementById("kb-popular-tags");
  var collectionsEl = document.getElementById("kb-collections");
  var askPanel = document.getElementById("kb-ask-panel");
  var askToggle = document.getElementById("kb-ask-toggle");
  var askInput = document.getElementById("kb-ask-input");
  var askBtn = document.getElementById("kb-ask-submit");
  var askAnswer = document.getElementById("kb-answer");
  var askSources = document.getElementById("kb-ask-sources");
  var askStatus = document.getElementById("kb-ask-status");

  if (!heroInput) return;

  var lastQuery = "";
  var allDocs = [];
  var filteredDocs = [];
  var currentPage = 1;
  var activeType = "";
  var activeTopic = "";
  var isSearchMode = false;
  var overviewExperts = [];
  var overviewTags = [];

  var ICON_FOLDER =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
  var ICON_DOC =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';
  var ICON_STAR =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>';
  var ICON_CLOCK =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
  var ICON_TYPE =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>';
  var ICON_CAL =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
  var ICON_USER =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  function esc(t) {
    return String(t)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function titleShort(title) {
    return String(title).split(/\s*·\s*/)[0].trim();
  }

  function formatDate(iso) {
    if (!iso) return "";
    var parts = iso.split("-");
    if (parts.length !== 3) return iso;
    var months = [
      "января", "февраля", "марта", "апреля", "мая", "июня",
      "июля", "августа", "сентября", "октября", "ноября", "декабря",
    ];
    return parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
  }

  function formatStat(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function queryTokens(query) {
    var q = String(query || "").toLowerCase().trim();
    var tokens = q.split(/\W+/).filter(function (t) {
      return t.length > 2;
    });
    if (q.length >= 3 && tokens.indexOf(q) === -1) tokens.unshift(q);
    return tokens;
  }

  function highlightHtml(text, query) {
    if (!text) return "";
    var safe = esc(text);
    var terms = [];
    var qn = String(query || "").toLowerCase().trim();
    if (qn.length >= 3) terms.push(qn);
    queryTokens(query).forEach(function (t) {
      terms.push(t);
      if (t.length >= 7) terms.push(t.slice(0, 6));
    });
    var seen = {};
    terms.filter(function (t) {
      if (seen[t] || t.length < 4) return false;
      seen[t] = true;
      return true;
    }).forEach(function (t) {
      var re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      safe = safe.replace(re, '<mark class="kb-hl">$1</mark>');
    });
    return safe;
  }

  function matchBadge(kind, entity) {
    if (entity === "expert") {
      if (kind === "role") return '<span class="kb-match-tag">В должности</span>';
      if (kind === "name") return '<span class="kb-match-tag">В имени</span>';
      if (kind === "content") return '<span class="kb-match-tag">В тексте</span>';
      return "";
    }
    if (kind === "title") return '<span class="kb-match-tag">В названии</span>';
    if (kind === "section") return '<span class="kb-match-tag">В разделе</span>';
    if (kind === "content") return '<span class="kb-match-tag">В тексте</span>';
    return "";
  }

  function docStatus(doc) {
    var d = new Date(doc.updated_at || "");
    var now = new Date("2025-05-19");
    if (isNaN(d.getTime())) return "";
    var days = (now - d) / 86400000;
    if (days <= 14) return '<span class="kb-status-tag kb-status-tag--new">Новый</span>';
    if (days <= 45) return '<span class="kb-status-tag kb-status-tag--updated">Обновлён</span>';
    return "";
  }

  function materialUrl(doc) {
    if (!doc || !doc.id) return "#";
    if (doc.is_project || doc.material_type === "Проект" || doc.doc_type === "project") {
      return "project.html?id=" + encodeURIComponent(doc.id);
    }
    return "document.html?id=" + encodeURIComponent(doc.id);
  }

  function fileIcon(ext) {
    var e = (ext || "pdf").toLowerCase();
    if (e === "folder") {
      return (
        '<div class="kb-file-icon kb-file-icon--folder" aria-hidden="true">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
        "</div>"
      );
    }
    return (
      '<div class="kb-file-icon kb-file-icon--' +
      esc(e) +
      '" aria-hidden="true">' +
      esc(e) +
      "</div>"
    );
  }

  function renderTagPills(tags, hot) {
    if (!tags || !tags.length) return "";
    return (
      '<div class="kb-doc-card__tags">' +
      tags
        .map(function (t) {
          var cls = hot && hot.indexOf(t) >= 0 ? " kb-tag-pill is-hot" : " kb-tag-pill";
          return '<span class="' + cls.trim() + '">' + esc(t) + "</span>";
        })
        .join("") +
      "</div>"
    );
  }

  function kbDocCard(doc, opts) {
    opts = opts || {};
    var q = opts.query || lastQuery;
    var title = opts.title != null ? opts.title : titleShort(doc.title || "");
    var snippet = opts.snippet != null ? opts.snippet : doc.excerpt || doc.snippet || "";
    var matchIn = opts.matchIn || doc.match_in;
    var entity = opts.entity || "document";
    var badge = matchBadge(matchIn, entity);
    var tags = doc.tags || [];
    var showAllTags = tags.length > 1;

    var href = materialUrl(doc);
    return (
      '<article class="kb-doc-card" data-id="' +
      esc(doc.id || "") +
      '" data-is-project="' +
      (doc.is_project ? "1" : "0") +
      '">' +
      fileIcon(doc.file_ext) +
      '<div class="kb-doc-card__content">' +
      '<div class="kb-doc-card__top">' +
      '<h3 class="kb-doc-card__title">' +
      '<a href="' +
      esc(href) +
      '" class="kb-doc-card__link">' +
      highlightHtml(title, q) +
      "</a>" +
      (opts.hideStatus ? "" : docStatus(doc)) +
      "</h3>" +
      "</div>" +
      '<p class="kb-doc-card__meta">' +
      (opts.sourceRef
        ? '<span class="kb-doc-card__meta-item"><span class="kb-match-tag kb-match-tag--ref">[' +
          esc(String(opts.sourceRef)) +
          "]</span></span>"
        : "") +
      (badge ? '<span class="kb-doc-card__meta-item">' + badge + "</span>" : "") +
      '<span class="kb-doc-card__meta-item">' +
      ICON_TYPE +
      esc(doc.material_type || "Материалы") +
      "</span>" +
      '<span class="kb-doc-card__meta-item">' +
      ICON_CAL +
      esc(formatDate(doc.updated_at)) +
      "</span>" +
      '<span class="kb-doc-card__meta-item">' +
      ICON_USER +
      esc(doc.author || "—") +
      "</span>" +
      "</p>" +
      (snippet
        ? '<p class="kb-doc-card__snippet">' + (opts.snippetHtml || highlightHtml(snippet, q)) + "</p>"
        : "") +
      (showAllTags ? renderTagPills(tags) : tags.length === 1 ? renderTagPills(tags) : "") +
      "</div>" +
      '<div class="kb-doc-card__actions">' +
      '<button type="button" class="kb-icon-btn" aria-label="В избранное">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>' +
      "</button>" +
      '<button type="button" class="kb-icon-btn" aria-label="Ещё" aria-haspopup="menu" aria-expanded="false" data-kb-more>' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>' +
      "</button>" +
      "</div>" +
      "</article>"
    );
  }

  function findDocById(id) {
    if (!id || !allDocs.length) return null;
    for (var i = 0; i < allDocs.length; i++) {
      if (allDocs[i].id === id) return allDocs[i];
    }
    return null;
  }

  function askSourceCard(source, query) {
    var s = source || {};
    var q = query || "";
    var doc = findDocById(s.document_id);
    var title = s.document_title || s.title || (doc && doc.title) || "Источник";
    var snippet = (s.quote || "").slice(0, 320);
    var matchIn = s.match_priority >= 3 ? "title" : "content";
    if (s.kind === "expert" || s.kind === "expert_profile") matchIn = "content";

    var cardDoc = doc
      ? Object.assign({}, doc, { excerpt: snippet })
      : {
          id: s.document_id || "",
          title: title,
          material_type: s.material_type || (s.kind === "expert" || s.kind === "expert_profile" ? "Эксперт" : "Материалы"),
          file_ext: s.file_ext || "pdf",
          updated_at: s.updated_at || "",
          author: s.author || "—",
          tags: s.tags || [],
          excerpt: snippet,
        };

    return (
      '<div class="kb-ask-sources__item">' +
      kbDocCard(cardDoc, {
        title: titleShort(title),
        snippet: snippet,
        snippetHtml: snippet ? highlightHtml(snippet, q) : "",
        matchIn: matchIn,
        hideStatus: true,
        query: q,
        sourceRef: s.ref,
      }) +
      "</div>"
    );
  }

  function showAskThinking() {
    if (askAnswer) {
      askAnswer.classList.remove("is-empty");
      askAnswer.innerHTML =
        '<div class="kb-ask-thinking" role="status" aria-live="polite">' +
        '<div class="kb-ask-thinking__orb" aria-hidden="true"></div>' +
        '<p class="kb-ask-thinking__text">Думаем…</p>' +
        "</div>";
    }
    if (askStatus) askStatus.textContent = "";
    if (askSources) askSources.innerHTML = "";
  }

  function recentCard(doc) {
    return (
      '<a href="' +
      esc(materialUrl(doc)) +
      '" class="kb-recent-card">' +
      '<div class="kb-recent-card__icon">' +
      fileIcon(doc.file_ext) +
      "</div>" +
      '<h3 class="kb-recent-card__title">' +
      esc(titleShort(doc.title)) +
      "</h3>" +
      '<p class="kb-recent-card__meta">' +
      esc(doc.material_type || "") +
      " · 2 часа назад</p>" +
      "</a>"
    );
  }

  function renderChips(el, items, active, onSelect) {
    if (!el) return;
    el.innerHTML =
      '<button type="button" class="kb-chip' +
      (active === "" ? " is-active" : "") +
      '" data-value="">Все</button>' +
      items
        .map(function (item) {
          return (
            '<button type="button" class="kb-chip' +
            (active === item ? " is-active" : "") +
            '" data-value="' +
            esc(item) +
            '">' +
            esc(item) +
            "</button>"
          );
        })
        .join("");
    el.querySelectorAll(".kb-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        onSelect(btn.getAttribute("data-value") || "");
      });
    });
  }

  function renderStats(stats) {
    if (!statsEl || !stats) return;
    var rows = [
      { v: stats.documents, l: "Документов" },
      { v: stats.projects, l: "Проектов" },
      { v: stats.experts, l: "Экспертов" },
      { v: stats.topics, l: "Тематик" },
      { v: "+" + stats.week_new, l: "За последнюю неделю" },
    ];
    statsEl.innerHTML = rows
      .map(function (r) {
        return (
          '<li class="kb-stats__item"><span class="kb-stats__value">' +
          formatStat(r.v) +
          '</span><span class="kb-stats__label">' +
          esc(r.l) +
          "</span></li>"
        );
      })
      .join("");
  }

  function renderExperts(experts) {
    if (!expertsListEl) return;
    expertsListEl.innerHTML = (experts || [])
      .map(function (e) {
        var initials = e.name
          .split(/\s+/)
          .map(function (p) {
            return p[0];
          })
          .join("")
          .slice(0, 2);
        var av = e.avatar
          ? '<img class="kb-expert-item__avatar" src="' + esc(e.avatar) + '" alt="" width="36" height="36" />'
          : '<span class="kb-expert-item__avatar">' + esc(initials) + "</span>";
        return (
          "<li class=\"kb-expert-item\">" +
          av +
          '<div><p class="kb-expert-item__name">' +
          esc(e.name) +
          '</p><p class="kb-expert-item__role">' +
          esc(e.role) +
          "</p></div>" +
          '<span class="kb-expert-item__count">' +
          e.doc_count +
          " doc</span></li>"
        );
      })
      .join("");
  }

  function renderTagCloud(tags) {
    if (!tagsEl) return;
    var hot = (tags || []).slice(0, 5);
    tagsEl.innerHTML = (tags || [])
      .map(function (t, i) {
        return (
          '<button type="button" class="kb-tag-pill' +
          (i < 5 ? " is-hot" : "") +
          '" data-tag="' +
          esc(t) +
          '">' +
          esc(t) +
          "</button>"
        );
      })
      .join("");
    tagsEl.querySelectorAll(".kb-tag-pill").forEach(function (btn) {
      btn.addEventListener("click", function () {
        heroInput.value = btn.getAttribute("data-tag") || "";
        runSearch(heroInput.value);
      });
    });
  }

  function collectionIcon(kind) {
    if (kind === "folder") return ICON_FOLDER;
    if (kind === "star") return ICON_STAR;
    if (kind === "clock") return ICON_CLOCK;
    return ICON_DOC;
  }

  function renderCollections(items) {
    if (!collectionsEl) return;
    collectionsEl.innerHTML = (items || [])
      .map(function (c) {
        var inner =
          '<span class="kb-collection-item__icon kb-collection-item__icon--' +
          esc(c.icon || "doc") +
          '">' +
          collectionIcon(c.icon) +
          "</span>" +
          '<span class="kb-collection-item__title">' +
          esc(c.title) +
          '</span><span class="kb-collection-item__count">' +
          c.count +
          " материалов</span>";
        if (c.project_id) {
          return (
            '<li class="kb-collection-item">' +
            '<a href="project.html?id=' +
            encodeURIComponent(c.project_id) +
            '" class="kb-collection-item__link">' +
            inner +
            "</a></li>"
          );
        }
        return "<li class=\"kb-collection-item\">" + inner + "</li>";
      })
      .join("");
  }

  function applyFilters() {
    filteredDocs = allDocs.filter(function (d) {
      if (activeType && d.material_type !== activeType) return false;
      if (activeTopic && d.section !== activeTopic) return false;
      return true;
    });
    currentPage = 1;
    renderCatalogPage();
  }

  function renderCatalogPage() {
    if (!catalogEl || isSearchMode) return;
    var total = filteredDocs.length;
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > pages) currentPage = pages;
    var start = (currentPage - 1) * PAGE_SIZE;
    var slice = filteredDocs.slice(start, start + PAGE_SIZE);

    if (listTitle) listTitle.textContent = "Все материалы";
    if (listCount) listCount.textContent = total ? formatStat(total) + " материалов" : "";

    if (!slice.length) {
      catalogEl.innerHTML = '<p class="kb-empty">Ничего не найдено по фильтрам</p>';
    } else {
      catalogEl.innerHTML = slice.map(function (d) {
        return kbDocCard(d);
      }).join("");
    }
    catalogEl.classList.remove("is-hidden");
    if (resultsEl) resultsEl.hidden = true;
    renderPagination(pages);
  }

  function renderPagination(pages) {
    if (!paginationEl) return;
    if (pages <= 1 || isSearchMode) {
      paginationEl.hidden = true;
      return;
    }
    paginationEl.hidden = false;
    var html = "";
    for (var p = 1; p <= Math.min(pages, 5); p++) {
      html +=
        '<button type="button" data-page="' +
        p +
        '"' +
        (p === currentPage ? ' class="is-active"' : "") +
        ">" +
        p +
        "</button>";
    }
    paginationEl.innerHTML = html;
    paginationEl.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentPage = parseInt(btn.getAttribute("data-page"), 10) || 1;
        renderCatalogPage();
      });
    });
  }

  function showSearchMode(on) {
    isSearchMode = on;
    if (recentSection) recentSection.classList.toggle("is-hidden", on);
    if (paginationEl && on) paginationEl.hidden = true;
    if (catalogEl) catalogEl.classList.toggle("is-hidden", on);
    if (resultsEl) resultsEl.hidden = !on;
    if (listTitle) listTitle.textContent = on ? "Результаты поиска" : "Все материалы";
  }

  async function loadOverview() {
    try {
      var res = await fetch(API + "/api/documents");
      var data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : res.statusText);

      allDocs = data.documents || [];
      filteredDocs = allDocs.slice();

      renderStats(data.stats);
      function onTypeFilter(v) {
        activeType = v;
        renderChips(filterTypeEl, data.material_types || [], activeType, onTypeFilter);
        applyFilters();
      }
      function onTopicFilter(v) {
        activeTopic = v;
        renderChips(filterTopicEl, data.topics || [], activeTopic, onTopicFilter);
        applyFilters();
      }
      renderChips(filterTypeEl, data.material_types || [], activeType, onTypeFilter);
      renderChips(filterTopicEl, data.topics || [], activeTopic, onTopicFilter);
      if (recentEl) {
        recentEl.innerHTML = (data.recent || []).slice(0, 4).map(recentCard).join("");
      }
      overviewExperts = data.experts || [];
      overviewTags = data.popular_tags || [];
      renderExperts(overviewExperts);
      renderTagCloud(overviewTags);
      renderCollections(data.collections);
      renderCatalogPage();
    } catch (e) {
      if (catalogEl) {
        var hint =
          location.hostname === "127.0.0.1" || location.hostname === "localhost"
            ? "Запустите: npm run api"
            : "Проверьте OPENAI_API_KEY в Netlify и пересоберите сайт";
        catalogEl.innerHTML = '<p class="kb-error">Не удалось загрузить каталог. ' + hint + "</p>";
      }
    }
  }

  async function runSearch(q) {
    q = (q || "").trim();
    lastQuery = q;
    if (q.length < 2) {
      showSearchMode(false);
      renderExperts(overviewExperts);
      applyFilters();
      return;
    }
    showSearchMode(true);
    if (resultsEl) resultsEl.innerHTML = '<p class="kb-status">Ищем…</p>';
    try {
      var res = await fetch(API + "/api/search?q=" + encodeURIComponent(q));
      var data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : res.statusText);

      var docs = data.documents || [];
      var exps = data.experts || [];
      var mens = data.mentions || [];
      var cards = [];

      docs.forEach(function (d) {
        cards.push(
          kbDocCard(d, {
            title: d.title_hit || titleShort(d.title || ""),
            snippet: d.snippet || d.excerpt || "",
            snippetHtml: d.snippet ? highlightHtml(d.snippet, q) : highlightHtml(d.excerpt || "", q),
            matchIn: d.match_in,
          })
        );
      });
      mens.forEach(function (m) {
        cards.push(
          kbDocCard(
            {
              id: m.document_id,
              title: m.document_title,
              material_type: m.section || "Упоминание",
              file_ext: "pdf",
              updated_at: "",
              author: m.expert_name,
              tags: m.tags,
              excerpt: m.snippet,
            },
            {
              title: titleShort(m.document_title || ""),
              snippet: m.snippet,
              snippetHtml: highlightHtml(m.snippet || "", q),
              matchIn: m.match_in,
              hideStatus: true,
            }
          )
        );
      });

      if (listCount) {
        listCount.textContent = cards.length ? cards.length + " результатов" : "";
      }
      if (resultsEl) {
        resultsEl.innerHTML = cards.length
          ? cards.join("")
          : '<p class="kb-empty">Ничего не найдено</p>';
      }
      if (exps.length) renderExperts(exps);
      else renderExperts(overviewExperts);
    } catch (e) {
      if (resultsEl) resultsEl.innerHTML = '<p class="kb-error">' + esc(e.message || "Ошибка поиска") + "</p>";
    }
  }

  async function runAsk() {
    var q = (askInput && askInput.value || "").trim();
    if (q.length < 3 || !askBtn) return;
    askBtn.disabled = true;
    showAskThinking();
    try {
      var res = await fetch(API + "/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : res.statusText);
      if (askAnswer) {
        askAnswer.classList.remove("is-empty");
        var summary = data.summary || "";
        var detail = data.detail || "";
        if (summary || detail) {
          askAnswer.innerHTML =
            (summary
              ? '<section class="kb-answer__block"><h3 class="kb-answer__heading">Кратко</h3><p class="kb-answer__text">' +
                esc(summary).replace(/\n/g, "<br>") +
                "</p></section>"
              : "") +
            (detail
              ? '<section class="kb-answer__block"><h3 class="kb-answer__heading">Подробнее</h3><p class="kb-answer__text">' +
                esc(detail).replace(/\n/g, "<br>") +
                "</p></section>"
              : "");
        } else {
          askAnswer.textContent = data.answer || "";
        }
      }
      if (askStatus) {
        askStatus.textContent =
          data.confidence === "low"
            ? "Низкая уверенность"
            : data.confidence === "high"
              ? "Высокая уверенность"
              : data.confidence === "medium"
                ? "Средняя уверенность"
                : "";
      }
      if (askSources && data.sources && data.sources.length) {
        askSources.innerHTML =
          '<h3 class="kb-ask-sources__title">Источники</h3><div class="kb-ask-sources__list">' +
          data.sources.map(function (s) { return askSourceCard(s, q); }).join("") +
          "</div>";
      }
    } catch (e) {
      if (askAnswer) askAnswer.textContent = "Ошибка: " + (e.message || "не удалось получить ответ");
    } finally {
      askBtn.disabled = false;
    }
  }

  heroInput.addEventListener("input", function () {
    clearTimeout(heroInput._timer);
    heroInput._timer = setTimeout(function () {
      runSearch(heroInput.value);
    }, 350);
  });

  heroInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch(heroInput.value);
    }
  });

  if (searchBtn) {
    searchBtn.addEventListener("click", function () {
      runSearch(heroInput.value);
    });
  }

  if (askToggle && askPanel) {
    askToggle.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = askPanel.hasAttribute("hidden");
      if (open) {
        askPanel.removeAttribute("hidden");
        askToggle.classList.add("is-on");
        askToggle.setAttribute("aria-pressed", "true");
        askToggle.setAttribute("aria-expanded", "true");
        if (askInput) askInput.focus();
      } else {
        askPanel.setAttribute("hidden", "");
        askToggle.classList.remove("is-on");
        askToggle.setAttribute("aria-pressed", "false");
        askToggle.setAttribute("aria-expanded", "false");
      }
    });
  }
  if (askBtn) askBtn.addEventListener("click", runAsk);

  document.addEventListener("click", function (e) {
    var content = e.target.closest(".kb-doc-card__content");
    if (!content || e.target.closest("a, button")) return;
    var card = content.closest(".kb-doc-card");
    var id = card && card.getAttribute("data-id");
    if (id) {
      var doc = findDocById(id);
      window.location.href = doc ? materialUrl(doc) : "document.html?id=" + encodeURIComponent(id);
    }
  });

  var params = new URLSearchParams(window.location.search);
  var initialQ = params.get("q");
  loadOverview().then(function () {
    if (initialQ) {
      heroInput.value = initialQ;
      runSearch(initialQ);
    }
  });
})();
