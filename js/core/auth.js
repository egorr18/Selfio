(function () {
  window.Selfio = window.Selfio || {};

  function sb() {
    const c = window.Selfio.supabase;
    if (!c) throw new Error("Supabase client not initialized (Selfio.supabase missing)");
    return c;
  }

  async function getSession() {
    const { data, error } = await sb().auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  async function getUser() {
    const { data, error } = await sb().auth.getUser();
    if (error) throw error;
    return data.user || null;
  }

  async function signUp(email, password, name) {
    const cfg = window.Selfio.config || {};
    const { data, error } = await sb().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: cfg.emailRedirectTo,
        data: { name: name || "" },
      },
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await sb().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await sb().auth.signOut();
    if (error) throw error;
  }

  async function requireAuth(redirectTo = "signin.html") {
    const session = await getSession();
    if (!session) {
      location.replace(redirectTo);
      return null;
    }
    return session;
  }

  window.Selfio.auth = { getSession, getUser, signUp, signIn, signOut, requireAuth };
})();
