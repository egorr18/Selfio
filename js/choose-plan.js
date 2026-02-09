// js/choose-plan.js
document.addEventListener("DOMContentLoaded", async () => {
  const cloud = window.Selfio?.cloud;

  // Fallback toast (без alert по дефолту — тільки якщо зовсім нема іншого)
  const toast = (msg, type = "info") => {
    if (typeof window.Selfio?.toast === "function") return window.Selfio.toast(msg, type);

    // inline fallback (створюємо маленький блок зверху)
    let el = document.querySelector("[data-toast]");
    if (!el) {
      el = document.createElement("div");
      el.setAttribute("data-toast", "");
      el.style.cssText =
        "position:fixed;top:16px;left:50%;transform:translateX(-50%);" +
        "max-width:92vw;padding:10px 12px;border-radius:12px;" +
        "background:rgba(0,0,0,.85);color:#fff;font:14px/1.35 system-ui;z-index:9999;";
      document.body.appendChild(el);
    }
    el.textContent = String(msg || "");
    el.style.display = msg ? "block" : "none";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.display = "none"), 1800);
  };

  const setLoading =
    window.Selfio?.setLoading ||
    ((btn, on, text) => {
      if (!btn) return;
      btn.disabled = !!on;
      if (on) {
        btn.dataset._oldText = btn.textContent || "";
        btn.textContent = text || "Saving...";
      } else {
        if (btn.dataset._oldText) btn.textContent = btn.dataset._oldText;
        delete btn.dataset._oldText;
      }
    });

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
    if (
      low.startsWith("http:") ||
      low.startsWith("https:") ||
      low.startsWith("//") ||
      low.startsWith("javascript:")
    ) {
      return "app.html";
    }

    try {
      v = decodeURIComponent(v);
    } catch {}

    const base = v.split(/[?#]/)[0];
    if (!ALLOWED_NEXT.has(base)) return "app.html";
    return v;
  }

  function normalizePlan(p) {
    p = String(p || "").trim().toLowerCase();
    return p === "free" || p === "pro" || p === "premium" ? p : "free";
  }

  // Коректний URL на signin залежно від того, де ти зараз (root чи /pages/)
  function signinUrl(nextUrl) {
    const inPages = (location.pathname || "").includes("/pages/");
    const base = inPages ? "signin.html" : "pages/signin.html";
    return `${base}?mode=login&next=${encodeURIComponent(nextUrl)}`;
  }

  function nextUrlWithMsg(next) {
    // Додаємо msg=plan_updated і plan=... БЕЗ повних URL
    try {
      const u = new URL(next, location.href);
      return u.pathname.split("/").pop() + (u.search || "") + (u.hash || "");
    } catch {
      return next;
    }
  }

  const next = sanitizeNext(qs.get("next"));

  if (!cloud?.getUser || !cloud?.savePlan || !cloud?.ensureProfile) {
    toast("Cloud is not ready. Check script order: config.js → supabase.js → choose-plan.js");
    return;
  }

  // треба бути залогіненим
  let user = null;
  try {
    user = await cloud.getUser();
  } catch (e) {
    console.error(e);
  }

  if (!user) {
    // повертаємо назад на choose-plan (з next усередині)
    const backToChoose = `choose-plan.html?next=${encodeURIComponent(next)}`;
    location.replace(signinUrl(backToChoose));
    return;
  }

  const email = String(user.email || "").toLowerCase();
  if (email) localStorage.setItem(EMAIL_KEY, email);

  // ✅ флаг "це перший вибір плану після реєстрації"
  const NEED_KEY = `selfio_need_choose_plan:${email || "anon"}`;
  const needChoose =
    localStorage.getItem("selfio_need_choose_plan") === "1" ||
    localStorage.getItem(NEED_KEY) === "1";

  // meta в хедері
  const meta = document.querySelector("[data-app-meta]");
  if (meta) meta.textContent = `${email || "Signed user"} • —`;

  // гарантуємо профіль
  try {
    await cloud.ensureProfile();
  } catch (e) {
    console.error(e);
  }

  // ✅ визначимо поточний план:
  // - якщо це перший вибір (needChoose=true) → НЕ вважаємо "free" як вже вибраний (щоб кнопка free не була disabled)
  // - якщо це не перший вибір → показуємо реальний поточний план
  let currentPlan = "";
  if (!needChoose) {
    currentPlan = normalizePlan(
      localStorage.getItem(planKeyForEmail(email)) || localStorage.getItem(PLAN_KEY) || ""
    );
    try {
      const p = await cloud.getMyPlan?.();
      if (p) currentPlan = normalizePlan(p);
    } catch (_) {}
  }

  if (meta) meta.textContent = `${email || "Signed user"} • ${currentPlan ? currentPlan.toUpperCase() : "CHOOSE PLAN"}`;

  const btns = Array.from(document.querySelectorAll("[data-plan]"));

  function renderButtons() {
    btns.forEach((btn) => {
      const plan = normalizePlan(btn.getAttribute("data-plan"));

      // ✅ якщо це перший вибір — не блокуємо нічого як "current"
      const isCurrent = !needChoose && currentPlan && plan === currentPlan;

      btn.dataset.current = isCurrent ? "1" : "0";
      btn.classList.toggle("is-current", isCurrent);

      if (isCurrent) {
        btn.disabled = true;
        btn.setAttribute("aria-current", "true");
        btn.title = "Current plan";
      } else {
        btn.disabled = false;
        btn.removeAttribute("aria-current");
        btn.title = "";
      }
    });
  }

  renderButtons();

  async function setPlan(plan, clickedBtn) {
    plan = normalizePlan(plan);

    // ✅ якщо це не перший вибір і план вже такий самий — просто йдемо далі
    if (!needChoose && currentPlan && plan === currentPlan) {
      toast("This plan is already active ✅");
      location.replace(nextUrlWithMsg(next));
      return;
    }

    // блокуємо всі кнопки на час збереження
    btns.forEach((b) => setLoading(b, true, b === clickedBtn ? "Saving..." : "…"));

    try {
      await cloud.savePlan(plan);

      // додатково синхронізуємо localStorage (щоб app.js одразу бачив)
      if (email) {
        localStorage.setItem(planKeyForEmail(email), plan);
        localStorage.setItem(PLAN_KEY, plan);
      }

      // ✅ прибираємо флаг "потрібно вибрати план" (глобальний і per-user)
      localStorage.removeItem("selfio_need_choose_plan");
      localStorage.removeItem(NEED_KEY);

      currentPlan = plan;

      toast(`Plan updated: ${plan.toUpperCase()} ✅`);

      // редірект назад
      location.replace(nextUrlWithMsg(next));
    } catch (e) {
      console.error(e);
      toast(e?.message || "Failed to save plan. Check console/RLS.");
    } finally {
      btns.forEach((b) => setLoading(b, false));
    }
  }

  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const plan = normalizePlan(btn.getAttribute("data-plan"));
      setPlan(plan, btn);
    });
  });

  // Back
  const backBtn = document.querySelector("[data-back]");
  backBtn?.addEventListener("click", () => {
    if (history.length > 1) history.back();
    else location.href = "app.html";
  });
});
