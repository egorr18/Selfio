// js/sign.js
(function () {
  function $(sel) { return document.querySelector(sel); }

  const ALLOWED_NEXT = new Set([
    "app.html",
    "weekly.html",
    "habits.html",
    "account.html",
    "my-plan.html",
    "choose-plan.html",
  ]);

  function sanitizeNext(raw) {
    let v = String(raw || "").trim();
    if (!v) return "app.html";

    const low = v.toLowerCase();
    if (low.startsWith("http:") || low.startsWith("https:") || low.startsWith("//") || low.startsWith("javascript:")) {
      return "app.html";
    }

    try { v = decodeURIComponent(v); } catch {}
    const base = v.split(/[?#]/)[0];
    if (!ALLOWED_NEXT.has(base)) return "app.html";
    return v;
  }

  function ensureMsgEl() {
    let el = $("#auth-msg");
    if (el) return el;
    const form = $(".auth__form");
    if (!form) return null;

    el = document.createElement("p");
    el.id = "auth-msg";
    el.className = "mini";
    el.style.marginTop = "10px";
    form.appendChild(el);
    return el;
  }

  function msg(text, kind = "") {
    const el = ensureMsgEl();
    if (!el) return;
    el.textContent = text || "";
    el.dataset.kind = kind; // можеш стилізувати по [data-kind="error"]
  }

  function setModeUI(mode) {
    const title = document.querySelector("[data-auth-title]");
    const text = document.querySelector("[data-auth-text]");
    const note = document.querySelector("[data-auth-note]");
    const submit = document.querySelector("[data-submit]");

    const isReg = mode === "register";

    if (title) title.textContent = isReg ? "Create account" : "Welcome back";
    if (text) text.textContent = isReg
      ? "Create an account to continue your journaling journey."
      : "Sign in to continue your journaling journey.";
    if (note) note.innerHTML = isReg
      ? 'Already have an account? Select <b>Sign in</b>.'
      : 'New here? Select <b>Create account</b>.';
    if (submit) submit.textContent = isReg ? "Create account" : "Sign in";

    document.querySelectorAll(".auth__switch [data-mode]").forEach((b) => {
      const m = b.getAttribute("data-mode");
      b.classList.toggle("btn--primary", m === mode);
      b.classList.toggle("btn--secondary", m !== mode);
    });
  }

  async function afterAuthRedirect(next) {
    // якщо план вже вибрано — йдемо на next, інакше на choose-plan
    const email = (localStorage.getItem("selfio_email") || "").toLowerCase();
    const perUserPlan = localStorage.getItem(`selfio_plan:${email || "anon"}`);
    const hasPlan = !!perUserPlan;

    if (!hasPlan) {
      location.href = `choose-plan.html?next=${encodeURIComponent(next)}`;
      return;
    }
    location.href = next;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const qs = new URLSearchParams(location.search);
    const next = sanitizeNext(qs.get("next"));

    const cloud = window.Selfio?.cloud;
    const auth = window.Selfio?.auth;

    if (!cloud || !auth) {
      console.error("[Selfio] Missing Selfio.cloud or Selfio.auth. Check script order.");
      msg("App scripts not loaded правильно. Перевір порядок підключень.", "error");
      return;
    }

    let mode = (qs.get("mode") || "login").toLowerCase();
    if (mode !== "register") mode = "login";
    setModeUI(mode);

    document.querySelectorAll(".auth__switch [data-mode]").forEach((b) => {
      b.addEventListener("click", () => {
        mode = b.getAttribute("data-mode") === "register" ? "register" : "login";
        setModeUI(mode);
        msg("");
        const url = new URL(location.href);
        url.searchParams.set("mode", mode);
        history.replaceState({}, "", url.toString());
      });
    });

    const form = $(".auth__form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg("");

      const email = (form.querySelector('input[name="email"]')?.value || "").trim();
      const password = (form.querySelector('input[name="password"]')?.value || "").trim();
      if (!email || !password) return msg("Fill email + password.", "error");

      try {
        if (mode === "register") {
          const res = await auth.signUp(email, password, "");
          if (res?.user && !res?.session) {
            msg("Check your email to confirm your account.", "ok");
            return;
          }
        } else {
          await auth.signIn(email, password);
        }

        // створимо/оновимо профіль
        await cloud.ensureProfile();

        await afterAuthRedirect(next);
      } catch (err) {
        console.error(err);
        msg(err?.message || "Auth failed", "error");
      }
    });
  });
})();
