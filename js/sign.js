document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";
    const VALID_PLANS = new Set(["free", "pro", "premium"]);

    const normalizePlan = (p) => {
        const v = String(p || "").trim().toLowerCase();
        return VALID_PLANS.has(v) ? v : "";
    };

    const safeNext = (next) => {
        const v = String(next || "").trim();
        // дозволяємо тільки локальні сторінки в /pages
        const allowed = new Set([
            "app.html",
            "weekly.html",
            "habits.html",
            "settings.html",
            "choose-plan.html",
        ]);
        return allowed.has(v) ? v : "";
    };

    const qs = new URLSearchParams(location.search);
    const next = safeNext(qs.get("next"));

    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const isServedByBackend = isLocal && location.port === "8080";

    const API_BASE_URL = isServedByBackend
        ? ""
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

            // 1) register (ok або 409 — норм)
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

            localStorage.setItem(TOKEN_KEY, data.token); // якщо у тебе інша назва — заміниш тут
            localStorage.setItem(EMAIL_KEY, email);

            const plan = normalizePlan(localStorage.getItem(PLAN_KEY));

            // якщо план ще не вибраний — ведемо на choose-plan
            if (!plan) {
                window.location.href = "choose-plan.html";
                return;
            }

            // якщо є next — туди, інакше в Today
            window.location.href = next || "app.html";
        } catch (err) {
            console.error(err);
            alert("Backend is not reachable");
        } finally {
            submitting = false;
            if (btn) btn.disabled = false;
        }
    });
});
