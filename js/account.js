// js/account.js
(() => {
  const toast = (m) => (window.Selfio?.toast ? window.Selfio.toast(m) : alert(String(m)));

  const setLoading = window.Selfio?.setLoading || ((btn, on, text) => {
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
    return (p === "free" || p === "pro" || p === "premium") ? p : "free";
  }

  function planPerksText(plan) {
    const p = normalizePlan(plan);
    if (p === "free") return "Free plan: basic weekly planning.\nUpgrade to Pro for planning ahead.\nUpgrade to Premium for templates + insights.";
    if (p === "pro") return "Pro active: plan this week + next weeks.\nPush goals to Today.\nUpgrade to Premium for templates + month insights.";
    return "Premium active: templates + up to 8 weeks ahead.\nMonth insights + trends.\nExport data.";
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleDateString();
    } catch { return "—"; }
  }

  async function main() {
    if (document.body?.getAttribute("data-page") !== "account") return;

    const cloud = window.Selfio?.cloud;
    if (!cloud?.client) {
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
      } catch { toast("Can’t copy (browser blocked)."); }
    });

    // Export (як було)
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

    // ✅ Delete account
    btnDelete?.addEventListener("click", async (e) => {
      e.preventDefault();

      const password = String(delPassword?.value || "").trim();
      if (!password) return toast("Enter your current password.");

      const ok = confirm("Delete your account permanently? This cannot be undone.");
      if (!ok) return;

      setLoading(btnDelete, true, "Deleting...");

      try {
        await cloud.deleteAccountViaFunction(password);

        // успіх: локально чистимо і на sign in (реєстрація/логін)
        try { await cloud.client.auth.signOut(); } catch (_) {}
        cloud.clearAllLocalAuth();

        toast("Account deleted ✅");
        location.replace("signin.html?mode=register");
      } catch (err) {
        if (err?.code === "WRONG_PASSWORD") {
          toast("Wrong password ❌");
          return;
        }
        if (err?.code === "SESSION_EXPIRED") {
          toast("Session expired. Please sign in again.");
          cloud.clearAllLocalAuth();
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
