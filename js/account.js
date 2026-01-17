(() => {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY = "selfio_plan";

    const NAME_KEY = "selfio_name";
    const MEMBER_SINCE_KEY = "selfio_member_since";

    function norm(s) { return String(s || "").trim(); }
    function lower(s) { return norm(s).toLowerCase(); }

    function requireAuth() {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
            const next = encodeURIComponent("account.html");
            location.replace(`signin.html?next=${next}`);
            return false;
        }
        return true;
    }

    function keyForEmail(base, email) {
        return `${base}:${email || "anon"}`;
    }

    function getPlanForEmail(email) {
        // 1) як у тебе в app.js — план прив’язаний до email
        const perUser = localStorage.getItem(keyForEmail(PLAN_KEY, email));
        if (perUser) return perUser;

        // 2) fallback
        return localStorage.getItem(PLAN_KEY) || "free";
    }

    function formatDate(iso) {
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return "—";
            return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
        } catch {
            return "—";
        }
    }

    function toast(el, msg) {
        if (!el) return;
        el.textContent = msg;
        el.style.display = "";
        clearTimeout(toast._t);
        toast._t = setTimeout(() => (el.style.display = "none"), 1400);
    }

    async function copyText(text) {
        const v = String(text || "");
        if (!v) return false;

        // modern
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(v);
                return true;
            }
        } catch {}

        // fallback
        try {
            const ta = document.createElement("textarea");
            ta.value = v;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand("copy");
            document.body.removeChild(ta);
            return ok;
        } catch {
            return false;
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        if (!requireAuth()) return;

        const email = lower(localStorage.getItem(EMAIL_KEY));
        const plan = String(getPlanForEmail(email)).toUpperCase();

        // fill email (profile + chip)
        const emailInput = document.querySelector("[data-account-email]");
        if (emailInput) emailInput.value = email || "";

        const chipEmail = document.querySelector("[data-user-email]");
        if (chipEmail) chipEmail.textContent = email || "—";

        const chipPlan = document.querySelector("[data-user-plan]");
        if (chipPlan) chipPlan.textContent = plan || "—";

        // plan badge inside page
        const planBadge = document.querySelector("[data-plan-badge]");
        if (planBadge) planBadge.textContent = plan || "—";

        // name (per user)
        const nameInput = document.querySelector("[data-account-name]");
        if (nameInput) {
            const savedName =
                localStorage.getItem(keyForEmail(NAME_KEY, email)) ||
                localStorage.getItem(NAME_KEY) ||
                "";

            const fallback = email && email.includes("@") ? email.split("@")[0] : "";
            nameInput.value = savedName || fallback;

            let t = null;
            nameInput.addEventListener("input", () => {
                clearTimeout(t);
                t = setTimeout(() => {
                    const v = norm(nameInput.value);
                    localStorage.setItem(keyForEmail(NAME_KEY, email), v);
                }, 250);
            });
        }

        // member since (per user)
        const sinceEl = document.querySelector("[data-member-since]");
        if (sinceEl) {
            const k = keyForEmail(MEMBER_SINCE_KEY, email);
            let iso = localStorage.getItem(k);
            if (!iso) {
                iso = new Date().toISOString();
                localStorage.setItem(k, iso);
            }
            sinceEl.textContent = formatDate(iso);
        }

        // copy email
        const copyBtn = document.querySelector("[data-copy-email]");
        const toastEl = document.querySelector("[data-copy-toast]");
        if (copyBtn) {
            copyBtn.addEventListener("click", async () => {
                const ok = await copyText(email);
                toast(toastEl, ok ? "Copied ✅" : "Copy failed");
            });
        }
    });
})();
