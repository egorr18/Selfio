window.Selfio = window.Selfio || {};

const savedMode = localStorage.getItem("selfio_mode") || "demo"; // demo | cloud | local

window.Selfio.config = {
    mode: savedMode,

    // Cloud (Supabase) — вставиш зі Settings → API
    supabaseUrl:  "PASTE_SUPABASE_URL",
    supabaseAnonKey: "PASTE_SUPABASE_ANON_KEY",

    // Local backend (docker), якщо захочеш старий режим
    localApiBase: "http://localhost:8080",
};
