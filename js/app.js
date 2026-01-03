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

    // planned/done helpers (важливо для статистики)
    function countPlannedTasks(tasks = []) {
        return tasks.map(t => norm(t)).filter(Boolean).length;
    }

    function countDoneTasks(tasks = [], tasksDone = []) {
        let done = 0;
        for (let i = 0; i < tasks.length; i++) {
            const t = norm(tasks[i]);
            if (!t) continue;      // порожня задача НЕ входить у план
            if (tasksDone[i]) done++;
        }
        return done;
    }

    function pct(done, total) {
        if (!total) return 0;
        return Math.round((done / total) * 100);
    }

    function startOfWeekMonday(date = new Date()) {
        const d = new Date(date);
        const shift = (d.getDay() + 6) % 7; // Mon=0
        d.setDate(d.getDate() - shift);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }

    // stable hash for seeded pick
    function hashString(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0);
    }

    function seededPick(arr, seedStr) {
        if (!arr || !arr.length) return null;
        const h = hashString(seedStr);
        return arr[h % arr.length];
    }

    // tiers by week score
    function weekTier(score) {
        if (score >= 85) return "elite";
        if (score >= 70) return "growth";
        if (score >= 50) return "stable";
        return "reset";
    }

    const PSYCH = {
        reset:  "Lower the barrier: make the first step ridiculously easy.",
        stable: "You’re building rhythm — consistency beats intensity.",
        growth: "You’re improving — add structure, not more tasks.",
        elite:  "Strong week — protect recovery to avoid burnout.",
    };

    // book library
    const BOOKS = {
        reset: {
            general: [
                { title: "Atomic Habits", tip: "Make it tiny: 2 minutes rule." },
                { title: "Deep Work", tip: "Remove distractions for 1 focused block." },
            ],
            sport: [
                { title: "Atomic Habits", tip: "Attach sport to a fixed trigger (after waking)." },
                { title: "Can't Hurt Me", tip: "Do the minimum even on low days." },
            ],
            crypto: [
                { title: "Trading in the Zone", tip: "Reduce decisions: write rules before trades." },
                { title: "The Psychology of Money", tip: "Focus on process, not outcome." },
            ],
            biz: [
                { title: "Getting Things Done", tip: "Capture everything into one inbox." },
                { title: "The One Thing", tip: "Pick 1 priority and protect it daily." },
            ],
            growth: [
                { title: "Atomic Habits", tip: "Track streaks — don’t break the chain." },
                { title: "Mindset", tip: "Swap “I can’t” → “I’m learning”." },
            ],
        },

        stable: {
            general: [
                { title: "Getting Things Done", tip: "Use next-actions, not vague tasks." },
                { title: "Essentialism", tip: "Cut 1 non-important thing this week." },
            ],
            sport: [
                { title: "Atomic Habits", tip: "Upgrade environment: bag ready in advance." },
                { title: "Why We Sleep", tip: "Sleep = free performance boost." },
            ],
            crypto: [
                { title: "Trading in the Zone", tip: "Journal 3 trades: entry/exit/why." },
                { title: "Fooled by Randomness", tip: "Don’t confuse luck with skill." },
            ],
            biz: [
                { title: "The One Thing", tip: "Block 60–90 min for main goal daily." },
                { title: "Essentialism", tip: "Say no to 1 low-value request." },
            ],
            growth: [
                { title: "Deep Work", tip: "1 distraction-free session per day." },
                { title: "Atomic Habits", tip: "Make good habits obvious & easy." },
            ],
        },

        growth: {
            general: [
                { title: "Deep Work", tip: "Add 1 more focused block next week." },
                { title: "Essentialism", tip: "Do less, but better — choose 3 priorities." },
            ],
            sport: [
                { title: "Atomic Habits", tip: "Increase load by +5% only." },
                { title: "Why We Sleep", tip: "7+ hours → better recovery → better discipline." },
            ],
            crypto: [
                { title: "Trading in the Zone", tip: "Limit trades: quality > quantity." },
                { title: "The Psychology of Money", tip: "Create a risk rule and follow it." },
            ],
            biz: [
                { title: "Getting Things Done", tip: "Weekly review to keep system clean." },
                { title: "The One Thing", tip: "Define 1 KPI for the week." },
            ],
            growth: [
                { title: "Atomic Habits", tip: "Raise the bar: 1% better daily." },
                { title: "Deep Work", tip: "Protect focus — schedule it first." },
            ],
        },

        elite: {
            general: [
                { title: "Deep Work", tip: "Optimize: reduce context switching." },
                { title: "The One Thing", tip: "Double down on what works." },
            ],
            sport: [
                { title: "Atomic Habits", tip: "Keep consistency, avoid overtraining." },
                { title: "Can't Hurt Me", tip: "Stay sharp: do the hard thing first." },
            ],
            crypto: [
                { title: "Fooled by Randomness", tip: "Stick to risk management always." },
                { title: "Trading in the Zone", tip: "Master execution, not prediction." },
            ],
            biz: [
                { title: "Essentialism", tip: "Scale by removing low-value tasks." },
                { title: "Getting Things Done", tip: "Systemize: templates + checklists." },
            ],
            growth: [
                { title: "Atomic Habits", tip: "Make it sustainable — no burnout." },
                { title: "Deep Work", tip: "Keep your focus as your advantage." },
            ],
        },
    };

    // Detect theme from task text (works with "#biz" OR "business/бізнес", etc.)
    function extractTheme(taskText) {
        const s = normLower(taskText);
        if (!s) return null;

        const has = (re) => re.test(s);

        if (has(/(^|\s)#?(biz|business)\b/) || has(/\bбізнес\b/) || has(/\bbusiness\b/)) return "biz";
        if (has(/(^|\s)#?(crypto)\b/) || has(/\bкрипт\b/) || has(/\bcrypto\b/)) return "crypto";
        if (has(/(^|\s)#?(sport)\b/) || has(/\bспорт\b/) || has(/\bsport\b/)) return "sport";
        if (has(/(^|\s)#?(growth)\b/) || has(/\bсаморозвиток\b/) || has(/\bgrowth\b/)) return "growth";

        return null;
    }

    function dominantThemeFromWeek(daysArr) {
        const counts = { biz: 0, crypto: 0, sport: 0, growth: 0 };
        daysArr.forEach(day => {
            (day.tasks || []).forEach(t => {
                const tt = norm(t);
                if (!tt) return;
                const theme = extractTheme(tt);
                if (theme) counts[theme] += 1;
            });
        });

        let best = "general";
        let bestVal = 0;
        Object.keys(counts).forEach(k => {
            if (counts[k] > bestVal) {
                bestVal = counts[k];
                best = k;
            }
        });

        return best; // or "general"
    }

    function planLimits(plan) {
        if (plan === "free") return { maxTasksPerDay: 5,  maxHabits: 5,  historyDays: 14,  weekNav: false };
        if (plan === "pro")  return { maxTasksPerDay: 10, maxHabits: 15, historyDays: 90,  weekNav: true  };
        return               { maxTasksPerDay: 15, maxHabits: 30, historyDays: 365, weekNav: true  }; // premium
    }

    // key per user
    function appStorageKey() {
        let email = normLower(localStorage.getItem(EMAIL_KEY));
        if (!email) email = "anon";
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
                localStorage.removeItem("selfio_email");
                location.href = "../index.html";
            });
        });
    }

    // state normalize / migration
    function initState() {
        const state = loadApp();
        state.days = state.days || {};
        state.settings = state.settings || {};

        const limits = planLimits(getPlan());

        // focuses
        if (!Array.isArray(state.settings.focuses) || state.settings.focuses.length === 0) {
            state.settings.focuses = DEFAULT_FOCUSES.slice();
        }

        // tasksCount (default 3, but clamp by plan)
        state.settings.tasksCount = clamp(safeNum(state.settings.tasksCount, 3), 1, limits.maxTasksPerDay);

        // habits master list (global)
        if (!Array.isArray(state.settings.habits) || state.settings.habits.length === 0) {
            const today = state.days[ymd()];
            if (today && Array.isArray(today.habits) && today.habits.length) {
                state.settings.habits = today.habits.map(h => norm(h.name)).filter(Boolean);
            } else {
                state.settings.habits = DEFAULT_HABITS.slice();
            }
        }

        // enforce habits limit by plan (PRO=15)
        if (state.settings.habits.length > limits.maxHabits) {
            state.settings.habits = state.settings.habits.slice(0, limits.maxHabits);
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

            if (!Array.isArray(day.habitDone)) {
                day.habitDone = masterHabits.map(() => false);
            } else {
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

        const qsDate = new URLSearchParams(location.search).get("date");
        const dayKey = (qsDate && isValidYMD(qsDate)) ? qsDate : ymd();

        state.days[dayKey] = state.days[dayKey] || {
            mood: 3,
            focus: state.settings.focuses[0] || "Deep work",
            tasks: [],
            tasksDone: [],
            habitDone: state.settings.habits.map(() => false),
            note: ""
        };

        const day = state.days[dayKey];

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

        // focus
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

        // tasks
        const tasksWrap = document.querySelector("[data-tasks]");
        const tasksCountSel = document.querySelector("[data-tasks-count]");
        const tasksProgress = document.querySelector("[data-tasks-progress]");
        const tasksBar = document.querySelector("[data-tasks-bar]");

        function updateTasksProgress() {
            const planned = countPlannedTasks(day.tasks);
            const done = countDoneTasks(day.tasks, day.tasksDone);
            const p = pct(done, planned);

            if (tasksProgress) tasksProgress.textContent = `Tasks: ${done}/${planned} (${p}%)`;
            if (tasksBar) tasksBar.style.width = `${p}%`;
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
                    updateTasksProgress();
                });

                row.appendChild(cb);
                row.appendChild(input);
                tasksWrap.appendChild(row);
            });

            updateTasksProgress();
        }

        if (tasksCountSel) {
            Array.from(tasksCountSel.querySelectorAll("option")).forEach(opt => {
                opt.disabled = Number(opt.value) > limits.maxTasksPerDay;
            });

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

        // habits
        const habitsWrap = document.querySelector("[data-habits]");
        const masterHabits = state.settings.habits; // already limited by plan

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

        // reset
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

        saveApp(state);
    }

    function weeklyPage() {
        const page = document.body.getAttribute("data-page");
        if (page !== "weekly") return;

        const state = initState();
        const plan = getPlan();
        const limits = planLimits(plan);

        const wrap = document.querySelector("[data-week]");
        const linesEl = document.querySelector("[data-weekly-lines]");
        if (!wrap || !linesEl) return;

        // week offset for Pro/Premium: ?w=0 current, -1 previous, -2, ...
        const qs = new URLSearchParams(location.search);
        let w = safeNum(qs.get("w"), 0);

        // no future weeks
        w = Math.min(0, w);

        const maxBackWeeks = Math.floor(limits.historyDays / 7);
        if (!limits.weekNav) w = 0;
        w = clamp(w, -maxBackWeeks, 0);

        const nav = document.querySelector("[data-week-nav]");
        const prevBtn = document.querySelector("[data-week-prev]");
        const nextBtn = document.querySelector("[data-week-next]");
        const labelEl = document.querySelector("[data-week-label]");

        if (nav) {
            nav.style.display = limits.weekNav ? "" : "none";
        }

        function goWeek(newW) {
            const url = new URL(location.href);
            url.searchParams.set("w", String(newW));
            location.href = url.pathname + url.search;
        }

        if (limits.weekNav && prevBtn && nextBtn) {
            prevBtn.onclick = () => goWeek(clamp(w - 1, -maxBackWeeks, 0));
            nextBtn.onclick = () => goWeek(clamp(w + 1, -maxBackWeeks, 0));

            prevBtn.disabled = (w <= -maxBackWeeks);
            nextBtn.disabled = (w >= 0);
        }

        const baseMonday = startOfWeekMonday(new Date());
        const monday = addDays(baseMonday, w * 7);

        const mondayKey = ymd(monday);
        const sundayKey = ymd(addDays(monday, 6));
        if (labelEl) labelEl.textContent = `${mondayKey} → ${sundayKey}`;

        const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
        wrap.innerHTML = "";

        // collect week days data for insights
        const weekDays = [];

        let weekTasksDone = 0, weekTasksPlanned = 0;
        let weekHabitsDone = 0, weekHabitsTotal = 0;

        // for streaks (Pro)
        const dayScores = [];

        for (let i = 0; i < 7; i++) {
            const d = addDays(monday, i);
            const key = ymd(d);
            const data = state.days[key] || {};
            const isToday = key === ymd();

            const planned = countPlannedTasks(data.tasks || []);
            const done = countDoneTasks(data.tasks || [], data.tasksDone || []);
            const tasksPct = pct(done, planned);

            const habitsDone = (data.habitDone || []).filter(Boolean).length;
            const habitsTotal = (data.habitDone || []).length || 0;
            const habitsPct = pct(habitsDone, habitsTotal);

            const dayScore = Math.round((tasksPct + habitsPct) / 2);

            weekTasksDone += done;
            weekTasksPlanned += planned;
            weekHabitsDone += habitsDone;
            weekHabitsTotal += habitsTotal;

            dayScores.push({ i, name: names[i], score: dayScore });

            weekDays.push({
                tasks: data.tasks || [],
                tasksDone: data.tasksDone || [],
            });

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
        <div class="mini">Tasks: ${done}/${planned} (${tasksPct}%) • Habits: ${habitsDone}/${habitsTotal} (${habitsPct}%)</div>
      `;
            wrap.appendChild(el);
        }

        const weekTasksPct = pct(weekTasksDone, weekTasksPlanned);
        const weekHabitsPct = pct(weekHabitsDone, weekHabitsTotal);
        const weekScore = Math.round((weekTasksPct + weekHabitsPct) / 2);

        // best day
        const best = dayScores.slice().sort((a, b) => b.score - a.score)[0];

        // streak (Pro): consecutive days with dayScore >= 70
        let bestStreak = 0, curStreak = 0;
        dayScores.forEach(ds => {
            if (ds.score >= 70) {
                curStreak += 1;
                bestStreak = Math.max(bestStreak, curStreak);
            } else {
                curStreak = 0;
            }
        });

        // theme
        const theme = dominantThemeFromWeek(weekDays); // biz/crypto/sport/growth/general
        const tier = weekTier(weekScore);

        const email = localStorage.getItem(EMAIL_KEY) || "anon";
        const seed = `${email}|${mondayKey}|${tier}|${theme}`;
        const pool =
            (BOOKS[tier] && BOOKS[tier][theme]) ||
            (BOOKS[tier] && BOOKS[tier].general) ||
            [];
        const book = seededPick(pool, seed) || { title: "Atomic Habits", tip: "Make it easy to start." };

        // Build 1–3 insights
        const lines = [];
        lines.push(`Week score: <b>${weekScore}%</b> (Tasks ${weekTasksPct}% • Habits ${weekHabitsPct}%)`);
        lines.push(`Best day: <b>${best.name}</b> — <b>${best.score}%</b>`);
        lines.push(`Book tip: <b>${book.title}</b> — ${book.tip}`);

        // Pro/Premium extra (still minimal)
        if (plan !== "free") {
            lines.push(`Insight: ${PSYCH[tier] || PSYCH.stable}`);
            if (bestStreak >= 2) lines.push(`Streak: <b>${bestStreak}</b> days ≥ 70%`);
        }

        linesEl.innerHTML = `<ul style="margin:0; padding-left:18px;">${lines.slice(0, 5).map(x => `<li>${x}</li>`).join("")}</ul>`;
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
        const plan = getPlan();
        const limits = planLimits(plan);

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

            add.disabled = masterHabits.length >= limits.maxHabits;
        }

        add.addEventListener("click", () => {
            const name = norm(input.value);
            if (!name) return;

            if (masterHabits.length >= limits.maxHabits) {
                alert(`Habit limit reached for ${plan.toUpperCase()} plan (${limits.maxHabits}).`);
                return;
            }

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
