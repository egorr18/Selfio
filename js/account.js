// js/account.js (Supabase)
document.addEventListener("DOMContentLoaded", async () => {
  const toast = window.Selfio?.toast || ((m) => alert(String(m)));
  const setLoading = window.Selfio?.setLoading || (() => {});
  const cloud = window.Selfio?.cloud;

  if (!cloud) {
    console.error("[Selfio] cloud missing");
    toast("Cloud not ready. Check script order.");
    return;
  }

  // Elements
  const elEmail = document.querySelector("[data-account-email]");
  const elName = document.querySelector("[data-account-name]");
  const elMemberSince = document.querySelector("[data-member-since]");
  const elPlanBadge = document.querySelector("[data-plan-badge]");
  const elPlanPerks = document.querySelector("[data-plan-perks]");
  const elMeta = document.querySelector("[data-app-meta]");
  const elThemeLabel = document.querySelector("[data-theme-label]");

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

  function normalizePlan(p) {
    p = String(p || "").trim().toLowerCase();
    return (p === "free" || p === "pro" || p === "premium") ? p : "free";
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

  function setThemeLabel() {
    const t =
      localStorage.getItem("selfio_theme") ||
      localStorage.getItem("theme") ||
      "system";
    const label = (t === "dark") ? "Dark" : (t === "light") ? "Light" : "System";
    if (elThemeLabel) elThemeLabel.textContent = label;
  }

  async function loadMe() {
    const user = await cloud.getUser();
    if (!user) {
      location.href = "signin.html?mode=login&next=" + encodeURIComponent("account.html");
      return;
    }

    // гарантуємо профіль і читаємо
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

  // Save name (profile)
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

  // Change password (через reauth + updateUser)
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

      // reauth
      const { error: e1 } = await cloud.client.auth.signInWithPassword({
        email: user.email,
        password: cur,
      });
      if (e1) throw e1;

      // update password
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

  // Delete (data only)
  btnDelete?.addEventListener("click", async () => {
    const ok = confirm("Delete your Selfio data from database? (Auth account may remain)");
    if (!ok) return;

    // пароль тут не використовується для Supabase delete (без сервера), але поле лишаємо як “підтвердження”
    const pwd = String(delPassword?.value || "").trim();
    if (!pwd) {
      toast("Enter current password to confirm.");
      delPassword?.focus();
      return;
    }

    try {
      await cloud.deleteMyData();
      toast("Data deleted ✅ (now signing out)");
      await cloud.client.auth.signOut();
      location.replace("../index.html");
    } catch (e) {
      console.error(e);
      toast("Delete failed. Check RLS/table.");
    }
  });

  // init
  setThemeLabel();
  await loadMe();
});
