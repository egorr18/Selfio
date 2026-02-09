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
    if (
      low.startsWith("http:") ||
      low.startsWith("https:") ||
      low.startsWith("//") ||
      low.startsWith("javascript:")
    ) return "app.html";

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
    el.setAttribute("aria-live", "polite");
    el.setAttribute("role", "status");
    form.appendChild(el);
    return el;
  }


  function msg(text, kind = "") {
    const el = ensureMsgEl();
    if (!el) return;
    el.textContent = text || "";
    el.dataset.kind = kind;
  }

    function setNote(noteEl, isReg) {
    if (!noteEl) return;
    noteEl.textContent = "";

    if (isReg) {
      noteEl.append(document.createTextNode("Already have an account? Select "));
      const b = document.createElement("b");
      b.textContent = "Sign in";
      noteEl.append(b);
      noteEl.append(document.createTextNode("."));
    } else {
      noteEl.append(document.createTextNode("New here? Select "));
      const b = document.createElement("b");
      b.textContent = "Create account";
      noteEl.append(b);
      noteEl.append(document.createTextNode("."));
    }
  }

  function setModeUI(mode) {
    const title = document.querySelector("[data-auth-title]");
    const text = document.querySelector("[data-auth-text]");
    const note = document.querySelector("[data-auth-note]");
    const submit = document.querySelector("[data-submit]");

    const isReg = mode === "register";

    if (title) title.textContent = isReg ? "Create account" : "Welcome back";
    if (text) {
      text.textContent = isReg
        ? "Create an account to continue your journaling journey."
        : "Sign in to continue your journaling journey.";
    }
    if (note) setNote(note, isReg);
    if (submit) submit.textContent = isReg ? "Create account" : "Sign in";

    document.querySelectorAll(".auth__switch [data-mode]").forEach((b) => {
      const m = b.getAttribute("data-mode");
      b.classList.toggle("btn--primary", m === mode);
      b.classList.toggle("btn--secondary", m !== mode);
    });
  }

  // читаємо mode з #hash або з ?mode= (fallback)
  function getMode() {
    const qs = new URLSearchParams(location.search);
    const fromQuery = (qs.get("mode") || "").toLowerCase();
    const fromHash = (location.hash || "").replace("#", "").toLowerCase();

    if (fromHash === "login" || fromHash === "register") return fromHash;
    if (fromQuery === "login" || fromQuery === "register") return fromQuery;
    return "login";
  }

  // записуємо mode у hash (SEO-дружньо: без ?mode=)
  function setMode(mode) {
    mode = mode === "register" ? "register" : "login";
    if (location.hash.replace("#", "") !== mode) {
      history.replaceState({}, "", `${location.pathname}${location.search}#${mode}`);
    }
  }

// ДОДАЙ зверху біля інших helper-функцій
function needChooseKey(email) {
  return `selfio_need_choose_plan:${(email || "anon").toLowerCase()}`;
}

function markNeedChoose(email) {
  localStorage.setItem("selfio_need_choose_plan", "1"); // fallback
  localStorage.setItem(needChooseKey(email), "1");       // per-user
}

function needsChoosePlan(email) {
  return (
    localStorage.getItem("selfio_need_choose_plan") === "1" ||
    localStorage.getItem(needChooseKey(email)) === "1"
  );
}

// ЗАМІНИ afterAuthRedirect на цю
async function afterAuthRedirect(next, email, mode) {
  const emailLower = (email || localStorage.getItem("selfio_email") || "").toLowerCase();

  // ✅ 1) Якщо це реєстрація — ЗАВЖДИ на choose-plan
  if (mode === "register") {
    markNeedChoose(emailLower);
    location.href = `choose-plan.html?next=${encodeURIComponent(next || "app.html")}`;
    return;
  }

  // ✅ 2) Якщо є флаг "треба вибрати план" — теж на choose-plan
  if (needsChoosePlan(emailLower)) {
    location.href = `choose-plan.html?next=${encodeURIComponent(next || "app.html")}`;
    return;
  }

  // ✅ 3) Для login — якщо плану немає, то choose-plan
  const perUserPlan = localStorage.getItem(`selfio_plan:${emailLower || "anon"}`);
  if (!perUserPlan) {
    location.href = `choose-plan.html?next=${encodeURIComponent(next || "app.html")}`;
    return;
  }

  // ✅ 4) Інакше — на next
  location.href = next || "app.html";
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

    // mode тепер з hash/query
    let mode = getMode();
    setModeUI(mode);

    // якщо mode прийшов через ?mode= — підчистимо UI на hash
    // (не обов'язково, але гарно)
    setMode(mode);

    document.querySelectorAll(".auth__switch [data-mode]").forEach((b) => {
      b.addEventListener("click", () => {
        mode = b.getAttribute("data-mode") === "register" ? "register" : "login";
        setModeUI(mode);
        setMode(mode);
        msg("");
      });
    });

    // якщо користувач руками поміняв hash (або прийшов по лінку #register)
    window.addEventListener("hashchange", () => {
      const m = getMode();
      mode = m;
      setModeUI(mode);
      msg("");
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

        await cloud.ensureProfile();
        await afterAuthRedirect(next, email, mode);
      } catch (err) {
        console.error(err);
        msg(err?.message || "Auth failed", "error");
      }
    });
  });
})();
