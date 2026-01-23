// js/cloud/supabase.js
(() => {
    window.Selfio = window.Selfio || {};
    const cfg = window.Selfio.config || {};
    const { supabaseUrl, supabaseAnonKey } = cfg;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn("Supabase config missing (supabaseUrl / supabaseAnonKey). Cloud mode disabled.");
        return;
    }

    if (!window.supabase?.createClient) {
        console.error("Supabase CDN not loaded. Add <script src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'></script> in <head>.");
        return;
    }

    // ✅ Singleton client (не створюємо кожен раз новий)
    const client = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

    async function getSession() {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data.session || null;
    }

    async function getUser() {
        const { data, error } = await client.auth.getUser();
        if (error) return null;
        return data.user || null;
    }

    async function signOut() {
        await client.auth.signOut();
    }

    async function ensureProfile(overrides = {}) {
        const user = await getUser();
        if (!user) return null;

        const email = overrides.email || user.email || "";
        const plan = String(overrides.plan ?? localStorage.getItem("selfio_plan") ?? "free").toLowerCase();
        const name = String(overrides.name ?? localStorage.getItem("selfio_name") ?? "");

        const { data, error } = await client
            .from("profiles")
            .upsert({ id: user.id, email, plan, name }, { onConflict: "id" })
            .select()
            .single();

        if (error) throw error;
        return data || null;
    }

    async function readProfile() {
        const user = await getUser();
        if (!user) return null;

        const { data, error } = await client
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (error) throw error;
        return data || null;
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

        const { error } = await client.from("user_state").upsert({
            user_id: user.id,
            data: state
        });

        if (error) throw error;
    }

    window.Selfio.cloud = {
        client,
        getSession,
        getUser,
        signOut,
        ensureProfile,
        readProfile,
        loadState,
        saveState,
    };
})();
