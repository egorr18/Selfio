(function () {
  const path = location.pathname;

  const isEN = path.includes("/Selfio/en/");
  const isUK = path.includes("/Selfio/uk/");

  if (!isEN && !isUK) return;

  const currentLang = isEN ? "en" : "uk";
  const otherLang = currentLang === "en" ? "uk" : "en";

  const samePageOtherLang = path.replace(`/Selfio/${currentLang}/`, `/Selfio/${otherLang}/`);

  document.querySelectorAll("[data-lang]").forEach((a) => {
    const target = a.getAttribute("data-lang");
    const targetPath = path.replace(`/Selfio/${currentLang}/`, `/Selfio/${target}/`);

    a.href = targetPath;

    if (target === currentLang) a.setAttribute("aria-current", "true");

    a.addEventListener("click", () => {
      localStorage.setItem("selfio_lang", target);
    });
  });
})();
