window.Selfio = window.Selfio || {};

(function () {
    let _client = null;

    function sb() {
        if (_client) return _client;

        const { supabaseUrl, supabaseAnonKey } = window.Selfio.config || {};
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error("Supabase keys are missing in config.js");
        }
        if (!window.supabase?.createClient) {
            throw new Error("Supabase CDN not loaded (window.supabase.createClient missing)");
        }

        _client = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        return _client;
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
            name: localStorage.getItem("selfio_name") || ""
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
            data: state
        });

        if (error) throw error;
    }

    window.Selfio.cloud = { sb, getUser, ensureProfile, loadState, saveState };
})();
