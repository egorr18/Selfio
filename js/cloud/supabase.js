window.Selfio = window.Selfio || {};

(function () {
    function sb() {
        // 1) перевірка SDK
        if (!window.supabase?.createClient) {
            throw new Error(
                "Supabase SDK not loaded. Make sure the CDN script is included BEFORE cloud.js"
            );
        }

        // 2) перевірка ключів
        const { supabaseUrl, supabaseAnonKey } = window.Selfio.config || {};
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error("Supabase keys are missing in config.js");
        }

        return window.supabase.createClient(supabaseUrl, supabaseAnonKey);
    }

    async function getUser() {
        const client = sb();
        const { data } = await client.auth.getUser();
        return data?.user || null;
    }

    async function ensureProfile(email) {
        const client = sb();
        const user = await getUser();
        if (!user) return;

        await client.from("profiles").upsert({
            id: user.id,
            email: email || user.email,
            plan: (localStorage.getItem("selfio_plan") || "free").toLowerCase(),
            name: localStorage.getItem("selfio_name") || ""
        });
    }

    async function loadState() {
        const client = sb();
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
        const client = sb();
        const user = await getUser();
        if (!user) throw new Error("Not signed in");

        const { error } = await client.from("user_state").upsert({
            user_id: user.id,
            data: state
        });

        if (error) throw error;
    }

    window.Selfio.cloud = { sb, getUser, ensureProfile, loadState, saveState };
})();
