// js/choose-plan.js (Supabase plan select)
document.addEventListener("DOMContentLoaded", async () => {
    const toast = window.Selfio?.toast || ((m) => alert(String(m)));
    const qs = new URLSearchParams(location.search);
    const next = qs.get("next") || "app.html";

    function normalizePlan(p) {
        p = String(p || "").toLowerCase();
        return (p === "free" || p === "pro" || p === "premium") ? p : "free";
    }

    // треба бути залогіненим через Supabase
    const user = await window.Selfio?.cloud?.getUser?.();
    if (!user) {
        location.href = `signin.html?mode=login&next=${encodeURIComponent("choose-plan.html?next=" + next)}`;
        return;
    }

    document.querySelectorAll("[data-plan]").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const plan = normalizePlan(btn.getAttribute("data-plan"));
            try {
                await window.Selfio.cloud.savePlan(plan); // пише в Supabase profiles + localStorage
                toast(`Plan set: ${plan.toUpperCase()} ✅`);
                location.href = next;
            } catch (e) {
                console.error(e);
                toast("Failed to save plan. Check console.");
            }
        });
    });
});
