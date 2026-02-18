(() => {
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

  function redirectToSignIn() {
    const next = encodeURIComponent("my-plan.html");
    location.replace(`signin.html?mode=login&next=${next}`);
  }

  async function init() {
    const page = document.body.getAttribute("data-page");
    if (page !== "my-plan") return;

    const cloud = window.Selfio?.cloud;
    const auth = window.Selfio?.auth;

    if (!cloud || !auth) {
      console.error("Selfio.cloud або Selfio.auth не ініціалізовані. Перевір order скриптів.");
      return redirectToSignIn();
    }

    let session = null;
    try {
      session = await auth.getSession();
    } catch (e) {
      console.error(e);
    }
    if (!session) return redirectToSignIn();

    let user = null;
    try {
      user = await cloud.getUser();
    } catch (e) {
      console.error(e);
    }
    if (!user) return redirectToSignIn();

    const email = normLower(user.email);

    try { await cloud.ensureProfile(); } catch (e) { console.error(e); }

    let plan = "free";
    try {
      const cloudPlan = await cloud.getMyPlan();
      plan = normalizePlan(cloudPlan || "free");
    } catch (e) {
      console.error(e);
    }

    setHeaderMeta(email, plan);
    render(email, plan);

    document.querySelector("[data-back]")?.addEventListener("click", () => {
      if (history.length > 1) history.back();
      else location.replace("account.html");
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
