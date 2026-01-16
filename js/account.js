(function () {
    function getUserFromStorage() {
        const candidates = ["selfio_user", "user", "me"];
        for (const k of candidates) {
            try {
                const raw = localStorage.getItem(k);
                if (!raw) continue;
                const obj = JSON.parse(raw);
                if (obj && (obj.email || obj.plan)) return obj;
            } catch {}
        }
        return {};
    }

    function pickFirst(keys) {
        for (const k of keys) {
            const v = localStorage.getItem(k);
            if (v) return v;
        }
        return "";
    }

    function fillUser() {
        const u = getUserFromStorage();
        const email = u.email || pickFirst(["selfio_email", "email", "user_email"]) || "—";
        const plan = (u.plan || pickFirst(["selfio_plan", "plan", "user_plan"]) || "FREE")
            .toString()
            .toUpperCase();

        document.querySelectorAll("[data-user-email]").forEach(el => (el.textContent = email));
        document.querySelectorAll("[data-user-plan]").forEach(el => (el.textContent = plan));

        const emailInput = document.querySelector("[data-account-email]");
        if (emailInput) emailInput.value = email === "—" ? "" : email;

        const badge = document.querySelector("[data-plan-badge]");
        if (badge) badge.textContent = plan;
    }

    function logout() {
        ["token","access_token","auth_token","selfio_token","selfio_user","user","me","selfio_email","selfio_plan"]
            .forEach(k => { try { localStorage.removeItem(k); } catch {} });
        location.href = "signin.html?mode=login";
    }

    document.addEventListener("DOMContentLoaded", () => {
        fillUser();
        document.querySelectorAll("[data-logout]").forEach(btn => btn.addEventListener("click", logout));

        // Якщо є inline кнопка, клікає хедерну
        const inline = document.querySelector("[data-theme-toggle-inline]");
        const headerBtn = document.querySelector("[data-theme-toggle]");
        if (inline && headerBtn) inline.addEventListener("click", () => headerBtn.click());
    });
})();
