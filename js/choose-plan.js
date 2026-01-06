(function () {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

    const VALID_PLANS = new Set(["free", "pro", "premium"]);

    function norm(s) {
        return String(s || "").trim();
    }

    function normalizePlan(p) {
        const v = norm(p).toLowerCase();
        return VALID_PLANS.has(v) ? v : "";
    }

    // --- auth guard ---
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        location.href = "signin.html?next=choose-plan.html";
        return;
    }

    // --- tiny style (без правок твоїх CSS-файлів) ---
    (function injectStyle() {
        if (document.getElementById("choose-plan-style")) return;
        const st = document.createElement("style");
        st.id = "choose-plan-style";
        st.textContent = `
      [data-plan] { cursor: pointer; transition: transform .15s ease, box-shadow .15s ease, outline-color .15s ease; }
      [data-plan].plan--active { outline: 2px solid var(--brand); box-shadow: 0 10px 28px rgba(0,0,0,.10); transform: translateY(-2px); }
      [data-plan].plan--inactive { outline: 1px solid rgba(0,0,0,.08); }
      @media (prefers-reduced-motion: reduce) {
        [data-plan] { transition: none; }
      }
    `;
        document.head.appendChild(st);
    })();

    // --- header meta (навіть якщо app.js не підключений) ---
    const meta = document.querySelector("[data-app-meta]");
    if (meta) {
        const email = localStorage.getItem(EMAIL_KEY) || "Signed user";
        const plan = (normalizePlan(localStorage.getItem(PLAN_KEY)) || "—").toUpperCase();
        meta.textContent = `${email} • ${plan}`;
    }

    // --- logout ---
    document.querySelectorAll("[data-logout]").forEach((btn) => {
        btn.addEventListener("click", () => {
            localStorage.removeItem(TOKEN_KEY);
            location.href = "../index.html";
        });
    });

    // --- UI ---
    const cards = Array.from(document.querySelectorAll("[data-plan]"));
    const btnContinue = document.querySelector("[data-continue]");
    const toastEl = document.querySelector("[data-plan-toast]");

    let selected = normalizePlan(localStorage.getItem(PLAN_KEY)) || "";

    function toast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.style.display = "";
        setTimeout(() => (toastEl.style.display = "none"), 1400);
    }

    function paint() {
        cards.forEach((c) => {
            const p = normalizePlan(c.getAttribute("data-plan"));
            const on = p && p === selected;

            c.classList.toggle("plan--active", on);
            c.classList.toggle("plan--inactive", !on);

            // keyboard focus helper
            c.setAttribute("tabindex", "0");
            c.setAttribute("role", "button");
            c.setAttribute("aria-pressed", on ? "true" : "false");
        });

        if (btnContinue) btnContinue.disabled = !selected;
    }

    function selectPlan(p) {
        const v = normalizePlan(p);
        if (!v) return;
        selected = v;
        paint();
    }

    cards.forEach((c) => {
        c.addEventListener("click", () => selectPlan(c.getAttribute("data-plan")));

        c.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                selectPlan(c.getAttribute("data-plan"));
            }
        });
    });

    if (btnContinue) {
        btnContinue.addEventListener("click", () => {
            if (!selected) return;

            localStorage.setItem(PLAN_KEY, selected);

            // update meta instantly
            if (meta) {
                const email = localStorage.getItem(EMAIL_KEY) || "Signed user";
                meta.textContent = `${email} • ${selected.toUpperCase()}`;
            }

            toast("Saved ✅");
            setTimeout(() => (location.href = "app.html"), 250);
        });
    }

    paint();
})();
