(function () {
  // We assume URLs like:
  // /Selfio/en/...  or  /Selfio/uk/...
  const path = location.pathname;

  const isEN = path.includes("/Selfio/en/");
  const isUK = path.includes("/Selfio/uk/");

  // If we are not in en/uk (e.g., /Selfio/), do nothing
  if (!isEN && !isUK) return;

  const currentLang = isEN ? "en" : "uk";
  const otherLang = currentLang === "en" ? "uk" : "en";

  const samePageOtherLang = path.replace(`/Selfio/${currentLang}/`, `/Selfio/${otherLang}/`);

  document.querySelectorAll("[data-lang]").forEach((a) => {
    const target = a.getAttribute("data-lang"); // "en" or "uk"
    const targetPath = path.replace(`/Selfio/${currentLang}/`, `/Selfio/${target}/`);

    a.href = targetPath;

    // highlight active
    if (target === currentLang) a.setAttribute("aria-current", "true");

    a.addEventListener("click", () => {
      localStorage.setItem("selfio_lang", target);
    });
  });
})();
