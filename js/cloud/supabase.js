window.Selfio = window.Selfio || {};

(function () {
    if (!window.supabase?.createClient) {
        console.error("Supabase CDN not loaded");
        return;
    }

    let client = null;

    function sb() {
        if (client) return client;

        const { supabaseUrl, supabaseAnonKey } = window.Selfio.config || {};
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error("Supabase keys are missing in config.js");
        }

        client = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                storageKey: "selfio-auth",     // важливо: стабільний ключ
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
            },
        });

        return client;
    }

    async function getUser() {
        const { data } = await sb().auth.getUser();
        return data?.user || null;
    }

    async function ensureProfile(email) {
        const user = await getUser();
        if (!user) return;

        await sb().from("profiles").upsert({
            id: user.id,
            email: email || user.email,
            plan: (localStorage.getItem("selfio_plan") || "free").toLowerCase(),
            name: localStorage.getItem("selfio_name") || "",
        });
    }

    async function loadState() {
        const user = await getUser();
        if (!user) return null;

        const { data, error } = await sb()
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

        const { error } = await sb().from("user_state").upsert({
            user_id: user.id,
            data: state,
        });

        if (error) throw error;
    }

    window.Selfio.cloud = { sb, getUser, ensureProfile, loadState, saveState };
})();
