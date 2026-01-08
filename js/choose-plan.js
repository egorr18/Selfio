document.addEventListener("DOMContentLoaded", () => {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

    const qs = new URLSearchParams(location.search);
    const mode = (qs.get("mode") || "onboarding").trim().toLowerCase(); // onboarding | upgrade
    const pref = (qs.get("pref") || "").trim().toLowerCase();
    const next = (qs.get("next") || "app.html").trim();

    const planBtns = Array.from(document.querySelectorAll("[data-plan]"));
    const continueBtn = document.querySelector("[data-continue]");
    const toastEl = document.querySelector("[data-plan-toast]");
    const backBtn = document.querySelector("[data-back]");

    const paywall = document.querySelector("[data-paywall]");
    const paywallText = document.querySelector("[data-paywall-text]");
    const payBtn = document.querySelector("[data-pay]");
    const cancelPayBtn = document.querySelector("[data-cancel-pay]");

    const token = localStorage.getItem(TOKEN_KEY);
    const email = (localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();

    // якщо раптом хтось відкрив choose-plan без логіну
    if (!token) {
        location.href = `signin.html?next=${encodeURIComponent("choose-plan.html" + location.search)}`;
        return;
    }

    const normalizePlan = (p) => {
        p = String(p || "").trim().toLowerCase();
        return p === "free" || p === "pro" || p === "premium" ? p : "";
    };

    const planKeyForEmail = (e) => `selfio_plan:${(e || "anon").trim().toLowerCase()}`;

    const currentPlan = normalizePlan(localStorage.getItem(planKeyForEmail(email)));
    const currentRank = rank(currentPlan);

    function rank(p) {
        if (p === "free") return 0;
        if (p === "pro") return 1;
        if (p === "premium") return 2;
        return -1; // no plan yet
    }

    function isPaid(p) {
        return p === "pro" || p === "premium";
    }

    function safeNext(raw) {
        // мінімальний захист від зовнішніх редіректів
        const v = String(raw || "").trim();
        const low = v.toLowerCase();
        if (!v) return "app.html";
        if (low.startsWith("http:") || low.startsWith("https:") || low.startsWith("//") || low.startsWith("javascript:"))
            return "app.html";
        return v;
    }

    function toast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.style.display = "";
        setTimeout(() => (toastEl.style.display = "none"), 1600);
    }

    function savePlan(p) {
        const perKey = planKeyForEmail(email);
        localStorage.setItem(perKey, p);
        localStorage.setItem(PLAN_KEY, p); // для UI
    }

    function lockCurrentPlanInUpgrade() {
        if (mode !== "upgrade") return;
        planBtns.forEach((b) => {
            const p = normalizePlan(b.getAttribute("data-plan"));
            if (p && p === currentPlan) {
                b.disabled = true;
                b.title = "Current plan";
            }
        });
    }

    let selected = normalizePlan(pref);

    function paintSelected() {
        planBtns.forEach((b) => {
            const p = normalizePlan(b.getAttribute("data-plan"));
            b.style.outline = p && p === selected ? "2px solid rgba(45,106,92,0.45)" : "none";
        });

        if (continueBtn) continueBtn.disabled = !selected;
    }

    planBtns.forEach((b) => {
        b.addEventListener("click", () => {
            if (b.disabled) return;
            selected = normalizePlan(b.getAttribute("data-plan"));
            paintSelected();
            toast(`Selected: ${selected.toUpperCase()}`);
        });
    });

    // Back: якщо є history — назад, інакше в Settings
    if (backBtn) {
        backBtn.addEventListener("click", () => {
            if (history.length > 1) history.back();
            else location.href = "settings.html";
        });
    }

    function showPaywall(text) {
        if (!paywall) return;
        if (paywallText) paywallText.textContent = text;
        paywall.style.display = "";
    }

    function hidePaywall() {
        if (!paywall) return;
        paywall.style.display = "none";
    }

    if (cancelPayBtn) cancelPayBtn.addEventListener("click", hidePaywall);

    if (continueBtn) {
        continueBtn.addEventListener("click", () => {
            const p = normalizePlan(selected);
            if (!p) return;

            // upgrade режим: поточний план не можна обрати
            if (mode === "upgrade" && currentPlan && p === currentPlan) return;

            const nextSafe = safeNext(next);

            // onboarding (план ще не вибрано)
            if (!currentPlan) {
                if (p === "free") {
                    savePlan("free");
                    location.href = nextSafe;
                    return;
                }
                // paid → показуємо "оплату"
                showPaywall(`${p.toUpperCase()} selected. Payment required (demo).`);
                if (payBtn) {
                    payBtn.onclick = () => {
                        savePlan(p);
                        hidePaywall();
                        location.href = nextSafe;
                    };
                }
                return;
            }

            // upgrade/downgrade коли план уже є
            const selRank = rank(p);

            // downgrade → безкоштовно
            if (selRank < currentRank) {
                savePlan(p);
                location.href = nextSafe;
                return;
            }

            // upgrade на платний → "оплата"
            if (selRank > currentRank && isPaid(p)) {
                showPaywall(`Upgrade to ${p.toUpperCase()} — payment required (demo).`);
                if (payBtn) {
                    payBtn.onclick = () => {
                        savePlan(p);
                        hidePaywall();
                        location.href = nextSafe;
                    };
                }
                return;
            }

            // якщо рівний (або upgrade free->free) — нічого
            toast("No changes");
        });
    }

    lockCurrentPlanInUpgrade();
    // автоселект: pref → або якщо onboarding і pref нема — нічого
    if (!selected) selected = "";
    paintSelected();
});
