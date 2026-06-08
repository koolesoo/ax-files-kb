(function () {
  "use strict";

  var modalEl = null;
  var backdropEl = null;
  var context = {};

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement("div");
    modalEl.id = "proj-access-modal";
    modalEl.className = "proj-access-modal";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    modalEl.setAttribute("aria-labelledby", "proj-access-modal-title");
    modalEl.hidden = true;
    modalEl.innerHTML =
      '<div class="proj-access-modal__backdrop" data-proj-access-close aria-hidden="true"></div>' +
      '<div class="proj-access-modal__dialog">' +
      '<button type="button" class="proj-access-modal__close" data-proj-access-close aria-label="Закрыть">×</button>' +
      '<h2 class="proj-access-modal__title" id="proj-access-modal-title">Запрос доступа</h2>' +
      '<div class="proj-access-modal__resource">' +
      '<span class="proj-access-modal__resource-icon" id="proj-access-resource-icon" aria-hidden="true">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>' +
      "</span>" +
      '<div class="proj-access-modal__resource-info">' +
      '<p class="proj-access-modal__resource-name" id="proj-access-resource-name"></p>' +
      '<p class="proj-access-modal__resource-owner" id="proj-access-resource-owner"></p>' +
      "</div></div>" +
      '<label class="proj-access-modal__field">' +
      '<span class="proj-access-modal__label">Уровень доступа</span>' +
      '<span class="proj-access-modal__select-wrap">' +
      '<select class="proj-access-modal__select" id="proj-access-level">' +
      '<option value="reader">Читатель — просмотр и скачивание</option>' +
      '<option value="editor">Редактор — просмотр и редактирование</option>' +
      '<option value="owner">Владелец — полный доступ</option>' +
      "</select>" +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
      "</span></label>" +
      '<label class="proj-access-modal__field">' +
      '<span class="proj-access-modal__label">Обоснование</span>' +
      '<textarea class="proj-access-modal__textarea" id="proj-access-reason" rows="4" placeholder="Например: работаю над похожим проектом в нефтегазе, нужны эталонные регламенты"></textarea>' +
      "</label>" +
      '<p class="proj-access-modal__note">Запрос уйдёт владельцу папки. Согласование доступов регулируется регламентом ax.files.</p>' +
      '<div class="proj-access-modal__actions">' +
      '<button type="button" class="proj-access-modal__btn proj-access-modal__btn--ghost" data-proj-access-close>Отмена</button>' +
      '<button type="button" class="proj-access-modal__btn proj-access-modal__btn--primary" id="proj-access-submit">Отправить запрос</button>' +
      "</div></div>";

    document.body.appendChild(modalEl);
    backdropEl = modalEl.querySelector(".proj-access-modal__backdrop");

    modalEl.querySelectorAll("[data-proj-access-close]").forEach(function (el) {
      el.addEventListener("click", close);
    });

    document.getElementById("proj-access-submit").addEventListener("click", function () {
      var btn = document.getElementById("proj-access-submit");
      btn.disabled = true;
      btn.textContent = "Запрос отправлен";
      window.setTimeout(function () {
        btn.disabled = false;
        btn.textContent = "Отправить запрос";
        close();
      }, 900);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modalEl && !modalEl.hidden) close();
    });

    return modalEl;
  }

  function setResourceIcon(isFile, ext) {
    var iconEl = document.getElementById("proj-access-resource-icon");
    if (!iconEl) return;
    if (!isFile) {
      iconEl.className = "proj-access-modal__resource-icon";
      iconEl.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
      return;
    }
    var e = (ext || "pdf").toLowerCase();
    iconEl.className = "proj-access-modal__resource-icon proj-access-modal__resource-icon--" + e;
    iconEl.textContent = e.slice(0, 4);
  }

  function open(opts) {
    opts = opts || {};
    ensureModal();
    context = opts;

    var name = opts.itemName || opts.projectTitle || "Материал";
    var owner = opts.ownerName || "—";

    document.getElementById("proj-access-resource-name").textContent = name;
    document.getElementById("proj-access-resource-owner").textContent = "Владелец: " + owner;

    setResourceIcon(!!opts.itemName, opts.fileExt);

    var reason = document.getElementById("proj-access-reason");
    if (reason) reason.value = "";

    var level = document.getElementById("proj-access-level");
    if (level) level.value = "reader";

    modalEl.hidden = false;
    document.body.style.overflow = "hidden";
    if (reason) reason.focus();
  }

  function close() {
    if (!modalEl || modalEl.hidden) return;
    modalEl.hidden = true;
    document.body.style.overflow = "";
  }

  function bind(root, project) {
    if (!root) return;

    root.addEventListener("click", function (e) {
      var trigger = e.target.closest("[data-proj-access-request]");
      if (!trigger) return;
      e.preventDefault();

      var itemName = trigger.getAttribute("data-item-name") || "";
      var fileExt = trigger.getAttribute("data-item-ext") || "";

      open({
        projectTitle: project.title,
        ownerName: project.owner && project.owner.name,
        itemName: itemName || null,
        fileExt: fileExt || null,
      });
    });
  }

  window.ProjAccessModal = { open: open, close: close, bind: bind };
})();
