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

    // planned/done helpers (для статистики)
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

    function getPlan() {
        return normLower(localStorage.getItem(PLAN_KEY)) || "free";
    }

    function isPremium() {
        return getPlan() === "premium";
    }

    function planLimits(plan) {
        if (plan === "free") return { maxTasksPerDay: 5 };
        if (plan === "pro") return { maxTasksPerDay: 10 };
        return { maxTasksPerDay: 15 }; // premium
    }

    function extractTag(taskText) {
        const s = String(taskText || "").toLowerCase();

        // 1) розбиваємо на "слова" (прибираємо пунктуацію)
        const tokens = s
            .replace(/[\u2019’]/g, "'")
            .replace(/[^a-z0-9а-яіїєґ#_-]+/gi, " ")
            .split(/\s+/)
            .filter(Boolean)
            .map(t => t.startsWith("#") ? t.slice(1) : t)      // #biz -> biz
            .map(t => t.replace(/[-_]/g, ""));                // self-dev -> selfdev

        // 2) синоніми → 4 категорії
        const MAP = {
            biz: new Set([
                "biz","business","work","startup","client","sales","marketing","project","product",
                "freelance","job","career",
                "бізнес","бизнес","робота","работа","стартап","клієнт","клиент"
            ]),
            crypto: new Set([
                "crypto","btc","eth","trade","trading","defi","airdrop","binance",
                "крипта","крипто","трейд","трейдинг","биток","біток"
            ]),
            sport: new Set([
                "sport","sports","gym","workout","training","run","running","cardio","lifting","fitness",
                "зал","тренування","тренировка","біг","бег"
            ]),
            growth: new Set([
                "growth","learn","learning","study","reading","skill","skills","selfdev","improve","habits","mindset",
                "розвиток","развитие","навчання","учеба","учёба"
            ]),
        };

        for (const t of tokens) {
            if (MAP.biz.has(t)) return "biz";
            if (MAP.crypto.has(t)) return "crypto";
            if (MAP.sport.has(t)) return "sport";
            if (MAP.growth.has(t)) return "growth";
        }

        return null;
    }

    // stable hash (FNV-1a)
    function hashString(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0);
    }

    function seededPick(arr, seedStr) {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const idx = hashString(seedStr) % arr.length;
        return arr[idx];
    }

    function weekTier(score) {
        if (score >= 85) return "elite";
        if (score >= 70) return "growth";
        if (score >= 50) return "stable";
        return "reset";
    }

    // Book library: BOOKS[tier][category]
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
                { title: "Trading in the Zone", tip: "Write rules BEFORE trades. Less эмоцій." },
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
                { title: "Atomic Habits", tip: "Prep your environment: bag ready." },
                { title: "Why We Sleep", tip: "Sleep = free performance boost." },
            ],
            crypto: [
                { title: "Trading in the Zone", tip: "Journal 3 trades: entry/exit/why." },
                { title: "Fooled by Randomness", tip: "Don’t confuse luck with skill." },
            ],
            biz: [
                { title: "The One Thing", tip: "Block 60–90 min for main goal daily." },
                { title: "Essentialism", tip: "Say no to 1 low-value thing." },
            ],
            growth: [
                { title: "Deep Work", tip: "1 distraction-free session per day." },
                { title: "Atomic Habits", tip: "Make good habits obvious & easy." },
            ],
        },

        growth: {
            general: [
                { title: "Deep Work", tip: "Add 1 more focused block next week." },
                { title: "Essentialism", tip: "Choose 3 priorities — do less, better." },
            ],
            sport: [
                { title: "Atomic Habits", tip: "Increase load by +5% only." },
                { title: "Why We Sleep", tip: "7+ hours → better recovery → discipline." },
            ],
            crypto: [
                { title: "Trading in the Zone", tip: "Limit trades: quality > quantity." },
                { title: "The Psychology of Money", tip: "Set 1 risk rule and follow it." },
            ],
            biz: [
                { title: "Getting Things Done", tip: "Weekly review keeps system clean." },
                { title: "The One Thing", tip: "Define 1 KPI for the week." },
            ],
            growth: [
                { title: "Atomic Habits", tip: "Raise the bar: 1% better daily." },
                { title: "Deep Work", tip: "Schedule focus first, then everything else." },
            ],
        },

        elite: {
            general: [
                { title: "Deep Work", tip: "Optimize: reduce context switching." },
                { title: "The One Thing", tip: "Double down on what works." },
            ],
            sport: [
                { title: "Atomic Habits", tip: "Stay consistent, avoid overtraining." },
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

    function pickWeeklyBook({ email, weekStart, score, topTag }) {
        const tier = weekTier(score);
        const cat = topTag || "general";

        const tierObj = BOOKS[tier] || BOOKS.reset;
        const pool = tierObj[cat] || tierObj.general || BOOKS.reset.general;

        const seed = `${email}|${weekStart}|${tier}|${cat}`;
        return seededPick(pool, seed) || pool[0];
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

        // focuses
        if (!Array.isArray(state.settings.focuses) || state.settings.focuses.length === 0) {
            state.settings.focuses = DEFAULT_FOCUSES.slice();
        }

        // tasksCount
        const limits = planLimits(getPlan());
        state.settings.tasksCount = clamp(safeNum(state.settings.tasksCount, 3), 1, limits.maxTasksPerDay);

        // habits master list
        if (!Array.isArray(state.settings.habits) || state.settings.habits.length === 0) {
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

            // old format habits -> habitDone
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

    // === Weekly page (includes Smart Book Tip 2.0) ===
    function weeklyPage() {
        const page = document.body.getAttribute("data-page");
        if (page !== "weekly") return;

        const state = initState();
        const wrap = document.querySelector("[data-week]");
        if (!wrap) return;

        // tabs
        const weekLinesEl = document.querySelector("[data-weekly-lines]");
        const monthLinesEl = document.querySelector("[data-monthly-lines]");
        const tabWeek = document.querySelector('[data-insights-tab="week"]');
        const tabMonth = document.querySelector('[data-insights-tab="month"]');

        function setTab(active) {
            if (tabWeek) tabWeek.classList.toggle("pill--today", active === "week");
            if (tabMonth) tabMonth.classList.toggle("pill--today", active === "month");

            if (weekLinesEl) weekLinesEl.style.display = active === "week" ? "" : "none";
            if (monthLinesEl) monthLinesEl.style.display = active === "month" ? "" : "none";
        }

        if (tabWeek) tabWeek.addEventListener("click", () => setTab("week"));

        if (tabMonth) {
            if (!isPremium()) {
                tabMonth.disabled = true;
                tabMonth.title = "Premium only";
            } else {
                tabMonth.addEventListener("click", () => setTab("month"));
            }
        }

        // week range (Mon/Sun)
        const now = new Date();
        const shift = (now.getDay() + 6) % 7; // Mon=0
        const monday = new Date(now);
        monday.setDate(now.getDate() - shift);

        const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
        wrap.innerHTML = "";

        // week totals
        let weekPlanned = 0;
        let weekDone = 0;
        const daysWithPlans = [];

        // TAG COUNTS (planned tasks only)
        const tagCounts = { biz: 0, crypto: 0, sport: 0, growth: 0 };

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const key = ymd(d);
            const data = state.days[key] || {};
            const isToday = key === ymd();

            const planned = countPlannedTasks(data.tasks || []);
            const done = countDoneTasks(data.tasks || [], data.tasksDone || []);

            weekPlanned += planned;
            weekDone += done;

            const dayScore = pct(done, planned);
            if (planned > 0) daysWithPlans.push({ name: names[i], score: dayScore, key });

            // count tags from PLANNED tasks
            for (const t of (data.tasks || [])) {
                const tt = norm(t);
                if (!tt) continue;
                const tag = extractTag(tt);
                if (tag && tagCounts[tag] !== undefined) tagCounts[tag]++;
            }

            const habitsDone = (data.habitDone || []).filter(Boolean).length;
            const habitsTotal = (data.habitDone || []).length || 0;

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
        <div class="mini">Tasks: ${done}/${planned} (${dayScore}%) • Habits: ${habitsDone}/${habitsTotal}</div>
      `;
            wrap.appendChild(el);
        }

        const weekScore = pct(weekDone, weekPlanned);

        // best day
        let bestDay = null;
        for (const d of daysWithPlans) {
            if (!bestDay || d.score > bestDay.score) bestDay = d;
        }

        // topTag (seeded if tie)
        let topTag = null;
        const maxTagVal = Math.max(tagCounts.biz, tagCounts.crypto, tagCounts.sport, tagCounts.growth);
        if (maxTagVal > 0) {
            const candidates = Object.keys(tagCounts).filter(k => tagCounts[k] === maxTagVal);
            const emailForSeed = (localStorage.getItem(EMAIL_KEY) || "anon").toLowerCase();
            topTag = seededPick(candidates, `${emailForSeed}|${ymd(monday)}|topTag`) || candidates[0];
        }

        // book (seeded per week + depends on score + tag)
        const email = (localStorage.getItem(EMAIL_KEY) || "anon").toLowerCase();
        const book = weekPlanned
            ? pickWeeklyBook({ email, weekStart: ymd(monday), score: weekScore, topTag: topTag || "general" })
            : null;

        // WEEK lines (max 3)  тут саме Smart Book Tip 2.0
        if (weekLinesEl) {
            const lines = [];
            lines.push(`Week score: <b>${weekScore}%</b> (${weekDone}/${weekPlanned})`);
            if (bestDay) lines.push(`Best day: <b>${bestDay.name}</b> — ${bestDay.score}%`);

            if (!weekPlanned) {
                lines.push(`Book tip: <b>—</b> Add tasks with biz/crypto/sport/growth (optionally with #).`);
            } else {
                lines.push(`Book tip: <b>${book.title}</b> — ${book.tip}`);
            }

            weekLinesEl.innerHTML = lines.slice(0, 3).join("<br>");
        }

        // MONTH insights (Premium) — як у тебе
        if (monthLinesEl) {
            if (!isPremium()) {
                monthLinesEl.innerHTML = `Upgrade to <b>Premium</b> to see Month insights.`;
            } else {
                const thisMonth = now.getMonth();
                const thisYear = now.getFullYear();

                // current month
                let mPlanned = 0;
                let mDone = 0;
                const weekdayAgg = {
                    Mon: { done: 0, planned: 0 },
                    Tue: { done: 0, planned: 0 },
                    Wed: { done: 0, planned: 0 },
                    Thu: { done: 0, planned: 0 },
                    Fri: { done: 0, planned: 0 },
                    Sat: { done: 0, planned: 0 },
                    Sun: { done: 0, planned: 0 },
                };

                // prev month
                const prev = new Date(now);
                prev.setMonth(now.getMonth() - 1);
                const prevMonth = prev.getMonth();
                const prevYear = prev.getFullYear();
                let pmPlanned = 0;
                let pmDone = 0;

                for (const key of Object.keys(state.days)) {
                    if (!isValidYMD(key)) continue;
                    const [Y, M, D] = key.split("-").map(Number);
                    const dt = new Date(Y, M - 1, D);
                    const dayData = state.days[key] || {};

                    const planned = countPlannedTasks(dayData.tasks || []);
                    const done = countDoneTasks(dayData.tasks || [], dayData.tasksDone || []);

                    if (planned <= 0) continue;

                    // this month
                    if (dt.getFullYear() === thisYear && dt.getMonth() === thisMonth) {
                        mPlanned += planned;
                        mDone += done;

                        const wname = names[(dt.getDay() + 6) % 7]; // Mon..Sun
                        if (weekdayAgg[wname]) {
                            weekdayAgg[wname].planned += planned;
                            weekdayAgg[wname].done += done;
                        }
                    }

                    // prev month
                    if (dt.getFullYear() === prevYear && dt.getMonth() === prevMonth) {
                        pmPlanned += planned;
                        pmDone += done;
                    }
                }

                const monthScore = pct(mDone, mPlanned);
                const prevScore = pct(pmDone, pmPlanned);
                const trend = monthScore - prevScore;

                // best weekday by avg score
                let bestWeekday = null;
                for (const k of Object.keys(weekdayAgg)) {
                    const sc = pct(weekdayAgg[k].done, weekdayAgg[k].planned);
                    if (weekdayAgg[k].planned <= 0) continue;
                    if (!bestWeekday || sc > bestWeekday.score) bestWeekday = { name: k, score: sc };
                }

                const lines = [];
                lines.push(`Month score: <b>${monthScore}%</b> (${mDone}/${mPlanned})`);
                if (pmPlanned > 0) {
                    const sign = trend >= 0 ? "+" : "";
                    lines.push(`Trend: <b>${sign}${trend}%</b> vs last month`);
                } else {
                    lines.push(`Trend: <b>—</b> (no data last month)`);
                }
                if (bestWeekday) lines.push(`Best weekday: <b>${bestWeekday.name}</b> — ${bestWeekday.score}%`);

                monthLinesEl.innerHTML = lines.slice(0, 3).join("<br>");
            }
        }

        setTab("week");
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
