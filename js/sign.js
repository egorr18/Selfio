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

    const authText = document.querySelector("[data-auth-text]");
    const authNote = document.querySelector("[data-auth-note]");
    const submitBtn = document.querySelector("[data-submit]");
    const modeBtns = Array.from(document.querySelectorAll("[data-mode]"));

    const emailInput = form.querySelector("input[type='email']");
    const passInput = form.querySelector("input[type='password']");

    // --- MODE ---
    function getInitialMode() {
        const m = (qs.get("mode") || "login").trim().toLowerCase();
        return m === "register" ? "register" : "login";
    }

    let mode = getInitialMode(); // "login" | "register"

    function paintMode() {
        modeBtns.forEach((b) => {
            const m = b.getAttribute("data-mode");
            b.classList.toggle("is-active", m === mode);
        });

        if (mode === "register") {
            if (submitBtn) submitBtn.textContent = "Create account";
            if (authText) authText.textContent = "Create your Selfio account.";
            if (authNote) authNote.innerHTML = `Already have an account? Select <b>Sign in</b>.`;
            if (passInput) passInput.autocomplete = "new-password";
        } else {
            if (submitBtn) submitBtn.textContent = "Sign in";
            if (authText) authText.textContent = "Sign in to continue your journaling journey.";
            if (authNote) authNote.innerHTML = `New here? Select <b>Create account</b>.`;
            if (passInput) passInput.autocomplete = "current-password";
        }

        // зберігаємо mode в URL, щоб refresh не скидав
        qs.set("mode", mode);
        history.replaceState(null, "", `${location.pathname}?${qs.toString()}`);
    }

    modeBtns.forEach((b) => {
        b.addEventListener("click", () => {
            mode = b.getAttribute("data-mode") === "register" ? "register" : "login";
            paintMode();
        });
    });

    paintMode();

    // --- SUBMIT ---
    let submitting = false;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;
        submitting = true;

        const email = (emailInput?.value || "").trim();
        const password = passInput?.value || "";

        if (submitBtn) submitBtn.disabled = true;

        try {
            if (!email || !password) {
                alert("Enter email and password");
                return;
            }

            // щоб не тягнути старе UI значення
            localStorage.removeItem(PLAN_KEY);

            const path = mode === "register" ? "/auth/register" : "/auth/login";
            const res = await post(path, { email, password });
            const data = await readBody(res);

            if (!res.ok) {
                // Ключова логіка: register НЕ логінить автоматично
                if (mode === "register" && res.status === 409) {
                    alert("Account already exists. Switch to Sign in.");
                    // можна автоматично переключити в login (але НЕ логінити)
                    mode = "login";
                    paintMode();
                    return;
                }

                if (mode === "login" && res.status === 401) {
                    alert("Invalid email or password.");
                    return;
                }

                alert(data?.error || data?.message || `${mode} failed: ${res.status}`);
                return;
            }

            const token = data?.token;
            if (!token) {
                alert("Success, but token is missing in response");
                return;
            }

            localStorage.setItem(TOKEN_KEY, token);
            localStorage.setItem(EMAIL_KEY, email);

            // якщо бек повертає plan — збережемо для UI
            const plan = normalizePlan(data?.plan);
            if (plan) localStorage.setItem(PLAN_KEY, plan);

            // якщо план порожній (у тебе може бути так в майбутньому) → onboarding
            if (!plan) {
                window.location.href = `choose-plan.html?mode=onboarding&next=${encodeURIComponent(next)}`;
                return;
            }

            // інакше просто вперед
            window.location.href = next;

        } catch (err) {
            console.error(err);
            alert("Backend is not reachable");
        } finally {
            submitting = false;
            if (submitBtn) submitBtn.disabled = false;
        }
    });
});
