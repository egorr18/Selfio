(function () {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

    // guard
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        location.href = "signin.html?next=plan.html";
        return;
    }

    const norm = (s) => String(s || "").trim().toLowerCase();
    const normalizePlan = (p) => (["free", "pro", "premium"].includes(norm(p)) ? norm(p) : "");

    const email = norm(localStorage.getItem(EMAIL_KEY));
    const planKey = `${PLAN_KEY}:${email || "anon"}`;

    // читаємо план строго для цього email, fallback — PLAN_KEY
    const stored = normalizePlan(localStorage.getItem(planKey)) || normalizePlan(localStorage.getItem(PLAN_KEY)) || "free";

    const PLANS = {
        free: {
            name: "Free",
            price: "$0",
            desc: "Great to start: daily check-in + tasks + habits.",
            badge: "FREE",
            features: [
                "Daily check-in",
                "Tasks + habits",
                "Up to 5 tasks/day",
                "No planning ahead",
            ],
        },
        pro: {
            name: "Pro",
            price: "$5",
            desc: "Unlock planning ahead + weekly goals.",
            badge: "PRO",
            features: [
                "Unlimited weeks",
                "History: 90 days",
                "Up to 15 habits",
                "Templates + streaks",
            ],
        },
        premium: {
            name: "Premium",
            price: "$10",
            desc: "Everything in Pro + deeper insights.",
            badge: "PREMIUM",
            features: [
                "Everything in Pro",
                "Insights (patterns & progress)",
                "Export (PDF/CSV)",
                "Priority support",
            ],
        },
    };

    const plan = PLANS[stored] || PLANS.free;

    // back link support
    const back = new URLSearchParams(location.search).get("back");
    const backBtn = document.querySelector("[data-back]");
    if (backBtn && back) backBtn.setAttribute("href", back);

    // render
    const nameEl = document.querySelector("[data-plan-name]");
    const priceEl = document.querySelector("[data-plan-price]");
    const descEl = document.querySelector("[data-plan-desc]");
    const badgeEl = document.querySelector("[data-plan-badge]");
    const ul = document.querySelector("[data-plan-features]");

    if (nameEl) nameEl.textContent = plan.name;
    if (priceEl) priceEl.textContent = plan.price ? `• ${plan.price}` : "";
    if (descEl) descEl.textContent = plan.desc;
    if (badgeEl) badgeEl.textContent = plan.badge;

    if (ul) {
        ul.innerHTML = "";
        plan.features.forEach((f) => {
            const li = document.createElement("li");
            li.textContent = f;
            ul.appendChild(li);
        });
    }

    // (опційно) підставляємо “pref” у change/upgrade лінк
    const change = document.querySelector("[data-change]");
    if (change) {
        const url = new URL(change.getAttribute("href"), location.href);
        url.searchParams.set("pref", stored === "premium" ? "premium" : "premium"); // завжди апгрейд-вверх
        change.setAttribute("href", url.pathname.replace(/.*\/pages\//, "") + "?" + url.searchParams.toString());
    }
})();
