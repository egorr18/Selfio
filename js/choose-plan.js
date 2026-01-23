// js/choose-plan.js (Supabase plan select)
document.addEventListener("DOMContentLoaded", async () => {
    const toast = window.Selfio?.toast || ((m) => alert(String(m)));
    const setLoading = window.Selfio?.setLoading || (() => {});
    const qs = new URLSearchParams(location.search);

    const ALLOWED_NEXT = new Set([
        "app.html",
        "weekly.html",
        "habits.html",
        "settings.html",
        "account.html",
        "my-plan.html",
    ]);

    function sanitizeNext(raw) {
        let v = String(raw || "").trim();
        if (!v) return "app.html";

        const low = v.toLowerCase();
        if (low.startsWith("http:") || low.startsWith("https:") || low.startsWith("//") || low.startsWith("javascript:")) {
            return "app.html";
        }

        try { v = decodeURIComponent(v); } catch {}
        const base = v.split(/[?#]/)[0];
        if (!ALLOWED_NEXT.has(base)) return "app.html";
        return v;
    }

    function normalizePlan(p) {
        p = String(p || "").toLowerCase();
        return (p === "free" || p === "pro" || p === "premium") ? p : "free";
    }

    const next = sanitizeNext(qs.get("next"));

    // ✅ треба бути залогіненим через Supabase
    const getUser = window.Selfio?.cloud?.getUser;
    if (!getUser) {
        toast("Cloud is not ready (Selfio.cloud missing). Check script order.");
        return;
    }

    const user = await getUser();
    if (!user) {
        location.href = `signin.html?mode=login&next=${encodeURIComponent("choose-plan.html?next=" + next)}`;
        return;
    }

    const btns = Array.from(document.querySelectorAll("[data-plan]"));
    btns.forEach((btn) => {
        btn.addEventListener("click", async () => {
            const plan = normalizePlan(btn.getAttribute("data-plan"));

            try {
                setLoading(btn, true, "Saving...");
                await window.Selfio.cloud.savePlan(plan);
                toast(`Plan set: ${plan.toUpperCase()} ✅`);
                location.href = next;
            } catch (e) {
                console.error(e);
                toast("Failed to save plan. Check console.");
            } finally {
                setLoading(btn, false);
            }
        });
    });
});
