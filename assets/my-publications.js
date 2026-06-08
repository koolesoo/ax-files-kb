(function () {
  "use strict";

  var tabs = document.querySelectorAll("[data-pub-filter]");
  var cards = document.querySelectorAll("[data-pub-status]");
  if (!tabs.length || !cards.length) return;

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      var filter = tab.getAttribute("data-pub-filter");

      tabs.forEach(function (t) {
        var active = t === tab;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });

      cards.forEach(function (card) {
        var status = card.getAttribute("data-pub-status");
        card.hidden = filter !== "all" && status !== filter;
      });
    });
  });
})();
