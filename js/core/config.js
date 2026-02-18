window.Selfio = window.Selfio || {};

window.Selfio.config = {
  mode: localStorage.getItem("selfio_mode") || "cloud",

  supabaseUrl: "https://duvgdgzbjrkkcxddfpvm.supabase.co",
  supabaseAnonKey: "sb_publishable_Y9be6af3F00v3otDYNyhGA_lrtM5CwZ",

  emailRedirectTo: location.origin + "/pages/account.html",
};
