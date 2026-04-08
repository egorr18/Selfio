(async function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
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

  const ensureArr = (arr, len, def) =>
    Array.from({ length: len }, (_, i) => arr?.[i] ?? def);

  const ymd = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

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
  const load = () => JSON.parse(ls.getItem(storageKey()) || "{}");
  const save = (st) => ls.setItem(storageKey(), JSON.stringify(st));

  const ensureTasksLen = (day, n) => {
    day.tasks = ensureArr(day.tasks, n, "");
    day.tasksDone = ensureArr(day.tasksDone, n, false);
  };

  const ensureWeekPlan = (st, weekKey) => {
    st.weeks ??= {};
    const maxGoals = limits().goals;
    const wp = st.weeks[weekKey] ??= { goals: [], note: "" };

    const minGoals = maxGoals ? Math.min(3, maxGoals) : 0;
    wp.goals = ensureArr(wp.goals, minGoals, "");
    if (maxGoals) wp.goals = wp.goals.slice(0, maxGoals);

    wp.note = String(wp.note || "");
    return wp;
  };

  const initState = () => {
    const st = load();
    st.days ??= {};
    st.settings ??= {};
    st.weeks ??= {};

    if (!Array.isArray(st.settings.focuses) || !st.settings.focuses.length)
      st.settings.focuses = DEFAULT_FOCUSES.slice();

    if (!Array.isArray(st.settings.habits) || !st.settings.habits.length)
      st.settings.habits = DEFAULT_HABITS.slice();

    st.settings.tasksCount = clamp(Number(st.settings.tasksCount || 3), 1, limits().maxTasks);

    Object.values(st.days).forEach(d => {
      d.habitDone = ensureArr(d.habitDone, st.settings.habits.length, false);
    });

    save(st);
    return st;
  };
    const setHeaderMeta = () => {
    const email = ls.getItem(EMAIL_KEY) || "Signed user";
    const plan = (getPlanSelectedForUser() || "—").toUpperCase();

    $("[data-app-meta]")?.replaceChildren(`${email} • ${plan}`);
    $$("[data-user-email]").forEach(el => el.textContent = email);
    $$("[data-user-plan]").forEach(el => el.textContent = plan);
  };

  const bindLogout = () => {
    $$("[data-logout]").forEach(btn => {
      if (btn.dataset.bound === "1") return;
      btn.dataset.bound = "1";

      on(btn, "click", async (e) => {
        e.preventDefault();
        if (getMode() === "cloud") await signOutSafe();
        [TOKEN_KEY, EMAIL_KEY, PLAN_KEY].forEach(k => ls.removeItem(k));
        location.replace("../index.html");
      });
    });

    if (!window.__selfio_pageshow_bound) {
      window.__selfio_pageshow_bound = true;
      on(window, "pageshow", requireAuth);
    }
  };

  if (!(await requireAuth())) return;
  if (!getPlanSelectedForUser() && page !== "choose-plan") {
    location.href = `choose-plan.html?next=${encodeURIComponent(pageFile(page))}`;
    return;
  }

  setHeaderMeta();
  bindLogout();

  const countPlanned = (tasks=[]) => tasks.filter(t => norm(t)).length;
  const countDone = (tasks=[], done=[]) =>
    tasks.reduce((acc, t, i) => acc + (norm(t) && done[i] ? 1 : 0), 0);

  const pct = (a,b) => (!b ? 0 : Math.round((a/b)*100));

  const initToday = () => {
    if (page !== "today") return;

    const st = initState();
    const maxT = limits().maxTasks;

    const qsDate = new URLSearchParams(location.search).get("date");
    const dayKey = (qsDate && isYMD(qsDate)) ? qsDate : ymd();

    const ensureDay = (key) => {
      st.days[key] ||= {
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
    const paintMood = () =>
      moodBtns.forEach(b =>
        b.dataset.active = String(Number(b.dataset.mood) === Number(day.mood))
      );

    moodBtns.forEach(b =>
      on(b, "click", () => {
        day.mood = Number(b.dataset.mood);
        save(st);
        paintMood();
      })
    );
    paintMood();

    const focusSel = $("[data-focus]");
    const focusNew = $("[data-focus-new]");
    const focusAdd = $("[data-focus-add]");

    const renderFocus = () => {
      if (!focusSel) return;
      focusSel.innerHTML = st.settings.focuses
        .map(f => `<option value="${f}">${f}</option>`)
        .join("");

      if (!st.settings.focuses.some(f => f.toLowerCase() === norm(day.focus).toLowerCase()))
        st.settings.focuses.push(day.focus);

      focusSel.value = day.focus;
    };

    renderFocus();

    on(focusSel, "change", () => {
      day.focus = focusSel.value;
      save(st);
    });

    on(focusAdd, "click", () => {
      const name = norm(focusNew?.value);
      if (!name) return;

      if (!st.settings.focuses.some(f => f.toLowerCase() === name.toLowerCase()))
        st.settings.focuses.push(name);

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

        const cb = Object.assign(document.createElement("input"), {
          type: "checkbox",
          checked: !!day.tasksDone[i],
        });

        const input = Object.assign(document.createElement("input"), {
          type: "text",
          value: val || "",
          placeholder: `Task #${i + 1}`,
        });

        on(cb, "change", () => {
          day.tasksDone[i] = cb.checked;
          save(st);
          updateProgress();
        });

        on(input, "input", () => {
          day.tasks[i] = input.value;
          save(st);
          updateProgress();
        });

        row.append(cb, input);
        tasksWrap.append(row);
      });

      updateProgress();
    };
        if (tasksCountSel) {
      tasksCountSel.innerHTML = Array.from({ length: 15 }, (_, i) => {
        const n = i + 1;
        return `<option value="${n}" ${n > maxT ? "disabled" : ""}>${n}</option>`;
      }).join("");

      tasksCountSel.value = String(clamp(st.settings.tasksCount, 1, maxT));

      on(tasksCountSel, "change", () => {
        st.settings.tasksCount = clamp(Number(tasksCountSel.value), 1, maxT);
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

      [...whenSel.options].forEach(opt => {
        const v = Number(opt.value);
        if (v > 0 && !unlocked) {
          opt.disabled = true;
          if (!opt.textContent.includes("(PRO)")) opt.textContent += " (PRO)";
        }
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

      on(addBtn, "click", () => {
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

      if (!isPro()) {
        btn.disabled = true;
        btn.title = "PRO only";
        return;
      }

      on(btn, "click", () => {
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
        if (wmGoals)
          wmGoals.textContent = "Upgrade to PRO to plan weeks ahead + push goals to Today.";
        return;
      }

      const wp = ensureWeekPlan(st, weekKey);
      const goals = (wp.goals || []).map(norm).filter(Boolean);

      if (wmGoals) {
        wmGoals.innerHTML = goals.length
          ? `<ul style="margin:6px 0 0; padding-left:16px;">${goals.map(g => `<li>${g}</li>`).join("")}</ul>`
          : "— Add 1–3 goals in Weekly.";
      }

      if (wmPush && wmPush.dataset.bound !== "1") {
        wmPush.dataset.bound = "1";

        on(wmPush, "click", () => {
          const gs = ensureWeekPlan(st, weekKey).goals.map(norm).filter(Boolean);
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

        const cb = Object.assign(document.createElement("input"), {
          type: "checkbox",
          checked: !!day.habitDone[i],
        });

        const input = Object.assign(document.createElement("input"), {
          type: "text",
          value: name,
        });

        on(cb, "change", () => {
          day.habitDone[i] = cb.checked;
          save(st);
        });

        on(input, "input", () => {
          const v = norm(input.value);
          if (!v) return;
          st.settings.habits[i] = v;
          save(st);
        });

        row.append(cb, input);
        habitsWrap.append(row);
      });
    };

    day.habitDone = ensureArr(day.habitDone, st.settings.habits.length, false);
    renderHabits();

    const note = $("[data-note]");
    if (note) {
      note.value = day.note || "";
      on(note, "input", () => {
        day.note = note.value;
        save(st);
      });
    }

    const reset = $("[data-reset-today]");
    if (reset) {
      on(reset, "click", () => {
        const n = clamp(st.settings.tasksCount || 3, 1, maxT);

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

    const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const monday = startOfWeekMon(new Date());

    wrap.innerHTML = "";

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);

      const key = ymd(d);
      const data = st.days[key] || {};

      const planned = countPlanned(data.tasks || []);
      const done = countDone(data.tasks || [], data.tasksDone || []);

      const el = document.createElement("div");
      el.className = "day";

      el.innerHTML = `
        <div class="day__head">
          <div>
            <div class="day__name">${names[i]}</div>
            <div class="day__date">${key}</div>
          </div>
          <a class="pill" href="app.html?date=${key}">Open</a>
        </div>
        <div class="mini">Tasks: ${done}/${planned}</div>
      `;

      wrap.appendChild(el);
    }
  };

  const initHabitsPage = () => {
    if (page !== "habits") return;

    const st = initState();

    const list = $("[data-habits-list]");
    const input = $("[data-habit-input]");
    const add = $("[data-habit-add]");
    if (!list || !input || !add) return;

    const render = () => {
      list.innerHTML = "";

      st.settings.habits.forEach((name, i) => {
        const div = document.createElement("div");
        div.className = "item";

        const tx = Object.assign(document.createElement("input"), {
          type: "text",
          value: name,
        });

        const del = Object.assign(document.createElement("button"), {
          className: "btn btn--ghost",
          textContent: "Remove",
        });

        on(tx, "input", () => {
          const v = norm(tx.value);
          if (!v) return;
          st.settings.habits[i] = v;
          save(st);
        });

        on(del, "click", () => {
          st.settings.habits.splice(i, 1);

          Object.values(st.days).forEach(d => {
            if (Array.isArray(d.habitDone)) d.habitDone.splice(i, 1);
          });

          save(st);
          render();
        });

        div.append(tx, del);
        list.append(div);
      });
    };

    on(add, "click", () => {
      const name = norm(input.value);
      if (!name) return;

      st.settings.habits.push(name);
      input.value = "";

      Object.values(st.days).forEach(d => {
        d.habitDone = ensureArr(d.habitDone, st.settings.habits.length, false);
      });

      save(st);
      render();
    });

    render();
  };

  initToday();
  initWeekly();
  initHabitsPage();

})();