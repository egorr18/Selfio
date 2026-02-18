(function () {
  const host = location.hostname;
  const path = location.pathname;

  if (host.endsWith("github.io") && location.protocol !== "https:") {
    location.replace("https://" + location.host + location.pathname + location.search + location.hash);
    return;
  }

  if (path.endsWith("/Selfio/index.html")) {
    location.replace(path.replace("/index.html", "/") + location.search + location.hash);
    return;
  }
})();
