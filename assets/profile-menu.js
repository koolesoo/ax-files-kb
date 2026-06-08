(function () {
  "use strict";

  var panelEl = null;
  var triggerEl = null;

  var USER = window.__CURRENT_USER__ || {
    name: "Васильева Анна",
    role: "Младший аналитик | Эксперт",
    email: "a.vasilyeva@axenix.ru",
    avatar: "assets/avatars/anna-vasilyeva.webp",
  };

  var logoutModalEl = null;

  var MENU = [
    {
      label: "Личный кабинет",
      href: "profile.html",
      icon:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    },
    {
      label: "Мои публикации",
      href: "my-publications.html",
      icon:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    },
    {
      label: "Опубликовать материал",
      href: "new-material.html",
      icon:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>',
    },
    {
      label: "Редактировать профиль",
      href: "profile-edit.html",
      icon:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    },
    {
      label: "Настройки",
      href: "profile-settings.html",
      icon:
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    },
  ];

  var CHEVRON =
    '<svg class="profile-menu__chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderMenu() {
    return MENU.map(function (item) {
      return (
        '<li><a href="' +
        esc(item.href) +
        '" class="profile-menu__link">' +
        '<span class="profile-menu__link-icon" aria-hidden="true">' +
        item.icon +
        "</span>" +
        '<span class="profile-menu__link-label">' +
        esc(item.label) +
        "</span>" +
        CHEVRON +
        "</a></li>"
      );
    }).join("");
  }

  function refreshMenuList() {
    if (!panelEl) return;
    var list = panelEl.querySelector(".profile-menu__list");
    if (list) list.innerHTML = renderMenu();
  }

  function ensurePanel() {
    if (panelEl) return panelEl;

    var stale = document.getElementById("profile-menu");
    if (stale) stale.remove();

    panelEl = document.createElement("div");
    panelEl.id = "profile-menu";
    panelEl.className = "profile-menu";
    panelEl.setAttribute("role", "menu");
    panelEl.setAttribute("aria-label", "Меню профиля");
    panelEl.hidden = true;
    panelEl.innerHTML =
      '<div class="profile-menu__user">' +
      '<img class="profile-menu__avatar" src="' +
      esc(USER.avatar) +
      '" alt="" width="44" height="44" decoding="async" />' +
      '<div class="profile-menu__user-info">' +
      '<p class="profile-menu__name">' +
      esc(USER.name) +
      "</p>" +
      '<p class="profile-menu__role">' +
      esc(USER.role) +
      "</p></div></div>" +
      '<ul class="profile-menu__list">' +
      renderMenu() +
      "</ul>" +
      '<div class="profile-menu__footer">' +
      '<button type="button" class="profile-menu__logout" data-logout-confirm>' +
      '<span class="profile-menu__logout-icon" aria-hidden="true">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>' +
      "</span>" +
      '<span class="profile-menu__logout-label">Выйти из профиля</span>' +
      CHEVRON +
      "</button></div>";

    panelEl.addEventListener("click", function (e) {
      var link = e.target.closest(".profile-menu__link");
      if (!link) return;
      var href = link.getAttribute("href");
      if (!href || href === "#") return;
      e.preventDefault();
      e.stopPropagation();
      window.location.assign(href);
    });

    document.body.appendChild(panelEl);
    return panelEl;
  }

  function closePanel() {
    if (!panelEl || panelEl.hidden) return;
    panelEl.hidden = true;
    if (triggerEl) {
      triggerEl.classList.remove("is-open");
      triggerEl.setAttribute("aria-expanded", "false");
    }
    triggerEl = null;
  }

  function positionPanel(btn) {
    var panel = ensurePanel();
    panel.hidden = false;
    panel.style.visibility = "hidden";
    panel.style.top = "0";
    panel.style.left = "0";

    var rect = btn.getBoundingClientRect();
    var panelRect = panel.getBoundingClientRect();
    var gap = 10;
    var top = rect.bottom + gap;
    var left = rect.right - panelRect.width;

    if (left < 8) left = 8;
    if (left + panelRect.width > window.innerWidth - 8) {
      left = window.innerWidth - panelRect.width - 8;
    }
    if (top + panelRect.height > window.innerHeight - 8) {
      top = rect.top - panelRect.height - gap;
    }

    panel.style.top = top + "px";
    panel.style.left = left + "px";
    panel.style.visibility = "";
  }

  function openPanel(btn) {
    ensurePanel();
    refreshMenuList();
    triggerEl = btn;
    btn.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    positionPanel(btn);
  }

  function ensureLogoutModal() {
    if (logoutModalEl) return logoutModalEl;

    logoutModalEl = document.createElement("div");
    logoutModalEl.id = "logout-confirm-modal";
    logoutModalEl.className = "logout-modal";
    logoutModalEl.setAttribute("role", "dialog");
    logoutModalEl.setAttribute("aria-modal", "true");
    logoutModalEl.setAttribute("aria-labelledby", "logout-modal-title");
    logoutModalEl.hidden = true;
    logoutModalEl.innerHTML =
      '<div class="logout-modal__backdrop" data-logout-close aria-hidden="true"></div>' +
      '<div class="logout-modal__dialog">' +
      '<img class="logout-modal__avatar" src="' +
      esc(USER.avatar) +
      '" alt="" width="80" height="80" decoding="async" />' +
      '<h2 class="logout-modal__title" id="logout-modal-title">Выйти из профиля?</h2>' +
      '<div class="logout-modal__copy">' +
      '<p class="logout-modal__line">Вы выйдете из аккаунта</p>' +
      '<p class="logout-modal__user">' +
      esc(USER.name) +
      " • " +
      esc(USER.email) +
      "</p>" +
      '<p class="logout-modal__line">на этом устройстве. Несохранённые черновики останутся.</p>' +
      "</div>" +
      '<div class="logout-modal__actions">' +
      '<button type="button" class="logout-modal__btn logout-modal__btn--ghost" data-logout-close>Отмена</button>' +
      '<button type="button" class="logout-modal__btn logout-modal__btn--primary" id="logout-confirm-submit">Выйти</button>' +
      "</div></div>";

    document.body.appendChild(logoutModalEl);

    logoutModalEl.querySelectorAll("[data-logout-close]").forEach(function (el) {
      el.addEventListener("click", closeLogoutModal);
    });

    document.getElementById("logout-confirm-submit").addEventListener("click", function () {
      window.location.href = "index.html";
    });

    return logoutModalEl;
  }

  function openLogoutModal() {
    closePanel();
    ensureLogoutModal();
    logoutModalEl.hidden = false;
    document.body.style.overflow = "hidden";
    var cancelBtn = logoutModalEl.querySelector("[data-logout-close].logout-modal__btn");
    if (cancelBtn) cancelBtn.focus();
  }

  function closeLogoutModal() {
    if (!logoutModalEl || logoutModalEl.hidden) return;
    logoutModalEl.hidden = true;
    document.body.style.overflow = "";
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-logout-confirm]")) {
      e.preventDefault();
      e.stopPropagation();
      openLogoutModal();
      return;
    }

    var btn = e.target.closest("[data-profile-menu-toggle]");
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      if (triggerEl === btn && panelEl && !panelEl.hidden) {
        closePanel();
      } else {
        closePanel();
        openPanel(btn);
      }
      return;
    }
    if (!e.target.closest("#profile-menu")) closePanel();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (logoutModalEl && !logoutModalEl.hidden) {
      closeLogoutModal();
      return;
    }
    closePanel();
  });

  window.addEventListener("resize", closePanel);
  window.addEventListener("scroll", closePanel, true);

  document.querySelectorAll("[data-profile-menu-toggle]").forEach(function (btn) {
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");
  });
})();
