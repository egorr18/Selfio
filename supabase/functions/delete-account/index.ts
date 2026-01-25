import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ✅ Налаштуй allowed origins під себе:
 * - прод: https://egorr18.github.io
 * - локалка: http://localhost:5500 (або твій порт)
 */
const ALLOWED_ORIGINS = new Set([
  "https://egorr18.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://egorr18.github.io";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });

  // ✅ тільки POST
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed" });

  try {
    // ✅ витягаємо токен з Authorization: Bearer <token>
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return json(req, 401, { error: "Missing access token" });

    // ✅ беремо з Secrets (НІЯКИХ ключів в коді)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRole || !anonKey) {
      return json(req, 500, { error: "Missing Supabase secrets (URL / SERVICE_ROLE / ANON_KEY)" });
    }

    // ✅ адмін клієнт (service role) — для deleteUser та доступу без RLS
    const admin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // ✅ публічний клієнт (anon) — для перевірки пароля
    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // ✅ хто викликає (перевіряємо токен)
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes.user) return json(req, 401, { error: "Invalid token" });

    const uid = userRes.user.id;
    const email = userRes.user.email || "";
    if (!email) return json(req, 400, { error: "User email missing" });

    // ✅ читаємо password з body
    const body = await req.json().catch(() => ({} as any));
    const password = String((body as any)?.password || "").trim();
    if (!password) return json(req, 400, { error: "Password required" });

    // ✅ перевірка пароля (якщо невірний — 403)
    const { error: pwErr } = await publicClient.auth.signInWithPassword({ email, password });
    if (pwErr) return json(req, 403, { error: "Wrong password" });

    // ✅ 1) видалити всі дані користувача (додай таблиці, якщо з’являться нові)
    await admin.from("user_state").delete().eq("user_id", uid);
    await admin.from("profiles").delete().eq("id", uid);

    // ✅ 2) видалити auth.users (це повне видалення акаунта)
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) throw delErr;

    // ✅ ок
    return json(req, 200, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(req, 500, { error: msg });
  }
});
