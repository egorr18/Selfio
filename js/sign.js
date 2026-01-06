document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

    // next: куди йти після логіну
    const qs = new URLSearchParams(location.search);

    const ALLOWED_BASE = new Set([
        "app.html",
        "weekly.html",
        "habits.html",
        "settings.html",
        "choose-plan.html",
    ]);

    function sanitizeNext(raw) {
        let v = String(raw || "").trim();
        if (!v) return "app.html";

        // захист від зовнішніх редіректів
        const low = v.toLowerCase();
        if (low.startsWith("http:") || low.startsWith("https:") || low.startsWith("//") || low.startsWith("javascript:")) {
            return "app.html";
        }

        // якщо раптом прийшло double-encoded
        try { v = decodeURIComponent(v); } catch {}

        // перевіряємо базову сторінку (до ? або #)
        const base = v.split(/[?#]/)[0];
        if (!ALLOWED_BASE.has(base)) return "app.html";

        return v; // повертаємо ПОВНИЙ next з query (?pref=...)
    }

    const next = sanitizeNext(qs.get("next"));

    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const isServedByBackend = isLocal && location.port === "8080";

    const API_BASE_URL = isServedByBackend
        ? "" // same-origin (localhost:8080)
        : (isLocal ? "http://localhost:8080" : "https://selfio-backend.onrender.com");

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

    const planKeyForEmail = (email) => {
        const e = String(email || "").trim().toLowerCase();
        return `selfio_plan:${e || "anon"}`;
    };

    let submitting = false;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;
        submitting = true;

        const btn = form.querySelector("button[type='submit']");
        if (btn) btn.disabled = true;

        const email = form.querySelector("input[type='email']")?.value.trim() || "";
        const password = form.querySelector("input[type='password']")?.value || "";

        try {
            if (!email || !password) {
                alert("Enter email and password");
                return;
            }

            // не тягнемо “поточний” план з минулого акаунта
            localStorage.removeItem(PLAN_KEY);

            // 1) register (ok або 409 якщо вже існує)
            const reg = await post("/auth/register", { email, password });

            if (!(reg.ok || reg.status === 409)) {
                const data = await readBody(reg);
                alert(data.error || data.message || `Register failed: ${reg.status}`);
                return;
            }

            // 2) login
            const login = await post("/auth/login", { email, password });
            const data = await readBody(login);

            if (!login.ok) {
                alert(data.error || data.message || `Login failed: ${login.status}`);
                return;
            }

            localStorage.setItem(TOKEN_KEY, data.token); // якщо інше поле — підстав
            localStorage.setItem(EMAIL_KEY, email);

            // 3) підтягуємо план саме для ЦЬОГО email
            const savedPlan = normalizePlan(localStorage.getItem(planKeyForEmail(email)));
            if (savedPlan) localStorage.setItem(PLAN_KEY, savedPlan);

            // 4) якщо плану нема — йдемо на choose-plan
            if (!savedPlan) {
                // якщо next вже є choose-plan з pref=..., не обгортай ще раз
                if (String(next).startsWith("choose-plan.html")) {
                    window.location.href = next;
                } else {
                    window.location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
                }
                return;
            }

            // 5) інакше — одразу туди, куди просили (включно з choose-plan?pref=premium...)
            window.location.href = next;
        } catch (err) {
            console.error(err);
            alert("Backend is not reachable");
        } finally {
            submitting = false;
            if (btn) btn.disabled = false;
        }
    });
});
