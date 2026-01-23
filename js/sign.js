// js/sign.js (Supabase auth)
document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

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

    function toast(msg) {
        window.Selfio?.toast ? window.Selfio.toast(msg) : alert(String(msg));
    }

    function setBusy(on) {
        btnModeLogin && (btnModeLogin.disabled = on);
        btnModeRegister && (btnModeRegister.disabled = on);
        if (btnSubmit) {
            btnSubmit.disabled = on;
            btnSubmit.textContent = on ? "Connecting..." : (authMode === "login" ? "Sign in" : "Create account");
        }
    }

    let submitting = false;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;
        submitting = true;
        setBusy(true);

        try {
            if (!window.Selfio?.cloud?.sb) {
                toast("Cloud is not ready: supabase.js or config.js missing.");
                return;
            }

            const email = (form.querySelector("input[type='email']")?.value || "").trim().toLowerCase();
            const password = form.querySelector("input[type='password']")?.value || "";

            if (!email || !password) {
                toast("Enter email and password");
                return;
            }

            const client = window.Selfio.cloud.sb();

            if (authMode === "register") {
                const { data, error } = await client.auth.signUp({ email, password });
                if (error) {
                    toast(error.message || "Register failed");
                    return;
                }

                // Записуємо локально (для UI)
                localStorage.setItem("selfio_email", email);
                if (!localStorage.getItem("selfio_plan")) localStorage.setItem("selfio_plan", "free");

                // Створюємо/оновлюємо профіль
                await window.Selfio.cloud.ensureProfile(email);

                // Після реєстрації — на вибір плану
                location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
                return;
            }

            // LOGIN
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) {
                toast(error.message || "Login failed");
                return;
            }

            localStorage.setItem("selfio_email", email);

            // підтягнути профіль/план
            await window.Selfio.cloud.ensureProfile(email);
            const prof = await window.Selfio.cloud.loadProfile().catch(() => null);

            const plan = (prof?.plan || localStorage.getItem("selfio_plan") || "free").toLowerCase();
            localStorage.setItem("selfio_plan", plan);

            // якщо плану нема (на всяк) — на choose-plan
            if (!plan) {
                location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
                return;
            }

            location.href = next;
        } catch (err) {
            console.error(err);
            toast("Auth error. Check console.");
        } finally {
            submitting = false;
            setBusy(false);
        }
    });
});
