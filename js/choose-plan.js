document.addEventListener("DOMContentLoaded", () => {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY  = "selfio_plan";

    const qs = new URLSearchParams(location.search);
    const mode = (qs.get("mode") || "onboarding").trim().toLowerCase(); // onboarding | upgrade
    const pref = (qs.get("pref") || "").trim().toLowerCase();
    const nextRaw = (qs.get("next") || "app.html").trim();

    const planBtns = Array.from(document.querySelectorAll("[data-plan]"));
    const toastEl = document.querySelector("[data-plan-toast]");
    const backBtn = document.querySelector("[data-back]");

    const paywall = document.querySelector("[data-paywall]");
    const paywallText = document.querySelector("[data-paywall-text]");
    const payBtn = document.querySelector("[data-pay]");
    const cancelPayBtn = document.querySelector("[data-cancel-pay]");

    const token = localStorage.getItem(TOKEN_KEY);

    // якщо відкрили choose-plan без логіну
    if (!token) {
        location.href = `signin.html?next=${encodeURIComponent("choose-plan.html" + location.search)}`;
        return;
    }

    const ALLOWED_BASE = new Set([
        "app.html",
        "weekly.html",
        "habits.html",
        "account.html",
        "my-plan.html",
        "choose-plan.html",
        "signin.html",
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

    // ------- API через api.js -------
    async function apiGetMe() {
        const r = await window.Selfio.apiFetch("/me", { method: "GET", token });
        if (r.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            location.href = `signin.html?next=${encodeURIComponent("choose-plan.html" + location.search)}`;
            return null;
        }
        if (!r.ok) throw new Error(r.data?.message || r.data?.error || `GET /me failed: ${r.status}`);
        return r.data;
    }

    async function apiSetPlan(plan) {
        // план синхронізуємо, але якщо бек лежить — не ламаємо UX
        const r = await window.Selfio.apiFetch("/plan/select", {
            method: "POST",
            token,
            body: { plan },
        });

        if (r.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            location.href = `signin.html?next=${encodeURIComponent("choose-plan.html" + location.search)}`;
            return null;
        }

        return r;
    }

    const planKeyForEmail = (e) => `selfio_plan:${String(e || "anon").trim().toLowerCase()}`;

    function savePlanLocal(email, plan) {
        const perKey = planKeyForEmail(email);
        localStorage.setItem(perKey, plan);
        localStorage.setItem(PLAN_KEY, plan);
    }

    function paintSelected(selected) {
        planBtns.forEach((b) => {
            const p = normalizePlan(b.getAttribute("data-plan"));
            b.style.outline = (p && p === selected) ? "2px solid rgba(45,106,92,0.45)" : "none";
        });
    }

    function disablePlanButtons(disabled) {
        planBtns.forEach((b) => (b.disabled = !!disabled));
    }

    let meEmail = String(localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
    let currentPlan = "";   // з бекенду
    let selected = normalizePlan(pref);

    async function applyPlanAndGo(plan) {
        const nextSafe = safeNext(nextRaw);
        disablePlanButtons(true);

        // 1) завжди зберігаємо локально одразу (це головне)
        savePlanLocal(meEmail, plan);

        // 2) пробуємо синхронізувати з беком (але НЕ блокуємо редірект)
        try {
            toast("Saving plan...");
            const r = await apiSetPlan(plan);
            if (!r || !r.ok) {
                toast("Saved locally (backend sync failed).");
            } else {
                toast(`Plan saved: ${plan.toUpperCase()}`);
            }
        } catch (e) {
            console.error(e);
            toast("Saved locally (backend unreachable).");
        }

        // 3) редірект
        location.href = nextSafe;
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

    async function init() {
        try {
            const me = await apiGetMe();
            if (!me) return;

            meEmail = String(me.email || "").trim().toLowerCase();
            currentPlan = normalizePlan(me.plan);

            localStorage.setItem(EMAIL_KEY, meEmail);
            if (currentPlan) savePlanLocal(meEmail, currentPlan);

            lockCurrentPlanInUpgrade();

            if (selected) paintSelected(selected);
        } catch (e) {
            console.error(e);
            // якщо бек недоступний — все одно дозволяємо вибір
            toast("Backend not reachable. You can still pick a plan locally.");
        }
    }

    planBtns.forEach((b) => {
        b.addEventListener("click", async () => {
            if (b.disabled) return;

            const p = normalizePlan(b.getAttribute("data-plan"));
            if (!p) return;

            selected = p;
            paintSelected(selected);

            // ✅ ГОЛОВНИЙ ФІКС:
            // onboarding — завжди дозволяємо вибрати навіть якщо currentPlan вже "free"
            if (mode !== "upgrade") {
                if (p === "free") {
                    await applyPlanAndGo("free");
                    return;
                }

                showPaywall(`${p.toUpperCase()} selected. Payment required (demo).`);
                payBtn && (payBtn.onclick = async () => {
                    hidePaywall();
                    await applyPlanAndGo(p);
                });
                return;
            }

            // -------- UPGRADE MODE логіка --------
            if (currentPlan && p === currentPlan) {
                toast("Current plan");
                return;
            }

            const currentRank = rank(currentPlan);
            const selRank = rank(p);

            // downgrade -> одразу
            if (selRank < currentRank) {
                await applyPlanAndGo(p);
                return;
            }

            // upgrade paid -> paywall
            if (selRank > currentRank && isPaid(p)) {
                showPaywall(`Upgrade to ${p.toUpperCase()} — payment required (demo).`);
                payBtn && (payBtn.onclick = async () => {
                    hidePaywall();
                    await applyPlanAndGo(p);
                });
                return;
            }

            toast("No changes");
        });
    });

    init();
});
