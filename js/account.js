document.addEventListener("DOMContentLoaded", () => {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY  = "selfio_plan";

    const token = localStorage.getItem(TOKEN_KEY);
    const emailLS = (localStorage.getItem(EMAIL_KEY) || "").trim();

    // якщо це сторінка app-zone і нема токена -> назад на login
    if (!token) {
        location.href = `signin.html?mode=login&next=${encodeURIComponent("account.html")}`;
        return;
    }

    // --------- helpers ----------
    const normalizePlan = (p) => {
        p = String(p || "").trim().toLowerCase();
        return (p === "free" || p === "pro" || p === "premium") ? p : "free";
    };

    const planPerks = (plan) => {
        if (plan === "premium") {
            return [
                "Premium active: templates + plan up to 8 weeks ahead.",
                "Month insights + trends.",
                "Push goals to Today (plan → tasks).",
            ];
        }
        if (plan === "pro") {
            return [
                "Pro active: plan goals for this week + next 2 weeks.",
                "Push goals to Today (plan → tasks).",
                "Upgrade to Premium for templates + 8 weeks + Month insights.",
            ];
        }
        return [
            "Free plan: basic weekly planning.",
            "Upgrade to Pro for next weeks planning.",
            "Upgrade to Premium for templates + insights.",
        ];
    };

    // --------- fill UI (email/plan/meta) ----------
    const emailInput = document.querySelector("[data-account-email]");
    const planBadge  = document.querySelector("[data-plan-badge]");
    const planPerksEl = document.querySelector("[data-plan-perks]");
    const metaEl = document.querySelector("[data-app-meta]");
    const memberSinceEl = document.querySelector("[data-member-since]");

    if (emailInput && emailLS) emailInput.value = emailLS;

    // get /me to sync plan (works with your backend already)
    (async () => {
        try {
            const res = await window.Selfio.apiFetch("/me", { method: "GET", token });
            if (!res.ok) return;

            const plan = normalizePlan(res.data?.plan || localStorage.getItem(PLAN_KEY));
            localStorage.setItem(PLAN_KEY, plan);

            // email could be returned too (if your /me returns it)
            const apiEmail = (res.data?.email || "").trim();
            const finalEmail = apiEmail || emailLS;
            if (finalEmail) localStorage.setItem(EMAIL_KEY, finalEmail);
            if (emailInput && finalEmail) emailInput.value = finalEmail;

            if (planBadge) planBadge.textContent = plan.toUpperCase();
            if (planPerksEl) planPerksEl.innerHTML = planPerks(plan).map(x => `${x}`).join("<br>");

            if (metaEl) metaEl.textContent = finalEmail ? `${finalEmail} • ${plan.toUpperCase()}` : plan.toUpperCase();

            // member since (якщо /me колись почне повертати created_at)
            const created = res.data?.created_at || res.data?.createdAt;
            if (memberSinceEl) {
                if (created) {
                    const d = new Date(created);
                    memberSinceEl.textContent = isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
                } else {
                    memberSinceEl.textContent = "—";
                }
            }
        } catch {}
    })();

    // --------- Copy email ----------
    const copyBtn = document.querySelector("[data-copy-email]");
    const copyToast = document.querySelector("[data-copy-toast]");
    copyBtn?.addEventListener("click", async () => {
        const val = (emailInput?.value || "").trim();
        if (!val) return;

        try {
            await navigator.clipboard.writeText(val);
            if (copyToast) {
                copyToast.style.display = "block";
                copyToast.textContent = "Copied!";
                setTimeout(() => {
                    copyToast.style.display = "none";
                    copyToast.textContent = "";
                }, 1200);
            }
            window.Selfio?.toast?.("Email copied", "success");
        } catch {
            window.Selfio?.toast?.("Can’t copy on this device", "error");
        }
    });

    // --------- Logout ----------
    const logoutBtn = document.querySelector("[data-logout]");
    logoutBtn?.addEventListener("click", () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(EMAIL_KEY);
        localStorage.removeItem(PLAN_KEY);
        location.href = `signin.html?mode=login&next=${encodeURIComponent("account.html")}`;
    });

    // --------- Change password ----------
    const pwForm = document.querySelector("[data-change-password]");
    if (pwForm) {
        const msg = pwForm.querySelector("[data-password-msg]");
        const btn = pwForm.querySelector("[data-save-password]");
        const curEl = pwForm.querySelector("#pw-current");
        const newEl = pwForm.querySelector("#pw-new");
        const conEl = pwForm.querySelector("#pw-confirm");

        pwForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (msg) msg.textContent = "";

            const current_password = (curEl?.value || "").trim();
            const new_password = (newEl?.value || "").trim();
            const confirm = (conEl?.value || "").trim();

            if (!current_password || !new_password || !confirm) {
                if (msg) msg.textContent = "Fill in all password fields.";
                return;
            }
            if (new_password.length < 6) {
                if (msg) msg.textContent = "New password must be at least 6 characters.";
                return;
            }
            if (new_password !== confirm) {
                if (msg) msg.textContent = "Passwords do not match.";
                return;
            }

            window.Selfio?.setLoading?.(btn, true, "Saving...");

            const res = await window.Selfio.apiFetch("/auth/change-password", {
                method: "POST",
                token,
                body: { current_password, new_password },
            });

            window.Selfio?.setLoading?.(btn, false);

            if (!res.ok) {
                const m = res.data?.message || res.data?.error || "Change password failed";
                if (msg) msg.textContent = m;
                window.Selfio?.toast?.(m, "error");
                return;
            }

            if (curEl) curEl.value = "";
            if (newEl) newEl.value = "";
            if (conEl) conEl.value = "";
            if (msg) msg.textContent = "Password updated successfully.";
            window.Selfio?.toast?.("Password updated", "success");
        });
    }
});
