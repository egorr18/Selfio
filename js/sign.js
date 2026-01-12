document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

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

    const post = (path, body) =>
        fetch(`${API_BASE_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

    const get = (path, token) =>
        fetch(`${API_BASE_URL}${path}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
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

    const planKeyForEmail = (email) => `selfio_plan:${String(email || "").trim().toLowerCase() || "anon"}`;

    async function pingBackendOnce() {
        try {
            const res = await fetch(`${API_BASE_URL}/health`, { method: "GET", cache: "no-store" });
            return res.ok;
        } catch {
            return false;
        }
    }

    async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

    async function ensureBackendReady() {
        const delays = [0, 1000, 2000, 4000];
        for (const d of delays) {
            if (d) await wait(d);
            if (await pingBackendOnce()) return true;
        }
        return false;
    }

    let submitting = false;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;
        submitting = true;

        const submitter = e.submitter; // яка кнопка натиснута
        const mode = submitter?.dataset?.auth === "register" ? "register" : "login";

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

            // чистимо UI-план (щоб не тягнути з іншого акаунта)
            localStorage.removeItem(PLAN_KEY);

            const ready = await ensureBackendReady();
            if (!ready) {
                alert("Server is waking up. Try again in 10–20 seconds.");
                return;
            }

            if (mode === "login") {
                // ✅ ТІЛЬКИ LOGIN
                const res = await post("/auth/login", { email, password });
                const data = await readBody(res);

                if (!res.ok) {
                    // якщо ти зробиш бекенд-фікс (404 user_not_found) — буде ідеально
                    if (res.status === 404 && data?.error === "user_not_found") {
                        alert("You don’t have an account yet. Click “Create account”.");
                    } else if (res.status === 401) {
                        alert("Invalid email or password. If you don’t have an account yet, click “Create account”.");
                    } else {
                        alert(data.error || data.message || `Login failed: ${res.status}`);
                    }
                    return;
                }

                const token = data?.token;
                if (!token) { alert("Login ok, but token missing"); return; }

                localStorage.setItem(TOKEN_KEY, token);
                localStorage.setItem(EMAIL_KEY, email);

                // підтягнемо план з /me якщо є
                try {
                    const meRes = await get("/me", token);
                    if (meRes.ok) {
                        const me = await meRes.json();
                        const plan = normalizePlan(me?.plan);
                        if (plan) {
                            localStorage.setItem(PLAN_KEY, plan);
                            localStorage.setItem(planKeyForEmail(email), plan);
                        }
                    }
                } catch {}

                // якщо плану нема (або ще не вибирали) — choose-plan
                const savedPlan = normalizePlan(localStorage.getItem(planKeyForEmail(email)));
                if (!savedPlan) {
                    window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
                    return;
                }

                window.location.href = next;
                return;
            }

            // mode === "register"
            // ✅ ТІЛЬКИ REGISTER
            const reg = await post("/auth/register", { email, password });
            const regData = await readBody(reg);

            if (!reg.ok) {
                if (reg.status === 409) {
                    alert("This account already exists. Click “Sign in”.");
                } else {
                    alert(regData.error || regData.message || `Register failed: ${reg.status}`);
                }
                return;
            }

            // якщо /auth/register повертає token — супер, якщо ні — робимо login
            let token = regData?.token;
            if (!token) {
                const login = await post("/auth/login", { email, password });
                const loginData = await readBody(login);
                if (!login.ok || !loginData?.token) {
                    alert("Registered, but can’t login automatically. Try Sign in.");
                    return;
                }
                token = loginData.token;
            }

            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(EMAIL_KEY, email);

            // після реєстрації — завжди на choose-plan
            window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
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
