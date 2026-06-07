/** Topbar / tabbar search → knowledge.html?q=... */
(function () {
  function goKnowledge(q) {
    var url = "knowledge.html";
    if (q && String(q).trim()) url += "?q=" + encodeURIComponent(String(q).trim());
    window.location.href = url;
  }

  function wireInput(input) {
    if (!input || input.dataset.kbWired) return;
    input.dataset.kbWired = "1";
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        goKnowledge(input.value);
      }
    });
  }

  document.querySelectorAll(".topbar-cluster > .search input, .app-tabbar__search input").forEach(wireInput);

  document.querySelectorAll("[data-nav-knowledge]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      var tag = el.tagName.toLowerCase();
      if (tag === "a") return;
      e.preventDefault();
      window.location.href = "knowledge.html";
    });
  });
})();
