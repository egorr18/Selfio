// js/account.js (Supabase) — clean, no duplicates
document.addEventListener("DOMContentLoaded", async () => {
  const toast = window.Selfio?.toast || ((m) => alert(String(m)));
  const setLoading = window.Selfio?.setLoading || (() => {});
  const cloud = window.Selfio?.cloud;

  if (!cloud?.client || !cloud.getUser) {
    console.error("[Selfio] cloud missing");
    toast("Cloud not ready. Check script order (config.js -> supabase.js -> account.js).");
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

  const passForm = document.querySelector("[data-pass-form]");
  const passCurrent = document.querySelector("[data-pass-current]");
  const passNew = document.querySelector("[data-pass-new]");
  const passConfirm = document.querySelector("[data-pass-confirm]");
  const passSaveBtn = document.querySelector("[data-pass-save]");
  const passMsg = document.querySelector("[data-pass-msg]");

  const FN_DELETE_URL = "https://duvgdgzbjrkkcxddfpvm.functions.supabase.co/delete-account";

  function homeUrl() {
    const p = location.pathname || "";
    return p.includes("/pages/") ? "../index.html" : "index.html";
  }

  function normalizePlan(p) {
    p = String(p || "").trim().toLowerCase();
    return p === "free" || p === "pro" || p === "premium" ? p : "free";
  }

  function planPerksText(plan) {
    const p = normalizePlan(plan);
    if (p === "free") {
      return [
        "Free plan: basic weekly planning.",
        "Upgrade to Pro for planning ahead.",
        "Upgrade to Premium for templates + insights.",
      ].join("\n");
    }
    if (p === "pro") {
      return [
        "Pro active: plan this week + next weeks.",
        "Push goals to Today (Weekly → Today).",
        "Upgrade to Premium for templates + month insights.",
      ].join("\n");
    }
    return [
      "Premium active: templates + up to 8 weeks ahead.",
      "Month insights + trends.",
      "Export data.",
    ].join("\n");
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

  function showInlineMsg(el, msg, type = "info") {
    if (!el) return;
    el.textContent = String(msg || "");
    el.dataset.type = type;
    el.style.display = msg ? "" : "none";
  }

  function clearLocalAuthEverywhere() {
    localStorage.removeItem("selfio_token");
    localStorage.removeItem("selfio_email");
    localStorage.removeItem("selfio_name");
    localStorage.removeItem("selfio_plan");

    Object.keys(localStorage)
      .filter((k) => k.startsWith("selfio_plan:"))
      .forEach((k) => localStorage.removeItem(k));
  }

  async function loadMe() {
    const user = await cloud.getUser();
    if (!user) {
      location.href = "signin.html?mode=login&next=" + encodeURIComponent("account.html");
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
        showInlineMsg(toastCopy, "Copied!", "ok");
        setTimeout(() => showInlineMsg(toastCopy, ""), 1200);
      } else {
        toast("Copied!");
      }
    } catch {
      toast("Can’t copy (browser blocked).");
    }
  });

  // Save name (debounced)
  let nameTimer = null;
  elName?.addEventListener("input", () => {
    const v = String(elName.value || "");
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

  // Change password (reauth + updateUser)
  passForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showInlineMsg(passMsg, "");

    const cur = String(passCurrent?.value || "").trim();
    const nw = String(passNew?.value || "").trim();
    const cf = String(passConfirm?.value || "").trim();

    if (!cur || !nw || !cf) return showInlineMsg(passMsg, "Fill all fields.", "err");
    if (nw.length < 6) return showInlineMsg(passMsg, "New password is too short (min 6).", "err");
    if (nw !== cf) return showInlineMsg(passMsg, "Passwords do not match.", "err");

    setLoading(passSaveBtn, true, "Saving...");

    try {
      const user = await cloud.getUser();
      if (!user?.email) throw new Error("No user email");

      const { error: e1 } = await cloud.client.auth.signInWithPassword({
        email: user.email,
        password: cur,
      });
      if (e1) throw e1;

      const { error: e2 } = await cloud.client.auth.updateUser({ password: nw });
      if (e2) throw e2;

      showInlineMsg(passMsg, "Password updated ✅", "ok");
      passCurrent.value = "";
      passNew.value = "";
      passConfirm.value = "";
    } catch (err) {
      console.error(err);
      showInlineMsg(passMsg, err?.message || "Failed to update password", "err");
    } finally {
      setLoading(passSaveBtn, false);
    }
  });

  // Export data
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

  // Delete account (Edge Function)
  btnDelete?.addEventListener("click", async (e) => {
    e.preventDefault();

    const password = String(delPassword?.value || "").trim();
    if (!password) {
      toast("Enter your current password.");
      return;
    }

    const ok = confirm("Delete account forever? This cannot be undone.");
    if (!ok) return;

    const anonKey = window.Selfio?.config?.supabaseAnonKey;
    if (!anonKey) {
      toast("Missing anon key in config.js");
      return;
    }

    setLoading(btnDelete, true, "Deleting...");
    btnDelete.disabled = true;

    try {
      // беремо session (і пробуємо refresh, щоб JWT був валідний)
      let session = null;
      try {
        const s1 = await cloud.client.auth.getSession();
        session = s1?.data?.session || null;
      } catch {}

      if (!session) {
        location.replace("signin.html?mode=login&next=" + encodeURIComponent("account.html"));
        return;
      }

      // refresh (не обов’язково, але часто рятує від Invalid JWT)
      try {
        const r = await cloud.client.auth.refreshSession();
        session = r?.data?.session || session;
      } catch {}

      const token = session?.access_token;
      if (!token) {
        location.replace("signin.html?mode=login&next=" + encodeURIComponent("account.html"));
        return;
      }

      const res = await fetch(FN_DELETE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 403) {
        toast("Wrong password ❌");
        return;
      }

      if (res.status === 401) {
        // якщо шлюз каже Invalid JWT — перезалогін
        toast(data?.message || data?.error || "Session expired. Please sign in again.");
        location.replace("signin.html?mode=login&next=" + encodeURIComponent("account.html"));
        return;
      }

      if (!res.ok) {
        console.error("Delete failed:", data);
        toast(data?.error || data?.message || "Delete failed. Check console/network.");
        return;
      }

      // успіх: чистимо все
      try { await cloud.client.auth.signOut(); } catch {}
      clearLocalAuthEverywhere();
      toast("Account deleted ✅");
      location.replace(homeUrl());
    } catch (err) {
      console.error(err);
      toast("Delete failed. Check console/network.");
    } finally {
      btnDelete.disabled = false;
      setLoading(btnDelete, false);
    }
  });

  // init
  await loadMe();
});
