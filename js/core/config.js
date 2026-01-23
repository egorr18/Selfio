window.Selfio = window.Selfio || {};

const savedMode = localStorage.getItem("selfio_mode") || "demo"; // demo | cloud | local

window.Selfio.config = {
    mode: savedMode,

    // Cloud (Supabase) — вставиш зі Settings → API
    supabaseUrl:  "https://duvgdgzbjrkkcxddfpvm.supabase.co",
    supabaseAnonKey: "sb_publishable_Y9be6af3F00v3otDYNyhGA_lrtM5CwZ",

    // Local backend (docker), якщо захочеш старий режим
    localApiBase: "http://localhost:8080",
};
