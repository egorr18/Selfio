document.addEventListener("DOMContentLoaded", async () => {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

    const emailEl = document.querySelector("[data-my-email]");
    const planEl = document.querySelector("[data-my-plan]");
    const statusEl = document.querySelector("[data-myplan-status]");
    const backBtn = document.querySelector("[data-back]");

    const token = localStorage.getItem(TOKEN_KEY);

    // якщо відкрили без логіну
    if (!token) {
        location.href = `signin.html?next=${encodeURIComponent("my-plan.html")}`;
        return;
    }

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            if (history.length > 1) history.back();
            else location.href = "settings.html";
        });
    }

    const isGitHubPages = location.hostname.endsWith("github.io");
    const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";

    const API_BASE_URL = isGitHubPages
        ? "https://selfio-backend.onrender.com"
        : (isLocalhost ? "http://localhost:8080" : "https://selfio-backend.onrender.com");

    const normalizePlan = (p) => {
        p = String(p || "").trim().toLowerCase();
        return p === "free" || p === "pro" || p === "premium" ? p : "";
    };

    const planKeyForEmail = (email) => `selfio_plan:${String(email || "").trim().toLowerCase() || "anon"}`;

    function showStatus(msg, type = "info") {
        if (!statusEl) return;
        statusEl.textContent = msg;
        statusEl.style.display = "";
        statusEl.style.opacity = "0.85";
        if (type === "error") statusEl.style.color = "rgb(160, 40, 40)";
        else statusEl.style.color = "";
    }

    try {
        showStatus("Loading…");

        const res = await fetch(`${API_BASE_URL}/me`, {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });

        if (res.status === 401) {
            // токен протух / невалідний
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(EMAIL_KEY);
            localStorage.removeItem(PLAN_KEY);
            location.href = `signin.html?next=${encodeURIComponent("my-plan.html")}`;
            return;
        }

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            showStatus(`Failed to load /me (${res.status}) ${text}`, "error");
            return;
        }

        const me = await res.json();
        const email = String(me?.email || "").trim().toLowerCase();
        const plan = normalizePlan(me?.plan);

        if (emailEl) emailEl.textContent = email || "—";
        if (planEl) planEl.textContent = plan ? plan.toUpperCase() : "—";

        // синхронізуємо localStorage
        if (email) localStorage.setItem(EMAIL_KEY, email);
        if (plan) {
            localStorage.setItem(PLAN_KEY, plan);
            if (email) localStorage.setItem(planKeyForEmail(email), plan);
        }

        showStatus(""); // прибираємо loading
        if (statusEl) statusEl.style.display = "none";
    } catch (e) {
        console.error(e);
        showStatus("Backend is not reachable. Try again.", "error");
    }
});
