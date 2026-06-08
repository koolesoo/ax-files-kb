(function () {
  "use strict";

  document.querySelectorAll("[data-settings-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var on = btn.classList.toggle("is-on");
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  });
})();
