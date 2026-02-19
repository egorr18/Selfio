(async function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const ls = localStorage;

  const TOKEN_KEY = "selfio_token";
  const EMAIL_KEY = "selfio_email";
  const PLAN_KEY  = "selfio_plan";
  const APP_KEY   = "selfio_app_v1";

  const DEFAULT_FOCUSES = ["Deep work", "Study", "Health", "Social", "Reset"];
  const DEFAULT_HABITS  = ["Drink water", "Study 30 min"];

  const PLAN = {
    free:    { maxTasks: 5,  horizon: 0, goals: 0 },
    pro:     { maxTasks: 10, horizon: 2, goals: 3 },
    premium: { maxTasks: 15, horizon: 8, goals: 8 },
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const norm  = (s) => String(s ?? "").trim();
  const ymd = (d = new Date()) => {
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, "0");
    const D = String(d.getDate()).padStart(2, "0");
    return `${Y}-${M}-${D}`;
  };
  const isYMD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
  const parseYMD = (s) => {
    if (!isYMD(s)) return new Date();
    const [Y, M, D] = s.split("-").map(Number);
    return new Date(Y, M - 1, D);
  };
  const addDaysKey = (key, n) => {
    const d = parseYMD(key);
    d.setDate(d.getDate() + n);
    return ymd(d);
  };
  const startOfWeekMon = (d) => {
    const dt = new Date(d);
    const shift = (dt.getDay() + 6) % 7;
    dt.setDate(dt.getDate() - shift);
    dt.setHours(0,0,0,0);
    return dt;
  };
  const weekRangeText = (monday) => {
    const sun = new Date(monday);
    sun.setDate(monday.getDate() + 6);
    return `${ymd(monday)} — ${ymd(sun)}`;
  };

  const getMode = () => (window.Selfio?.store?.mode?.() || window.Selfio?.config?.mode || "demo");

  let __sb = null;
  const sb = () => {
    if (__sb) return __sb;
    if (window.Selfio?.cloud?.client) return (__sb = window.Selfio.cloud.client);

    const url = window.Selfio?.config?.supabaseUrl;
    const key = window.Selfio?.config?.supabaseAnonKey;
    const lib = window.supabase || window.Supabase;
    const createClient = lib?.createClient;

    if (url && key && typeof createClient === "function") __sb = createClient(url, key);
    return __sb;
  };

  const getSession = async () => {
    try {
      const client = sb();
      if (!client?.auth?.getSession) return null;
      const { data, error } = await client.auth.getSession();
      if (error) return null;
      return data?.session || null;
    } catch { return null; }
  };

  const signOutSafe = async () => {
    try {
      const client = sb();
      if (client?.auth?.signOut) await client.auth.signOut();
    } catch {}
  };

  const page = document.body?.dataset?.page || "today";
  const isApp = document.body?.hasAttribute("data-app");
  if (!isApp) return;

  const pageFile = (p) => (p === "today" ? "app.html" : `${p}.html`);
  const signinUrl = (nextFile) => `signin.html?mode=login&next=${encodeURIComponent(nextFile)}`;

  const requireAuth = async () => {
    const nextFile = pageFile(page);

    if (getMode() === "cloud") {
      const s = await getSession();
      const email = s?.user?.email;
      if (!email) { location.replace(signinUrl(nextFile)); return false; }
      ls.setItem(EMAIL_KEY, email);
      ls.setItem(TOKEN_KEY, "sb");
      return true;
    }

    if (!ls.getItem(TOKEN_KEY)) {
      location.replace(signinUrl(nextFile));
      return false;
    }
    return true;
  };

  const emailLower = () => norm(ls.getItem(EMAIL_KEY)).toLowerCase() || "anon";
  const planKeyFor = (email) => `${PLAN_KEY}:${email || "anon"}`;

  const normalizePlan = (p) => (PLAN[p] ? p : "");
  const getPlanSelectedForUser = () => {
    const e = emailLower();
    const perUser = normalizePlan(norm(ls.getItem(planKeyFor(e))).toLowerCase());
    if (perUser) { ls.setItem(PLAN_KEY, perUser); return perUser; }
    return normalizePlan(norm(ls.getItem(PLAN_KEY)).toLowerCase()) || "";
  };
  const getPlan = () => getPlanSelectedForUser() || "free";
  const isPro = () => ["pro","premium"].includes(getPlan());
  const isPremium = () => getPlan() === "premium";
  const limits = () => PLAN[getPlan()] || PLAN.free;

  const storageKey = () => `${APP_KEY}:${emailLower().replace(/\s+/g,"")}`;
  const load = () => { try { return JSON.parse(ls.getItem(storageKey()) || "{}"); } catch { return {}; } };
  const save = (st) => ls.setItem(storageKey(), JSON.stringify(st));

  const ensureTasksLen = (day, n) => {
    day.tasks = Array.isArray(day.tasks) ? day.tasks : [];
    day.tasksDone = Array.isArray(day.tasksDone) ? day.tasksDone : [];
    while (day.tasks.length < n) day.tasks.push("");
    while (day.tasksDone.length < n) day.tasksDone.push(false);
    day.tasks = day.tasks.slice(0, n);
    day.tasksDone = day.tasksDone.slice(0, n);
  };

  const ensureWeekPlan = (st, weekKey) => {
    st.weeks = st.weeks || {};
    const maxGoals = limits().goals;
    if (!st.weeks[weekKey]) st.weeks[weekKey] = { goals: [], note: "" };
    const wp = st.weeks[weekKey];
    wp.goals = Array.isArray(wp.goals) ? wp.goals : [];
    wp.note = typeof wp.note === "string" ? wp.note : "";
    const minGoals = maxGoals ? Math.min(3, maxGoals) : 0;
    while (wp.goals.length < minGoals) wp.goals.push("");
    if (maxGoals) wp.goals = wp.goals.slice(0, maxGoals);
    return wp;
  };

  const initState = () => {
    const st = load();
    st.days = st.days || {};
    st.settings = st.settings || {};
    st.weeks = st.weeks || {};

    if (!Array.isArray(st.settings.focuses) || !st.settings.focuses.length)
      st.settings.focuses = DEFAULT_FOCUSES.slice();

    const maxT = limits().maxTasks;
    st.settings.tasksCount = clamp(Number(st.settings.tasksCount || 3), 1, maxT);

    if (!Array.isArray(st.settings.habits) || !st.settings.habits.length)
      st.settings.habits = DEFAULT_HABITS.slice();

    for (const k of Object.keys(st.days)) {
      const d = st.days[k] || {};
      if (Array.isArray(d.habits) && d.habits.length) {
        const map = new Map(d.habits.map(h => [norm(h?.name).toLowerCase(), !!h?.done]));
        d.habitDone = st.settings.habits.map(n => !!map.get(norm(n).toLowerCase()));
        delete d.habits;
      }
      d.habitDone = Array.isArray(d.habitDone) ? d.habitDone : [];
      while (d.habitDone.length < st.settings.habits.length) d.habitDone.push(false);
      d.habitDone = d.habitDone.slice(0, st.settings.habits.length);
      st.days[k] = d;
    }

    save(st);
    return st;
  };

  const syncHabitsToAllDays = (st) => {
    for (const k of Object.keys(st.days)) {
      const d = st.days[k];
      d.habitDone = Array.isArray(d.habitDone) ? d.habitDone : [];
      while (d.habitDone.length < st.settings.habits.length) d.habitDone.push(false);
      d.habitDone = d.habitDone.slice(0, st.settings.habits.length);
    }
  };

  const setHeaderMeta = () => {
    const email = ls.getItem(EMAIL_KEY) || "Signed user";
    const plan = (getPlanSelectedForUser() || "—").toUpperCase();
    const meta = $("[data-app-meta]");
    if (meta) meta.textContent = `${email} • ${plan}`;
    $$("[data-user-email]").forEach(el => el.textContent = email);
    $$("[data-user-plan]").forEach(el => el.textContent = plan);
  };

  const bindLogout = () => {
    $$("[data-logout]").forEach(btn => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        if (getMode() === "cloud") await signOutSafe();
        ls.removeItem(TOKEN_KEY);
        ls.removeItem(EMAIL_KEY);
        ls.removeItem(PLAN_KEY);
        location.replace("../index.html");
      });
    });

    if (!window.__selfio_pageshow_bound) {
      window.__selfio_pageshow_bound = true;
      window.addEventListener("pageshow", () => requireAuth());
    }
  };

  if (!(await requireAuth())) return;
  if (!getPlanSelectedForUser() && page !== "choose-plan") {
    location.href = `choose-plan.html?next=${encodeURIComponent(pageFile(page))}`;
    return;
  }

  setHeaderMeta();
  bindLogout();

  const countPlanned = (tasks=[]) => tasks.map(norm).filter(Boolean).length;
  const countDone = (tasks=[], done=[]) => tasks.reduce((acc, t, i) => acc + (!!norm(t) && !!done[i] ? 1 : 0), 0);
  const pct = (a,b) => (!b ? 0 : Math.round((a/b)*100));

  const initToday = () => {
    if (page !== "today") return;
    const st = initState();
    const maxT = limits().maxTasks;

    const qsDate = new URLSearchParams(location.search).get("date");
    const dayKey = (qsDate && isYMD(qsDate)) ? qsDate : ymd();

    const ensureDay = (key) => {
      st.days[key] = st.days[key] || {
        mood: 3,
        focus: st.settings.focuses[0] || "Deep work",
        tasks: [],
        tasksDone: [],
        habitDone: st.settings.habits.map(() => false),
        note: "",
      };
      ensureTasksLen(st.days[key], st.settings.tasksCount);
      return st.days[key];
    };

    const day = ensureDay(dayKey);

    const moodBtns = $$("[data-mood]");
    const paintMood = () => moodBtns.forEach(b => b.dataset.active = String(Number(b.dataset.mood) === Number(day.mood)));
    moodBtns.forEach(b => b.addEventListener("click", () => { day.mood = Number(b.dataset.mood); save(st); paintMood(); }));
    paintMood();

    const focusSel = $("[data-focus]");
    const focusNew = $("[data-focus-new]");
    const focusAdd = $("[data-focus-add]");
    const renderFocus = () => {
      if (!focusSel) return;
      focusSel.innerHTML = st.settings.focuses.map(f => `<option value="${f}">${f}</option>`).join("");
      if (!st.settings.focuses.some(f => f.toLowerCase() === norm(day.focus).toLowerCase())) st.settings.focuses.push(day.focus);
      focusSel.value = day.focus;
    };
    renderFocus();
    focusSel && focusSel.addEventListener("change", () => { day.focus = focusSel.value; save(st); });
    focusAdd && focusAdd.addEventListener("click", () => {
      const name = norm(focusNew?.value);
      if (!name) return;
      if (!st.settings.focuses.some(f => f.toLowerCase() === name.toLowerCase())) st.settings.focuses.push(name);
      day.focus = name;
      if (focusNew) focusNew.value = "";
      renderFocus();
      save(st);
    });

    const tasksWrap = $("[data-tasks]");
    const tasksCountSel = $("[data-tasks-count]");
    const tasksProgress = $("[data-tasks-progress]");
    const tasksBar = $("[data-tasks-bar]");

    const updateProgress = () => {
      const planned = countPlanned(day.tasks);
      const done = countDone(day.tasks, day.tasksDone);
      const p = pct(done, planned);
      if (tasksProgress) tasksProgress.textContent = `Tasks: ${done}/${planned} (${p}%)`;
      if (tasksBar) tasksBar.style.width = `${p}%`;
    };

    const renderTasks = () => {
      if (!tasksWrap) return;
      tasksWrap.innerHTML = "";
      day.tasks.forEach((val, i) => {
        const row = document.createElement("div");
        row.className = "item";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!day.tasksDone[i];

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = `Task #${i + 1}`;
        input.value = val || "";

        cb.addEventListener("change", () => { day.tasksDone[i] = cb.checked; save(st); updateProgress(); });
        input.addEventListener("input", () => { day.tasks[i] = input.value; save(st); updateProgress(); });

        row.appendChild(cb);
        row.appendChild(input);
        tasksWrap.appendChild(row);
      });
      updateProgress();
    };

    if (tasksCountSel) {
      tasksCountSel.innerHTML = Array.from({ length: 15 }, (_, i) => {
        const n = i + 1;
        const dis = n > maxT ? "disabled" : "";
        return `<option value="${n}" ${dis}>${n}</option>`;
      }).join("");
      tasksCountSel.value = String(clamp(st.settings.tasksCount, 1, maxT));

      tasksCountSel.addEventListener("change", () => {
        st.settings.tasksCount = clamp(Number(tasksCountSel.value || st.settings.tasksCount), 1, maxT);
        tasksCountSel.value = String(st.settings.tasksCount);
        ensureTasksLen(day, st.settings.tasksCount);
        save(st);
        renderTasks();
      });
    }

    st.settings.tasksCount = clamp(Number(st.settings.tasksCount || 3), 1, maxT);
    ensureTasksLen(day, st.settings.tasksCount);
    renderTasks();

    (() => {
      const input = $("[data-quick-task]");
      const whenSel = $("[data-quick-when]");
      const addBtn = $("[data-quick-add]");
      const toastEl = $("[data-quick-toast]");
      if (!input || !whenSel || !addBtn) return;

      const toast = (m) => {
        if (!toastEl) return;
        toastEl.textContent = m;
        toastEl.style.display = "";
        setTimeout(() => (toastEl.style.display = "none"), 1500);
      };

      const unlocked = isPro();
      Array.from(whenSel.options).forEach(opt => {
        const v = Number(opt.value);
        if (v > 0 && !unlocked) { opt.disabled = true; if (!opt.textContent.includes("(PRO)")) opt.textContent += " (PRO)"; }
      });

      const putTask = (dayObj, text) => {
        let idx = dayObj.tasks.findIndex(t => !norm(t));
        if (idx === -1 && st.settings.tasksCount < maxT) {
          st.settings.tasksCount++;
          ensureTasksLen(day, st.settings.tasksCount);
          ensureTasksLen(dayObj, st.settings.tasksCount);
          const sel = $("[data-tasks-count]");
          if (sel) sel.value = String(st.settings.tasksCount);
          idx = dayObj.tasks.findIndex(t => !norm(t));
        }
        if (idx === -1) return false;
        dayObj.tasks[idx] = text;
        dayObj.tasksDone[idx] = false;
        return true;
      };

      addBtn.addEventListener("click", () => {
        const text = norm(input.value);
        if (!text) return;

        const offset = Number(whenSel.value || "0");
        if (offset > 0 && !unlocked) return toast("Upgrade to PRO to plan ahead");

        const targetKey = addDaysKey(dayKey, offset);
        const targetDay = ensureDay(targetKey);

        if (!putTask(targetDay, text)) return toast("No empty task slots");
        save(st);
        if (targetKey === dayKey) renderTasks();

        input.value = "";
        toast(offset === 0 ? "Added ✅" : `Planned (+${offset}d) ✅`);
      });
    })();

    (() => {
      const btn = $("[data-carry-tomorrow]");
      if (!btn) return;
      if (!isPro()) { btn.disabled = true; btn.title = "PRO only"; return; }

      btn.addEventListener("click", () => {
        const tomorrowKey = addDaysKey(dayKey, 1);
        const tomorrow = ensureDay(tomorrowKey);

        for (let i = 0; i < day.tasks.length; i++) {
          if (!norm(day.tasks[i]) || day.tasksDone[i]) continue;
          const slot = tomorrow.tasks.findIndex(t => !norm(t));
          if (slot === -1) break;
          tomorrow.tasks[slot] = day.tasks[i];
          tomorrow.tasksDone[slot] = false;
          day.tasks[i] = "";
          day.tasksDone[i] = false;
        }

        save(st);
        renderTasks();
      });
    })();

    (() => {
      const wm = $("[data-weekmini]");
      if (!wm) return;
      const unlocked = isPro();
      const wmRange = $("[data-weekmini-range]");
      const wmGoals = $("[data-weekmini-goals]");
      const wmPush = $("[data-weekmini-push]");
      const wmToast = $("[data-weekmini-toast]");
      const wmLocked = $("[data-weekmini-locked]");
      const wmBody = $("[data-weekmini-body]");

      const toast = (m) => {
        if (!wmToast) return;
        wmToast.textContent = m;
        wmToast.style.display = "";
        setTimeout(() => (wmToast.style.display = "none"), 1500);
      };

      const monday = startOfWeekMon(parseYMD(dayKey));
      const weekKey = ymd(monday);

      if (wmRange) wmRange.textContent = weekRangeText(monday);
      if (wmLocked) wmLocked.style.display = unlocked ? "none" : "";
      if (wmBody) wmBody.style.display = unlocked ? "" : "none";

      if (!unlocked) {
        if (wmGoals) wmGoals.textContent = "Upgrade to PRO to plan weeks ahead + push goals to Today.";
        return;
      }

      const wp = ensureWeekPlan(st, weekKey);
      const goals = (wp.goals || []).map(norm).filter(Boolean);

      if (wmGoals) {
        if (!goals.length) wmGoals.textContent = "— Add 1–3 goals in Weekly.";
        else wmGoals.innerHTML = `<ul style="margin:6px 0 0; padding-left:16px;">${goals.map(g => `<li>${g}</li>`).join("")}</ul>`;
      }

      if (wmPush && wmPush.dataset.bound !== "1") {
        wmPush.dataset.bound = "1";
        wmPush.addEventListener("click", () => {
          const gs = (ensureWeekPlan(st, weekKey).goals || []).map(norm).filter(Boolean);
          if (!gs.length) return toast("No goals yet");
          let added = 0;
          for (const g of gs) {
            const idx = day.tasks.findIndex(t => !norm(t));
            if (idx === -1) break;
            day.tasks[idx] = g;
            day.tasksDone[idx] = false;
            added++;
          }
          save(st);
          renderTasks();
          toast(added ? `Added ${added} goal(s) ✅` : "No empty task slots");
        });
      }
    })();

    const habitsWrap = $("[data-habits]");
    const renderHabits = () => {
      if (!habitsWrap) return;
      habitsWrap.innerHTML = "";

      st.settings.habits.forEach((name, i) => {
        const row = document.createElement("div");
        row.className = "item";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!day.habitDone[i];

        const input = document.createElement("input");
        input.type = "text";
        input.value = name;

        cb.addEventListener("change", () => { day.habitDone[i] = cb.checked; save(st); });
        input.addEventListener("input", () => {
          const v = norm(input.value);
          if (!v) return;
          st.settings.habits[i] = v;
          save(st);
        });

        row.appendChild(cb);
        row.appendChild(input);
        habitsWrap.appendChild(row);
      });
    };

    while (day.habitDone.length < st.settings.habits.length) day.habitDone.push(false);
    day.habitDone = day.habitDone.slice(0, st.settings.habits.length);
    renderHabits();

    const note = $("[data-note]");
    if (note) {
      note.value = day.note || "";
      note.addEventListener("input", () => { day.note = note.value; save(st); });
    }

    const reset = $("[data-reset-today]");
    if (reset) {
      reset.addEventListener("click", () => {
        const n = clamp(Number(st.settings.tasksCount || 3), 1, maxT);
        st.days[dayKey] = {
          mood: 3,
          focus: st.settings.focuses[0] || "Deep work",
          tasks: Array.from({ length: n }, () => ""),
          tasksDone: Array.from({ length: n }, () => false),
          habitDone: st.settings.habits.map(() => false),
          note: "",
        };
        save(st);
        location.reload();
      });
    }

    save(st);
  };

  const initWeekly = () => {
    if (page !== "weekly") return;

    const st = initState();
    const wrap = $("[data-week]");
    if (!wrap) return;

    const pro = isPro();
    const premium = isPremium();
    const maxOff = limits().horizon;
    const maxGoals = limits().goals;

    const wpCard = $("[data-weekplan]");
    const wpRange = $("[data-weekplan-range]");
    const wpPrev = $("[data-weekplan-prev]");
    const wpNext = $("[data-weekplan-next]");
    const wpToday = $("[data-weekplan-today]");
    const wpCopy = $("[data-weekplan-copy]");
    const wpCopyWeeks = $("[data-weekplan-copy-weeks]");
    const wpToast = $("[data-weekplan-toast]");
    const wpHint = $("[data-weekplan-hint]");
    const wpLocked = $("[data-weekplan-locked]");
    const wpFields = $("[data-weekplan-fields]");
    const noteEl = $("[data-week-note]");
    const goalsWrap = $("[data-week-goals]");
    const goalAddBtn = $("[data-week-goal-add]");
    const goalLimitEl = $("[data-week-goal-limit]");

    const weekLinesEl = $("[data-weekly-lines]");
    const monthLinesEl = $("[data-monthly-lines]");
    const tabWeek = $('[data-insights-tab="week"]');
    const tabMonth = $('[data-insights-tab="month"]');

    const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const baseMon = startOfWeekMon(new Date());

    let weekOffset = 0;
    let activeWeekKey = null;

    const toast = (m) => {
      if (!wpToast) return;
      wpToast.textContent = m;
      wpToast.style.display = "";
      setTimeout(() => (wpToast.style.display = "none"), 1500);
    };

    const setTab = (t) => {
      tabWeek && tabWeek.classList.toggle("pill--today", t === "week");
      tabMonth && tabMonth.classList.toggle("pill--today", t === "month");
      weekLinesEl && (weekLinesEl.style.display = t === "week" ? "" : "none");
      monthLinesEl && (monthLinesEl.style.display = t === "month" ? "" : "none");
    };

    tabWeek && tabWeek.addEventListener("click", () => setTab("week"));
    if (tabMonth) {
      if (!premium) { tabMonth.disabled = true; tabMonth.title = "Premium only"; }
      else tabMonth.addEventListener("click", () => setTab("month"));
    }

    const mondayFor = (off) => {
      const d = new Date(baseMon);
      d.setDate(baseMon.getDate() + off * 7);
      return d;
    };

    const applyWpUI = () => {
      if (!wpCard) return;

      wpCard.classList.toggle("weekplan--locked", !pro);
      if (wpLocked) wpLocked.style.display = pro ? "none" : "";
      if (wpFields) wpFields.style.display = pro ? "" : "none";
      if (wpHint) {
        wpHint.style.display = pro ? "" : "none";
        if (pro) wpHint.innerHTML = premium
          ? `<b>Premium:</b> plan this week + next <b>${maxOff}</b> weeks.`
          : `<b>Pro:</b> plan this week + next <b>${maxOff}</b> weeks.`;
      }

      [wpPrev, wpNext, wpToday].forEach(b => b && (b.style.display = pro ? "" : "none"));
      if (wpPrev) wpPrev.disabled = weekOffset <= 0;
      if (wpNext) wpNext.disabled = weekOffset >= maxOff;
      if (wpToday) wpToday.disabled = weekOffset === 0;

      if (wpCopy) {
        wpCopy.style.display = pro ? "" : "none";
        wpCopy.disabled = !pro || weekOffset >= maxOff;
      }

      if (wpCopyWeeks) {
        if (!premium) { wpCopyWeeks.style.display = "none"; }
        else {
          const maxForward = Math.max(0, maxOff - weekOffset);
          const opts = [1,2,4,8].filter(n => n <= maxForward && n >= 1);
          wpCopyWeeks.style.display = "";
          wpCopyWeeks.innerHTML = (opts.length ? opts : [1]).map(n => `<option value="${n}">+${n} week${n===1?"":"s"}</option>`).join("");
          wpCopyWeeks.disabled = !opts.length;
        }
      }

      const tSel = $("[data-weekplan-template]");
      const tApply = $("[data-weekplan-template-apply]");
      const tClear = $("[data-weekplan-clear]");
      tSel && (tSel.style.display = "none");
      tApply && (tApply.style.display = "none");
      tClear && (tClear.style.display = "none");

      if (goalAddBtn) goalAddBtn.style.display = premium ? "" : "none";
    };

    const renderGoals = (wp) => {
      if (!goalsWrap) return;
      goalsWrap.innerHTML = "";

      const minGoals = maxGoals ? Math.min(3, maxGoals) : 0;
      wp.goals = Array.isArray(wp.goals) ? wp.goals : [];
      while (wp.goals.length < minGoals) wp.goals.push("");
      if (maxGoals) wp.goals = wp.goals.slice(0, maxGoals);

      wp.goals.forEach((val, i) => {
        const row = document.createElement("div");
        row.className = "item";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = `Goal #${i + 1}`;
        input.value = val || "";

        input.addEventListener("input", () => {
          if (!pro || !activeWeekKey) return;
          const w = ensureWeekPlan(st, activeWeekKey);
          w.goals[i] = input.value;
          save(st);
          if (goalLimitEl) {
            const filled = w.goals.map(norm).filter(Boolean).length;
            goalLimitEl.textContent = `${filled}/${maxGoals || 0}`;
          }
        });

        row.appendChild(input);

        if (premium && i >= 3) {
          const del = document.createElement("button");
          del.type = "button";
          del.className = "btn btn--ghost";
          del.textContent = "Remove";
          del.addEventListener("click", () => {
            if (!activeWeekKey) return;
            const w = ensureWeekPlan(st, activeWeekKey);
            w.goals.splice(i, 1);
            save(st);
            renderGoals(w);
          });
          row.appendChild(del);
        }

        goalsWrap.appendChild(row);
      });

      if (goalLimitEl) {
        const filled = wp.goals.map(norm).filter(Boolean).length;
        goalLimitEl.textContent = `${filled}/${maxGoals || 0}`;
      }
    };

    if (noteEl && noteEl.dataset.bound !== "1") {
      noteEl.dataset.bound = "1";
      noteEl.addEventListener("input", () => {
        if (!pro || !activeWeekKey) return;
        const w = ensureWeekPlan(st, activeWeekKey);
        w.note = noteEl.value;
        save(st);
      });
    }

    const renderForOffset = (off) => {
      weekOffset = clamp(off, 0, maxOff);
      const monday = mondayFor(weekOffset);
      const weekKey = ymd(monday);

      if (wpRange) wpRange.textContent = weekRangeText(monday);

      if (pro) {
        activeWeekKey = weekKey;
        const wp = ensureWeekPlan(st, weekKey);
        renderGoals(wp);
        if (noteEl) noteEl.value = wp.note || "";

        if (goalAddBtn && goalAddBtn.dataset.bound !== "1") {
          goalAddBtn.dataset.bound = "1";
          goalAddBtn.addEventListener("click", () => {
            if (!premium || !activeWeekKey) return;
            const w = ensureWeekPlan(st, activeWeekKey);
            if (w.goals.length >= maxGoals) return toast(`Limit: ${maxGoals} goals`);
            w.goals.push("");
            save(st);
            renderGoals(w);
          });
        }
      } else {
        activeWeekKey = null;
      }

      wrap.innerHTML = "";
      let weekPlanned = 0, weekDone = 0;

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const key = ymd(d);
        const data = st.days[key] || {};
        const isToday = key === ymd();

        const planned = countPlanned(data.tasks || []);
        const done = countDone(data.tasks || [], data.tasksDone || []);
        weekPlanned += planned;
        weekDone += done;

        const dayScore = pct(done, planned);
        const habitsDone = (data.habitDone || []).filter(Boolean).length;
        const habitsTotal = (data.habitDone || []).length || 0;

        const el = document.createElement("div");
        el.className = "day";
        el.innerHTML = `
          <div class="day__head">
            <div>
              <div class="day__name">
                ${names[i]} <span class="pill ${isToday ? "pill--today" : ""}">${isToday ? "Today" : ""}</span>
              </div>
              <div class="day__date">${key}</div>
            </div>
            <a class="pill" href="app.html?date=${key}">Open</a>
          </div>
          <div class="mini">Tasks: ${done}/${planned} (${dayScore}%) • Habits: ${habitsDone}/${habitsTotal}</div>
        `;
        wrap.appendChild(el);
      }

      const weekScore = pct(weekDone, weekPlanned);
      if (weekLinesEl) {
        weekLinesEl.innerHTML = `Week: <b>${weekScore}%</b> (${weekDone}/${weekPlanned})`;
      }

      if (monthLinesEl) {
        if (!premium) {
          monthLinesEl.innerHTML = `Upgrade to <b>Premium</b> to see Month insights.`;
        } else {
          const now = new Date();
          let mPlanned = 0, mDone = 0;
          for (const k of Object.keys(st.days)) {
            if (!isYMD(k)) continue;
            const dt = parseYMD(k);
            if (dt.getFullYear() !== now.getFullYear() || dt.getMonth() !== now.getMonth()) continue;
            const dd = st.days[k] || {};
            const planned = countPlanned(dd.tasks || []);
            const done = countDone(dd.tasks || [], dd.tasksDone || []);
            if (!planned) continue;
            mPlanned += planned;
            mDone += done;
          }
          monthLinesEl.innerHTML = `Month: <b>${pct(mDone, mPlanned)}%</b> (${mDone}/${mPlanned})`;
        }
      }

      applyWpUI();
      save(st);
    };

    if (wpPrev && wpPrev.dataset.bound !== "1") { wpPrev.dataset.bound="1"; wpPrev.addEventListener("click", () => renderForOffset(weekOffset - 1)); }
    if (wpNext && wpNext.dataset.bound !== "1") { wpNext.dataset.bound="1"; wpNext.addEventListener("click", () => renderForOffset(weekOffset + 1)); }
    if (wpToday && wpToday.dataset.bound !== "1") { wpToday.dataset.bound="1"; wpToday.addEventListener("click", () => renderForOffset(0)); }

    if (wpCopy && wpCopy.dataset.bound !== "1") {
      wpCopy.dataset.bound = "1";
      wpCopy.addEventListener("click", () => {
        if (!pro || weekOffset >= maxOff) return;

        const fromKey = ymd(mondayFor(weekOffset));
        const from = ensureWeekPlan(st, fromKey);

        let n = 1;
        if (premium && wpCopyWeeks) n = clamp(Number(wpCopyWeeks.value || 1), 1, Math.max(1, maxOff - weekOffset));

        const minGoals = maxGoals ? Math.min(3, maxGoals) : 0;

        for (let i = 1; i <= n; i++) {
          const toKey = ymd(mondayFor(weekOffset + i));
          const to = ensureWeekPlan(st, toKey);
          to.goals = (from.goals || []).slice(0, maxGoals);
          while (to.goals.length < minGoals) to.goals.push("");
          to.note = String(from.note || "");
        }

        save(st);
        toast(`Copied forward ${n} week(s) ✅`);
        renderForOffset(weekOffset);
      });
    }

    setTab("week");
    renderForOffset(0);
  };

  const initHabitsPage = () => {
    if (page !== "habits") return;

    const st = initState();

    const goalsPreview = $("[data-weekgoals-preview]");
    if (goalsPreview) {
      if (!isPro()) goalsPreview.textContent = "PRO feature — upgrade to see goals here.";
      else {
        const monday = startOfWeekMon(new Date());
        const weekKey = ymd(monday);
        const wp = ensureWeekPlan(st, weekKey);
        const goals = (wp.goals || []).map(norm).filter(Boolean);
        goalsPreview.textContent = goals.length ? goals.join(" • ") : "— Add 1–3 goals in Weekly.";
      }
    }

    const list = $("[data-habits-list]");
    const input = $("[data-habit-input]");
    const add = $("[data-habit-add]");
    if (!list || !input || !add) return;

    const render = () => {
      list.innerHTML = "";
      st.settings.habits.forEach((name, i) => {
        const div = document.createElement("div");
        div.className = "item";

        const tx = document.createElement("input");
        tx.type = "text";
        tx.value = name;

        const del = document.createElement("button");
        del.className = "btn btn--ghost";
        del.type = "button";
        del.textContent = "Remove";

        tx.addEventListener("input", () => {
          const v = norm(tx.value);
          if (!v) return;
          st.settings.habits[i] = v;
          save(st);
        });

        del.addEventListener("click", () => {
          st.settings.habits.splice(i, 1);
          for (const k of Object.keys(st.days)) {
            const d = st.days[k];
            if (Array.isArray(d.habitDone)) d.habitDone.splice(i, 1);
          }
          save(st);
          render();
        });

        div.appendChild(tx);
        div.appendChild(del);
        list.appendChild(div);
      });
    };

    add.addEventListener("click", () => {
      const name = norm(input.value);
      if (!name) return;
      st.settings.habits.push(name);
      input.value = "";
      syncHabitsToAllDays(st);
      save(st);
      render();
    });

    render();
  };

  initToday();
  initWeekly();
  initHabitsPage();

})();
