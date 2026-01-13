(() => {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

    const VALID_PLANS = new Set(["free", "pro", "premium"]);

    function norm(s) { return String(s || "").trim(); }
    function normLower(s) { return norm(s).toLowerCase(); }
    function normalizePlan(p) {
        const v = normLower(p);
        return VALID_PLANS.has(v) ? v : "";
    }

    function currentEmail() {
        return normLower(localStorage.getItem(EMAIL_KEY));
    }

    function planKeyForEmail(email) {
        return `${PLAN_KEY}:${email || "anon"}`;
    }

    // маскування пошти (щоб не світилась на My Plan)
    function maskEmail(email) {
        const s = String(email || "").trim();
        if (!s.includes("@")) return s || "—";

        const [name, domain] = s.split("@");
        if (!domain) return s;

        const safeName =
            name.length <= 2
                ? ((name[0] || "*") + "*")
                : (name.slice(0, 2) + "***");

        return `${safeName}@${domain}`;
    }

    // 1) джерело правди — план, прив’язаний до email
    function getPlanSelectedForCurrentUser() {
        const email = currentEmail();
        const perUser = normalizePlan(localStorage.getItem(planKeyForEmail(email)));
        if (perUser) {
            localStorage.setItem(PLAN_KEY, perUser); // синк для хедера
            return perUser;
        }
        return "";
    }

    // для UI/логіки: якщо не вибрано — вважаємо free
    function getPlan() {
        return getPlanSelectedForCurrentUser() || "free";
    }

    function requireAuth() {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
            location.replace(`signin.html?next=${encodeURIComponent("my-plan.html")}`);
            return false;
        }
        return true;
    }

    function requirePlanSelected() {
        const selected = getPlanSelectedForCurrentUser();
        if (!selected) {
            location.replace(`choose-plan.html?next=${encodeURIComponent("my-plan.html")}`);
            return false;
        }
        return true;
    }

    function setHeaderMeta() {
        const email = localStorage.getItem(EMAIL_KEY) || "—";
        const plan = (getPlanSelectedForCurrentUser() || "—").toUpperCase();
        const el = document.querySelector("[data-app-meta]");
        if (el) el.textContent = `${maskEmail(email)} • ${plan}`;
    }

    function bindLogout() {
        document.querySelectorAll("[data-logout]").forEach((btn) => {
            if (btn.dataset.bound === "1") return;
            btn.dataset.bound = "1";

            btn.addEventListener("click", (e) => {
                e.preventDefault();
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(EMAIL_KEY);
                localStorage.removeItem(PLAN_KEY);
                location.replace("../index.html");
            });
        });
    }

    function bindBack() {
        const btn = document.querySelector("[data-back]");
        if (!btn || btn.dataset.bound === "1") return;
        btn.dataset.bound = "1";

        btn.addEventListener("click", () => {
            if (history.length > 1) history.back();
            else location.href = "app.html";
        });
    }

    function renderAccount() {
        const email = localStorage.getItem(EMAIL_KEY) || "—";
        const selected = getPlanSelectedForCurrentUser();
        const planLabel = selected ? selected.toUpperCase() : "—";

        const emailEl = document.querySelector("[data-my-email]");
        const planEl = document.querySelector("[data-my-plan]");

        // тут маскуємо email
        if (emailEl) emailEl.textContent = maskEmail(email);
        if (planEl) planEl.textContent = planLabel;
    }

    function renderPlanCard() {
        const p = getPlan(); // free|pro|premium

        const PLAN_UI = {
            free: {
                badge: "FREE",
                name: "Free",
                price: "$0",
                desc: "Good to start and build the habit.",
                features: [
                    "Weekly planner (1 week)",
                    "Up to 3 habits",
                    "Up to 10 tasks / week",
                    "History: 7 days",
                ],
            },
            pro: {
                badge: "PRO",
                name: "Pro",
                price: "$5",
                desc: "For consistency and planning ahead.",
                features: [
                    "Unlimited weeks",
                    "History: 90 days",
                    "Up to 15 habits",
                    "Templates + streaks",
                ],
            },
            premium: {
                badge: "PREMIUM",
                name: "Premium",
                price: "$10",
                desc: "All features + deeper insights.",
                features: [
                    "Everything in Pro",
                    "Insights (patterns & progress)",
                    "Export (PDF/CSV)",
                    "Priority support",
                ],
            },
        };

        const ui = PLAN_UI[p] || PLAN_UI.free;

        const badgeEl = document.querySelector("[data-plan-badge]");
        const nameEl = document.querySelector("[data-plan-name]");
        const priceEl = document.querySelector("[data-plan-price]");
        const descEl = document.querySelector("[data-plan-desc]");
        const listEl = document.querySelector("[data-plan-features]");

        if (badgeEl) badgeEl.textContent = ui.badge;
        if (nameEl) nameEl.textContent = ui.name;
        if (priceEl) priceEl.textContent = ui.price;
        if (descEl) descEl.textContent = ui.desc;

        if (listEl) {
            listEl.innerHTML = "";
            ui.features.forEach((t) => {
                const li = document.createElement("li");
                li.textContent = t;
                listEl.appendChild(li);
            });
        }
    }

    // ===== init =====
    const page = document.body.getAttribute("data-page");
    if (page !== "my-plan") return;

    if (!requireAuth()) return;
    if (!requirePlanSelected()) return;

    setHeaderMeta();
    bindLogout();
    bindBack();

    renderAccount();
    renderPlanCard();
})();
