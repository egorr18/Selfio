// js/sign.js
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

    const toast = window.Selfio?.toast || ((m) => alert(String(m)));

    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY  = "selfio_plan";
    const TOKEN_KEY = "selfio_token"; // тимчасово для сумісності з твоїми сторінками

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
        "account.html",
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

    // ---------- MODE ----------
    let authMode = (String(qs.get("mode") || "login").toLowerCase() === "register") ? "register" : "login";

    function paintMode() {
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

    btnModeLogin?.addEventListener("click", () => { authMode = "login"; paintMode(); });
    btnModeRegister?.addEventListener("click", () => { authMode = "register"; paintMode(); });
    paintMode();

    function normalizePlan(p) {
        p = String(p || "").trim().toLowerCase();
        return (p === "free" || p === "pro" || p === "premium") ? p : "";
    }

    function setSubmitting(on, text = "Connecting...") {
        btnModeLogin && (btnModeLogin.disabled = on);
        btnModeRegister && (btnModeRegister.disabled = on);
        if (btnSubmit) {
            btnSubmit.disabled = on;
            if (!btnSubmit.dataset.originalText) btnSubmit.dataset.originalText = btnSubmit.textContent;
            btnSubmit.textContent = on ? text : btnSubmit.dataset.originalText;
        }
    }

    // ---------- SUBMIT ----------
    let submitting = false;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;
        submitting = true;
        setSubmitting(true);

        try {
            const email = (form.querySelector("input[type='email']")?.value || "").trim();
            const password = String(form.querySelector("input[type='password']")?.value || "");

            if (!email || !password) {
                toast("Enter email and password", "err");
                return;
            }

            // ✅ Supabase Cloud mode only
            const cloud = window.Selfio?.cloud;
            const client = cloud?.client;

            if (!client) {
                toast("Supabase client is not ready. Check config.js + supabase CDN.", "err");
                return;
            }

            // Щоб не тягнути план з іншого акаунта
            localStorage.removeItem(PLAN_KEY);

            if (authMode === "login") {
                const { data, error } = await client.auth.signInWithPassword({ email, password });
                if (error) {
                    toast(error.message || "Login failed", "err");
                    return;
                }

                // session може бути в data.session, а може бути через getSession()
                const session = data?.session || await cloud.getSession();
                if (!session) {
                    toast("Signed in, but no session found. Check Auth settings.", "err");
                    return;
                }

                localStorage.setItem(EMAIL_KEY, email.toLowerCase());
                localStorage.setItem(TOKEN_KEY, session.access_token); // тимчасово для твоїх guard'ів

                // Підтягнути профіль (план/імʼя)
                let profile = null;
                try {
                    profile = await cloud.readProfile();
                    if (!profile) profile = await cloud.ensureProfile({ email });
                } catch (err) {
                    console.warn("Profile load/upsert failed:", err);
                }

                const plan = normalizePlan(profile?.plan);
                if (plan) localStorage.setItem(PLAN_KEY, plan);

                // Якщо план порожній — ведемо на choose-plan
                if (!plan) {
                    location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
                    return;
                }

                location.href = next;
                return;
            }

            // REGISTER
            const emailRedirectTo = new URL("signin.html?mode=login", location.href).toString();

            const { data, error } = await client.auth.signUp({
                email,
                password,
                options: { emailRedirectTo }
            });

            if (error) {
                // найчастіші кейси
                const msg = String(error.message || "");
                if (msg.toLowerCase().includes("rate limit")) {
                    toast("Email rate limit in Supabase. Disable Confirm email OR create user from dashboard (Add user).", "err", 6000);
                } else if (msg.toLowerCase().includes("disabled")) {
                    toast("Email signups are disabled in Supabase. Check: Email provider ON + User Signups ON + Save changes.", "err", 6000);
                } else {
                    toast(msg || "Register failed", "err");
                }
                return;
            }

            // Якщо Confirm email OFF -> session є одразу
            const session = data?.session || await cloud.getSession();
            if (!session) {
                toast("Account created. If Confirm email is ON, you must confirm via email first.", "info", 6000);
                return;
            }

            localStorage.setItem(EMAIL_KEY, email.toLowerCase());
            localStorage.setItem(TOKEN_KEY, session.access_token); // тимчасово

            // Створимо профіль одразу (план поки що буде free або порожній — як у тебе в таблиці)
            try { await cloud.ensureProfile({ email }); } catch {}

            // Після реєстрації — завжди на вибір плану
            location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
        } catch (err) {
            console.error(err);
            toast("Unexpected error. Check Console.", "err");
        } finally {
            submitting = false;
            setSubmitting(false);
        }
    });
});
