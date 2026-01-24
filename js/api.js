// js/core/api.js
(function () {
  window.Selfio = window.Selfio || {};

  function sb() {
    const c = window.Selfio.supabase;
    if (!c) throw new Error("Supabase client not initialized");
    return c;
  }

  async function uid() {
    const { data, error } = await sb().auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not authenticated");
    return data.user.id;
  }

  // PROFILE
  async function getMyProfile() {
    const id = await uid();
    const { data, error } = await sb().from("profiles").select("*").eq("id", id).single();
    if (error) throw error;
    return data;
  }

  async function updateMyProfile(patch) {
    const id = await uid();
    const { data, error } = await sb()
      .from("profiles")
      .update({ ...patch })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  // PLAN
  async function getMyPlan() {
    const id = await uid();
    const { data, error } = await sb()
      .from("user_plans")
      .select("*")
      .eq("user_id", id)
      .single();
    if (error) throw error;
    return data;
  }

  async function setMyPlan(plan) {
    const id = await uid();
    const payload = { user_id: id, plan, status: "active", provider: "manual" };

    const { data, error } = await sb()
      .from("user_plans")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  window.Selfio.api = { getMyProfile, updateMyProfile, getMyPlan, setMyPlan };
})();
