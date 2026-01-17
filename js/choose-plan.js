document.addEventListener("DOMContentLoaded", () => {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY  = "selfio_plan";

    const qs = new URLSearchParams(location.search);
    const mode = (qs.get("mode") || "onboarding").trim().toLowerCase(); // onboarding | upgrade
    const nextRaw = (qs.get("next") || "app.html").trim();

    const toastEl = document.querySelector("[data-plan-toast]");
    const backBtn = document.querySelector("[data-back]");

    const paywall = document.querySelector("[data-paywall]");
    const paywallText = document.querySelector("[data-paywall-text]");
    const payBtn = document.querySelector("[data-pay]");
    const cancelPayBtn = document.querySelector("[data-cancel-pay]");

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        location.href = `signin.html?next=${encodeURIComponent("choose-plan.html" + location.search)}`;
        return;
    }

    const ALLOWED_BASE = new Set([
        "app.html","weekly.html","habits.html","account.html",
        "my-plan.html","choose-plan.html","signin.html",
    ]);

    function normalizePlan(p) {
        p = String(p || "").trim().toLowerCase();
        return (p === "free" || p === "pro" || p === "premium") ? p : "";
    }

    function rank(p) {
        if (p === "free") return 0;
        if (p === "pro") return 1;
        if (p === "premium") return 2;
        return -1;
    }

    function isPaid(p) {
        return p === "pro" || p === "premium";
    }

    function safeNext(raw) {
        let v = String(raw || "").trim();
        if (!v) return "app.html";

        const low = v.toLowerCase();
        if (low.startsWith("http:") || low.startsWith("https:") || low.startsWith("//") || low.startsWith("javascript:")) {
            return "app.html";
        }

        try { v = decodeURIComponent(v); } catch {}
        const base = v.split(/[?#]/)[0];
        if (!ALLOWED_BASE.has(base)) return "app.html";
        return v;
    }

    function toast(msg) {
        if (window.Selfio?.toast) return window.Selfio.toast(msg, "info", 1400);
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.style.display = "";
        setTimeout(() => (toastEl.style.display = "none"), 1600);
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

    cancelPayBtn?.addEventListener("click", hidePaywall);

    backBtn?.addEventListener("click", () => {
        if (history.length > 1) history.back();
        else location.href = "account.html";
    });

    // ---- local plan state ----
    const meEmail = String(localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
    const perKey = `selfio_plan:${meEmail || "anon"}`;

    let currentPlan = normalizePlan(localStorage.getItem(perKey) || localStorage.getItem(PLAN_KEY) || "");
    const nextSafe = safeNext(nextRaw);

    // ---- save plan local + try sync backend (non-blocking) ----
    async function syncPlanBackend(plan) {
        if (!window.Selfio?.apiFetch) return { ok: false, status: 0 };
        return await window.Selfio.apiFetch("/plan/select", {
            method: "POST",
            token,
            body: { plan },
        });
    }

    async function applyPlanAndGo(plan) {
        // 1) local save
        localStorage.setItem(perKey, plan);
        localStorage.setItem(PLAN_KEY, plan);

        // 2) sync (optional)
        try {
            toast("Saving plan...");
            const r = await syncPlanBackend(plan);
            if (r?.status === 401) {
                localStorage.removeItem(TOKEN_KEY);
                location.href = `signin.html?next=${encodeURIComponent("choose-plan.html" + location.search)}`;
                return;
            }
            // навіть якщо не ok — ми все одно йдемо далі
        } catch {}

        // 3) go next
        location.href = nextSafe;
    }

    // ---- Click handling (event delegation) ----
    document.addEventListener("click", async (e) => {
        const el = e.target.closest("[data-plan]");
        if (!el) return;

        // якщо це <a>, прибираємо дефолтний перехід
        e.preventDefault();

        const p = normalizePlan(el.getAttribute("data-plan"));
        if (!p) return;

        // UPGRADE MODE
        if (mode === "upgrade") {
            if (currentPlan && p === currentPlan) {
                toast("Current plan");
                return;
            }

            const cur = rank(currentPlan);
            const sel = rank(p);

            // downgrade / same -> одразу
            if (sel <= cur) {
                await applyPlanAndGo(p);
                return;
            }

            // upgrade to paid -> paywall
            if (sel > cur && isPaid(p)) {
                showPaywall(`Upgrade to ${p.toUpperCase()} — payment required (demo).`);
                payBtn && (payBtn.onclick = async () => {
                    hidePaywall();
                    await applyPlanAndGo(p);
                });
                return;
            }

            await applyPlanAndGo(p);
            return;
        }

        // ONBOARDING MODE (після реєстрації)
        if (p === "free") {
            await applyPlanAndGo("free");
            return;
        }

        showPaywall(`${p.toUpperCase()} selected. Payment required (demo).`);
        payBtn && (payBtn.onclick = async () => {
            hidePaywall();
            await applyPlanAndGo(p);
        });
    });
});
