(function () {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY  = "selfio_plan";
    const APP_KEY   = "selfio_app_v1";

    const DEFAULT_FOCUSES = ["Deep work", "Study", "Health", "Social", "Reset"];
    const DEFAULT_HABITS  = ["Drink water", "Study 30 min"];

// utils
    function ymd(d = new Date()) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    function isValidYMD(s) {
        return /^\d{4}-\d{2}-\d{2}$/.test(s);
    }

    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function safeNum(v, fallback) {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
    }

    function norm(s) {
        return String(s || "").trim();
    }

    function normLower(s) {
        return norm(s).toLowerCase();
    }

// key per user
    function appStorageKey() {
        // важливо: беремо email, який записує sign.js у localStorage
        let email = normLower(localStorage.getItem(EMAIL_KEY));

        // якщо email не записаний — падаємо в anon
        if (!email) email = "anon";

        // щоб ключ завжди був безпечний
        email = email.replace(/\s+/g, "");

        return `${APP_KEY}:${email}`;
    }

    function loadApp() {
        try {
            return JSON.parse(localStorage.getItem(appStorageKey())) || {};
        } catch {
            return {};
        }
    }

    function saveApp(state) {
        localStorage.setItem(appStorageKey(), JSON.stringify(state));
    }

    function getPlan() {
        return normLower(localStorage.getItem(PLAN_KEY)) || "free";
    }


    function planLimits(plan) {
        // Free: max 5 tasks/day
        if (plan === "free") return { maxTasksPerDay: 5 };
        if (plan === "pro") return { maxTasksPerDay: 10 };
        return { maxTasksPerDay: 15 }; // premium
    }

    function requireAuth() {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
            location.href = "signin.html";
            return false;
        }
        return true;
    }

    function setHeaderMeta() {
        const email = localStorage.getItem(EMAIL_KEY) || "Signed user";
        const plan = (localStorage.getItem(PLAN_KEY) || "free").toUpperCase();
        const el = document.querySelector("[data-app-meta]");
        if (el) el.textContent = `${email} • ${plan}`;
    }

    function bindLogout() {
        document.querySelectorAll("[data-logout]").forEach((btn) => {
            btn.addEventListener("click", () => {
                localStorage.removeItem("selfio_token");
                location.href = "../index.html";
            });
        });
    }

    // state normalize / migration
    function initState() {
        const state = loadApp();
        state.days = state.days || {};
        state.settings = state.settings || {};

        // focuses
        if (!Array.isArray(state.settings.focuses) || state.settings.focuses.length === 0) {
            state.settings.focuses = DEFAULT_FOCUSES.slice();
        }

        // tasksCount (default 3, but clamp by plan)
        const limits = planLimits(getPlan());
        state.settings.tasksCount = clamp(safeNum(state.settings.tasksCount, 3), 1, limits.maxTasksPerDay);

        // habits master list (global)
        if (!Array.isArray(state.settings.habits) || state.settings.habits.length === 0) {
            // пробуємо взяти зі "сьогоднішнього" дня (старий формат)
            const today = state.days[ymd()];
            if (today && Array.isArray(today.habits) && today.habits.length) {
                state.settings.habits = today.habits.map(h => norm(h.name)).filter(Boolean);
            } else {
                state.settings.habits = DEFAULT_HABITS.slice();
            }
        }

        // migrate each day to habitDone array
        const masterHabits = state.settings.habits;

        Object.keys(state.days).forEach((key) => {
            const day = state.days[key] || {};
            // old format: habits: [{name, done}]
            if (Array.isArray(day.habits) && day.habits.length) {
                const map = new Map(day.habits.map(h => [normLower(h.name), !!h.done]));
                day.habitDone = masterHabits.map(name => !!map.get(normLower(name)));
                delete day.habits;
            }

            // ensure habitDone exists
            if (!Array.isArray(day.habitDone)) {
                day.habitDone = masterHabits.map(() => false);
            } else {
                // resize to master list length
                while (day.habitDone.length < masterHabits.length) day.habitDone.push(false);
                day.habitDone = day.habitDone.slice(0, masterHabits.length);
            }

            state.days[key] = day;
        });

        saveApp(state);
        return state;
    }

    function ensureTasksLen(day, count) {
        day.tasks = Array.isArray(day.tasks) ? day.tasks : [];
        day.tasksDone = Array.isArray(day.tasksDone) ? day.tasksDone : [];

        while (day.tasks.length < count) day.tasks.push("");
        while (day.tasksDone.length < count) day.tasksDone.push(false);

        day.tasks = day.tasks.slice(0, count);
        day.tasksDone = day.tasksDone.slice(0, count);
    }

    // pages
    function todayPage() {
        const page = document.body.getAttribute("data-page");
        if (page !== "today") return;

        const state = initState();
        const limits = planLimits(getPlan());

        // allow open from weekly: app.html?date=YYYY-MM-DD
        const qsDate = new URLSearchParams(location.search).get("date");
        const dayKey = (qsDate && isValidYMD(qsDate)) ? qsDate : ymd();

        // init day if missing
        state.days[dayKey] = state.days[dayKey] || {
            mood: 3,
            focus: state.settings.focuses[0] || "Deep work",
            tasks: [],
            tasksDone: [],
            habitDone: state.settings.habits.map(() => false),
            note: ""
        };

        const day = state.days[dayKey];

        // clamp tasksCount by plan
        state.settings.tasksCount = clamp(safeNum(state.settings.tasksCount, 3), 1, limits.maxTasksPerDay);
        ensureTasksLen(day, state.settings.tasksCount);

        // mood
        const moodBtns = Array.from(document.querySelectorAll("[data-mood]"));
        function paintMood() {
            moodBtns.forEach(btn => {
                const val = Number(btn.getAttribute("data-mood"));
                btn.setAttribute("data-active", String(val === day.mood));
            });
        }
        moodBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                day.mood = Number(btn.getAttribute("data-mood"));
                paintMood();
                saveApp(state);
            });
        });
        paintMood();

        // focus (options + add custom)
        const focusSel = document.querySelector("[data-focus]");
        const focusNew = document.querySelector("[data-focus-new]");
        const focusAdd = document.querySelector("[data-focus-add]");

        function renderFocusOptions() {
            if (!focusSel) return;
            focusSel.innerHTML = "";
            state.settings.focuses.forEach(name => {
                const opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                focusSel.appendChild(opt);
            });
        }

        if (!state.settings.focuses.some(f => normLower(f) === normLower(day.focus))) {
            state.settings.focuses.push(day.focus);
        }

        renderFocusOptions();
        if (focusSel) focusSel.value = day.focus;

        if (focusSel) {
            focusSel.addEventListener("change", () => {
                day.focus = focusSel.value;
                saveApp(state);
            });
        }

        if (focusAdd) {
            focusAdd.addEventListener("click", () => {
                const name = norm(focusNew?.value);
                if (!name) return;

                const exists = state.settings.focuses.some(f => normLower(f) === normLower(name));
                if (!exists) state.settings.focuses.push(name);

                day.focus = name;
                renderFocusOptions();
                if (focusSel) focusSel.value = day.focus;

                if (focusNew) focusNew.value = "";
                saveApp(state);
            });
        }

        // tasks (dynamic list + progress)
        const tasksWrap = document.querySelector("[data-tasks]");
        const tasksCountSel = document.querySelector("[data-tasks-count]");
        const tasksProgress = document.querySelector("[data-tasks-progress]");
        const tasksBar = document.querySelector("[data-tasks-bar]");

        function updateTasksProgress() {
            const total = day.tasks.length;
            const done = day.tasksDone.filter(Boolean).length;
            const pct = total ? Math.round((done / total) * 100) : 0;

            if (tasksProgress) tasksProgress.textContent = `Tasks: ${done}/${total} (${pct}%)`;
            if (tasksBar) tasksBar.style.width = `${pct}%`;
        }

        function renderTasks() {
            if (!tasksWrap) return;
            tasksWrap.innerHTML = "";

            day.tasks.forEach((val, idx) => {
                const row = document.createElement("div");
                row.className = "item";

                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.checked = !!day.tasksDone[idx];

                const input = document.createElement("input");
                input.type = "text";
                input.placeholder = `Task #${idx + 1}`;
                input.value = val || "";

                cb.addEventListener("change", () => {
                    day.tasksDone[idx] = cb.checked;
                    saveApp(state);
                    updateTasksProgress();
                });

                input.addEventListener("input", () => {
                    day.tasks[idx] = input.value;
                    saveApp(state);
                });

                row.appendChild(cb);
                row.appendChild(input);
                tasksWrap.appendChild(row);
            });

            updateTasksProgress();
        }

        if (tasksCountSel) {
            // disable options > plan limit (на майбутнє)
            Array.from(tasksCountSel.querySelectorAll("option")).forEach(opt => {
                opt.disabled = Number(opt.value) > limits.maxTasksPerDay;
            });

            // sync select with setting (clamped)
            tasksCountSel.value = String(state.settings.tasksCount);

            tasksCountSel.addEventListener("change", () => {
                const wanted = safeNum(tasksCountSel.value, state.settings.tasksCount);
                const clamped = clamp(wanted, 1, limits.maxTasksPerDay);

                state.settings.tasksCount = clamped;
                tasksCountSel.value = String(clamped);

                ensureTasksLen(day, clamped);
                saveApp(state);
                renderTasks();
            });
        }

        renderTasks();

        // habits (global names + per day done)
        const habitsWrap = document.querySelector("[data-habits]");
        const masterHabits = state.settings.habits;

        function renderHabits() {
            if (!habitsWrap) return;
            habitsWrap.innerHTML = "";

            masterHabits.forEach((name, i) => {
                const row = document.createElement("div");
                row.className = "item";

                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.checked = !!day.habitDone[i];

                const input = document.createElement("input");
                input.type = "text";
                input.value = name;

                cb.addEventListener("change", () => {
                    day.habitDone[i] = cb.checked;
                    saveApp(state);
                });

                // rename habit (updates master list)
                input.addEventListener("input", () => {
                    const newName = norm(input.value);
                    if (!newName) return;

                    state.settings.habits[i] = newName;
                    saveApp(state);
                });

                row.appendChild(cb);
                row.appendChild(input);
                habitsWrap.appendChild(row);
            });
        }

        // ensure habitDone length matches master
        while (day.habitDone.length < masterHabits.length) day.habitDone.push(false);
        day.habitDone = day.habitDone.slice(0, masterHabits.length);

        renderHabits();

        // note
        const note = document.querySelector("[data-note]");
        if (note) {
            note.value = day.note || "";
            note.addEventListener("input", () => {
                day.note = note.value;
                saveApp(state);
            });
        }

        // reset today (resets selected date, not only "today")
        const reset = document.querySelector("[data-reset-today]");
        if (reset) {
            reset.addEventListener("click", () => {
                const n = state.settings.tasksCount;

                state.days[dayKey] = {
                    mood: 3,
                    focus: state.settings.focuses[0] || "Deep work",
                    tasks: Array.from({ length: n }, () => ""),
                    tasksDone: Array.from({ length: n }, () => false),
                    habitDone: state.settings.habits.map(() => false),
                    note: ""
                };

                saveApp(state);
                location.reload();
            });
        }

        // final save
        saveApp(state);
    }

    function weeklyPage() {
        const page = document.body.getAttribute("data-page");
        if (page !== "weekly") return;

        const state = initState();
        const wrap = document.querySelector("[data-week]");
        if (!wrap) return;

        const now = new Date();
        const shift = (now.getDay() + 6) % 7; // Mon=0
        const monday = new Date(now);
        monday.setDate(now.getDate() - shift);

        const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
        wrap.innerHTML = "";

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const key = ymd(d);
            const data = state.days[key] || {};
            const isToday = key === ymd();

            const tasksDone = (data.tasksDone || []).filter(Boolean).length;
            const tasksTotal = (data.tasks || []).length || 0;
            const habitsDone = (data.habitDone || []).filter(Boolean).length;
            const habitsTotal = (data.habitDone || []).length || 0;

            const pct = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;

            const el = document.createElement("div");
            el.className = "day";
            el.innerHTML = `
        <div class="day__head">
          <div>
            <div class="day__name">
              ${names[i]}
              <span class="pill ${isToday ? "pill--today" : ""}">${isToday ? "Today" : ""}</span>
            </div>
            <div class="day__date">${key}</div>
          </div>
          <a class="pill" href="app.html?date=${key}">Open</a>
        </div>
        <div class="mini">Tasks: ${tasksDone}/${tasksTotal} (${pct}%) • Habits: ${habitsDone}/${habitsTotal}</div>
      `;
            wrap.appendChild(el);
        }
    }

    function settingsPage() {
        const page = document.body.getAttribute("data-page");
        if (page !== "settings") return;

        const email = localStorage.getItem(EMAIL_KEY) || "—";
        const plan = (localStorage.getItem(PLAN_KEY) || "free");
        const emailEl = document.querySelector("[data-email]");
        const planEl = document.querySelector("[data-plan]");
        if (emailEl) emailEl.textContent = email;
        if (planEl) planEl.textContent = plan.toUpperCase();
    }

    function habitsPage() {
        const page = document.body.getAttribute("data-page");
        if (page !== "habits") return;

        const state = initState();
        const masterHabits = state.settings.habits;

        const list = document.querySelector("[data-habits-list]");
        const input = document.querySelector("[data-habit-input]");
        const add = document.querySelector("[data-habit-add]");

        if (!list || !input || !add) return;

        function syncDaysAfterAdd() {
            Object.keys(state.days).forEach(k => {
                const d = state.days[k];
                d.habitDone = Array.isArray(d.habitDone) ? d.habitDone : [];
                while (d.habitDone.length < masterHabits.length) d.habitDone.push(false);
                d.habitDone = d.habitDone.slice(0, masterHabits.length);
            });
        }

        function removeHabitAt(idx) {
            masterHabits.splice(idx, 1);
            Object.keys(state.days).forEach(k => {
                const d = state.days[k];
                if (Array.isArray(d.habitDone)) d.habitDone.splice(idx, 1);
            });
            saveApp(state);
        }

        function render() {
            list.innerHTML = "";

            masterHabits.forEach((name, i) => {
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
                    const newName = norm(tx.value);
                    if (!newName) return;
                    masterHabits[i] = newName;
                    saveApp(state);
                });

                del.addEventListener("click", () => {
                    removeHabitAt(i);
                    render();
                });

                div.appendChild(tx);
                div.appendChild(del);
                list.appendChild(div);
            });
        }

        add.addEventListener("click", () => {
            const name = norm(input.value);
            if (!name) return;

            masterHabits.push(name);
            input.value = "";

            syncDaysAfterAdd();
            saveApp(state);
            render();
        });

        render();
    }

    // init
    const isAppPage = document.body.hasAttribute("data-app");
    if (!isAppPage) return;

    if (!requireAuth()) return;
    setHeaderMeta();
    bindLogout();

    todayPage();
    weeklyPage();
    habitsPage();
    settingsPage();
})();
