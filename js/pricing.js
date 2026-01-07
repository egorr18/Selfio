document.addEventListener("DOMContentLoaded", () => {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

    const qs = new URLSearchParams(location.search);
    const mode = (qs.get("mode") || "public").trim().toLowerCase(); // public | view | change
    const back = (qs.get("back") || "").trim();
    const pref = (qs.get("pref") || "").trim().toLowerCase();

    const normalizePlan = (p) => {
        p = String(p || "").trim().toLowerCase();
        return p === "free" || p === "pro" || p === "premium" ? p : "";
    };

    // поточний юзер
    const token = localStorage.getItem(TOKEN_KEY);
    const email = (localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
    const perEmailKey = `${PLAN_KEY}:${email || "anon"}`;

    // дістаємо план: спочатку "поточний", потім per-email
    const storedCurrent = normalizePlan(localStorage.getItem(PLAN_KEY));
    const storedPerEmail = normalizePlan(localStorage.getItem(perEmailKey));
    const currentPlan = storedCurrent || storedPerEmail;

    // ---- Back кнопка (якщо прийшли з app/settings) ----
    const hero = document.querySelector(".page-hero__content");
    if (hero && (mode === "view" || mode === "change")) {
        const wrap = document.createElement("div");
        wrap.style.marginTop = "12px";
        wrap.style.display = "flex";
        wrap.style.gap = "10px";
        wrap.style.flexWrap = "wrap";

        const backBtn = document.createElement("a");
        backBtn.className = "btn btn--ghost";
        backBtn.textContent = "Back";
        backBtn.href = back || "javascript:void(0)";
        if (!back) backBtn.addEventListener("click", (e) => {
            e.preventDefault();
            history.back();
        });

        wrap.appendChild(backBtn);

        // якщо view-mode і логінений — покажемо який план
        if (mode === "view" && token) {
            const badge = document.createElement("span");
            badge.className = "mini";
            badge.style.alignSelf = "center";
            badge.textContent = `Your plan: ${(currentPlan || "—").toUpperCase()}`;
            wrap.appendChild(badge);
        }

        hero.appendChild(wrap);
    }

    // ---- Toggle (monthly/yearly) — залишаю просту логіку, працює як у тебе по data-* ----
    const labels = Array.from(document.querySelectorAll(".toggle-label[data-period]"));
    const prices = Array.from(document.querySelectorAll(".price"));

    function setPeriod(period) {
        labels.forEach((l) => l.classList.toggle("active", l.getAttribute("data-period") === period));
        prices.forEach((p) => {
            const v = p.getAttribute(`data-${period}`);
            if (v != null) p.textContent = `$${v}`;
        });
    }

    labels.forEach((l) => {
        l.addEventListener("click", () => setPeriod(l.getAttribute("data-period")));
    });

    // стартовий період — той, що active, або monthly
    const startPeriod = labels.find((l) => l.classList.contains("active"))?.getAttribute("data-period") || "monthly";
    setPeriod(startPeriod);

    // ---- MODE LOGIC ----
    const cards = Array.from(document.querySelectorAll(".pricing-card"));
    const planToShow = normalizePlan(pref) || currentPlan || "free";

    function disableCta(card, text) {
        const a = card.querySelector("a.btn");
        if (!a) return;
        a.removeAttribute("href");
        a.textContent = text;
        a.classList.remove("btn--primary");
        a.classList.add("btn--secondary");
        a.setAttribute("aria-disabled", "true");
        a.addEventListener("click", (e) => e.preventDefault());
    }

    if (mode === "view" && token) {
        // показуємо тільки поточний план, інші ховаємо
        cards.forEach((c) => {
            const p = normalizePlan(c.getAttribute("data-plan") || "");
            c.style.display = p === planToShow ? "" : "none";
            if (p === planToShow) disableCta(c, "Current plan");
        });
    }

    if (mode === "change" && token) {
        // можна змінювати: підсвічуємо pref (або current)
        cards.forEach((c) => {
            const p = normalizePlan(c.getAttribute("data-plan") || "");
            c.classList.toggle("pricing-card--featured", p === planToShow);

            // Перепишемо href так, щоб після choose-plan вернуло назад (в settings)
            const a = c.querySelector("a.btn");
            if (a && p) {
                const next = back || "app.html";
                a.href = `choose-plan.html?pref=${encodeURIComponent(p)}&next=${encodeURIComponent(next)}`;
            }
        });
    }

    // public (гостьовий) — нічого не чіпаємо
});
