(function () {
  "use strict";

  var API_BASE =
    (typeof window.__API_BASE__ === "string" && window.__API_BASE__) ||
    (location.hostname === "127.0.0.1" || location.hostname === "localhost"
      ? "http://127.0.0.1:8000"
      : location.protocol + "//" + location.host);

  var rootEl = document.getElementById("doc-root");

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function formatDateShort(iso) {
    if (!iso) return "";
    var parts = iso.split("-");
    if (parts.length !== 3) return iso;
    var months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    return parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
  }

  function timeAgo(hours) {
    if (hours < 1) return "только что";
    if (hours < 24) return hours + " ч назад";
    return Math.floor(hours / 24) + " дн назад";
  }

  function fileIconCls(ext) {
    return "doc-file__icon doc-file__icon--" + esc((ext || "pdf").toLowerCase());
  }

  function similarIconCls(ext) {
    return "doc-similar__icon doc-similar__icon--" + esc((ext || "pdf").toLowerCase());
  }

  function render(d) {
    document.title = "ax.files — " + d.title_short;

    var crumbs = (d.breadcrumbs || [])
      .map(function (c) {
        if (c.href) {
          return '<a href="' + esc(c.href) + '">' + esc(c.label) + "</a>";
        }
        return "<span>" + esc(c.label) + "</span>";
      })
      .join('<span class="doc-breadcrumbs__sep">/</span>');

    var sections = (d.sections || [])
      .map(function (s) {
        return (
          '<section class="doc-section">' +
          '<h2 class="doc-section__title">' +
          esc(s.title) +
          "</h2>" +
          '<p class="doc-section__text">' +
          esc(s.content) +
          "</p></section>"
        );
      })
      .join("");

    var attachments = (d.attachments || [])
      .map(function (f) {
        var meta = esc(f.size);
        if (f.date) meta += " · " + esc(formatDateShort(f.date));
        return (
          "<li class=\"doc-file\">" +
          '<span class="' +
          fileIconCls(f.file_ext) +
          '">' +
          esc((f.file_ext || "pdf").slice(0, 4)) +
          "</span><div>" +
          '<p class="doc-file__name">' +
          esc(f.name) +
          '</p><p class="doc-file__size">' +
          meta +
          "</p></div>" +
          '<a href="#" class="doc-file__dl">Скачать</a></li>'
        );
      })
      .join("");

    var versions = (d.versions || [])
      .map(function (v) {
        var cls = v.status === "current" ? " doc-version--current" : "";
        var meta = esc(v.author || "");
        if (meta && v.date) meta += " · ";
        if (v.date) meta += formatDate(v.date);
        return (
          '<li class="doc-version' +
          cls +
          '">' +
          '<span class="doc-version__dot" aria-hidden="true"></span>' +
          "<div>" +
          '<span class="doc-version__num">Версия ' +
          esc(v.version) +
          "</span>" +
          '<span class="doc-version__meta">' +
          esc(meta) +
          "</span>" +
          (v.label ? '<span class="doc-version__tag">' + esc(v.label) + "</span>" : "") +
          "</div>" +
          (v.status === "current"
            ? ""
            : '<a href="#" class="doc-version__open">Открыть</a>') +
          "</li>"
        );
      })
      .join("");

    var comments = (d.comments || [])
      .map(function (c) {
        return (
          "<li class=\"doc-comment\">" +
          '<span class="doc-comment__avatar">' +
          esc(c.initials) +
          "</span><div>" +
          '<div class="doc-comment__head">' +
          '<span class="doc-comment__name">' +
          esc(c.author) +
          "</span>" +
          (c.is_author ? '<span class="doc-comment__author-tag">Автор</span>' : "") +
          '<span class="doc-comment__role">' +
          esc(c.role) +
          '</span><span class="doc-comment__time">' +
          timeAgo(c.hours_ago) +
          "</span></div>" +
          '<p class="doc-comment__text">' +
          esc(c.text) +
          "</p></div></li>"
        );
      })
      .join("");

    var tags = (d.tags || [])
      .map(function (t) {
        return '<a href="knowledge.html?q=' + encodeURIComponent(t) + '" class="kb-tag-pill">' + esc(t) + "</a>";
      })
      .join("");

    var similar = (d.similar || [])
      .map(function (s) {
        var meta = s.section || "";
        if (s.updated_at) meta = formatDateShort(s.updated_at) + (meta ? " · " + meta : "");
        return (
          '<a href="document.html?id=' +
          encodeURIComponent(s.id) +
          '" class="doc-similar__item">' +
          '<span class="' +
          similarIconCls(s.file_ext) +
          '">' +
          esc((s.file_ext || "pdf").slice(0, 3)) +
          "</span><div>" +
          '<p class="doc-similar__title">' +
          esc(s.title) +
          '</p><p class="doc-similar__meta">' +
          esc(meta) +
          "</p></div></a>"
        );
      })
      .join("");

    var ae = d.author_expert || {};
    var authorAv =
      '<span class="doc-author__avatar">' + esc(ae.initials || "?") + "</span>";

    var expertHref = "experts.html?q=" + encodeURIComponent(ae.name || "");

    var params = d.parameters || {};
    var paramRows = [
      ["Тип", params.type, ""],
      ["Формат", params.format, ""],
      ["Тематика", params.subject, ""],
      ["Фокус", params.focus, "accent"],
      ["Опубликован", formatDate(params.published || params.created), ""],
      ["Обновлён", formatDate(params.updated), ""],
      ["Просмотры", params.views, ""],
    ]
      .map(function (row) {
        var valCls = row[2] === "accent" ? " doc-params__value--accent" : "";
        return (
          "<li class=\"doc-params__row\"><span class=\"doc-params__label\">" +
          esc(row[0]) +
          '</span><span class="doc-params__value' +
          valCls +
          '">' +
          esc(row[1]) +
          "</span></li>"
        );
      })
      .join("");

    if (params.status) {
      paramRows +=
        '<li class="doc-params__row"><span class="doc-params__label">Статус</span>' +
        '<span class="doc-params__status"><span class="doc-params__dot" aria-hidden="true"></span>' +
        esc(params.status) +
        "</span></li>";
    }

    var accessBox = params.access
      ? '<div class="doc-params__access">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
        '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
        esc(params.access) +
        "</div>"
      : "";

    var thanksAvs = (d.thanks_users || [])
      .map(function (u) {
        return '<span class="doc-thanks__av" title="' + esc(u.name) + '">' + esc(u.initials) + "</span>";
      })
      .join("");

    var thanksLabel = d.thanks_count ? "+" + d.thanks_count + " человека" : "Сказать спасибо";

    var summaryPoints = d.summary_points || [];
    var summaryHtml =
      '<div class="doc-summary">' +
      '<h3 class="doc-summary__title">' +
      esc(d.summary_title || "Краткое содержание") +
      "</h3>";
    if (summaryPoints.length) {
      summaryHtml +=
        '<ul class="doc-summary__list">' +
        summaryPoints.map(function (p) {
          return "<li>" + esc(p) + "</li>";
        }).join("") +
        "</ul>";
    } else {
      summaryHtml += '<p class="doc-section__text" style="color:#5b21b6;margin:0">' + esc(d.summary) + "</p>";
    }
    summaryHtml += "</div>";

    var discussCount = d.comments_count != null ? d.comments_count : (d.comments || []).length;
    var publishedAt = d.published_at || params.published || params.created || d.updated_at;

    rootEl.innerHTML =
      '<nav class="doc-breadcrumbs" aria-label="Навигация">' +
      crumbs +
      "</nav>" +
      '<div class="doc-layout">' +
      '<div class="doc-main">' +
      '<header class="doc-hero">' +
      '<div class="doc-badges">' +
      '<span class="doc-badge doc-badge--type">' +
      esc(d.type_label) +
      "</span>" +
      (d.is_approved !== false
        ? '<span class="doc-badge doc-badge--approved"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>Утверждено</span>'
        : "") +
      "</div>" +
      '<h1 class="doc-title">' +
      esc(d.title_short) +
      "</h1>" +
      '<p class="doc-meta-line">' +
      "<span>Категория: " +
      esc(d.category || params.subject || d.section) +
      "</span>" +
      "<span>" +
      formatDate(publishedAt) +
      "</span>" +
      '<span>Автор: <a href="' +
      esc(expertHref) +
      '" class="doc-meta-line__link">' +
      esc(ae.name) +
      "</a></span>" +
      "<span>" +
      (d.views || params.views || 0) +
      " просмотров</span>" +
      "</p>" +
      '<div class="doc-actions">' +
      '<button type="button" class="doc-btn doc-btn--primary">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
      "Скачать " +
      (d.file_ext || "PDF").toUpperCase() +
      " - " +
      esc(d.file_size) +
      "</button>" +
      '<button type="button" class="doc-btn doc-btn--ghost">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
      "В избранное</button>" +
      '<div class="doc-actions__right">' +
      '<button type="button" class="doc-btn doc-btn--ghost doc-btn--icon">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>' +
      "Спасибо</button>" +
      '<button type="button" class="doc-btn doc-btn--ghost doc-btn--icon">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>' +
      "Поделиться</button>" +
      '<button type="button" class="kb-icon-btn" aria-label="Ещё" data-kb-more>' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>' +
      "</button></div></div></header>" +
      summaryHtml +
      sections +
      '<section class="doc-section">' +
      '<h2 class="doc-block-title">Прикреплённые файлы</h2>' +
      '<ul class="doc-files">' +
      attachments +
      "</ul></section>" +
      '<section class="doc-section">' +
      '<h2 class="doc-block-title">История версий</h2>' +
      '<ul class="doc-versions">' +
      versions +
      "</ul></section>" +
      '<section class="doc-discuss">' +
      '<h2 class="doc-block-title">Обсуждение <span class="doc-discuss__count">· ' +
      discussCount +
      "</span></h2>" +
      '<form class="doc-comment-form" onsubmit="return false">' +
      '<span class="doc-comment-form__avatar" aria-hidden="true">ВЫ</span>' +
      '<div class="doc-comment-form__body">' +
      '<textarea placeholder="Написать комментарий…"></textarea>' +
      '<div class="doc-comment-form__row">' +
      '<a href="#" class="kb-link">Прикрепить файл</a>' +
      '<button type="button" class="doc-btn doc-btn--primary">Отправить</button>' +
      "</div></div></form>" +
      '<ul class="doc-comments">' +
      comments +
      "</ul></section></div>" +
      '<aside class="doc-side">' +
      '<section class="doc-panel doc-author">' +
      '<h2 class="doc-panel__title">Автор материала</h2>' +
      '<a href="' +
      esc(expertHref) +
      '" class="doc-author__profile">' +
      '<div class="doc-author__avatar-wrap">' +
      authorAv +
      "</div>" +
      '<div class="doc-author__info">' +
      '<p class="doc-author__name">' +
      esc(ae.name) +
      "</p>" +
      '<p class="doc-author__role">' +
      esc(ae.role) +
      "</p>" +
      (ae.is_top
        ? '<span class="doc-author__badge"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>Топ-эксперт</span>'
        : "") +
      "</div></a>" +
      '<div class="doc-author__actions">' +
      '<button type="button" class="doc-author__btn doc-author__btn--primary">Подписаться</button>' +
      '<button type="button" class="doc-author__btn doc-author__btn--ghost">Написать</button>' +
      "</div></section>" +
      '<section class="doc-panel">' +
      '<h2 class="doc-panel__title">Параметры</h2>' +
      '<ul class="doc-params">' +
      paramRows +
      "</ul>" +
      accessBox +
      "</section>" +
      '<section class="doc-panel">' +
      '<h2 class="doc-panel__title">Теги</h2>' +
      '<div class="doc-tags">' +
      tags +
      "</div></section>" +
      '<section class="doc-panel doc-thanks">' +
      '<h2 class="doc-panel__title">Спасибо за материал</h2>' +
      '<div class="doc-thanks__avatars">' +
      thanksAvs +
      "</div>" +
      '<p class="doc-thanks__count">' +
      esc(thanksLabel) +
      "</p>" +
      '<button type="button" class="doc-thanks__btn">Сказать спасибо</button>' +
      "</section>" +
      '<section class="doc-panel">' +
      '<h2 class="doc-panel__title">Похожие материалы</h2>' +
      '<div class="doc-similar">' +
      similar +
      "</div></section></aside></div>";
  }

  var params = new URLSearchParams(window.location.search);
  var docId = params.get("id");
  if (!docId) {
    rootEl.innerHTML = '<p class="kb-status">Не указан документ. <a href="knowledge.html">Вернуться в базу знаний</a></p>';
    return;
  }

  fetch(API_BASE + "/api/documents/" + encodeURIComponent(docId))
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (d) {
      if (d.is_project) {
        window.location.replace("project.html?id=" + encodeURIComponent(docId));
        return;
      }
      render(d);
    })
    .catch(function () {
      rootEl.innerHTML =
        '<p class="kb-status">Не удалось загрузить материал. <a href="knowledge.html">Вернуться в базу знаний</a></p>';
    });
})();
