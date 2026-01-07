(function () {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

    const qs = new URLSearchParams(location.search);
    const mode = (qs.get("mode") || "").trim().toLowerCase(); // view | change | ""
    const pref = (qs.get("pref") || "").trim().toLowerCase(); // free|pro|premium
    const back = (qs.get("back") || "").trim();
    const nextRaw = (qs.get("next") || "app.html").trim();

    const token = localStorage.getItem(TOKEN_KEY);
    const email = (localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
    const planKey = `${PLAN_KEY}:${email || "anon"}`;

    const normalizePlan = (p) => {
        p = String(p || "").trim().toLowerCase();
        return p === "free" || p === "pro" || p === "premium" ? p : "";
    };

    const currentPlan =
        normalizePlan(localStorage.getItem(planKey)) ||
        normalizePlan(localStorage.getItem(PLAN_KEY)) ||
        "free";

    const cards = Array.from(document.querySelectorAll("[data-pricing-plan]"));
    const backBtn = document.querySelector("[data-back]");

    function setupBack() {
        if (!backBtn) return;
        if (mode !== "view") return;

        backBtn.style.display = "";
        backBtn.href = back || (token ? "app.html" : "../index.html");
    }

    function applyViewMode() {
        if (mode !== "view") return;

        cards.forEach((c) => {
            const p = normalizePlan(c.getAttribute("data-pricing-plan"));
            if (!p) return;

            if (p !== currentPlan) {
                c.style.display = "none";
            } else {
                c.style.outline = "2px solid var(--brand)";
                c.style.boxShadow = "0 10px 28px rgba(0,0,0,.10)";
            }
        });

        document.querySelectorAll(".pricing-card a.btn, .pricing-card button.btn").forEach((el) => {
            el.style.pointerEvents = "none";
            el.style.opacity = "0.6";
            el.setAttribute("aria-disabled", "true");
        });
    }

    function applyChangeMode() {
        if (mode !== "change") return;

        const p = normalizePlan(pref);
        if (!p) return;

        const next = nextRaw || "app.html";

        if (!token) {
            const afterSignin = `choose-plan.html?pref=${encodeURIComponent(p)}&next=${encodeURIComponent(next)}`;
            location.href = `signin.html?next=${encodeURIComponent(afterSignin)}`;
            return;
        }

        location.href = `choose-plan.html?pref=${encodeURIComponent(p)}&next=${encodeURIComponent(next)}`;
    }

    setupBack();
    applyViewMode();
    applyChangeMode();
})();
