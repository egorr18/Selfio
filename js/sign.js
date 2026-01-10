document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY  = "selfio_plan";

    const qs = new URLSearchParams(location.search);

    const ALLOWED_BASE = new Set([
        "app.html",
        "weekly.html",
        "habits.html",
        "settings.html",
        "choose-plan.html",
        "my-plan.html",
    ]);

    function sanitizeNext(raw) {
        let v = String(raw || "").trim();
        if (!v) return "app.html";

        const low = v.toLowerCase();
        if (
            low.startsWith("http:") ||
            low.startsWith("https:") ||
            low.startsWith("//") ||
            low.startsWith("javascript:")
        ) return "app.html";

        try { v = decodeURIComponent(v); } catch {}

        const base = v.split(/[?#]/)[0];
        if (!ALLOWED_BASE.has(base)) return "app.html";

        return v;
    }

    const next = sanitizeNext(qs.get("next"));

    const isGitHubPages = location.hostname.endsWith("github.io");
    const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";

    const API_BASE_URL = isGitHubPages
        ? "https://selfio-backend.onrender.com"
        : (isLocalhost ? "http://localhost:8080" : "https://selfio-backend.onrender.com");

    const post = (path, body) =>
        fetch(`${API_BASE_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

    const readBody = async (res) => {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) return res.json();
        const text = await res.text();
        return text ? { message: text } : {};
    };

    // --- Render wake-up ---
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    async function pingBackendOnce() {
        try {
            const res = await fetch(`${API_BASE_URL}/health`, { method: "GET", cache: "no-store" });
            return res.ok;
        } catch {
            return false;
        }
    }

    async function ensureBackendReady() {
        const delays = [0, 1000, 2000, 4000]; // ~7s total
        for (const d of delays) {
            if (d) await wait(d);
            if (await pingBackendOnce()) return true;
        }
        return false;
    }

    const normalizePlan = (p) => {
        p = String(p || "").trim().toLowerCase();
        return p === "free" || p === "pro" || p === "premium" ? p : "";
    };

    const planKeyForEmail = (email) => {
        const e = String(email || "").trim().toLowerCase();
        return `selfio_plan:${e || "anon"}`;
    };

    const btnLogin = form.querySelector("[data-auth='login']");
    const btnRegister = form.querySelector("[data-auth='register']");

    let submitting = false;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;
        submitting = true;

        // визначаємо, яка кнопка реально сабмітнула форму
        const submitter = e.submitter || document.activeElement;
        const mode = submitter?.getAttribute?.("data-auth") === "register" ? "register" : "login";

        const email = form.querySelector("input[type='email']")?.value.trim() || "";
        const password = form.querySelector("input[type='password']")?.value || "";

        if (btnLogin) btnLogin.disabled = true;
        if (btnRegister) btnRegister.disabled = true;

        try {
            if (!email || !password) {
                alert("Enter email and password");
                return;
            }

            localStorage.removeItem(PLAN_KEY);

            const ready = await ensureBackendReady();
            if (!ready) {
                alert("Server is not reachable right now (it may be waking up). Try again in 10–20 seconds.");
                return;
            }

            // 1) або login, або register
            let res = await post(mode === "register" ? "/auth/register" : "/auth/login", { email, password });

            // 2) якщо Register, але акаунт існує — робимо Login (щоб не стопорити юзера)
            if (mode === "register" && res.status === 409) {
                res = await post("/auth/login", { email, password });
            }

            const data = await readBody(res);

            if (!res.ok) {
                if (res.status === 401) {
                    alert("Invalid email or password.");
                } else if (res.status === 409) {
                    alert("Account already exists. Use Sign in.");
                } else {
                    alert(data.error || data.message || `${mode} failed: ${res.status}`);
                }
                return;
            }

            const token = data?.token;
            if (!token) {
                alert("Success, but token is missing in response");
                return;
            }

            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(EMAIL_KEY, email);

            // план: якщо бек повернув — добре; якщо ні — беремо localStorage per email
            const serverPlan = normalizePlan(data?.plan);
            const perEmailPlan = normalizePlan(localStorage.getItem(planKeyForEmail(email)));
            const finalPlan = serverPlan || perEmailPlan;

            if (finalPlan) {
                localStorage.setItem(PLAN_KEY, finalPlan);
                localStorage.setItem(planKeyForEmail(email), finalPlan);
            }

            // після реєстрації — одразу на вибір плану (логічно для онбордингу)
            if (mode === "register") {
                window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
                return;
            }

            // якщо плану нема — теж на choose-plan
            if (!finalPlan) {
                window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
                return;
            }

            window.location.href = next;
        } catch (err) {
            console.error(err);
            alert("Backend is not reachable");
        } finally {
            submitting = false;
            if (btnLogin) btnLogin.disabled = false;
            if (btnRegister) btnRegister.disabled = false;
        }
    });
});
