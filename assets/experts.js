(function () {
  "use strict";

  var API_BASE =
    (typeof window.__API_BASE__ === "string" && window.__API_BASE__) ||
    (location.hostname === "127.0.0.1" || location.hostname === "localhost"
      ? "http://127.0.0.1:8000"
      : location.protocol + "//" + location.host);
  var API = API_BASE + "/api/experts";

  var state = {
    q: "",
    department: "",
    specialization: "",
    status: "",
    sort: "activity",
    page: 1,
    view: "grid",
    subscribed: {},
  };

  var headSubEl = document.getElementById("exp-head-sub");
  var searchInput = document.getElementById("exp-search-input");
  var searchBtn = document.getElementById("exp-search-btn");
  var statsEl = document.getElementById("exp-stats");
  var filterDeptEl = document.getElementById("exp-filter-dept");
  var filterSpecEl = document.getElementById("exp-filter-spec");
  var filterStatusEl = document.getElementById("exp-filter-status");
  var recentEl = document.getElementById("exp-recent");
  var gridEl = document.getElementById("exp-grid");
  var listCountEl = document.getElementById("exp-list-count");
  var paginationEl = document.getElementById("exp-pagination");
  var sortEl = document.getElementById("exp-sort");
  var viewGridBtn = document.getElementById("exp-view-grid");
  var viewListBtn = document.getElementById("exp-view-list");
  var topMonthEl = document.getElementById("exp-top-month");
  var deptBarsEl = document.getElementById("exp-dept-bars");
  var activityEl = document.getElementById("exp-activity");
  var modalEl = document.getElementById("exp-modal");
  var modalBackdrop = document.getElementById("exp-modal-backdrop");
  var modalClose = document.getElementById("exp-modal-close");
  var modalContent = document.getElementById("exp-modal-content");
  var currentModalId = null;

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatNum(n) {
    if (n >= 1000) return Math.floor(n / 100) / 10 + "k";
    return String(n);
  }

  function formatStat(v) {
    if (typeof v === "number" && v >= 10000) {
      return Math.floor(v / 100) / 10 + "k+";
    }
    return String(v);
  }

  function timeAgo(hours) {
    if (hours < 1) return "только что";
    if (hours < 24) return hours + " ч назад";
    var days = Math.floor(hours / 24);
    return days + " дн назад";
  }

  function avatarHtml(e, cls) {
    if (e.avatar) {
      return '<img class="' + cls + '" src="' + esc(e.avatar) + '" alt="" width="48" height="48" />';
    }
    return '<span class="' + cls + '">' + esc(e.initials || "?") + "</span>";
  }

  function loadSubscribed() {
    try {
      var raw = localStorage.getItem("exp-subscribed");
      if (raw) state.subscribed = JSON.parse(raw);
    } catch (_) {}
  }

  function saveSubscribed() {
    try {
      localStorage.setItem("exp-subscribed", JSON.stringify(state.subscribed));
    } catch (_) {}
  }

  function isSubscribed(id) {
    return !!state.subscribed[id];
  }

  function toggleSubscribe(id) {
    if (state.subscribed[id]) delete state.subscribed[id];
    else state.subscribed[id] = true;
    saveSubscribed();
    refreshSubscribeUi(id);
  }

  function subscribeBtnHtml(id, large) {
    var sub = isSubscribed(id);
    if (large) {
      return sub
        ? '<button type="button" class="exp-modal__sub-btn is-subscribed" data-sub-toggle="' + esc(id) + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>Вы подписаны</button>'
        : '<button type="button" class="exp-modal__sub-btn is-unsubscribed" data-sub-toggle="' + esc(id) + '"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>Подписаться</button>';
    }
    return sub
      ? '<button type="button" class="exp-follow-btn is-subscribed" data-sub-toggle="' + esc(id) + '" aria-label="Подписаны"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg></button>'
      : '<button type="button" class="exp-follow-btn is-unsubscribed" data-sub-toggle="' + esc(id) + '" aria-label="Подписаться"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg></button>';
  }

  function refreshSubscribeUi(id) {
    document.querySelectorAll('[data-sub-toggle="' + id + '"]').forEach(function (btn) {
      var large = btn.classList.contains("exp-modal__sub-btn");
      var wrap = document.createElement("div");
      wrap.innerHTML = subscribeBtnHtml(id, large);
      if (wrap.firstChild) btn.replaceWith(wrap.firstChild);
    });
    wireSubscribeButtons();
    var card = gridEl && gridEl.querySelector('.exp-card[data-id="' + id + '"]');
    if (card) {
      var footer = card.querySelector(".exp-card__footer");
      if (footer) {
        var active = footer.querySelector(".exp-card__active");
        var activeHtml = active ? active.outerHTML : "";
        footer.innerHTML =
          (isSubscribed(id)
            ? '<span class="exp-subscribe-btn exp-subscribe-btn--done">Вы подписаны</span>'
            : '<button type="button" class="exp-subscribe-btn exp-subscribe-btn--primary" data-subscribe="' + esc(id) + '">Подписаться</button>') +
          activeHtml;
        wireCardSubscribeButtons();
      }
    }
  }

  function wireSubscribeButtons() {
    document.querySelectorAll("[data-sub-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-sub-toggle");
        toggleSubscribe(id);
      });
    });
  }

  function wireCardSubscribeButtons() {
    if (!gridEl) return;
    gridEl.querySelectorAll("[data-subscribe]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var id = btn.getAttribute("data-subscribe");
        state.subscribed[id] = true;
        saveSubscribed();
        refreshSubscribeUi(id);
      });
    });
  }

  function openExpertModal(id) {
    if (!modalEl || !modalContent) return;
    currentModalId = id;
    modalContent.innerHTML = '<p class="kb-status" style="padding:2rem">Загрузка…</p>';
    modalEl.hidden = false;
    modalEl.setAttribute("aria-hidden", "false");
    document.body.classList.add("exp-modal-open");
    fetch(API_BASE + "/api/experts/" + encodeURIComponent(id))
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        if (currentModalId !== id) return;
        renderModal(data);
      })
      .catch(function () {
        modalContent.innerHTML = '<p class="kb-status" style="padding:2rem">Не удалось загрузить профиль.</p>';
      });
  }

  function closeModal() {
    if (!modalEl) return;
    currentModalId = null;
    modalEl.hidden = true;
    modalEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("exp-modal-open");
  }

  function formatDate(d) {
    if (!d) return "";
    var parts = d.split("-");
    if (parts.length !== 3) return d;
    var months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    return parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
  }

  function renderModal(e) {
    if (!modalContent) return;
    var badges = "";
    if (e.is_top) badges += '<span class="exp-modal__badge exp-modal__badge--top">Топ-эксперт</span>';
    if (e.is_verified) badges += '<span class="exp-modal__badge exp-modal__badge--verified">Верифицирован</span>';

    var tags = (e.skills || [])
      .map(function (s, i) {
        return (
          '<span class="exp-modal__tag' +
          (i >= 3 ? " exp-modal__tag--muted" : "") +
          '">' +
          esc(s) +
          "</span>"
        );
      })
      .join("");

    var maxBar = Math.max.apply(null, (e.activity_weeks || []).map(function (w) { return w.value; })) || 1;
    var chart = (e.activity_weeks || [])
      .map(function (w) {
        var h = Math.round((w.value / maxBar) * 100);
        return (
          '<div class="exp-modal__chart-bar">' +
          '<div class="exp-modal__chart-fill' +
          (w.is_current ? " is-current" : "") +
          '" style="height:' +
          h +
          '%"></div>' +
          '<span class="exp-modal__chart-label">' +
          esc(w.label) +
          "</span></div>"
        );
      })
      .join("");

    var materials = (e.materials || [])
      .map(function (m) {
        var status =
          m.status === "new"
            ? ' <span class="kb-status-tag kb-status-tag--new">новый</span>'
            : m.status === "updated"
              ? ' <span class="kb-status-tag kb-status-tag--updated">обновлён</span>'
              : "";
        return (
          "<li class=\"exp-modal__material\">" +
          '<span class="exp-modal__material-icon exp-modal__material-icon--' +
          esc(m.file_ext || "pdf") +
          '">' +
          esc((m.file_ext || "pdf").slice(0, 4)) +
          "</span><div>" +
          '<p class="exp-modal__material-title">' +
          esc(m.title) +
          status +
          "</p>" +
          '<p class="exp-modal__material-meta"><span>' +
          esc(m.section) +
          "</span><span>" +
          formatDate(m.updated_at) +
          "</span><span>" +
          formatNum(m.views) +
          " просм.</span></p></div></li>"
        );
      })
      .join("");

    var areas = (e.verification_areas || [])
      .map(function (a) {
        return (
          "<li class=\"exp-modal__area\"><span class=\"exp-modal__area-name\">" +
          esc(a.name) +
          '</span><span class="exp-modal__area-rating">★ ' +
          esc(a.rating) +
          "</span></li>"
        );
      })
      .join("");

    var similar = (e.similar || [])
      .map(function (s) {
        var av = s.avatar
          ? '<img class="exp-modal__similar-avatar" src="' + esc(s.avatar) + '" alt="" width="32" height="32" />'
          : '<span class="exp-modal__similar-avatar">' + esc(s.initials) + "</span>";
        return (
          '<li class="exp-modal__similar-item">' +
          '<a href="#" class="exp-modal__similar-link exp-profile-open" data-expert-id="' +
          esc(s.id) +
          '">' +
          av +
          "<div>" +
          '<p class="exp-modal__similar-name">' +
          esc(s.name) +
          '</p><p class="exp-modal__similar-role">' +
          esc(s.role) +
          "</p></div></a>" +
          subscribeBtnHtml(s.id, false) +
          "</li>"
        );
      })
      .join("");

    var avHero = e.avatar
      ? '<img class="exp-modal__avatar" src="' + esc(e.avatar) + '" alt="" width="88" height="88" />'
      : '<span class="exp-modal__avatar">' + esc(e.initials) + "</span>";

    modalContent.innerHTML =
      '<header class="exp-modal__hero">' +
      '<div class="exp-modal__avatar-wrap">' +
      avHero +
      (e.is_verified
        ? '<span class="exp-modal__avatar-badge" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg></span>'
        : "") +
      "</div>" +
      "<div>" +
      '<div class="exp-modal__title-row"><h2 class="exp-modal__name" id="exp-modal-name">' +
      esc(e.name) +
      "</h2>" +
      badges +
      "</div>" +
      '<p class="exp-modal__role">' +
      esc(e.role) +
      " · ax.files</p>" +
      '<span class="exp-modal__dept-pill">' +
      esc(e.department) +
      "</span>" +
      '<div class="exp-modal__tags">' +
      tags +
      "</div></div>" +
      '<div class="exp-modal__actions">' +
      subscribeBtnHtml(e.id, true) +
      '<button type="button" class="exp-modal__msg-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Написать</button>' +
      '<div class="exp-modal__icon-row">' +
      '<button type="button" class="exp-modal__icon-btn" aria-label="Поделиться"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg></button>' +
      '<button type="button" class="exp-modal__icon-btn" aria-label="Ещё"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg></button>' +
      "</div></div></header>" +
      '<div class="exp-modal__body">' +
      '<div class="exp-modal__main">' +
      '<h3 class="exp-modal__section-title">О себе</h3>' +
      '<p class="exp-modal__about">' +
      esc(e.about) +
      "</p>" +
      '<div class="exp-modal__chart">' +
      '<h3 class="exp-modal__section-title">Активность за последние 12 недель</h3>' +
      '<div class="exp-modal__chart-bars">' +
      chart +
      "</div></div>" +
      '<div class="exp-modal__materials-head">' +
      '<h3 class="exp-modal__section-title">Последние материалы</h3>' +
      '<a href="knowledge.html" class="exp-modal__materials-link">Все ' +
      e.doc_count +
      " →</a></div>" +
      '<ul class="exp-modal__materials">' +
      materials +
      "</ul></div>" +
      '<aside class="exp-modal__side">' +
      (e.is_verified
        ? '<div class="exp-modal__verify-box"><strong>Верифицированный эксперт</strong>Подтверждён ' +
          formatDate(e.verified_date) +
          "</div>"
        : "") +
      '<h3 class="exp-modal__section-title">Контакты</h3>' +
      '<ul class="exp-modal__contacts">' +
      '<li class="exp-modal__contact"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M4 8l8 5 8-5"/></svg>' +
      esc(e.contacts.email) +
      "</li>" +
      '<li class="exp-modal__contact"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>' +
      esc(e.contacts.telegram) +
      "</li>" +
      '<li class="exp-modal__contact"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' +
      esc(e.contacts.office) +
      "</li></ul>" +
      '<h3 class="exp-modal__section-title">Области верификации</h3>' +
      '<ul class="exp-modal__areas">' +
      areas +
      "</ul>" +
      '<h3 class="exp-modal__section-title">Похожие эксперты</h3>' +
      '<ul class="exp-modal__similar">' +
      similar +
      "</ul></aside></div>";

    wireSubscribeButtons();
  }

  function renderChips(el, items, active, onSelect, allLabel) {
    if (!el) return;
    var html = '<button type="button" class="kb-chip' + (active === "" ? " is-active" : "") + '" data-value="">' + esc(allLabel || "Все") + "</button>";
    items.forEach(function (item) {
      var val = typeof item === "string" ? item : item.id;
      var label = typeof item === "string" ? item : item.label;
      if (!val && val !== "") return;
      html +=
        '<button type="button" class="kb-chip' +
        (active === val ? " is-active" : "") +
        '" data-value="' +
        esc(val) +
        '">' +
        esc(label) +
        "</button>";
    });
    if (items[0] === "" || (items.length && items[0] === "")) {
      /* departments include empty first */
    }
    el.innerHTML = html;
    el.querySelectorAll(".kb-chip").forEach(function (btn) {
      btn.addEventListener("click", function () {
        onSelect(btn.getAttribute("data-value") || "");
      });
    });
  }

  function renderStats(stats) {
    if (!statsEl || !stats) return;
    var rows = [
      { v: stats.experts, l: "экспертов" },
      { v: formatStat(stats.materials), l: "опубликованных материалов" },
      { v: stats.verified_pct + "%", l: "верифицированных" },
      { v: stats.departments, l: "отделов" },
      { v: "+" + stats.new_month, l: "новых за месяц" },
    ];
    statsEl.innerHTML = rows
      .map(function (r) {
        return (
          '<li class="kb-stats__item"><span class="kb-stats__value">' +
          esc(formatStat(r.v)) +
          '</span><span class="kb-stats__label">' +
          esc(r.l) +
          "</span></li>"
        );
      })
      .join("");
    if (headSubEl) {
      headSubEl.textContent =
        stats.experts +
        " верифицированных специалистов — редакторы и авторы материалов базы знаний";
    }
  }

  function renderRecent(items) {
    if (!recentEl) return;
    recentEl.innerHTML = (items || [])
      .map(function (e) {
        return (
          '<a href="#" class="exp-recent-card exp-profile-open" data-expert-id="' +
          esc(e.id) +
          '">' +
          avatarHtml(e, "exp-recent-card__avatar") +
          '<p class="exp-recent-card__name">' +
          esc(e.name) +
          '</p><p class="exp-recent-card__role">' +
          esc(e.role) +
          '</p><p class="exp-recent-card__meta">' +
          e.doc_count +
          " материалов · " +
          timeAgo(e.hours_ago) +
          "</p></a>"
        );
      })
      .join("");
  }

  function renderExpertCard(e) {
    var sub = isSubscribed(e.id) || e.subscribed;
    var tags = (e.skills || [])
      .map(function (s, i) {
        return '<span class="exp-skill-tag exp-skill-tag--' + (i % 4) + '">' + esc(s) + "</span>";
      })
      .join("");
    var footerBtn = sub
      ? '<span class="exp-subscribe-btn exp-subscribe-btn--done">Вы подписаны</span>'
      : '<button type="button" class="exp-subscribe-btn exp-subscribe-btn--primary" data-subscribe="' + esc(e.id) + '">Подписаться</button>';

    return (
      '<div class="exp-card" data-id="' +
      esc(e.id) +
      '">' +
      '<a href="#" class="exp-card__hit exp-profile-open" data-expert-id="' +
      esc(e.id) +
      '">' +
      '<div class="exp-card__head">' +
      avatarHtml(e, "exp-card__avatar") +
      "<div>" +
      '<p class="exp-card__name">' +
      esc(e.name) +
      "</p>" +
      '<p class="exp-card__role">' +
      esc(e.role) +
      "</p>" +
      '<p class="exp-card__dept">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' +
      esc(e.department) +
      "</p></div></div>" +
      '<div class="exp-card__tags">' +
      tags +
      "</div>" +
      '<div class="exp-card__stats">' +
      '<div class="exp-card__stat"><span class="exp-card__stat-value">' +
      e.doc_count +
      '</span><span class="exp-card__stat-label">материалов</span></div>' +
      '<div class="exp-card__stat"><span class="exp-card__stat-value">' +
      formatNum(e.views) +
      '</span><span class="exp-card__stat-label">просмотров</span></div>' +
      '<div class="exp-card__stat"><span class="exp-card__stat-value">' +
      e.verified_pct +
      '%</span><span class="exp-card__stat-label">верификация</span></div>' +
      "</div></a>" +
      '<div class="exp-card__footer">' +
      footerBtn +
      '<span class="exp-card__active">активен ' +
      timeAgo(e.last_active_hours) +
      "</span></div></div>"
    );
  }

  function renderGrid(experts) {
    if (!gridEl) return;
    if (!experts || !experts.length) {
      gridEl.innerHTML = '<p class="kb-status">Эксперты не найдены. Попробуйте изменить фильтры.</p>';
      return;
    }
    gridEl.innerHTML = experts.map(renderExpertCard).join("");
    gridEl.classList.toggle("is-list", state.view === "list");
    wireCardSubscribeButtons();
  }

  function renderPagination(pag) {
    if (!paginationEl || !pag) return;
    if (pag.pages <= 1) {
      paginationEl.hidden = true;
      return;
    }
    paginationEl.hidden = false;
    var html = "";
    if (pag.page > 1) {
      html += '<button type="button" data-page="' + (pag.page - 1) + '" aria-label="Назад">&lt;</button>';
    }
    var start = Math.max(1, pag.page - 2);
    var end = Math.min(pag.pages, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    if (start > 1) {
      html += '<button type="button" data-page="1">1</button>';
      if (start > 2) html += '<span style="padding:0 0.25rem;color:var(--text-tertiary)">…</span>';
    }
    for (var p = start; p <= end; p++) {
      html +=
        '<button type="button" data-page="' +
        p +
        '"' +
        (p === pag.page ? ' class="is-active"' : "") +
        ">" +
        p +
        "</button>";
    }
    if (end < pag.pages) {
      if (end < pag.pages - 1) html += '<span style="padding:0 0.25rem;color:var(--text-tertiary)">…</span>';
      html += '<button type="button" data-page="' + pag.pages + '">' + pag.pages + "</button>";
    }
    if (pag.page < pag.pages) {
      html += '<button type="button" data-page="' + (pag.page + 1) + '" aria-label="Вперёд">&gt;</button>';
    }
    paginationEl.innerHTML = html;
    paginationEl.querySelectorAll("button[data-page]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.page = parseInt(btn.getAttribute("data-page"), 10);
        load();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function renderTopMonth(items) {
    if (!topMonthEl) return;
    topMonthEl.innerHTML = (items || [])
      .map(function (e) {
        return (
          "<li>" +
          '<a href="#" class="exp-top-item exp-profile-open" data-expert-id="' +
          esc(e.id) +
          '">' +
          '<span class="exp-top-item__rank">' +
          e.rank +
          "</span>" +
          avatarHtml(e, "exp-top-item__avatar") +
          "<div>" +
          '<p class="exp-top-item__name">' +
          esc(e.name) +
          '</p><p class="exp-top-item__meta">' +
          e.doc_count +
          " мат. · " +
          formatNum(e.views) +
          " просм.</p></div>" +
          '<span class="exp-top-item__delta">+' +
          e.delta +
          "</span></a></li>"
        );
      })
      .join("");
  }

  function renderDeptBars(items) {
    if (!deptBarsEl || !items || !items.length) return;
    var max = items[0].count;
    deptBarsEl.innerHTML = items
      .map(function (d) {
        var pct = Math.round((d.count / max) * 100);
        return (
          '<div class="exp-dept-bar">' +
          '<div class="exp-dept-bar__head"><span class="exp-dept-bar__name">' +
          esc(d.name) +
          '</span><span class="exp-dept-bar__count">' +
          d.count +
          "</span></div>" +
          '<div class="exp-dept-bar__track"><div class="exp-dept-bar__fill" style="width:' +
          pct +
          '%"></div></div></div>'
        );
      })
      .join("");
  }

  function renderActivity(items) {
    if (!activityEl) return;
    activityEl.innerHTML = (items || [])
      .map(function (a) {
        return (
          "<li class=\"exp-activity-item\">" +
          "<strong>" +
          esc(a.name.split(" ").reverse().join(" ")) +
          "</strong> " +
          esc(a.action) +
          '<span class="exp-activity-item__time">' +
          timeAgo(a.hours_ago) +
          "</span></li>"
        );
      })
      .join("");
  }

  function buildUrl() {
    var p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.department) p.set("department", state.department);
    if (state.specialization) p.set("specialization", state.specialization);
    if (state.status) p.set("status", state.status);
    if (state.sort) p.set("sort", state.sort);
    p.set("page", String(state.page));
    p.set("limit", "12");
    return API + "?" + p.toString();
  }

  function load() {
    if (gridEl) gridEl.innerHTML = '<p class="kb-status">Загрузка…</p>';
    fetch(buildUrl())
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        renderStats(data.stats);
        renderRecent(data.recent);
        renderGrid(data.experts);
        if (listCountEl && data.pagination) {
          listCountEl.textContent = data.pagination.total + " специалистов";
        }
        renderPagination(data.pagination);
        renderTopMonth(data.top_month);
        renderDeptBars(data.by_department);
        renderActivity(data.activity);

        if (filterDeptEl && data.departments) {
          renderChips(
            filterDeptEl,
            data.departments.filter(function (d) { return d; }),
            state.department,
            function (v) {
              state.department = v;
              state.page = 1;
              load();
            },
            "Все отделы"
          );
        }
        if (filterSpecEl && data.specializations) {
          renderChips(filterSpecEl, data.specializations, state.specialization, function (v) {
            state.specialization = v;
            state.page = 1;
            load();
          });
        }
        if (filterStatusEl && data.statuses) {
          renderChips(filterStatusEl, data.statuses, state.status, function (v) {
            state.status = v;
            state.page = 1;
            load();
          });
        }
      })
      .catch(function () {
        if (gridEl) {
          gridEl.innerHTML =
            '<p class="kb-status">Не удалось загрузить каталог. Запустите API: <code>npm run api</code></p>';
        }
      });
  }

  loadSubscribed();

  document.addEventListener("click", function (e) {
    var link = e.target.closest(".exp-profile-open");
    if (!link) return;
    e.preventDefault();
    var id = link.getAttribute("data-expert-id");
    if (id) openExpertModal(id);
  });

  if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);
  if (modalClose) modalClose.addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modalEl && !modalEl.hidden) closeModal();
  });

  if (searchBtn) {
    searchBtn.addEventListener("click", function () {
      state.q = (searchInput && searchInput.value) || "";
      state.page = 1;
      load();
    });
  }
  if (searchInput) {
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        state.q = searchInput.value;
        state.page = 1;
        load();
      }
    });
  }
  if (sortEl) {
    sortEl.addEventListener("change", function () {
      state.sort = sortEl.value;
      state.page = 1;
      load();
    });
  }
  if (viewGridBtn) {
    viewGridBtn.addEventListener("click", function () {
      state.view = "grid";
      viewGridBtn.classList.add("is-active");
      if (viewListBtn) viewListBtn.classList.remove("is-active");
      if (gridEl) gridEl.classList.remove("is-list");
    });
  }
  if (viewListBtn) {
    viewListBtn.addEventListener("click", function () {
      state.view = "list";
      viewListBtn.classList.add("is-active");
      if (viewGridBtn) viewGridBtn.classList.remove("is-active");
      if (gridEl) gridEl.classList.add("is-list");
    });
  }

  var params = new URLSearchParams(window.location.search);
  if (params.get("q")) {
    state.q = params.get("q");
    if (searchInput) searchInput.value = state.q;
  }

  load();
})();
