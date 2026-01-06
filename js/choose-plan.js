(function () {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

    // guard: треба бути залогіненим
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
        location.href = "signin.html?next=choose-plan.html";
        return;
    }

    const email = (localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
    const planKey = `${PLAN_KEY}:${email || "anon"}`;

    const cards = Array.from(document.querySelectorAll("[data-plan]"));
    const btnContinue = document.querySelector("[data-continue]");
    const btnPricing = document.querySelector("[data-pricing]");
    const toastEl = document.querySelector("[data-plan-toast]");

    let selected = (localStorage.getItem(planKey) || "").trim().toLowerCase();

    // PREF з URL: choose-plan.html?pref=free|pro|premium
    const pref = (new URLSearchParams(location.search).get("pref") || "").trim().toLowerCase();
    if (["free", "pro", "premium"].includes(pref)) selected = pref;

    function toast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.style.display = "";
        setTimeout(() => (toastEl.style.display = "none"), 1400);
    }

    function paint() {
        cards.forEach((c) => {
            const on = c.getAttribute("data-plan") === selected;
            c.style.outline = on ? "2px solid var(--brand)" : "1px solid rgba(0,0,0,.06)";
            c.style.boxShadow = on ? "0 10px 28px rgba(0,0,0,.10)" : "";
            c.style.transform = on ? "translateY(-2px)" : "";
        });

        if (btnContinue) btnContinue.disabled = !selected;
    }

    cards.forEach((c) => {
        c.addEventListener("click", () => {
            selected = c.getAttribute("data-plan");
            paint();
        });
    });

    if (btnPricing) {
        btnPricing.addEventListener("click", () => {
            location.href = "pricing.html";
        });
    }

    if (btnContinue) {
        btnContinue.addEventListener("click", () => {
            if (!selected) return;

            // зберігаємо для цього email
            localStorage.setItem(planKey, selected);

            // і синхронізуємо “поточний” для хедера
            localStorage.setItem(PLAN_KEY, selected);

            toast("Saved ✅");

            const next = new URLSearchParams(location.search).get("next");
            setTimeout(() => {
                location.href = next ? next : "app.html";
            }, 200);
        });
    }

    paint();
})();
