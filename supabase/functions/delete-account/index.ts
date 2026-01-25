import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1) беремо access token з Authorization: Bearer ...
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) secrets (НЕ SUPABASE_*)
    const projectUrl = Deno.env.get("PROJECT_URL");
    const anonKey = Deno.env.get("ANON_KEY");
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!projectUrl || !anonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing function secrets (PROJECT_URL/ANON_KEY/SERVICE_ROLE_KEY)" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) admin клієнт (service role) + public клієнт (anon)
    const admin = createClient(projectUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const publicClient = createClient(projectUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // 4) перевіряємо JWT і дістаємо користувача
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Invalid JWT" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uid = userRes.user.id;
    const email = userRes.user.email || "";

    // 5) читаємо пароль з body
    const body = await req.json().catch(() => ({}));
    const password = String(body?.password || "").trim();

    if (!password) {
      return new Response(JSON.stringify({ error: "Password required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6) перевірка пароля (якщо не той — 403)
    const { error: pwErr } = await publicClient.auth.signInWithPassword({ email, password });
    if (pwErr) {
      return new Response(JSON.stringify({ error: "Wrong password" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7) видаляємо дані з таблиць
    // (якщо додаси нові таблиці — додай сюди)
    const d1 = await admin.from("user_state").delete().eq("user_id", uid);
    if (d1.error) throw d1.error;

    const d2 = await admin.from("profiles").delete().eq("id", uid);
    if (d2.error) throw d2.error;

    // 8) видаляємо AUTH юзера (головне)
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
