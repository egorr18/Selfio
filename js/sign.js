document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY  = "selfio_plan";
    const PROVIDER_KEY = "selfio_auth_provider"; // "supabase" | "backend"

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
        "account.html",
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

    // allow forcing provider for testing
    const providerParam = String(qs.get("provider") || "").toLowerCase();
    const forceSupabase = providerParam === "supabase" || providerParam === "cloud";
    const forceBackend  = providerParam === "backend" || providerParam === "local";

    function hasSupabaseReady() {
        const cfg = window.Selfio?.config;
        return !!(
            cfg?.supabaseUrl &&
            cfg?.supabaseAnonKey &&
            window.supabase?.createClient &&
            window.Selfio?.cloud?.sb
        );
    }

    const useSupabase =
        !forceBackend &&
        (isGitHubPages || forceSupabase) &&
        hasSupabaseReady();

    // ---------- Backend config (old mode) ----------
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
        const text = await res.text().catch(() => "");
        return text ? { message: text } : {};
    };

    const normalizePlan = (p) => {
        p = String(p || "").trim().toLowerCase();
        return (p === "free" || p === "pro" || p === "premium") ? p : "";
    };

    const planKeyForEmail = (email) => `selfio_plan:${String(email || "").trim().toLowerCase() || "anon"}`;

    // Render wake up ping
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

    // ---------- MODE UI ----------
    let authMode = (String(qs.get("mode") || "login").toLowerCase() === "register")
        ? "register"
        : "login";

    function paintMode() {
        if (authMode === "login") {
            btnModeLogin?.classList.add("btn--primary");
            btnModeLogin?.classList.remove("btn--secondary");
            btnModeRegister?.classList.add("btn--secondary");
            btnModeRegister?.classList.remove("btn--primary");

            if (titleEl) titleEl.textContent = "Welcome back";
            if (textEl)  textEl.textContent  = "Sign in to continue your journaling journey.";
            if (noteEl)  noteEl.innerHTML    = 'New here? Select <b>Create account</b>.';
            if (btnSubmit) btnSubmit.textContent = "Sign in";
        } else {
            btnModeRegister?.classList.add("btn--primary");
            btnModeRegister?.classList.remove("btn--secondary");
            btnModeLogin?.classList.add("btn--secondary");
            btnModeLogin?.classList.remove("btn--primary");

            if (titleEl) titleEl.textContent = "Create account";
            if (textEl)  textEl.textContent  = "Create an account to start using Selfio.";
            if (noteEl)  noteEl.innerHTML    = 'Already have an account? Select <b>Sign in</b>.';
            if (btnSubmit) btnSubmit.textContent = "Create account";
        }
    }

    btnModeLogin?.addEventListener("click", () => { authMode = "login"; paintMode(); });
    btnModeRegister?.addEventListener("click", () => { authMode = "register"; paintMode(); });
    paintMode();

    function setUIBusy(busy, text = "Connecting...") {
        btnModeLogin && (btnModeLogin.disabled = busy);
        btnModeRegister && (btnModeRegister.disabled = busy);
        btnSubmit && (btnSubmit.disabled = busy);
        if (btnSubmit) btnSubmit.textContent = busy ? text : (authMode === "login" ? "Sign in" : "Create account");
    }

    // ---------- Supabase helpers ----------
    function sbClient() {
        if (!window.Selfio?.cloud?.sb) {
            throw new Error("Selfio.cloud is missing. Check that api.js does NOT overwrite window.Selfio.");
        }
        return window.Selfio.cloud.sb();
    }

    async function supaGetUser() {
        return await window.Selfio.cloud.getUser();
    }

    async function supaEnsureProfile(email) {
        await window.Selfio.cloud.ensureProfile(email);
    }

    async function supaReadProfilePlan(userId) {
        const client = sbClient();
        const { data, error } = await client
            .from("profiles")
            .select("plan")
            .eq("id", userId)
            .maybeSingle();

        if (error) throw error;
        return normalizePlan(data?.plan);
    }

    // ---------- SUBMIT ----------
    let submitting = false;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;
        submitting = true;

        const email = form.querySelector("input[type='email']")?.value.trim() || "";
        const password = form.querySelector("input[type='password']")?.value || "";

        setUIBusy(true, "Connecting...");

        try {
            if (!email || !password) {
                alert("Enter email and password");
                return;
            }

            // щоб не тягнути план з іншого акаунта
            localStorage.removeItem(PLAN_KEY);

            // =========================
            // ✅ SUPABASE MODE (GitHub Pages)
            // =========================
            if (useSupabase) {
                const client = sbClient();

                // login/register
                if (authMode === "login") {
                    const { data, error } = await client.auth.signInWithPassword({ email, password });
                    if (error) {
                        alert(error.message || "Supabase login failed");
                        return;
                    }

                    // store flags
                    localStorage.setItem(PROVIDER_KEY, "supabase");
                    localStorage.setItem(EMAIL_KEY, email.toLowerCase());

                    // keep something in TOKEN_KEY so old pages that check token won't block
                    const accessToken = data?.session?.access_token || "sb";
                    localStorage.setItem(TOKEN_KEY, accessToken);

                    // create/update profile
                    await supaEnsureProfile(email);

                    const user = await supaGetUser();
                    if (!user) {
                        alert("Signed in, but session is not available. Check Auth settings (email confirmation?).");
                        return;
                    }

                    // sync plan from profiles (if exists)
                    let plan = "";
                    try { plan = await supaReadProfilePlan(user.id); } catch {}
                    if (plan) {
                        localStorage.setItem(PLAN_KEY, plan);
                        localStorage.setItem(planKeyForEmail(email), plan);
                    }

                    // if no plan -> choose-plan
                    const savedPlan = normalizePlan(localStorage.getItem(planKeyForEmail(email)));
                    if (!savedPlan) {
                        window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}&provider=supabase`;
                        return;
                    }

                    window.location.href = next;
                    return;
                }

                // register
                const { data, error } = await client.auth.signUp({ email, password });
                if (error) {
                    alert(error.message || "Supabase register failed");
                    return;
                }

                localStorage.setItem(PROVIDER_KEY, "supabase");
                localStorage.setItem(EMAIL_KEY, email.toLowerCase());

                // If email confirmations are ON, session may be null here
                const accessToken = data?.session?.access_token;
                if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
                else localStorage.setItem(TOKEN_KEY, "sb");

                // try profile (works only if session exists)
                try { await supaEnsureProfile(email); } catch {}

                // after register -> choose plan
                window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}&provider=supabase`;
                return;
            }

            // =========================
            // ✅ BACKEND MODE (Local / Docker)
            // =========================
            const ready = await ensureBackendReady();
            if (!ready) {
                alert("Server is waking up. Try again in 10–20 seconds.");
                return;
            }

            if (authMode === "login") {
                const res = await post("/auth/login", { email, password });
                const data = await readBody(res);

                if (!res.ok) {
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

                localStorage.setItem(PROVIDER_KEY, "backend");
                localStorage.setItem(TOKEN_KEY, token);
                localStorage.setItem(EMAIL_KEY, email.toLowerCase());

                // sync plan from DB
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

                const savedPlan = normalizePlan(localStorage.getItem(planKeyForEmail(email)));
                if (!savedPlan) {
                    window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
                    return;
                }

                window.location.href = next;
                return;
            }

            // register backend
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

            // if register has no token -> login
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

            localStorage.setItem(PROVIDER_KEY, "backend");
            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(EMAIL_KEY, email.toLowerCase());

            window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
        } catch (err) {
            console.error(err);
            alert(String(err?.message || err || "Something went wrong"));
        } finally {
            submitting = false;
            setUIBusy(false);
        }
    });
});
