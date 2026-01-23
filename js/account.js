document.addEventListener("DOMContentLoaded", () => {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY  = "selfio_plan";

    const token = localStorage.getItem(TOKEN_KEY);

    // Якщо без токена — на логін
    if (!token) {
        location.href = "signin.html?mode=login&next=" + encodeURIComponent("account.html");
        return;
    }

    // api.js MUST be loaded
    const apiFetch = window.Selfio?.apiFetch;
    const toast = window.Selfio?.toast || ((m) => alert(String(m)));
    const setLoading = window.Selfio?.setLoading || (() => {});
    if (!apiFetch) {
        console.error("api.js is not loaded -> window.Selfio.apiFetch missing");
    }

    // Elements
    const elEmail = document.querySelector("[data-account-email]");
    const elName = document.querySelector("[data-account-name]");
    const elMemberSince = document.querySelector("[data-member-since]");
    const elPlanBadge = document.querySelector("[data-plan-badge]");
    const elPlanPerks = document.querySelector("[data-plan-perks]");
    const elMeta = document.querySelector("[data-app-meta]");
    const elThemeLabel = document.querySelector("[data-theme-label]");

    const btnCopyEmail = document.querySelector("[data-copy-email]");
    const toastCopy = document.querySelector("[data-copy-toast]");

    const btnLogout = document.querySelector("[data-logout]");

    // Password form
    const passForm = document.querySelector("[data-pass-form]");
    const passCurrent = document.querySelector("[data-pass-current]");
    const passNew = document.querySelector("[data-pass-new]");
    const passConfirm = document.querySelector("[data-pass-confirm]");
    const passSaveBtn = document.querySelector("[data-pass-save]");
    const passMsg = document.querySelector("[data-pass-msg]");

    // Data
    const btnExport = document.querySelector("[data-export]");
    const btnDelete = document.querySelector("[data-delete]");
    const delPassword = document.querySelector("[data-delete-password]");

    const normalizePlan = (p) => {
        p = String(p || "").trim().toLowerCase();
        return (p === "free" || p === "pro" || p === "premium") ? p : "free";
    };

    function setThemeLabel() {
        // theme.js зазвичай тримає theme в localStorage, але назва ключа може відрізнятись
        // Тому робимо “м’яко”:
        const t =
            localStorage.getItem("selfio_theme") ||
            localStorage.getItem("theme") ||
            "system";
        const label = (t === "dark") ? "Dark" : (t === "light") ? "Light" : "System";
        if (elThemeLabel) elThemeLabel.textContent = label;
    }

    function planPerksText(plan) {
        const p = normalizePlan(plan);
        if (p === "free") {
            return [
                "Free plan: basic weekly planning.",
                "Upgrade to Pro for next weeks planning.",
                "Upgrade to Premium for templates + insights."
            ].join("\n");
        }
        if (p === "pro") {
            return [
                "Pro active: plan goals for this week + next 2 weeks.",
                "Push goals to Today (plan → tasks).",
                "Upgrade to Premium for templates + 8 weeks + Month insights."
            ].join("\n");
        }
        return [
            "Premium active: templates + up to 8 weeks ahead.",
            "Month insights + trends (soon).",
            "Export data (soon)."
        ].join("\n");
    }

    function formatDate(iso) {
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return "—";
            return d.toLocaleDateString();
        } catch {
            return "—";
        }
    }

    function showInlineMsg(el, msg, type = "info") {
        if (!el) return;
        el.textContent = String(msg || "");
        el.dataset.type = type;
        el.style.display = msg ? "" : "none";
    }

    async function loadMe() {
        if (!apiFetch) return;

        const res = await apiFetch("/me", { token });
        if (!res.ok) {
            // якщо бек недоступний, сторінка все одно може показатися, але дані не підтягнуться
            toast(res.data?.message || "Backend unavailable. Open locally with Live Server for localhost API.");
            return;
        }

        const me = res.data || {};
        const email = String(me.email || localStorage.getItem(EMAIL_KEY) || "").trim();
        const plan = normalizePlan(me.plan || localStorage.getItem(PLAN_KEY) || "free");

        if (elEmail) elEmail.value = email;
        if (elPlanBadge) elPlanBadge.textContent = plan.toUpperCase();
        if (elPlanPerks) elPlanPerks.textContent = planPerksText(plan);

        if (elMemberSince) elMemberSince.textContent = formatDate(me.created_at || me.createdAt);
        if (elMeta) elMeta.textContent = `${email || "—"} • ${plan.toUpperCase()}`;

        localStorage.setItem(EMAIL_KEY, email.toLowerCase());
        localStorage.setItem(PLAN_KEY, plan);
    }

    // Copy email
    btnCopyEmail?.addEventListener("click", async () => {
        const email = (elEmail?.value || "").trim();
        if (!email) return;

        try {
            await navigator.clipboard.writeText(email);
            if (toastCopy) {
                showInlineMsg(toastCopy, "Copied!", "ok");
                setTimeout(() => showInlineMsg(toastCopy, ""), 1200);
            } else {
                toast("Copied!");
            }
        } catch {
            toast("Can’t copy (browser blocked).");
        }
    });

    // Save name locally (поки без бекенду)
    elName?.addEventListener("input", () => {
        localStorage.setItem("selfio_name", String(elName.value || ""));
    });

    // Logout
    btnLogout?.addEventListener("click", () => {
        localStorage.removeItem(TOKEN_KEY);
        // email/plan можна лишити або очистити — я очищу все “сесійне”
        // localStorage.removeItem(EMAIL_KEY);
        // localStorage.removeItem(PLAN_KEY);
        location.href = "signin.html?mode=login";
    });

    // Change password (needs backend endpoint POST /auth/change-password)
    passForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!apiFetch) return;

        const cur = String(passCurrent?.value || "").trim();
        const nw = String(passNew?.value || "").trim();
        const cf = String(passConfirm?.value || "").trim();

        if (!cur || !nw || !cf) {
            showInlineMsg(passMsg, "Fill all fields.", "err");
            return;
        }
        if (nw.length < 6) {
            showInlineMsg(passMsg, "New password is too short (min 6).", "err");
            return;
        }
        if (nw !== cf) {
            showInlineMsg(passMsg, "Passwords do not match.", "err");
            return;
        }

        setLoading(passSaveBtn, true, "Saving...");
        showInlineMsg(passMsg, "");

        const res = await apiFetch("/auth/change-password", {
            method: "POST",
            token,
            body: { current_password: cur, new_password: nw }
        });

        setLoading(passSaveBtn, false);

        if (!res.ok) {
            // 404 тут означає: роут не існує на бекенді (те, що ти бачив)
            showInlineMsg(passMsg, res.data?.message || res.data?.error || `Error: ${res.status}`, "err");
            return;
        }

        showInlineMsg(passMsg, "Password updated ✅", "ok");
        passCurrent.value = "";
        passNew.value = "";
        passConfirm.value = "";
    });

    // Export data: tries backend GET /me/export, otherwise local export (full)
    btnExport?.addEventListener("click", async () => {
        const email = (elEmail?.value || localStorage.getItem(EMAIL_KEY) || "").trim().toLowerCase();
        const plan = normalizePlan((elPlanBadge?.textContent || localStorage.getItem(PLAN_KEY) || "free"));
        // 1) try backend export (if exists)
        if (apiFetch) {
            const res = await apiFetch("/me/export", { token });
            if (res.ok && res.data) {
                await shareOrDownloadJSON(res.data, `selfio-export-${today()}.json`);
                toast("Export ready ✅");
                return;
            }
            console.warn("Export backend failed:", res.status, res.data);
        }

        // 2) local export fallback (NO token/password)
        const theme =
            document.documentElement.getAttribute("data-theme") ||
            localStorage.getItem("selfio_theme") ||
            localStorage.getItem("theme") ||
            "system";

        const { state, snapshotUsed } = collectLocalStateForExport(email);

        const payload = {
            schema: "selfio.export.v1",
            exported_at: new Date().toISOString(),
            email_masked: maskEmail(email || "anon"),
            plan,
            name: localStorage.getItem("selfio_name") || "",
            theme,
            state,
            note: snapshotUsed
                ? "Local export (state key not found, exported selfio_* snapshot)."
                : "Local export (no password/token)."
        };

        await shareOrDownloadJSON(payload, `selfio-export-${today()}.json`);
        toast("Exported ✅");
    });

    // Delete account: needs backend POST /me/delete, otherwise local cleanup only
    btnDelete?.addEventListener("click", async () => {
        const ok = confirm("Delete account? This action is irreversible.");
        if (!ok) return;

        const pwd = String(delPassword?.value || "").trim();
        if (!pwd) {
            toast("Enter current password to delete.");
            delPassword?.focus();
            return;
        }

        // 1) try backend
        if (apiFetch) {
            const res = await apiFetch("/me/delete", {
                method: "POST",
                token,
                body: { password: pwd }
            });

            if (res.ok) {
                toast("Account deleted ✅");
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(EMAIL_KEY);
                localStorage.removeItem(PLAN_KEY);
                location.href = "../index.html";
                return;
            }

            console.warn("Delete backend failed:", res.status, res.data);
            // якщо 404 — просто нема такого ендпоїнту на бекенді
            toast(res.data?.message || res.data?.error || `Delete failed (${res.status}).`);
            // НЕ робимо локальне “видалення акаунта” автоматично, бо це може ввести в оману
            return;
        }

        toast("Backend unavailable. Can't delete from database.");
    });

    function safeJsonParse(str, fallback) {
        try { return JSON.parse(str); } catch { return fallback; }
    }

    function maskEmail(email) {
        const e = String(email || "");
        const at = e.indexOf("@");
        if (at <= 1) return e || "anon";
        const name = e.slice(0, at);
        const domain = e.slice(at + 1);
        return `${name.slice(0, 2)}***@${domain}`;
    }

// tries to get real app state; if not found -> exports snapshot of selfio_* (excluding token)
    function collectLocalStateForExport(email) {
        const APP_KEY = "selfio_app_v1";

        // 1) try common state keys
        const keysToTry = [
            `${APP_KEY}:${email || "anon"}`,
            `${APP_KEY}:${(email || "anon").toLowerCase()}`,
            APP_KEY
        ];

        for (const k of keysToTry) {
            const raw = localStorage.getItem(k);
            if (!raw) continue;
            const parsed = safeJsonParse(raw, null);
            if (parsed && typeof parsed === "object") {
                const days = parsed.days || {};
                const settings = parsed.settings || {};
                const weeks = parsed.weeks || {};
                return { state: { days, settings, weeks }, snapshotUsed: false };
            }
        }

        // 2) fallback: snapshot all selfio_* keys (no token)
        const snap = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;

            // take only selfio_* keys but NEVER token
            if (!key.startsWith("selfio_")) continue;
            if (key === "selfio_token") continue;

            snap[key] = localStorage.getItem(key);
        }

        return { state: { snapshot: snap }, snapshotUsed: true };
    }

// share sheet on mobile if possible, otherwise download
    async function shareOrDownloadJSON(obj, filename) {
        const json = JSON.stringify(obj, null, 2);
        const blob = new Blob([json], { type: "application/json" });

        // Mobile share (iOS/Android)
        try {
            const file = new File([blob], filename, { type: "application/json" });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: "Selfio export" });
                return;
            }
        } catch (_) {}

        // Fallback download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function today() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${dd}`;
    }

    // init
    setThemeLabel();
    loadMe();
});
