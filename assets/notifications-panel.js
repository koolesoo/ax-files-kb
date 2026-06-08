(function () {
  "use strict";

  var panelEl = null;
  var triggerEl = null;

  var NOTIFICATIONS = [
    {
      id: "n1",
      unread: true,
      icon: "folder",
      tone: "blue",
      title: "Новый документ добавлен",
      time: "2 мин назад",
      text: "«Q3 Финансовый отчёт.pdf» добавлен в папку «Финансы»",
    },
    {
      id: "n2",
      unread: true,
      icon: "comment",
      tone: "blue",
      title: "Пользователь оценил файл",
      time: "1 ч назад",
      text: "Евгения Х. поставила 5 звёзд и оставила комментарий.",
    },
    {
      id: "n3",
      unread: false,
      icon: "gear",
      tone: "red",
      title: "Техническое уведомление",
      time: "4 ч назад",
      text: "База знаний будет недоступна сегодня ночью в связи с плановым обслуживанием",
    },
    {
      id: "n4",
      unread: false,
      icon: "calendar",
      tone: "purple",
      title: "Приглашение на встречу",
      time: "Вчера",
      text: "Марк А. приглашает Вас на встречу по теме «Обсуждение текущих задач»",
    },
  ];

  var ICONS = {
    folder:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    comment:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    gear:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    calendar:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  };

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function unreadCount() {
    return NOTIFICATIONS.filter(function (n) {
      return n.unread;
    }).length;
  }

  function renderItems() {
    return NOTIFICATIONS.map(function (n) {
      return (
        '<li class="notif-panel__item' +
        (n.unread ? " is-unread" : "") +
        '">' +
        '<span class="notif-panel__icon notif-panel__icon--' +
        esc(n.tone) +
        '" aria-hidden="true">' +
        (ICONS[n.icon] || ICONS.folder) +
        "</span>" +
        '<div class="notif-panel__body">' +
        '<div class="notif-panel__row">' +
        '<p class="notif-panel__title">' +
        esc(n.title) +
        '</p><span class="notif-panel__time">' +
        esc(n.time) +
        "</span></div>" +
        '<p class="notif-panel__text">' +
        esc(n.text) +
        "</p></div></li>"
      );
    }).join("");
  }

  function ensurePanel() {
    if (panelEl) return panelEl;

    panelEl = document.createElement("div");
    panelEl.id = "notif-panel";
    panelEl.className = "notif-panel";
    panelEl.setAttribute("role", "dialog");
    panelEl.setAttribute("aria-label", "Уведомления");
    panelEl.hidden = true;
    panelEl.innerHTML =
      '<div class="notif-panel__head">' +
      '<h2 class="notif-panel__heading">Уведомления</h2>' +
      '<button type="button" class="notif-panel__read-all" id="notif-read-all">Прочитать все</button>' +
      "</div>" +
      '<ul class="notif-panel__list" id="notif-list">' +
      renderItems() +
      "</ul>" +
      '<a href="#" class="notif-panel__footer">Все уведомления <span aria-hidden="true">›</span></a>';

    document.body.appendChild(panelEl);

    document.getElementById("notif-read-all").addEventListener("click", function (e) {
      e.preventDefault();
      NOTIFICATIONS.forEach(function (n) {
        n.unread = false;
      });
      document.getElementById("notif-list").innerHTML = renderItems();
      updateBadges();
    });

    panelEl.querySelector(".notif-panel__footer").addEventListener("click", function (e) {
      e.preventDefault();
      closePanel();
    });

    return panelEl;
  }

  function updateBadges() {
    var count = unreadCount();
    document.querySelectorAll("[data-notifications-toggle]").forEach(function (btn) {
      var dot = btn.querySelector(".notif-btn__dot");
      if (count > 0) {
        if (!dot) {
          dot = document.createElement("span");
          dot.className = "notif-btn__dot";
          dot.setAttribute("aria-hidden", "true");
          btn.appendChild(dot);
        }
      } else if (dot) {
        dot.remove();
      }
    });
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

    panel.style.position = "fixed";
    panel.style.top = top + "px";
    panel.style.left = left + "px";
    panel.style.visibility = "";
  }

  function openPanel(btn) {
    triggerEl = btn;
    btn.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    positionPanel(btn);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-notifications-toggle]");
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
    if (!e.target.closest("#notif-panel")) closePanel();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closePanel();
  });

  window.addEventListener("resize", closePanel);
  window.addEventListener("scroll", closePanel, true);

  document.querySelectorAll("[data-notifications-toggle]").forEach(function (btn) {
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-expanded", "false");
  });

  updateBadges();
})();
