(() => {
    const root = document.documentElement; // <html>
    const key = "theme"; // localStorage key
    const btn = document.querySelector("[data-theme-toggle]");

    // apply saved theme if exists
    const saved = localStorage.getItem(key);
    if (saved === "dark" || saved === "light") {
        root.dataset.theme = saved; // sets <html data-theme="dark">
    }

    const systemPrefersDark = () =>
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;

    const currentTheme = () =>
        root.dataset.theme || (systemPrefersDark() ? "dark" : "light");

    const paintBtn = () => {
        if (!btn) return;
        const t = currentTheme();
        btn.textContent = t === "dark" ? "☀️" : "🌙";
        btn.setAttribute("aria-label", t === "dark" ? "Switch to light" : "Switch to dark");
        btn.title = btn.getAttribute("aria-label");
    };

    paintBtn();

    // if user didn't pick manually, react to system changes
    const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    if (mq && mq.addEventListener) {
        mq.addEventListener("change", () => {
            if (!localStorage.getItem(key)) paintBtn();
        });
    }

    btn?.addEventListener("click", () => {
        const next = currentTheme() === "dark" ? "light" : "dark";
        root.dataset.theme = next;
        localStorage.setItem(key, next);
        paintBtn();
    });
})();
