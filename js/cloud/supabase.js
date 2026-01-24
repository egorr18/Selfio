// js/cloud/supabase.js
(function () {
  window.Selfio = window.Selfio || {};
  const cfg = window.Selfio.config || {};

  const AUTH_STORAGE_KEY = "selfio_auth"; // важливо: щоб ми могли синхронно підтягнути сесію

  function homeUrl() {
    // якщо ми на /pages/* — виходимо на ../index.html
    const p = location.pathname || "";
    return p.includes("/pages/") ? "../index.html" : "index.html";
  }

  function normalizePlan(p) {
    p = String(p || "").trim().toLowerCase();
    return (p === "free" || p === "pro" || p === "premium") ? p : "free";
  }

  function planKeyForEmail(email) {
    return `selfio_plan:${(email || "anon").toLowerCase()}`;
  }

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function syncLocalFromStoredSession() {
    // Спроба синхронно підняти сесію (до виконання app.js)
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    const j = raw ? safeJsonParse(raw) : null;

    // формати можуть відрізнятись, тому робимо “м’яко”
    const session =
      (j && j.access_token && j.user) ? j :
      (j && j.currentSession && j.currentSession.access_token) ? j.currentSession :
      null;

    if (session?.access_token) localStorage.setItem("selfio_token", session.access_token);
    if (session?.user?.email) localStorage.setItem("selfio_email", String(session.user.email).toLowerCase());
  }

  function clearLocalAuth() {
    localStorage.removeItem("selfio_token");
    localStorage.removeItem("selfio_email");
    // selfio_plan НЕ чіпаємо — це твій вибір/кеш
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("[Selfio] Supabase SDK missing. Add CDN script first.");
    window.Selfio.supabase = null;
    window.Selfio.cloud = null;
    return;
  }

  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    console.error("[Selfio] Missing supabaseUrl / supabaseAnonKey in config.js");
    window.Selfio.supabase = null;
    window.Selfio.cloud = null;
    return;
  }

  // ✅ синхронно піднімаємо selfio_token/selfio_email ДО app.js
  syncLocalFromStoredSession();

  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: AUTH_STORAGE_KEY,
    },
  });

  window.Selfio.supabase = client;

  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function getUser() {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    return data.user || null;
  }

  async function ensureProfile() {
    const user = await getUser();
    if (!user) return null;

    const email = String(user.email || "").toLowerCase();
    const localName = localStorage.getItem("selfio_name") || "";

    // 1) перевіряємо чи є профіль
    const { data: existing, error: selErr } = await client
      .from("profiles")
      .select("id,email,plan,name,created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (selErr) throw selErr;

    const localPlan = normalizePlan(
      localStorage.getItem(planKeyForEmail(email)) ||
      localStorage.getItem("selfio_plan") ||
      "free"
    );

    // 2) якщо є — оновлюємо email/name, але plan не чіпаємо (якщо вже встановлений)
    if (existing) {
      const patch = {
        email,
        name: localName,
      };

      // якщо в базі plan порожній — підставимо локальний
      if (!existing.plan) patch.plan = localPlan;

      const { error: upErr } = await client
        .from("profiles")
        .update(patch)
        .eq("id", user.id);

      if (upErr) throw upErr;

      // кешуємо план локально, щоб твій app.js бачив його миттєво
      const effectivePlan = normalizePlan(existing.plan || patch.plan || "free");
      localStorage.setItem("selfio_plan", effectivePlan);
      localStorage.setItem(planKeyForEmail(email), effectivePlan);

      return { ...existing, ...patch, plan: effectivePlan };
    }

    // 3) якщо нема — створюємо
    const payload = {
      id: user.id,
      email,
      plan: localPlan,
      name: localName,
    };

    const { data: ins, error: insErr } = await client
      .from("profiles")
      .insert(payload)
      .select("id,email,plan,name,created_at")
      .single();

    if (insErr) throw insErr;

    localStorage.setItem("selfio_plan", normalizePlan(ins.plan));
    localStorage.setItem(planKeyForEmail(email), normalizePlan(ins.plan));

    return ins;
  }

  async function getMyProfile() {
    const user = await getUser();
    if (!user) throw new Error("Not signed in");
    const { data, error } = await client.from("profiles").select("*").eq("id", user.id).single();
    if (error) throw error;
    return data;
  }

  async function savePlan(plan) {
    plan = normalizePlan(plan);
    const user = await getUser();
    if (!user) throw new Error("Not signed in");

    // гарантуємо профіль
    await ensureProfile();

    const { error } = await client.from("profiles").update({ plan }).eq("id", user.id);
    if (error) throw error;

    const email = String(user.email || "").toLowerCase();
    localStorage.setItem("selfio_plan", plan);
    localStorage.setItem(planKeyForEmail(email), plan);

    return plan;
  }

  async function loadState() {
    const user = await getUser();
    if (!user) return null;

    const { data, error } = await client
      .from("user_state")
      .select("data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    return data?.data || null;
  }

  async function saveState(state) {
    const user = await getUser();
    if (!user) throw new Error("Not signed in");

    const { error } = await client
      .from("user_state")
      .upsert(
        { user_id: user.id, data: state, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (error) throw error;
  }

  async function deleteMyData() {
    const user = await getUser();
    if (!user) throw new Error("Not signed in");

    // це видаляє ДАНІ (профіль/стан), але НЕ видаляє auth.users без серверної частини
    const { error: e1 } = await client.from("user_state").delete().eq("user_id", user.id);
    if (e1) throw e1;

    const { error: e2 } = await client.from("profiles").delete().eq("id", user.id);
    if (e2) throw e2;
  }

  // ✅ Тримаємо selfio_token/selfio_email в sync після логіну/логауту
  client.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) localStorage.setItem("selfio_token", session.access_token);
    else localStorage.removeItem("selfio_token");

    const email = session?.user?.email ? String(session.user.email).toLowerCase() : "";
    if (email) localStorage.setItem("selfio_email", email);
    else localStorage.removeItem("selfio_email");
  });

  // ✅ Єдиний логаут на всіх сторінках (щоб твій app.js не ламав Supabase-сесію)
  document.addEventListener(
    "click",
    async (e) => {
      const btn = e.target?.closest?.("[data-logout]");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn("[Selfio] signOut error:", err);
      } finally {
        clearLocalAuth();
        location.replace(homeUrl());
      }
    },
    true // capture — щоб перехопити ДО інших хендлерів
  );

  window.Selfio.cloud = {
    client,
    getSession,
    getUser,
    ensureProfile,
    getMyProfile,
    savePlan,
    loadState,
    saveState,
    deleteMyData,
  };
})();
