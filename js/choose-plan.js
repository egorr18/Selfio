document.addEventListener("DOMContentLoaded", async () => {
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
    let email = (localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();

    const isGitHubPages = location.hostname.endsWith("github.io");
    const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const API_BASE_URL = isLocalhost
        ? "http://localhost:8080"
        : "https://selfio-backend.onrender.com";

    if (!token) {
        location.href = `signin.html?next=${encodeURIComponent("choose-plan.html" + location.search)}`;
        return;
    }

    const normalizePlan = (p) => {
        p = String(p || "").trim().toLowerCase();
        return p === "free" || p === "pro" || p === "premium" ? p : "";
    };

    const planKeyForEmail = (e) => `selfio_plan:${(e || "anon").trim().toLowerCase()}`;

    function rank(p) {
        if (p === "free") return 0;
        if (p === "pro") return 1;
        if (p === "premium") return 2;
        return -1; // unknown
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

    function savePlanLocal(p) {
        const perKey = planKeyForEmail(email);
        localStorage.setItem(perKey, p);
        localStorage.setItem(PLAN_KEY, p); // для UI
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

    async function apiGet(path) {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
        });
        return res;
    }

    async function apiPost(path, body) {
        const res = await fetch(`${API_BASE_URL}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });
        return res;
    }

    async function readBody(res) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) return res.json();
        const text = await res.text();
        return text ? { message: text } : {};
    }

    async function fetchMePlan() {
        const res = await apiGet("/me");
        if (res.status === 401) {
            location.href = `signin.html?next=${encodeURIComponent("choose-plan.html" + location.search)}`;
            return { email: "", plan: "" };
        }
        if (!res.ok) {
            const data = await readBody(res);
            throw new Error(data?.message || data?.error || `GET /me failed: ${res.status}`);
        }
        const data = await readBody(res);
        return { email: String(data.email || "").toLowerCase(), plan: normalizePlan(data.plan) };
    }

    async function setPlanOnServer(plan) {
        const res = await apiPost("/plan/select", { plan });
        const data = await readBody(res);
        if (!res.ok) {
            throw new Error(data?.message || data?.error || `POST /plan/select failed: ${res.status}`);
        }
        // очікуємо { plan: "...", status: "ok" } або щось подібне
        return normalizePlan(data.plan) || plan;
    }

    // --- INIT: синхронізуємо реальний email/plan з бекенда ---
    let currentPlan = "";
    try {
        const me = await fetchMePlan();
        if (me.email) {
            email = me.email;
            localStorage.setItem(EMAIL_KEY, email);
        }
        currentPlan = me.plan || normalizePlan(localStorage.getItem(planKeyForEmail(email))) || "";
        if (currentPlan) savePlanLocal(currentPlan);
    } catch (e) {
        console.error(e);
        toast("Backend is not reachable");
        // не виходимо, але кнопки можуть не працювати коректно
    }

    let currentRank = rank(currentPlan);

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

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            if (history.length > 1) history.back();
            else location.href = "settings.html";
        });
    }

    let submitting = false;

    if (continueBtn) {
        continueBtn.addEventListener("click", async () => {
            const p = normalizePlan(selected);
            if (!p || submitting) return;

            // upgrade режим: поточний план не можна обрати
            if (mode === "upgrade" && currentPlan && p === currentPlan) return;

            const nextSafe = safeNext(next);

            const applyAndGo = async () => {
                submitting = true;
                continueBtn.disabled = true;
                try {
                    const serverPlan = await setPlanOnServer(p);
                    savePlanLocal(serverPlan);
                    currentPlan = serverPlan;
                    currentRank = rank(currentPlan);
                    hidePaywall();
                    location.href = nextSafe;
                } catch (e) {
                    console.error(e);
                    toast(e.message || "Failed to set plan");
                } finally {
                    submitting = false;
                    continueBtn.disabled = false;
                }
            };

            // якщо платний — показуємо “оплату”, але після неї реально шлемо в бек
            if (isPaid(p)) {
                showPaywall(`${p.toUpperCase()} selected. Payment required (demo).`);
                if (payBtn) {
                    payBtn.onclick = async () => {
                        await applyAndGo();
                    };
                }
                return;
            }

            // free / downgrade — одразу шлемо в бек
            await applyAndGo();
        });
    }

    lockCurrentPlanInUpgrade();

    if (!selected) selected = "";
    paintSelected();
});
