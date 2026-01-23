window.Selfio = window.Selfio || {};

(function () {
    const cfg = window.Selfio.config || {};
    const supabaseUrl = cfg.supabaseUrl;
    const supabaseAnonKey = cfg.supabaseAnonKey;

    if (!supabaseUrl || !supabaseAnonKey) {
        console.warn("Supabase config missing (supabaseUrl / supabaseAnonKey). Cloud mode disabled.");
        return;
    }

    if (!window.supabase?.createClient) {
        console.error("Supabase CDN not loaded. Add supabase script in <head>.");
        return;
    }

    // ✅ один клієнт на весь сайт
    const client = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

    async function getUser() {
        const { data } = await client.auth.getUser();
        return data?.user || null;
    }

    async function ensureProfile(email) {
        const user = await getUser();
        if (!user) return;

        // не затираємо plan якщо профіль вже існує
        const { data: existing } = await client
            .from("profiles")
            .select("plan")
            .eq("id", user.id)
            .maybeSingle();

        if (existing) {
            await client.from("profiles").update({
                email: (email || user.email || "").toLowerCase(),
                name: localStorage.getItem("selfio_name") || ""
            }).eq("id", user.id);
            return;
        }

        const plan = (localStorage.getItem("selfio_plan") || "free").toLowerCase();

        await client.from("profiles").insert({
            id: user.id,
            email: (email || user.email || "").toLowerCase(),
            plan,
            name: localStorage.getItem("selfio_name") || ""
        });
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

    window.Selfio.cloud = { client, getUser, ensureProfile, loadState, saveState };
})();
