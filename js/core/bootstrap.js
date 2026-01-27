// js/core/bootstrap.js
(function () {
  const host = location.hostname;
  const path = location.pathname;

  // 1) Force HTTPS only on GitHub Pages (не чіпає localhost / 127.0.0.1)
  if (host.endsWith("github.io") && location.protocol !== "https:") {
    location.replace("https://" + location.host + location.pathname + location.search + location.hash);
    return;
  }

  // 2) Canonicalize /index.html -> /
  // Працює для .../Selfio/index.html (і не чіпає інші page/index.html якщо раптом з'являться)
  if (path.endsWith("/Selfio/index.html")) {
    location.replace(path.replace("/index.html", "/") + location.search + location.hash);
    return;
  }
})();
