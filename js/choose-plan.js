// js/choose-plan.js
document.addEventListener("DOMContentLoaded", async () => {
  const toast = window.Selfio?.toast || ((m) => alert(String(m)));
  const setLoading = window.Selfio?.setLoading || (() => {});
  const qs = new URLSearchParams(location.search);

  const EMAIL_KEY = "selfio_email";
  const PLAN_KEY = "selfio_plan";

  function planKeyForEmail(email) {
    return `${PLAN_KEY}:${email || "anon"}`;
  }

  const ALLOWED_NEXT = new Set(["app.html", "weekly.html", "habits.html", "account.html", "my-plan.html"]);

  function sanitizeNext(raw) {
    let v = String(raw || "").trim();
    if (!v) return "app.html";
    const low = v.toLowerCase();
    if (low.startsWith("http:") || low.startsWith("https:") || low.startsWith("//") || low.startsWith("javascript:")) return "app.html";
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

  const cloud = window.Selfio?.cloud;
  if (!cloud) {
    toast("Cloud is not ready (Selfio.cloud missing). Check script order.");
    return;
  }

  // треба бути залогіненим
  let user = null;
  try { user = await cloud.getUser(); } catch (e) { console.error(e); }

  if (!user) {
    location.href = `signin.html?mode=login&next=${encodeURIComponent("choose-plan.html?next=" + next)}`;
    return;
  }

  const email = String(user.email || "").toLowerCase();
  if (email) localStorage.setItem(EMAIL_KEY, email);

  // (опц.) meta в хедері хоч щось покаже
  const meta = document.querySelector("[data-app-meta]");
  if (meta) meta.textContent = `${email || "Signed user"} • —`;

  // гарантуємо профіль
  try { await cloud.ensureProfile(); } catch (e) { console.error(e); }

  const btns = Array.from(document.querySelectorAll("[data-plan]"));
  btns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const plan = normalizePlan(btn.getAttribute("data-plan"));

      try {
        setLoading(btn, true, "Saving...");
        await cloud.savePlan(plan);

        // ✅ ВАЖЛИВО: синхронізуємо localStorage, щоб app.js одразу бачив план
        if (email) {
          localStorage.setItem(planKeyForEmail(email), plan);
          localStorage.setItem(PLAN_KEY, plan);
        }

        toast(`Plan set: ${plan.toUpperCase()} ✅`);
        location.replace(next); // краще replace, щоб choose-plan не лишався в back
      } catch (e) {
        console.error(e);
        toast("Failed to save plan. Check console (RLS/table).");
      } finally {
        setLoading(btn, false);
      }
    });
  });

  // Back
  const backBtn = document.querySelector("[data-back]");
  backBtn?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.href = "app.html";
  });
});
