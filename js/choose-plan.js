(function () {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

    // --- auth guard (працює навіть якщо ти не підключиш app.js) ---
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        location.href = "signin.html?next=choose-plan.html";
        return;
    }

    // --- header meta (якщо немає app.js або хочеш дубль-надійність) ---
    const meta = document.querySelector("[data-app-meta]");
    if (meta) {
        const email = localStorage.getItem(EMAIL_KEY) || "Signed user";
        const plan = (localStorage.getItem(PLAN_KEY) || "—").toUpperCase();
        meta.textContent = `${email} • ${plan}`;
    }

    // --- logout (якщо немає app.js) ---
    document.querySelectorAll("[data-logout]").forEach((btn) => {
        btn.addEventListener("click", () => {
            localStorage.removeItem(TOKEN_KEY);
            location.href = "../index.html";
        });
    });

    // --- UI ---
    const cards = Array.from(document.querySelectorAll("[data-plan]"));
    const btnContinue = document.querySelector("[data-continue]");
    const toastEl = document.querySelector("[data-plan-toast]");

    let selected = localStorage.getItem(PLAN_KEY) || null;

    function toast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.style.display = "";
        setTimeout(() => (toastEl.style.display = "none"), 1400);
    }

    function paint() {
        cards.forEach((c) => {
            const on = c.getAttribute("data-plan") === selected;

            // мінімальні стилі без правок CSS
            c.style.outline = on ? "2px solid var(--brand)" : "1px solid rgba(0,0,0,.06)";
            c.style.boxShadow = on ? "0 10px 28px rgba(0,0,0,.10)" : "";
            c.style.transform = on ? "translateY(-2px)" : "";
        });

        if (btnContinue) btnContinue.disabled = !selected;
    }

    cards.forEach((c) => {
        c.addEventListener("click", () => {
            selected = c.getAttribute("data-plan");
            paint();
        });
    });

    if (btnContinue) {
        btnContinue.addEventListener("click", () => {
            if (!selected) return;

            localStorage.setItem(PLAN_KEY, selected);

            // оновити meta, якщо є
            if (meta) {
                const email = localStorage.getItem(EMAIL_KEY) || "Signed user";
                meta.textContent = `${email} • ${selected.toUpperCase()}`;
            }

            toast("Saved ✅");

            // за сценарієм: після вибору плану → Today
            setTimeout(() => (location.href = "app.html"), 250);
        });
    }

    paint();
})();
