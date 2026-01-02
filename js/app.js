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
            if (!t) continue; // порожня задача НЕ входить у план
            if (tasksDone[i]) done++;
        }
        return done;
    }

    function pct(done, total) {
        if (!total) return 0;
        return Math.round((done / total) * 100);
    }

    // ---------- Weekly Insights helpers ----------

    // #tag на початку таски: #biz #crypto #sport #growth
    function extractTag(taskText) {
        const s = normLower(taskText);
        const m = s.match(/^#(biz|crypto|sport|growth)\b/);
        return m ? m[1] : null;
    }

    // стабільний hash (щоб book tip не змінювався при кожному refresh)
    function fnv1a(str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    }

    function pickStable(arr, seedStr) {
        if (!arr || arr.length === 0) return null;
        const idx = fnv1a(seedStr) % arr.length;
        return arr[idx];
    }

    function weekTier(score) {
        if (score >= 85) return "elite";
        if (score >= 70) return "growth";
        if (score >= 50) return "stable";
        return "reset";
    }

    function detectCategoryFromTasks(taskTexts) {
        // 1) спочатку пробуємо #tags
        const tagCount = { biz: 0, crypto: 0, sport: 0, growth: 0 };
        for (const t of taskTexts) {
            const tag = extractTag(t);
            if (tag) tagCount[tag] += 1;
        }
        let bestTag = null;
        let bestVal = 0;
        for (const k of Object.keys(tagCount)) {
            if (tagCount[k] > bestVal) { bestVal = tagCount[k]; bestTag = k; }
        }
        if (bestVal > 0) return bestTag; // biz/crypto/sport/growth

        // 2) fallback: ключові слова
        const text = taskTexts.join(" ").toLowerCase();
        const score = { general: 0, sport: 0, crypto: 0, biz: 0, growth: 0 };

        const add = (k, words) => {
            for (const w of words) if (text.includes(w)) score[k] += 1;
        };

        add("crypto", ["crypto", "крипт", "btc", "eth", "binance", "okx", "futures", "трейд", "trade", "лонг", "шорт", "позиція"]);
        add("sport",  ["gym", "workout", "run", "cardio", "спорт", "тренування", "зал", "біг", "stretch"]);
        add("biz",    ["business", "biz", "стартап", "клієнт", "sales", "продаж", "маркет", "seo", "контент", "проект", "meeting", "дзвінок"]);
        add("growth", ["study", "learn", "course", "english", "читати", "книга", "саморозвиток", "код", "coding", "practice", "звичка", "ворк"]);

        let best = "general";
        let bestS = 0;
        for (const k of Object.keys(score)) {
            if (score[k] > bestS) { bestS = score[k]; best = k; }
        }
        return bestS === 0 ? "general" : best;
    }

    const BOOKS = {
        reset: {
            general: [
                { title: "Atomic Habits", tip: "Make it tiny: use the 2-minute rule." },
                { title: "Deep Work", tip: "Remove distractions for 1 focused block." },
            ],
            sport: [
                { title: "Atomic Habits", tip: "Attach sport to a fixed trigger (after waking)." },
                { title: "Can't Hurt Me", tip: "Do the minimum even on low days." },
            ],
            crypto: [
                { title: "Trading in the Zone", tip: "Write rules before trades. Reduce emotions." },
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
                { title: "Essentialism", tip: "Choose 3 priorities. Do less, better." },
            ],
            sport: [
                { title: "Atomic Habits", tip: "Increase load by only +5%." },
                { title: "Why We Sleep", tip: "7+ hours → better recovery → discipline." },
            ],
            crypto: [
                { title: "Trading in the Zone", tip: "Limit trades: quality > quantity." },
                { title: "The Psychology of Money", tip: "Create a risk rule and follow it." },
            ],
            biz: [
                { title: "Getting Things Done", tip: "Do a weekly review to keep system clean." },
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
                { title: "Atomic Habits", tip: "Keep consistency, avoid burnout." },
                { title: "Can't Hurt Me", tip: "Do the hard thing first." },
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
                { title: "Deep Work", tip: "Keep focus as your advantage." },
            ],
        },
    };

    // ---------- storage per user ----------
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

    function planLimits(plan) {
        if (plan === "free") return { maxTasksPerDay: 5 };
        if (plan === "pro") return { maxTasksPerDay: 10 };
        return { maxTasksPerDay: 15 };
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
                localStorage.removeItem(TOKEN_KEY);
                location.href = "../index.html";
            });
        });
    }

    // state normalize / migration
    function initState() {
        const state = loadApp();
        state.days = state.days || {};
        state.settings = state.settings || {};

        if (!Array.isArray(state.settings.focuses) || state.settings.focuses.length === 0) {
            state.settings.focuses = DEFAULT_FOCUSES.slice();
        }

        const limits = planLimits(getPlan());
        state.settings.tasksCount = clamp(safeNum(state.settings.tasksCount, 3), 1, limits.maxTasksPerDay);

        if (!Array.isArray(state.settings.habits) || state.settings.habits.length === 0) {
            const today = state.days[ymd()];
            if (today && Array.isArray(today.habits) && today.habits.length) {
                state.settings.habits = today.habits.map(h => norm(h.name)).filter(Boolean);
            } else {
                state.settings.habits = DEFAULT_HABITS.slice();
            }
        }

        const masterHabits = state.settings.habits;

        Object.keys(state.days).forEach((key) => {
            const day = state.days[key] || {};

            // old format migrate
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
        const wrap = document.querySelector("[data-week]");
        if (!wrap) return;

        // підтримка обох варіантів верстки
        const insightsEl =
            document.querySelector("[data-week-insights]") ||
            document.querySelector("[data-weekly-lines]");

        const now = new Date();
        const shift = (now.getDay() + 6) % 7; // Mon=0
        const monday = new Date(now);
        monday.setDate(now.getDate() - shift);

        const mondayKey = ymd(monday);
        const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

        wrap.innerHTML = "";

        let weekTasksDone = 0, weekTasksPlanned = 0;
        let weekHabitsDone = 0, weekHabitsPlanned = 0;

        let bestDayName = "—";
        let bestDayScore = -1;

        const allTaskTexts = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const key = ymd(d);
            const data = state.days[key] || {};
            const isToday = key === ymd();

            const plannedTasks = countPlannedTasks(data.tasks || []);
            const doneTasks = countDoneTasks(data.tasks || [], data.tasksDone || []);

            const habitsPlanned = Array.isArray(data.habitDone) ? data.habitDone.length : 0;
            const habitsDone = Array.isArray(data.habitDone) ? data.habitDone.filter(Boolean).length : 0;

            weekTasksPlanned += plannedTasks;
            weekTasksDone += doneTasks;
            weekHabitsPlanned += habitsPlanned;
            weekHabitsDone += habitsDone;

            if (Array.isArray(data.tasks)) {
                for (const t of data.tasks) {
                    const s = norm(t);
                    if (s) allTaskTexts.push(s);
                }
            }

            const tasksPct = pct(doneTasks, plannedTasks);
            const habitsPct = pct(habitsDone, habitsPlanned);
            const dayScore = Math.round((tasksPct + habitsPct) / 2);

            if (dayScore > bestDayScore && (plannedTasks + habitsPlanned) > 0) {
                bestDayScore = dayScore;
                bestDayName = names[i];
            }

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

        <div class="mini">
          Tasks: ${doneTasks}/${plannedTasks} (${tasksPct}%)
          &nbsp;•&nbsp;
          Habits: ${habitsDone}/${habitsPlanned} (${habitsPct}%)
        </div>
      `;
            wrap.appendChild(el);
        }

        // Weekly Insights (1–3 lines)
        if (insightsEl) {
            const totalPlanned = weekTasksPlanned + weekHabitsPlanned;
            if (!totalPlanned) {
                insightsEl.textContent = "No data yet — open Today and check tasks/habits.";
                return;
            }

            const tasksPctWeek = pct(weekTasksDone, weekTasksPlanned);
            const habitsPctWeek = pct(weekHabitsDone, weekHabitsPlanned);
            const weekScore = Math.round((tasksPctWeek + habitsPctWeek) / 2);

            const tier = weekTier(weekScore);
            const category = detectCategoryFromTasks(allTaskTexts);

            const email = (localStorage.getItem(EMAIL_KEY) || "anon").toLowerCase();
            const pool = (BOOKS[tier] && (BOOKS[tier][category] || BOOKS[tier].general)) || [];
            const picked = pickStable(pool, `${email}|${mondayKey}|${tier}|${category}`);

            const lines = [];
            lines.push(`• Week score: ${weekScore}% (Tasks ${tasksPctWeek}% • Habits ${habitsPctWeek}%)`);
            if (bestDayScore >= 0) lines.push(`• Best day: ${bestDayName} — ${bestDayScore}%`);
            if (picked) lines.push(`• Book tip: ${picked.title} — ${picked.tip}`);

            insightsEl.innerHTML = lines.slice(0, 3).join("<br>");
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
