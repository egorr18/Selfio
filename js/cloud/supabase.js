// js/cloud/supabase.js
(function () {
  window.Selfio = window.Selfio || {};
  const cfg = window.Selfio.config || {};

  // ✅ Це ключ localStorage для supabase сесії. НЕ URL.
  const AUTH_STORAGE_KEY = "selfio_auth";

  function homeUrl() {
    const p = location.pathname || "";
    return p.includes("/pages/") ? "../index.html" : "index.html";
  }

  function signinUrl() {
    const p = location.pathname || "";
    // якщо ти вже у /pages/* — то signin.html поруч
    return p.includes("/pages/") ? "signin.html?mode=login" : "pages/signin.html?mode=login";
  }

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch { return null; }
  }

  function findLegacySbAuthKey() {
    // якщо раніше сесія була під дефолтним sb-...-auth-token
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) return k;
    }
    return null;
  }

  function syncLocalFromStoredSession() {
    const legacyKey = findLegacySbAuthKey();
    const raw =
      localStorage.getItem(AUTH_STORAGE_KEY) ||
      (legacyKey ? localStorage.getItem(legacyKey) : null);

    const j = raw ? safeJsonParse(raw) : null;

    const session =
      (j && j.access_token && j.user) ? j :
      (j && j.currentSession && j.currentSession.access_token) ? j.currentSession :
      null;

    if (session?.access_token) localStorage.setItem("selfio_token", session.access_token);
    if (session?.user?.email) localStorage.setItem("selfio_email", String(session.user.email).toLowerCase());
  }

  function clearAllLocalAuth() {
    // ❗️ Використовуй для DELETE ACCOUNT (повна зачистка).
    const keep = new Set(["selfio_theme", "theme"]);
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("selfio_") && !keep.has(k)) localStorage.removeItem(k);
      if (k.startsWith("selfio_plan:")) localStorage.removeItem(k);
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) localStorage.removeItem(k);
    }
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  // logout: чистимо ТІЛЬКИ сесію, але НЕ user_state/plan в БД
  function clearLocalAuthOnly() {
    localStorage.removeItem("selfio_token");
    localStorage.removeItem("selfio_email");

    // краще прибрати глобальні кеші, щоб інший юзер не підхопив
    localStorage.removeItem("selfio_plan");
    localStorage.removeItem("selfio_name");

    // прибираємо реальний storageKey Supabase
    localStorage.removeItem(AUTH_STORAGE_KEY);

    // на всяк випадок — старі ключі, якщо колись було по-іншому
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
      .forEach((k) => localStorage.removeItem(k));
  }

  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    console.error("[Selfio] Supabase SDK missing.");
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

  async function requireUser(redirectTo) {
    const user = await getUser().catch(() => null);
    if (!user && redirectTo) location.replace(redirectTo);
    return user;
  }

  function normalizePlan(p) {
    p = String(p || "").trim().toLowerCase();
    return (p === "free" || p === "pro" || p === "premium") ? p : "free";
  }

  function planKeyForEmail(email) {
    return `selfio_plan:${(email || "anon").toLowerCase()}`;
  }

  async function ensureProfile() {
    const user = await getUser();
    if (!user) return null;

    const email = String(user.email || "").toLowerCase();
    const localName = localStorage.getItem("selfio_name") || "";

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

    if (existing) {
      const patch = { email, name: localName };
      if (!existing.plan) patch.plan = localPlan;

      const { error: upErr } = await client.from("profiles").update(patch).eq("id", user.id);
      if (upErr) throw upErr;

      const effectivePlan = normalizePlan(existing.plan || patch.plan || "free");
      localStorage.setItem("selfio_plan", effectivePlan);
      localStorage.setItem(planKeyForEmail(email), effectivePlan);

      return { ...existing, ...patch, plan: effectivePlan };
    }

    const payload = { id: user.id, email, plan: localPlan, name: localName };
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

  async function getMyPlan() {
    const user = await getUser();
    if (!user) return null;

    await ensureProfile();

    const { data: row, error } = await client
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    const plan = normalizePlan(row?.plan || "free");
    const email = String(user.email || "").toLowerCase();
    localStorage.setItem("selfio_plan", plan);
    localStorage.setItem(planKeyForEmail(email), plan);

    return plan;
  }

  async function savePlan(plan) {
    plan = normalizePlan(plan);
    const user = await getUser();
    if (!user) throw new Error("Not signed in");

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

  async function deleteAccountViaFunction(password) {
    // ✅ гарантуємо, що токен реальний
    await client.auth.refreshSession().catch(() => {});

    const session = await getSession();
    const token = session?.access_token;

    if (!token) {
      const err = new Error("SESSION_EXPIRED");
      err.code = "SESSION_EXPIRED";
      throw err;
    }

    const url = String(cfg.supabaseUrl).replace(".supabase.co", ".functions.supabase.co") + "/delete-account";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ password }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 403) {
      const err = new Error("WRONG_PASSWORD");
      err.code = "WRONG_PASSWORD";
      throw err;
    }
    if (res.status === 401) {
      const err = new Error(data?.error || "SESSION_EXPIRED");
      err.code = "SESSION_EXPIRED";
      throw err;
    }
    if (!res.ok) {
      throw new Error(data?.error || `Delete failed (${res.status})`);
    }

    return true;
  }

  // Тримаємо selfio_token/selfio_email в sync після логіну/логауту
  client.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) localStorage.setItem("selfio_token", session.access_token);
    else localStorage.removeItem("selfio_token");

    const email = session?.user?.email ? String(session.user.email).toLowerCase() : "";
    if (email) localStorage.setItem("selfio_email", email);
    else localStorage.removeItem("selfio_email");
  });

  // Logout кнопка
  document.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("[data-logout]");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    try { await client.auth.signOut(); } catch (_) {}
    clearLocalAuthOnly();
    location.replace(signinUrl());
  }, true);

  window.Selfio.cloud = {
    client,
    AUTH_STORAGE_KEY,
    getSession,
    getUser,
    requireUser,
    ensureProfile,
    getMyPlan,
    getMyProfile,
    savePlan,
    loadState,
    saveState,
    deleteAccountViaFunction,
    clearLocalAuthOnly,
    clearAllLocalAuth,
  };
})();
