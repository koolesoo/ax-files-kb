(function () {
  var menuEl = null;
  var triggerEl = null;
  var activeDocId = null;
  var activeIsProject = false;

  var ICON_OPEN =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var ICON_DL =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>';
  var ICON_SHARE =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>';
  var ICON_LOCK =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
  var ICON_TRASH =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

  function docUrl(id, isProject) {
    if (isProject) return "project.html?id=" + encodeURIComponent(id);
    return "document.html?id=" + encodeURIComponent(id);
  }

  function resolveDocId(btn) {
    var card = btn.closest(".kb-doc-card");
    if (card) return card.getAttribute("data-id");
    return new URLSearchParams(window.location.search).get("id");
  }

  function resolveIsProject(btn) {
    var card = btn.closest(".kb-doc-card");
    if (card) return card.getAttribute("data-is-project") === "1";
    return window.location.pathname.indexOf("project.html") >= 0;
  }

  function ensureMenu() {
    if (menuEl) return menuEl;
    menuEl = document.createElement("div");
    menuEl.id = "kb-more-menu";
    menuEl.className = "kb-more-menu";
    menuEl.setAttribute("role", "menu");
    menuEl.hidden = true;
    menuEl.innerHTML =
      '<button type="button" class="kb-more-menu__item" role="menuitem" data-action="open">' +
      ICON_OPEN +
      "Открыть</button>" +
      '<button type="button" class="kb-more-menu__item" role="menuitem" data-action="download">' +
      ICON_DL +
      "Скачать</button>" +
      '<button type="button" class="kb-more-menu__item" role="menuitem" data-action="share">' +
      ICON_SHARE +
      "Поделиться</button>" +
      '<button type="button" class="kb-more-menu__item" role="menuitem" data-action="access">' +
      ICON_LOCK +
      "Настроить доступ</button>" +
      '<hr class="kb-more-menu__sep" />' +
      '<button type="button" class="kb-more-menu__item kb-more-menu__item--danger" role="menuitem" data-action="delete">' +
      ICON_TRASH +
      "Удалить</button>";
    document.body.appendChild(menuEl);
    menuEl.querySelectorAll("[data-action]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var action = btn.getAttribute("data-action");
        var id = activeDocId;
        closeMenu();
        if (action === "open" && id) {
          window.location.href = docUrl(id, activeIsProject);
        }
      });
    });
    return menuEl;
  }

  function closeMenu() {
    if (!menuEl || menuEl.hidden) return;
    menuEl.hidden = true;
    if (triggerEl) {
      triggerEl.classList.remove("is-open");
      triggerEl.setAttribute("aria-expanded", "false");
    }
    triggerEl = null;
    activeDocId = null;
    activeIsProject = false;
  }

  function positionMenu(btn) {
    var menu = ensureMenu();
    menu.hidden = false;
    menu.style.visibility = "hidden";
    menu.style.top = "0";
    menu.style.left = "0";
    var menuRect = menu.getBoundingClientRect();
    var rect = btn.getBoundingClientRect();
    var gap = 6;
    var top = rect.bottom + gap;
    var left = rect.right - menuRect.width;
    if (left < 8) left = 8;
    if (left + menuRect.width > window.innerWidth - 8) {
      left = window.innerWidth - menuRect.width - 8;
    }
    if (top + menuRect.height > window.innerHeight - 8) {
      top = rect.top - menuRect.height - gap;
    }
    menu.style.top = top + "px";
    menu.style.left = left + "px";
    menu.style.visibility = "";
  }

  function openMenu(btn) {
    activeDocId = resolveDocId(btn);
    activeIsProject = resolveIsProject(btn);
    triggerEl = btn;
    btn.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    positionMenu(btn);
  }

  document.addEventListener("click", function (e) {
    var moreBtn = e.target.closest("[data-kb-more]");
    if (moreBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (triggerEl === moreBtn && menuEl && !menuEl.hidden) {
        closeMenu();
      } else {
        closeMenu();
        openMenu(moreBtn);
      }
      return;
    }
    if (!e.target.closest("#kb-more-menu")) closeMenu();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  window.addEventListener("resize", closeMenu);
  window.addEventListener("scroll", closeMenu, true);
})();
