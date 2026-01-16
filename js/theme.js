(() => {
    const root = document.documentElement;
    const KEY = "selfio-theme";
    const BTN_SEL = "[data-theme-toggle]";

    function setTheme(theme) {
        if (theme === "dark" || theme === "light") {
            root.setAttribute("data-theme", theme);
        } else {
            root.removeAttribute("data-theme"); // system
        }
    }

    function updateButton(btn) {
        if (!btn) return;
        const t = root.getAttribute("data-theme");
        const isDark = t === "dark";
        btn.setAttribute("aria-pressed", String(isDark));
        btn.textContent = isDark ? "☀️" : "🌙";
    }
    
    // apply saved
    const saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") setTheme(saved);

    document.addEventListener("DOMContentLoaded", () => {
        updateButton(document.querySelector(BTN_SEL));
    });

    document.addEventListener("click", (e) => {
        const btn = e.target.closest(BTN_SEL);
        if (!btn) return;

        const current = root.getAttribute("data-theme");
        const next = current === "dark" ? "light" : "dark";
        setTheme(next);
        localStorage.setItem(KEY, next);
        updateButton(btn);
    });
})();
