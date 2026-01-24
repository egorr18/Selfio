// js/core/config.js
window.Selfio = window.Selfio || {};

window.Selfio.config = {
  // режим (якщо треба) — можна перемикати: localStorage.setItem("selfio_mode","cloud")
  mode: localStorage.getItem("selfio_mode") || "cloud", // cloud | demo | local

  // Supabase (Project Settings → API)
  supabaseUrl: "https://duvgdgzbjrkkcxddfpvm.supabase.co",
  supabaseAnonKey: "sb_publishable_Y9be6af3F00v3otDYNyhGA_lrtM5CwZ",

  // Redirect після підтвердження email (якщо увімкнеш підтвердження)
  emailRedirectTo: location.origin + "/pages/account.html",
};
