document.addEventListener("DOMContentLoaded", () => {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY  = "selfio_plan";

    const qs = new URLSearchParams(location.search);
    const mode = (qs.get("mode") || "onboarding").trim().toLowerCase(); // onboarding | upgrade
    const pref = (qs.get("pref") || "").trim().toLowerCase();
    const next = (qs.get("next") || "app.html").trim();

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

    const normalizePlan = (p) => {
        p = String(p || "").trim().toLowerCase();
        return p === "free" || p === "pro" || p === "premium" ? p : "";
    };

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
        const v = String(raw || "").trim();
        const low = v.toLowerCase();
        if (!v) return "app.html";
        if (low.startsWith("http:") || low.startsWith("https:") || low.startsWith("//") || low.startsWith("javascript:")) {
            return "app.html";
        }
        return v;
    }

    function toast(msg) {
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

    // Back: якщо є history — назад, інакше в Settings
    backBtn?.addEventListener("click", () => {
        if (history.length > 1) history.back();
        else location.href = "settings.html";
    });

    // -------- API BASE (як у sign.js) --------
    const isGitHubPages = location.hostname.endsWith("github.io");
    const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";

    const API_BASE_URL = isGitHubPages
        ? "https://selfio-backend.onrender.com"
        : isLocalhost
            ? "http://localhost:8080"
            : "https://selfio-backend.onrender.com";

    async function readBody(res) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) return res.json();
        const text = await res.text();
        return text ? { message: text } : {};
    }

    async function apiGetMe() {
        const res = await fetch(`${API_BASE_URL}/me`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });

        if (res.status === 401) {
            // токен протух / невалідний
            localStorage.removeItem(TOKEN_KEY);
            location.href = `signin.html?next=${encodeURIComponent("choose-plan.html" + location.search)}`;
            return null;
        }

        const data = await readBody(res);
        if (!res.ok) throw new Error(data?.message || data?.error || `GET /me failed: ${res.status}`);
        return data;
    }

    async function apiSetPlan(plan) {
        const res = await fetch(`${API_BASE_URL}/plan/select`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ plan }),
        });

        const data = await readBody(res);
        if (res.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            location.href = `signin.html?next=${encodeURIComponent("choose-plan.html" + location.search)}`;
            return null;
        }
        if (!res.ok) throw new Error(data?.message || data?.error || `POST /plan/select failed: ${res.status}`);
        return data;
    }

    const planKeyForEmail = (e) => `selfio_plan:${(e || "anon").trim().toLowerCase()}`;

    function savePlanLocal(email, plan) {
        const perKey = planKeyForEmail(email);
        localStorage.setItem(perKey, plan);
        localStorage.setItem(PLAN_KEY, plan);
    }

    function paintSelected(selected) {
        planBtns.forEach((b) => {
            const p = normalizePlan(b.getAttribute("data-plan"));
            b.style.outline = p && p === selected ? "2px solid rgba(45,106,92,0.45)" : "none";
        });
    }

    function disablePlanButtons(disabled) {
        planBtns.forEach((b) => (b.disabled = !!disabled));
    }

    let meEmail = (localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
    let currentPlan = ""; // з бекенду
    let selected = normalizePlan(pref);

    async function applyPlanAndGo(plan) {
        const nextSafe = safeNext(next);
        disablePlanButtons(true);

        try {
            toast("Saving plan...");
            await apiSetPlan(plan); // ПИШЕМО В БД
            savePlanLocal(meEmail, plan); // кеш для UI
            toast(`Plan saved: ${plan.toUpperCase()}`);
            location.href = nextSafe;
        } catch (e) {
            console.error(e);
            alert(String(e?.message || e || "Failed to save plan"));
            disablePlanButtons(false);
        }
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

            // me: {id, email, plan, created_at}
            meEmail = String(me.email || "").trim().toLowerCase();
            currentPlan = normalizePlan(me.plan);

            localStorage.setItem(EMAIL_KEY, meEmail);
            if (currentPlan) savePlanLocal(meEmail, currentPlan);

            lockCurrentPlanInUpgrade();

            if (selected) paintSelected(selected);
        } catch (e) {
            console.error(e);
            alert(String(e?.message || e || "Failed to load user"));
        }
    }

    // клік по плану = дія (без Continue)
    planBtns.forEach((b) => {
        b.addEventListener("click", async () => {
            if (b.disabled) return;

            const p = normalizePlan(b.getAttribute("data-plan"));
            if (!p) return;

            selected = p;
            paintSelected(selected);

            // upgrade режим: поточний план не можна вибрати
            if (mode === "upgrade" && currentPlan && p === currentPlan) {
                toast("Current plan");
                return;
            }

            const currentRank = rank(currentPlan);
            const selRank = rank(p);

            // якщо плану ще немає або він пустий — це onboarding
            const hasPlan = currentPlan === "free" || currentPlan === "pro" || currentPlan === "premium";

            // ONBOARDING: free -> одразу, paid -> paywall
            if (!hasPlan) {
                if (p === "free") {
                    await applyPlanAndGo("free");
                    return;
                }

                showPaywall(`${p.toUpperCase()} selected. Payment required (demo).`);
                if (payBtn) {
                    payBtn.onclick = async () => {
                        hidePaywall();
                        await applyPlanAndGo(p);
                    };
                }
                return;
            }

            // якщо користувач вже має план:
            // downgrade (pro->free, premium->pro/free) -> безкоштовно одразу
            if (selRank < currentRank) {
                await applyPlanAndGo(p);
                return;
            }

            // upgrade на платний -> paywall
            if (selRank > currentRank && isPaid(p)) {
                showPaywall(`Upgrade to ${p.toUpperCase()} — payment required (demo).`);
                if (payBtn) {
                    payBtn.onclick = async () => {
                        hidePaywall();
                        await applyPlanAndGo(p);
                    };
                }
                return;
            }

            toast("No changes");
        });
    });

    init();
});
