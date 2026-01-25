// js/account.js (Supabase) — SINGLE, NO DUPLICATES
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
    } catch {
      return "—";
    }
  }

  async function main() {
    if (document.body?.getAttribute("data-page") !== "account") return;

    const cloud = window.Selfio?.cloud;
    if (!cloud?.client || !cloud.getUser || !cloud.getSession) {
      toast("Cloud not ready. Check script order: config.js → cloud/supabase.js → app.js → account.js");
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

    function showInlineMsg(el, msg, type = "info") {
      if (!el) return;
      el.textContent = String(msg || "");
      el.dataset.type = type;
      el.style.display = msg ? "" : "none";
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
          toastCopy.textContent = "Copied!";
          toastCopy.style.display = "";
          setTimeout(() => { toastCopy.style.display = "none"; toastCopy.textContent = ""; }, 1200);
        } else toast("Copied!");
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
        } catch (_) {}
      }, 450);
    });

    // Change password
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

        const { error: e1 } = await cloud.client.auth.signInWithPassword({ email: user.email, password: cur });
        if (e1) throw e1;

        const { error: e2 } = await cloud.client.auth.updateUser({ password: nw });
        if (e2) throw e2;

        showInlineMsg(passMsg, "Password updated ✅", "ok");
        passCurrent.value = "";
        passNew.value = "";
        passConfirm.value = "";
      } catch (err) {
        showInlineMsg(passMsg, err?.message || "Failed to update password", "err");
      } finally {
        setLoading(passSaveBtn, false);
      }
    });

    // Export (залиш як у тебе — тут не чіпаю логіку)

    // ✅ DELETE ACCOUNT (правильна поведінка)
    btnDelete?.addEventListener("click", async (e) => {
      e.preventDefault();

      const password = String(delPassword?.value || "").trim();
      if (!password) return toast("Enter your current password.");

      const ok = confirm("Delete your account permanently? This cannot be undone.");
      if (!ok) return;

      setLoading(btnDelete, true, "Deleting...");

      try {
        await cloud.deleteAccountHard(password);

        toast("Account deleted ✅");
        // ✅ після видалення: на sign in (реєстрація нового)
        location.replace("signin.html?mode=register");
      } catch (err) {
        const code = err?.code || "";

        if (code === "WRONG_PASSWORD") {
          toast("Wrong password ❌");
          return; // ✅ НЕ виходимо з акаунта
        }

        if (code === "INVALID_JWT" || code === "NO_SESSION") {
          toast("Session expired. Please sign in again.");
          location.replace("signin.html?mode=login&next=" + encodeURIComponent("account.html"));
          return;
        }

        toast(err?.message || "Delete failed. Check console.");
        console.error(err);
      } finally {
        setLoading(btnDelete, false);
      }
    });

    await loadMe();
  }

  document.addEventListener("DOMContentLoaded", main);
})();
