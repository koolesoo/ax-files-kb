(function () {
  "use strict";

  var API_BASE =
    (typeof window.__API_BASE__ === "string" && window.__API_BASE__) ||
    (location.hostname === "127.0.0.1" || location.hostname === "localhost"
      ? "http://127.0.0.1:8000"
      : location.protocol + "//" + location.host);

  var rootEl = document.getElementById("proj-root");
  if (!rootEl) return;

  var AV_COLORS = ["green", "blue", "purple", "orange", "gray"];

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function avColor(name) {
    var n = 0;
    for (var i = 0; i < (name || "").length; i++) n += name.charCodeAt(i);
    return AV_COLORS[n % AV_COLORS.length];
  }

  function renderAvatar(person, cls) {
    cls = cls || "proj-row__av";
    if (person.avatar) {
      return (
        '<img class="' +
        cls +
        '" src="' +
        esc(person.avatar) +
        '" alt="" width="26" height="26" />'
      );
    }
    return (
      '<span class="' +
      cls +
      " " +
      cls +
      "--" +
      avColor(person.name) +
      '">' +
      esc(person.initials || "?") +
      "</span>"
    );
  }

  function badgeHtml(b) {
    var cls = "proj-badge proj-badge--" + esc(b.type || "category");
    return '<span class="' + cls + '">' + esc(b.label) + "</span>";
  }

  function rowIcon(item) {
    if (item.type === "folder") {
      return (
        '<span class="proj-row__icon proj-row__icon--folder" aria-hidden="true">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
        "</span>"
      );
    }
    var ext = (item.file_ext || "pdf").toLowerCase();
    return (
      '<span class="proj-row__icon proj-row__icon--' +
      esc(ext) +
      '">' +
      esc(ext.slice(0, 4)) +
      "</span>"
    );
  }

  function renderAccessSub(item) {
    if (!item.access_restricted && !item.subtext) return "";
    var lines = "";
    if (item.subtext && !item.access_label) {
      lines += '<p class="proj-row__sub">' + esc(item.subtext) + "</p>";
    } else if (item.subtext && item.access_label) {
      lines += '<p class="proj-row__sub">' + esc(item.subtext) + "</p>";
    }
    if (item.access_restricted || item.access_label) {
      lines +=
        '<p class="proj-row__sub proj-row__sub--accent">' +
        '<button type="button" class="proj-row__access-btn" data-proj-access-request data-item-name="' +
        esc(item.name) +
        '" data-item-ext="' +
        esc(item.file_ext || "") +
        '">' +
        esc(item.access_label || "Доступ по запросу") +
        "</button></p>";
    } else if (item.subtext_accent && item.subtext) {
      lines +=
        '<p class="proj-row__sub proj-row__sub--accent">' +
        '<button type="button" class="proj-row__access-btn" data-proj-access-request data-item-name="' +
        esc(item.name) +
        '" data-item-ext="' +
        esc(item.file_ext || "") +
        '">' +
        esc(item.subtext) +
        "</button></p>";
    }
    return lines;
  }

  function renderRow(item) {
    var locked = item.access_restricted;
    var href = !locked && item.doc_id ? "document.html?id=" + encodeURIComponent(item.doc_id) : "#";
    var tag = !locked && item.doc_id ? "a" : "div";
    var sub = renderAccessSub(item);
    var nameCls = locked ? " proj-row__name proj-row__name--locked" : " proj-row__name";

    return (
      "<tr>" +
      "<td>" +
      "<" +
      tag +
      (!locked && item.doc_id ? ' href="' + esc(href) + '"' : "") +
      ' class="' +
      nameCls.trim() +
      '">' +
      rowIcon(item) +
      "<div>" +
      '<p class="proj-row__title">' +
      esc(item.name) +
      "</p>" +
      sub +
      "</div></" +
      tag +
      "></td>" +
      '<td class="proj-row__author">' +
      renderAvatar(item.author) +
      '<span class="proj-row__author-name">' +
      esc(item.author.name) +
      "</span></td>" +
      '<td class="proj-row__changed">' +
      esc(item.changed) +
      "</td>" +
      '<td class="proj-row__size">' +
      (item.size ? esc(item.size) : "—") +
      "</td>" +
      '<td><button type="button" class="proj-row__more" aria-label="Ещё" data-kb-more>' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>' +
      "</button></td></tr>"
    );
  }

  function render(p) {
    document.title = "ax.files — " + p.title;

    var crumbs = (p.breadcrumbs || [])
      .map(function (c) {
        if (c.href) {
          return '<a href="' + esc(c.href) + '">' + esc(c.label) + "</a>";
        }
        return "<span>" + esc(c.label) + "</span>";
      })
      .join('<span class="proj-breadcrumbs__sep">/</span>');

    var badges = (p.badges || []).map(badgeHtml).join("");

    var rows = (p.items || []).map(renderRow).join("");

    var tags = (p.tags || [])
      .map(function (t) {
        return '<a href="knowledge.html?q=' + encodeURIComponent(t) + '" class="kb-tag-pill">' + esc(t) + "</a>";
      })
      .join("");

    var accessUsers = (p.access_users || [])
      .map(function (u) {
        var name = esc(u.name);
        if (u.is_you) name += ' <span class="proj-access__you">(вы)</span>';
        return (
          "<li class=\"proj-access__item\">" +
          renderAvatar(u, "proj-access__av") +
          '<div class="proj-access__info">' +
          '<span class="proj-access__name">' +
          name +
          '</span><span class="proj-access__role proj-access__role--' +
          esc(u.role || "reader") +
          '">' +
          esc(u.role_label) +
          "</span></div></li>"
        );
      })
      .join("");

    var activity = (p.activity || [])
      .map(function (a) {
        return (
          "<li class=\"proj-activity__item\">" +
          '<span class="proj-activity__dot proj-activity__dot--' +
          esc(a.dot || "gray") +
          '" aria-hidden="true"></span>' +
          "<div>" +
          '<p class="proj-activity__text">' +
          esc(a.text) +
          '</p><span class="proj-activity__time">' +
          esc(a.time) +
          "</span></div></li>"
        );
      })
      .join("");

    rootEl.innerHTML =
      '<nav class="proj-breadcrumbs" aria-label="Навигация">' +
      crumbs +
      "</nav>" +
      '<header class="proj-hero">' +
      '<div class="proj-hero__top">' +
      '<span class="proj-hero__icon" aria-hidden="true">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
      "</span>" +
      '<div class="proj-hero__head">' +
      '<div class="proj-badges">' +
      badges +
      "</div>" +
      '<h1 class="proj-title">' +
      esc(p.title) +
      "</h1>" +
      '<p class="proj-meta">' +
      "<span>" +
      esc(p.subtitle) +
      '</span><span class="proj-meta__sep">•</span>' +
      "<span>Владелец <strong>" +
      esc(p.owner.name) +
      "</strong></span>" +
      '<span class="proj-meta__sep">•</span>' +
      "<span>" +
      p.file_count +
      " файлов</span>" +
      '<span class="proj-meta__sep">•</span>' +
      "<span>" +
      esc(p.updated_label) +
      "</span></p></div></div>" +
      '<div class="proj-actions">' +
      '<div class="proj-actions__left">' +
      '<button type="button" class="proj-btn proj-btn--primary">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>' +
      "Загрузить</button>" +
      '<button type="button" class="proj-btn proj-btn--ghost">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M12 11v6M9 14h6"/></svg>' +
      "Новая папка</button></div>" +
      '<div class="proj-actions__right">' +
      '<button type="button" class="proj-btn proj-btn--ghost" data-proj-access-request>Запросить доступ</button>' +
      '<button type="button" class="proj-btn proj-btn--ghost">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>' +
      "Поделиться</button></div></div></header>" +
      '<div class="proj-layout">' +
      '<section class="proj-files">' +
      '<div class="proj-files__head">' +
      '<p class="proj-files__path">' +
      esc(p.title) +
      " / Все материалы</p>" +
      '<label class="proj-files__search" aria-label="Поиск в папке">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
      '<input type="search" placeholder="Поиск в папке" autocomplete="off" id="proj-folder-search" />' +
      "</label></div>" +
      '<table class="proj-table">' +
      "<thead><tr>" +
      '<th>Название <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;opacity:.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></th>' +
      "<th>Автор</th>" +
      "<th>Изменён</th>" +
      "<th>Размер</th>" +
      "<th></th>" +
      "</tr></thead>" +
      "<tbody>" +
      rows +
      "</tbody></table></section>" +
      '<aside class="proj-side">' +
      '<section class="proj-panel">' +
      '<h2 class="proj-panel__title">О папке</h2>' +
      '<p class="proj-about">' +
      esc(p.about) +
      "</p>" +
      '<div class="proj-tags">' +
      tags +
      "</div></section>" +
      '<section class="proj-panel">' +
      '<div class="proj-panel__head">' +
      '<h2 class="proj-panel__title">Доступ · ' +
      (p.access_count || (p.access_users || []).length) +
      " человек</h2>" +
      '<a href="#" class="proj-panel__link">Управление</a></div>' +
      '<ul class="proj-access">' +
      accessUsers +
      "</ul>" +
      '<button type="button" class="proj-access__btn" data-proj-access-request>Запросить расширение доступа</button>' +
      "</section>" +
      '<section class="proj-panel">' +
      '<h2 class="proj-panel__title">Активность</h2>' +
      '<ul class="proj-activity">' +
      activity +
      "</ul></section></aside></div>";

    var searchInput = document.getElementById("proj-folder-search");
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        var q = searchInput.value.toLowerCase().trim();
        rootEl.querySelectorAll(".proj-table tbody tr").forEach(function (tr) {
          var text = tr.textContent.toLowerCase();
          tr.style.display = !q || text.indexOf(q) >= 0 ? "" : "none";
        });
      });
    }

    if (window.ProjAccessModal) {
      window.ProjAccessModal.bind(rootEl, p);
    }
  }

  var params = new URLSearchParams(window.location.search);
  var projectId = params.get("id");
  if (!projectId) {
    rootEl.innerHTML = '<p class="kb-status">Не указан проект. <a href="knowledge.html">Вернуться в базу знаний</a></p>';
    return;
  }

  fetch(API_BASE + "/api/projects/" + encodeURIComponent(projectId))
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(render)
    .catch(function () {
      rootEl.innerHTML =
        '<p class="kb-status">Не удалось загрузить проект. <a href="knowledge.html">Вернуться в базу знаний</a></p>';
    });
})();
