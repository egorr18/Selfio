// js/cloud/supabase.js
window.Selfio = window.Selfio || {};

(function () {
    let _client = null;

    function sb() {
        const { supabaseUrl, supabaseAnonKey } = window.Selfio.config || {};
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error("Supabase keys are missing in config.js");
        }
        if (!window.supabase?.createClient) {
            throw new Error("Supabase CDN not loaded (window.supabase.createClient missing)");
        }

        if (_client) return _client;

        _client = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                storageKey: "selfio_sb_auth", // щоб сесія жила між сторінками
                detectSessionInUrl: true
            }
        });

        return _client;
    }

    async function getUser() {
        const client = sb();
        const { data, error } = await client.auth.getUser();
        if (error) return null;
        return data?.user || null;
    }

    async function ensureProfile(email) {
        const client = sb();
        const user = await getUser();
        if (!user) return;

        // 1) пробуємо знайти існуючий профіль
        const { data: existing } = await client
            .from("profiles")
            .select("plan,name,email")
            .eq("id", user.id)
            .maybeSingle();

        // 2) якщо є — оновлюємо тільки name/email (plan не чіпаємо)
        if (existing) {
            await client.from("profiles").update({
                email: (email || user.email || "").toLowerCase(),
                name: localStorage.getItem("selfio_name") || ""
            }).eq("id", user.id);
            return;
        }

        // 3) якщо нема — створюємо з plan
        const plan = (localStorage.getItem("selfio_plan") || "free").toLowerCase();

        await client.from("profiles").insert({
            id: user.id,
            email: (email || user.email || "").toLowerCase(),
            plan,
            name: localStorage.getItem("selfio_name") || ""
        });
    }

    async function loadProfile() {
        const client = sb();
        const user = await getUser();
        if (!user) return null;

        const { data, error } = await client
            .from("profiles")
            .select("id,email,plan,name,created_at")
            .eq("id", user.id)
            .maybeSingle();

        if (error) throw error;
        return data || null;
    }

    async function savePlan(plan) {
        const client = sb();
        const user = await getUser();
        if (!user) throw new Error("Not signed in");

        const p = String(plan || "").toLowerCase();
        await client.from("profiles").upsert({ id: user.id, plan: p });
        localStorage.setItem("selfio_plan", p);
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

    window.Selfio.cloud = { sb, getUser, ensureProfile, loadProfile, savePlan, loadState, saveState };
})();
