document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY  = "selfio_plan";

    const titleEl = document.querySelector("[data-auth-title]");
    const textEl  = document.querySelector("[data-auth-text]");
    const noteEl  = document.querySelector("[data-auth-note]");

    const btnModeLogin    = document.querySelector("[data-mode='login']");
    const btnModeRegister = document.querySelector("[data-mode='register']");
    const btnSubmit       = document.querySelector("[data-submit]");

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

    const getMe = (token) =>
        fetch(`${API_BASE_URL}/me`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });

    const readBody = async (res) => {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
            try { return await res.json(); } catch { return {}; }
        }
        const text = await res.text();
        return text ? { message: text } : {};
    };

    const normalizePlan = (p) => {
        p = String(p || "").trim().toLowerCase();
        return (p === "free" || p === "pro" || p === "premium") ? p : "";
    };

    const planKeyForEmail = (email) => `selfio_plan:${String(email || "").trim().toLowerCase() || "anon"}`;

    // Render може прокидатися — легкий ping
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

    // ---------- MODE ----------
    let authMode = (String(qs.get("mode") || "login").toLowerCase() === "register")
        ? "register"
        : "login";

    function paintMode() {
        // Візуально: активна кнопка — primary, інша — secondary
        if (authMode === "login") {
            btnModeLogin?.classList.add("btn--primary");
            btnModeLogin?.classList.remove("btn--secondary");
            btnModeRegister?.classList.add("btn--secondary");
            btnModeRegister?.classList.remove("btn--primary");

            if (titleEl) titleEl.textContent = "Welcome back";
            if (textEl)  textEl.textContent  = "Sign in to continue your journaling journey.";
            if (noteEl)  noteEl.innerHTML     = 'New here? Select <b>Create account</b>.';
            if (btnSubmit) btnSubmit.textContent = "Sign in";
        } else {
            btnModeRegister?.classList.add("btn--primary");
            btnModeRegister?.classList.remove("btn--secondary");
            btnModeLogin?.classList.add("btn--secondary");
            btnModeLogin?.classList.remove("btn--primary");

            if (titleEl) titleEl.textContent = "Create account";
            if (textEl)  textEl.textContent  = "Create an account to start using Selfio.";
            if (noteEl)  noteEl.innerHTML     = 'Already have an account? Select <b>Sign in</b>.';
            if (btnSubmit) btnSubmit.textContent = "Create account";
        }
    }

    btnModeLogin?.addEventListener("click", () => {
        authMode = "login";
        paintMode();
    });

    btnModeRegister?.addEventListener("click", () => {
        authMode = "register";
        paintMode();
    });

    paintMode();

    // ---------- SUBMIT ----------
    let submitting = false;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;
        submitting = true;

        const email = form.querySelector("input[type='email']")?.value.trim() || "";
        const password = form.querySelector("input[type='password']")?.value || "";

        // disable UI
        btnModeLogin && (btnModeLogin.disabled = true);
        btnModeRegister && (btnModeRegister.disabled = true);
        btnSubmit && (btnSubmit.disabled = true);
        const prevSubmitText = btnSubmit ? btnSubmit.textContent : "";
        if (btnSubmit) btnSubmit.textContent = "Connecting...";

        try {
            if (!email || !password) {
                alert("Enter email and password");
                return;
            }

            // щоб не тягнути план з іншого акаунта
            localStorage.removeItem(PLAN_KEY);

            const ready = await ensureBackendReady();
            if (!ready) {
                alert("Server is waking up. Try again in 10–20 seconds.");
                return;
            }

            // ---------------- LOGIN ONLY ----------------
            if (authMode === "login") {
                const res = await post("/auth/login", { email, password });
                const data = await readBody(res);

                if (!res.ok) {
                    // якщо ти додаси 404 user_not_found — буде ще точніше
                    if (res.status === 404 && data?.error === "user_not_found") {
                        alert("You don’t have an account yet. Click “Create account”.");
                    } else if (res.status === 401) {
                        alert("Invalid email or password. If you don’t have an account yet, click “Create account”.");
                    } else {
                        alert(data?.message || data?.error || `Login failed: ${res.status}`);
                    }
                    return;
                }

                const token = data?.token;
                if (!token) {
                    alert("Login succeeded but token is missing");
                    return;
                }

                localStorage.setItem(TOKEN_KEY, token);
                localStorage.setItem(EMAIL_KEY, email);

                // синхронізуємо план з БД (щоб UI показував правильне)
                try {
                    const meRes = await getMe(token);
                    if (meRes.ok) {
                        const me = await meRes.json();
                        const plan = normalizePlan(me?.plan);
                        if (plan) {
                            localStorage.setItem(PLAN_KEY, plan);
                            localStorage.setItem(planKeyForEmail(email), plan);
                        }
                    }
                } catch {}

                // якщо плану нема в localStorage — на choose-plan
                const savedPlan = normalizePlan(localStorage.getItem(planKeyForEmail(email)));
                if (!savedPlan) {
                    window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
                    return;
                }

                window.location.href = next;
                return;
            }

            // ---------------- REGISTER ONLY ----------------
            const reg = await post("/auth/register", { email, password });
            const regData = await readBody(reg);

            if (!reg.ok) {
                if (reg.status === 409) {
                    alert("This account already exists. Click “Sign in”.");
                } else {
                    alert(regData?.message || regData?.error || `Register failed: ${reg.status}`);
                }
                return;
            }

            // якщо register повернув token — ок. Якщо ні — робимо login
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

            // після реєстрації завжди на choose-plan
            window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
        } catch (err) {
            console.error(err);
            alert("Backend is not reachable");
        } finally {
            submitting = false;
            btnModeLogin && (btnModeLogin.disabled = false);
            btnModeRegister && (btnModeRegister.disabled = false);
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.textContent = prevSubmitText || "Continue";
            }
        }
    });
});
