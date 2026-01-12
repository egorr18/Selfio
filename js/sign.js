document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY  = "selfio_plan";

    const qs = new URLSearchParams(location.search);

    const authText = document.querySelector("[data-auth-text]");
    const authNote = document.querySelector("[data-auth-note]");
    const btnModeLogin = document.querySelector("[data-mode='login']");
    const btnModeReg   = document.querySelector("[data-mode='register']");
    const submitBtn    = document.querySelector("[data-submit]");

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

    // ------------------ MODE SWITCH ------------------
    const modeParam = (qs.get("mode") || "login").trim().toLowerCase();
    let authMode = modeParam === "register" ? "register" : "login";

    function setMode(mode) {
        authMode = mode === "register" ? "register" : "login";

        btnModeLogin?.classList.toggle("is-active", authMode === "login");
        btnModeReg?.classList.toggle("is-active", authMode === "register");

        if (submitBtn) submitBtn.textContent = authMode === "register" ? "Create account" : "Sign in";

        if (authText) {
            authText.textContent =
                authMode === "register"
                    ? "Create an account to start your journaling journey."
                    : "Sign in to continue your journaling journey.";
        }

        if (authNote) {
            authNote.innerHTML =
                authMode === "register"
                    ? 'Already have an account? Select <b>Sign in</b>.'
                    : 'New here? Select <b>Create account</b>.';
        }

        // зберігаємо в URL
        const url = new URL(location.href);
        url.searchParams.set("mode", authMode);
        history.replaceState({}, "", url.toString());
    }

    btnModeLogin?.addEventListener("click", () => setMode("login"));
    btnModeReg?.addEventListener("click", () => setMode("register"));
    setMode(authMode);

    // ------------------ SUBMIT ------------------
    let submitting = false;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;
        submitting = true;

        const email = form.querySelector("input[type='email']")?.value.trim() || "";
        const password = form.querySelector("input[type='password']")?.value || "";

        // disable UI
        submitBtn && (submitBtn.disabled = true);
        btnModeLogin && (btnModeLogin.disabled = true);
        btnModeReg && (btnModeReg.disabled = true);

        try {
            if (!email || !password) {
                alert("Enter email and password");
                return;
            }

            // не тягнемо plan з іншого акаунта
            localStorage.removeItem(PLAN_KEY);

            const ready = await ensureBackendReady();
            if (!ready) {
                alert("Server is waking up. Try again in 10–20 seconds.");
                return;
            }

            if (authMode === "login") {
                // ТІЛЬКИ LOGIN
                const res = await post("/auth/login", { email, password });
                const data = await readBody(res);

                if (!res.ok) {
                    // Ідеальний кейс (коли бекенд повертає 404 user_not_found)
                    if (res.status === 404 && data?.error === "user_not_found") {
                        alert(`You don't have an account yet. Click "Create account".`);
                        // можна автоматично переключити:
                        setMode("register");
                        return;
                    }

                    // якщо бекенд ще не оновлений і повертає тільки 401
                    if (res.status === 401) {
                        alert(`Invalid email or password. If you don't have an account yet, click "Create account".`);
                        return;
                    }

                    alert(data?.error || data?.message || `Login failed: ${res.status}`);
                    return;
                }

                const token = data?.token;
                if (!token) {
                    alert("Login ok, but token missing");
                    return;
                }

                localStorage.setItem(TOKEN_KEY, token);
                localStorage.setItem(EMAIL_KEY, email);

                // підтягнемо plan з /me якщо є
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

                const savedPlan = normalizePlan(localStorage.getItem(planKeyForEmail(email)));
                if (!savedPlan) {
                    window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
                    return;
                }

                window.location.href = next;
                return;
            }

            // ТІЛЬКИ REGISTER
            const reg = await post("/auth/register", { email, password });
            const regData = await readBody(reg);

            if (!reg.ok) {
                if (reg.status === 409) {
                    alert('This account already exists. Click "Sign in".');
                    setMode("login");
                    return;
                }
                alert(regData?.error || regData?.message || `Register failed: ${reg.status}`);
                return;
            }

            // якщо /auth/register повертає token — супер, якщо ні — робимо login
            let token = regData?.token;
            if (!token) {
                const login = await post("/auth/login", { email, password });
                const loginData = await readBody(login);
                if (!login.ok || !loginData?.token) {
                    alert("Registered, but can't login automatically. Try Sign in.");
                    setMode("login");
                    return;
                }
                token = loginData.token;
            }

            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(EMAIL_KEY, email);

            // після реєстрації — завжди choose-plan
            window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
        } catch (err) {
            console.error(err);
            alert("Backend is not reachable");
        } finally {
            submitting = false;
            submitBtn && (submitBtn.disabled = false);
            btnModeLogin && (btnModeLogin.disabled = false);
            btnModeReg && (btnModeReg.disabled = false);
        }
    });
});
