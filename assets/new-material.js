(function () {
  "use strict";

  document.querySelectorAll("[data-nm-type]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("[data-nm-type]").forEach(function (b) {
        b.classList.remove("is-active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-pressed", "true");
    });
  });
})();
