document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

    const qs = new URLSearchParams(location.search);
    const defaultMode = (qs.get("mode") || "login").trim().toLowerCase(); // login | register

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
        if (low.startsWith("http:") || low.startsWith("https:") || low.startsWith("//") || low.startsWith("javascript:")) {
            return "app.html";
        }

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

    const post = (path, body, token) =>
        fetch(`${API_BASE_URL}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(body),
        });

    const get = (path, token) =>
        fetch(`${API_BASE_URL}${path}`, {
            method: "GET",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            cache: "no-store",
        });

    const readBody = async (res) => {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) return res.json();
        const text = await res.text();
        return text ? { message: text } : {};
    };

    const normalizePlan = (p) => {
        p = String(p || "").trim().toLowerCase();
        return p === "free" || p === "pro" || p === "premium" ? p : "";
    };

    const planKeyForEmail = (email) => `selfio_plan:${String(email || "anon").trim().toLowerCase()}`;

    async function pingBackendOnce() {
        try {
            const res = await fetch(`${API_BASE_URL}/health`, { method: "GET", cache: "no-store" });
            return res.ok;
        } catch {
            return false;
        }
    }

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    async function ensureBackendReady() {
        const delays = [0, 1000, 2000, 4000];
        for (const d of delays) {
            if (d) await wait(d);
            if (await pingBackendOnce()) return true;
        }
        return false;
    }

    async function fetchPlanFromServer(token) {
        try {
            const res = await get("/me", token);
            if (!res.ok) return "";
            const data = await res.json();
            return normalizePlan(data?.plan);
        } catch {
            return "";
        }
    }

    let submitting = false;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;
        submitting = true;

        const submitter = e.submitter; // кнопка, яку натиснули
        const mode = (submitter?.dataset?.auth || defaultMode || "login").toLowerCase(); // login | register

        const btnLogin = form.querySelector("[data-auth='login']");
        const btnRegister = form.querySelector("[data-auth='register']");
        if (btnLogin) btnLogin.disabled = true;
        if (btnRegister) btnRegister.disabled = true;

        const email = form.querySelector("input[type='email']")?.value.trim() || "";
        const password = form.querySelector("input[type='password']")?.value || "";

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

            const path = mode === "register" ? "/auth/register" : "/auth/login";
            const res = await post(path, { email, password });
            const data = await readBody(res);

            if (!res.ok) {
                if (mode === "register" && res.status === 409) {
                    alert("Account already exists. Click Sign in.");
                } else if (mode === "login" && res.status === 401) {
                    alert("Invalid email or password.");
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

            // беремо план з сервера (це важливо, щоб не було плутанини)
            let plan = await fetchPlanFromServer(token);

            // fallback: якщо /me не дав план — беремо localStorage per-email
            if (!plan) plan = normalizePlan(localStorage.getItem(planKeyForEmail(email)));

            if (plan) {
                localStorage.setItem(PLAN_KEY, plan);
                localStorage.setItem(planKeyForEmail(email), plan);
            }

            if (!plan) {
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
