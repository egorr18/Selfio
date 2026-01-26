// js/account.js — CLEAN + FIXED (profile + export + change password + delete account)
(() => {
  const toast = (m) => (window.Selfio?.toast ? window.Selfio.toast(m) : alert(String(m)));

  const setLoading =
    window.Selfio?.setLoading ||
    ((btn, on, text) => {
      if (!btn) return;
      if (on) {
        btn.disabled = true;
        btn.dataset._oldText = btn.textContent || "";
        btn.textContent = text || "Loading...";
      } else {
        btn.disabled = false;
        if (btn.dataset._oldText) btn.textContent = btn.dataset._oldText;
        delete btn.dataset._oldText;
      }
    });

  function normalizePlan(p) {
    p = String(p || "").trim().toLowerCase();
    return p === "free" || p === "pro" || p === "premium" ? p : "free";
  }

  function planPerksText(plan) {
    const p = normalizePlan(plan);
    if (p === "free")
      return "Free plan: basic weekly planning.\nUpgrade to Pro for planning ahead.\nUpgrade to Premium for templates + insights.";
    if (p === "pro")
      return "Pro active: plan this week + next weeks.\nPush goals to Today.\nUpgrade to Premium for templates + month insights.";
    return "Premium active: templates + up to 8 weeks ahead.\nMonth insights + trends.\nExport data.";
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString();
    } catch {
      return "—";
    }
  }

  function clearLocalAuthHard() {
    // прибираємо твої ключі
    localStorage.removeItem("selfio_token");
    localStorage.removeItem("selfio_email");
    localStorage.removeItem("selfio_name");
    localStorage.removeItem("selfio_plan");

    // можливі storageKey варіанти (якщо міняв)
    localStorage.removeItem("selfio_auth");
    localStorage.removeItem("sb-duvgdgzbjrkkcxddfpvm-auth-token");

    // на всякий випадок — всі sb-...-auth-token
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))
      .forEach((k) => localStorage.removeItem(k));

    // кеші планів по email
    Object.keys(localStorage)
      .filter((k) => k.startsWith("selfio_plan:"))
      .forEach((k) => localStorage.removeItem(k));
  }

  async function main() {
    if (document.body?.getAttribute("data-page") !== "account") return;

    const cloud = window.Selfio?.cloud;
    const cfg = window.Selfio?.config;

    if (!cloud?.client || !cloud.getUser || !cloud.getSession) {
      toast("Cloud not ready. Check script order: config.js → supabase.js → account.js");
      return;
    }

    // Elements
    const elEmail = document.querySelector("[data-account-email]");
    const elName = document.querySelector("[data-account-name]");
    const elMemberSince = document.querySelector("[data-member-since]");
    const elPlanBadge = document.querySelector("[data-plan-badge]");
    const elPlanPerks = document.querySelector("[data-plan-perks]");
    const elMeta = document.querySelector("[data-app-meta]");

    const btnCopyEmail = document.querySelector("[data-copy-email]");
    const toastCopy = document.querySelector("[data-copy-toast]");
    const btnExport = document.querySelector("[data-export]");
    const btnDelete = document.querySelector("[data-delete]");
    const delPassword = document.querySelector("[data-delete-password]");

    // Password elements (Security section)
    const passForm = document.querySelector("[data-pass-form]");
    const passCurrent = document.querySelector("[data-pass-current]");
    const passNew = document.querySelector("[data-pass-new]");
    const passConfirm = document.querySelector("[data-pass-confirm]");
    const passSaveBtn = document.querySelector("[data-pass-save]");
    const passMsg = document.querySelector("[data-pass-msg]");

    function showInline(el, msg, type = "info") {
      if (!el) return;
      el.textContent = String(msg || "");
      el.dataset.type = type;
      el.style.display = msg ? "" : "none";
    }

    async function loadMe() {
      const user = await cloud.getUser();
      if (!user) {
        location.replace("signin.html?mode=login&next=" + encodeURIComponent("account.html"));
        return;
      }

      await cloud.ensureProfile();
      const profile = await cloud.getMyProfile();

      const email = String(profile.email || user.email || "").toLowerCase();
      const plan = normalizePlan(profile.plan);

      if (elEmail) elEmail.value = email;
      if (elName) elName.value = profile.name || "";
      if (elPlanBadge) elPlanBadge.textContent = plan.toUpperCase();
      if (elPlanPerks) elPlanPerks.textContent = planPerksText(plan);
      if (elMemberSince) elMemberSince.textContent = formatDate(profile.created_at || user.created_at);
      if (elMeta) elMeta.textContent = `${email || "—"} • ${plan.toUpperCase()}`;

      // локальні кеші (не обов'язково, але корисно)
      localStorage.setItem("selfio_email", email);
      localStorage.setItem("selfio_plan", plan);
      localStorage.setItem(`selfio_plan:${email || "anon"}`, plan);
    }

    // Copy email
    btnCopyEmail?.addEventListener("click", async () => {
      const email = (elEmail?.value || "").trim();
      if (!email) return;
      try {
        await navigator.clipboard.writeText(email);
        if (toastCopy) {
          showInline(toastCopy, "Copied!", "ok");
          setTimeout(() => showInline(toastCopy, ""), 1200);
        } else toast("Copied!");
      } catch {
        toast("Can’t copy (browser blocked).");
      }
    });

    // Save name (debounced)
    let nameTimer = null;
    elName?.addEventListener("input", () => {
      const v = String(elName.value ?? "");
      localStorage.setItem("selfio_name", v);

      clearTimeout(nameTimer);
      nameTimer = setTimeout(async () => {
        try {
          const user = await cloud.getUser();
          if (!user) return;
          await cloud.ensureProfile();
          await cloud.client.from("profiles").update({ name: v }).eq("id", user.id);
        } catch (e) {
          console.warn("Name update failed:", e);
        }
      }, 450);
    });

    // Export
    btnExport?.addEventListener("click", async () => {
      try {
        const user = await cloud.getUser();
        if (!user) return toast("Not signed in.");

        const profile = await cloud.getMyProfile();
        const state = await cloud.loadState();

        const payload = {
          schema: "selfio.export.v1",
          exported_at: new Date().toISOString(),
          profile,
          state: state || null,
        };

        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `selfio-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);

        toast("Export ready ✅");
      } catch (e) {
        console.error(e);
        toast("Export failed. Check console.");
      }
    });

    // --- Change password (stable) ---
    passForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      showInline(passMsg, "");

      // НЕ trim() для паролів
      const cur = String(passCurrent?.value ?? "");
      const nw = String(passNew?.value ?? "");
      const cf = String(passConfirm?.value ?? "");

      if (!cur || !nw || !cf) return showInline(passMsg, "Fill all fields.", "err");
      if (nw.length < 6) return showInline(passMsg, "New password is too short (min 6).", "err");
      if (nw !== cf) return showInline(passMsg, "Passwords do not match.", "err");

      setLoading(passSaveBtn, true, "Saving...");

      try {
        if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey || !window.supabase?.createClient) {
          throw new Error("Supabase config/sdk not ready.");
        }

        const user = await cloud.getUser();
        if (!user?.email) throw new Error("No user email");

        // 1) verify current password WITHOUT touching browser session
        const temp = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { error: vErr } = await temp.auth.signInWithPassword({
          email: user.email,
          password: cur,
        });

        if (vErr) {
          showInline(passMsg, "Current password is wrong ❌", "err");
          return;
        }

        // 2) update password on the REAL session client
        const { error: upErr } = await cloud.client.auth.updateUser({ password: nw });
        if (upErr) throw upErr;

        showInline(passMsg, "Password updated ✅ Please sign in again…", "ok");

        // 3) sign out + clear local auth keys
        try {
          await cloud.client.auth.signOut();
        } catch (_) {}

        // якщо у тебе є готова функція — використаємо її, інакше hard-clean
        if (typeof cloud.clearAllLocalAuth === "function") cloud.clearAllLocalAuth();
        else clearLocalAuthHard();

        // 4) redirect to signin
        location.replace("signin.html?mode=login&msg=pw_updated");
      } catch (err) {
        console.error(err);
        showInline(passMsg, err?.message || "Failed to update password", "err");
      } finally {
        setLoading(passSaveBtn, false);
      }
    });

    // ✅ Delete account
    btnDelete?.addEventListener("click", async (e) => {
      e.preventDefault();

      const password = String(delPassword?.value ?? "").trim();
      if (!password) return toast("Enter your current password.");

      const ok = confirm("Delete your account permanently? This cannot be undone.");
      if (!ok) return;

      setLoading(btnDelete, true, "Deleting...");

      try {
        // delete via Edge Function (має бути в cloud)
        if (typeof cloud.deleteAccountViaFunction !== "function") {
          throw new Error("deleteAccountViaFunction is missing in cloud. Check js/cloud/supabase.js");
        }

        await cloud.deleteAccountViaFunction(password);

        // успіх: sign out + clear local
        try {
          await cloud.client.auth.signOut();
        } catch (_) {}

        if (typeof cloud.clearAllLocalAuth === "function") cloud.clearAllLocalAuth();
        else clearLocalAuthHard();

        toast("Account deleted ✅");
        location.replace("signin.html?mode=register");
      } catch (err) {
        if (err?.code === "WRONG_PASSWORD") {
          toast("Wrong password ❌");
          return;
        }
        if (err?.code === "SESSION_EXPIRED") {
          toast("Session expired. Please sign in again.");
          if (typeof cloud.clearAllLocalAuth === "function") cloud.clearAllLocalAuth();
          else clearLocalAuthHard();
          location.replace("signin.html?mode=login&next=" + encodeURIComponent("account.html"));
          return;
        }

        console.error(err);
        toast(err?.message || "Delete failed. Check console/network.");
      } finally {
        setLoading(btnDelete, false);
      }
    });

    await loadMe();
  }

  document.addEventListener("DOMContentLoaded", main);
})();
