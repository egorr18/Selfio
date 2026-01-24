// js/my-plan.js
(() => {
  const EMAIL_KEY = "selfio_email";
  const PLAN_KEY = "selfio_plan";

  const VALID_PLANS = new Set(["free", "pro", "premium"]);
  const norm = (s) => String(s || "").trim();
  const normLower = (s) => norm(s).toLowerCase();
  const normalizePlan = (p) => (VALID_PLANS.has(normLower(p)) ? normLower(p) : "free");

  function maskEmail(email) {
    const s = String(email || "").trim();
    if (!s.includes("@")) return s || "—";
    const [name, domain] = s.split("@");
    const safeName = name.length <= 2 ? ((name[0] || "*") + "*") : (name.slice(0, 2) + "***");
    return `${safeName}@${domain}`;
  }

  function setHeaderMeta(email, plan) {
    const el = document.querySelector("[data-app-meta]");
    if (el) el.textContent = `${maskEmail(email)} • ${String(plan || "—").toUpperCase()}`;
  }

  function render(email, plan) {
    const emailEl = document.querySelector("[data-my-email]");
    const planEl = document.querySelector("[data-my-plan]");
    if (emailEl) emailEl.textContent = maskEmail(email);
    if (planEl) planEl.textContent = String(plan).toUpperCase();

    const PLAN_UI = {
      free: {
        badge: "FREE",
        name: "Free",
        price: "$0",
        desc: "Good to start and build the habit.",
        features: ["Weekly planner (1 week)", "Up to 3 habits", "Up to 10 tasks / week", "History: 7 days"],
      },
      pro: {
        badge: "PRO",
        name: "Pro",
        price: "$5",
        desc: "For consistency and planning ahead.",
        features: ["Unlimited weeks", "History: 90 days", "Up to 15 habits", "Templates + streaks"],
      },
      premium: {
        badge: "PREMIUM",
        name: "Premium",
        price: "$10",
        desc: "All features + deeper insights.",
        features: ["Everything in Pro", "Insights (patterns & progress)", "Export (PDF/CSV)", "Priority support"],
      },
    };

    const ui = PLAN_UI[plan] || PLAN_UI.free;

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

  async function init() {
    const page = document.body.getAttribute("data-page");
    if (page !== "my-plan") return;

    if (!window.Selfio?.cloud?.requireUser) {
      location.replace("signin.html?mode=login&next=" + encodeURIComponent("my-plan.html"));
      return;
    }

    const user = await window.Selfio.cloud.requireUser("signin.html?mode=login&next=" + encodeURIComponent("my-plan.html"));
    if (!user) return;

    const email = normLower(user.email);
    localStorage.setItem(EMAIL_KEY, email);

    let plan = normalizePlan(localStorage.getItem(PLAN_KEY));
    try {
      const cloudPlan = await window.Selfio.cloud.getMyPlan();
      if (cloudPlan) plan = normalizePlan(cloudPlan);
    } catch (_) {}

    localStorage.setItem(PLAN_KEY, plan);

    setHeaderMeta(email, plan);
    render(email, plan);

    const back = document.querySelector("[data-back]");
    back?.addEventListener("click", () => (history.length > 1 ? history.back() : location.replace("app.html")));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
