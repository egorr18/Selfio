// js/account.js — SIMPLE (profile + export only)
(() => {
  const toast = (m) => (window.Selfio?.toast ? window.Selfio.toast(m) : alert(String(m)));

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
        "Push goals to Today.",
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

  async function main() {
    if (document.body?.getAttribute("data-page") !== "account") return;

    const cloud = window.Selfio?.cloud;
    if (!cloud?.client || !cloud.getUser) {
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

    async function loadMe() {
      const user = await cloud.getUser().catch(() => null);
      if (!user) {
        location.replace("signin.html?mode=login&next=" + encodeURIComponent("account.html"));
        return;
      }

      // ensure profile exists + read it
      if (typeof cloud.ensureProfile === "function") await cloud.ensureProfile();
      const profile = (typeof cloud.getMyProfile === "function")
        ? await cloud.getMyProfile()
        : { email: user.email, plan: "free", name: "" };

      const email = String(profile.email || user.email || "").toLowerCase();
      const plan = normalizePlan(profile.plan);

      if (elEmail) elEmail.value = email;
      if (elName) elName.value = profile.name || "";
      if (elPlanBadge) elPlanBadge.textContent = plan.toUpperCase();
      if (elPlanPerks) elPlanPerks.textContent = planPerksText(plan);
      if (elMemberSince) elMemberSince.textContent = formatDate(profile.created_at || user.created_at);
      if (elMeta) elMeta.textContent = `${email || "—"} • ${plan.toUpperCase()}`;

      // локальні кеші
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
          setTimeout(() => {
            toastCopy.style.display = "none";
            toastCopy.textContent = "";
          }, 1200);
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
      const v = String(elName.value ?? "");
      localStorage.setItem("selfio_name", v);

      clearTimeout(nameTimer);
      nameTimer = setTimeout(async () => {
        try {
          const user = await cloud.getUser().catch(() => null);
          if (!user) return;

          if (typeof cloud.ensureProfile === "function") await cloud.ensureProfile();
          await cloud.client.from("profiles").update({ name: v }).eq("id", user.id);
        } catch (e) {
          console.warn("Name update failed:", e);
        }
      }, 450);
    });

    // Export
    btnExport?.addEventListener("click", async () => {
      try {
        const user = await cloud.getUser().catch(() => null);
        if (!user) return toast("Not signed in.");

        const profile = (typeof cloud.getMyProfile === "function") ? await cloud.getMyProfile() : null;
        const state = (typeof cloud.loadState === "function") ? await cloud.loadState() : null;

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

    await loadMe();
  }

  document.addEventListener("DOMContentLoaded", main);
})();
