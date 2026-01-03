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

    // PRO / PREMIUM правила
    function planFeatures(plan) {
        if (plan === "pro") {
            return {
                maxTasksPerDay: 10,
                maxHabits: 15,
                historyDays: 90,
                insights: true,
            };
        }
        if (plan === "premium") {
            return {
                maxTasksPerDay: 15,
                maxHabits: 30,     // можеш змінити як захочеш
                historyDays: 365,  // або "unlimited"
                insights: true,
            };
        }
        // free
        return {
            maxTasksPerDay: 5,
            maxHabits: 5,
            historyDays: 30,
            insights: false,
        };
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

    // history prune (щоб free/pro відповідали “History: 30/90 days”)
    function pruneHistoryDays(state, keepDays) {
        if (!keepDays || keepDays <= 0) return;
        const today = new Date();
        const cutoff = new Date(today);
        cutoff.setDate(today.getDate() - (keepDays - 1));
        const cutoffKey = ymd(cutoff);

        Object.keys(state.days || {}).forEach((k) => {
            if (!isValidYMD(k)) return;
            if (k < cutoffKey) delete state.days[k];
        });
    }

    // state normalize / migration
    function initState() {
        const state = loadApp();
        state.days = state.days || {};
        state.settings = state.settings || {};

        const plan = getPlan();
        const features = planFeatures(plan);

        // focuses
        if (!Array.isArray(state.settings.focuses) || state.settings.focuses.length === 0) {
            state.settings.focuses = DEFAULT_FOCUSES.slice();
        }

        // tasksCount (default 3, but clamp by plan)
        state.settings.tasksCount = clamp(safeNum(state.settings.tasksCount, 3), 1, features.maxTasksPerDay);

        // habits master list (global)
        if (!Array.isArray(state.settings.habits) || state.settings.habits.length === 0) {
            const today = state.days[ymd()];
            if (today && Array.isArray(today.habits) && today.habits.length) {
                state.settings.habits = today.habits.map(h => norm(h.name)).filter(Boolean);
            } else {
                state.settings.habits = DEFAULT_HABITS.slice();
            }
        }

        // enforce maxHabits by plan
        if (state.settings.habits.length > features.maxHabits) {
            state.settings.habits = state.settings.habits.slice(0, features.maxHabits);
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

            // ensure habitDone exists & correct length
            if (!Array.isArray(day.habitDone)) {
                day.habitDone = masterHabits.map(() => false);
            } else {
                while (day.habitDone.length < masterHabits.length) day.habitDone.push(false);
                day.habitDone = day.habitDone.slice(0, masterHabits.length);
            }

            state.days[key] = day;
        });

        // prune history
        pruneHistoryDays(state, features.historyDays);

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

    // ---------- WEEKLY INSIGHTS helpers ----------
    function extractTag(taskText) {
        const s = normLower(taskText);
        const m = s.match(/^#(biz|crypto|sport|growth)\b/);
        return m ? m[1] : null;
    }

    function hashString(str) {
        // FNV-1a
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return (h >>> 0);
    }

    function seededPick(arr, seedStr) {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const h = hashString(seedStr);
        return arr[h % arr.length];
    }

    function weekTier(score) {
        if (score >= 85) return "elite";
        if (score >= 70) return "growth";
        if (score >= 50) return "stable";
        return "reset";
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
                { title: "Trading in the Zone", tip: "Write rules before trades. Less impulsive decisions." },
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
                { title: "Atomic Habits", tip: "Upgrade environment: prepare your gear заранее." },
                { title: "Why We Sleep", tip: "Sleep = free performance boost." },
            ],
            crypto: [
                { title: "Trading in the Zone", tip: "Journal 3 trades: entry/exit/why." },
                { title: "Fooled by Randomness", tip: "Don’t confuse luck with skill." },
            ],
            biz: [
                { title: "The One Thing", tip: "Block 60–90 min for your main goal daily." },
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
                { title: "Essentialism", tip: "Choose 3 priorities. Do less, but better." },
            ],
            sport: [
                { title: "Atomic Habits", tip: "Increase load by only +5%." },
                { title: "Why We Sleep", tip: "7+ hours → better recovery → better discipline." },
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
                { title: "Deep Work", tip: "Schedule focus first — protect it." },
            ],
        },

        elite: {
            general: [
                { title: "Deep Work", tip: "Optimize: reduce context switching." },
                { title: "The One Thing", tip: "Double down on what works." },
            ],
            sport: [
                { title: "Atomic Habits", tip: "Keep consistency, avoid overtraining." },
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

    // pages
    function todayPage() {
        const page = document.body.getAttribute("data-page");
        if (page !== "today") return;

        const state = initState();
        const plan = getPlan();
        const features = planFeatures(plan);

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

        // clamp tasksCount by plan
        state.settings.tasksCount = clamp(safeNum(state.settings.tasksCount, 3), 1, features.maxTasksPerDay);
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
            // IMPORTANT: генеруємо опції 1..limit (щоб PRO показував 10, не 5)
            tasksCountSel.innerHTML = "";
            for (let i = 1; i <= features.maxTasksPerDay; i++) {
                const opt = document.createElement("option");
                opt.value = String(i);
                opt.textContent = String(i);
                tasksCountSel.appendChild(opt);
            }

            tasksCountSel.value = String(state.settings.tasksCount);

            tasksCountSel.addEventListener("change", () => {
                const wanted = safeNum(tasksCountSel.value, state.settings.tasksCount);
                const clamped = clamp(wanted, 1, features.maxTasksPerDay);

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
        const plan = getPlan();
        const features = planFeatures(plan);

        const wrap = document.querySelector("[data-week]");
        if (!wrap) return;

        const insightsLines = document.querySelector("[data-weekly-lines]");

        const now = new Date();
        const shift = (now.getDay() + 6) % 7; // Mon=0
        const monday = new Date(now);
        monday.setDate(now.getDate() - shift);
        const mondayKey = ymd(monday);

        const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

        // totals for week
        let weekTasksPlanned = 0, weekTasksDone = 0;
        let weekHabitsTotal = 0, weekHabitsDone = 0;

        const tagCounts = { biz: 0, crypto: 0, sport: 0, growth: 0 };

        // build days
        wrap.innerHTML = "";

        let bestDayIdx = 0;
        let bestDayScore = -1;

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const key = ymd(d);
            const data = state.days[key] || {};
            const isToday = key === ymd();

            const planned = countPlannedTasks(data.tasks || []);
            const done = countDoneTasks(data.tasks || [], data.tasksDone || []);
            const tPct = pct(done, planned);

            const hTotal = Array.isArray(data.habitDone) ? data.habitDone.length : 0;
            const hDone = Array.isArray(data.habitDone) ? data.habitDone.filter(Boolean).length : 0;
            const hPct = pct(hDone, hTotal);

            // day score = avg tasks/habits pct (як у твоєму макеті)
            const dayScore = Math.round((tPct + hPct) / 2);

            if (dayScore > bestDayScore) {
                bestDayScore = dayScore;
                bestDayIdx = i;
            }

            weekTasksPlanned += planned;
            weekTasksDone += done;
            weekHabitsTotal += hTotal;
            weekHabitsDone += hDone;

            // tags (from planned tasks)
            (data.tasks || []).forEach((t) => {
                const tt = norm(t);
                if (!tt) return;
                const tag = extractTag(tt);
                if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
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
        <div class="mini">
          Tasks: ${done}/${planned} (${tPct}%) • Habits: ${hDone}/${hTotal} (${hPct}%)
        </div>
      `;
            wrap.appendChild(el);
        }

        // INSIGHTS (тільки PRO/PREMIUM)
        if (insightsLines) {
            if (!features.insights) {
                insightsLines.innerHTML = `Upgrade to <b>Pro</b> to unlock weekly insights + book tips.`;
            } else {
                const tasksPct = pct(weekTasksDone, weekTasksPlanned);
                const habitsPct = pct(weekHabitsDone, weekHabitsTotal);
                const weekScore = Math.round((tasksPct + habitsPct) / 2);

                // dominant tag
                let dominant = "general";
                let best = 0;
                Object.keys(tagCounts).forEach((k) => {
                    if (tagCounts[k] > best) {
                        best = tagCounts[k];
                        dominant = k;
                    }
                });

                const tier = weekTier(weekScore);
                const list = (BOOKS[tier] && (BOOKS[tier][dominant] || BOOKS[tier].general)) || [];
                const seedStr = `${appStorageKey()}|${mondayKey}|${tier}|${dominant}`;
                const book = seededPick(list, seedStr) || seededPick((BOOKS[tier] && BOOKS[tier].general) || [], seedStr) || { title: "—", tip: "—" };

                const bestDayName = names[bestDayIdx] || "—";

                // 1–3 lines (буліти)
                insightsLines.innerHTML = `
          • Week score: <b>${weekScore}%</b> (Tasks ${tasksPct}% • Habits ${habitsPct}%)<br>
          • Best day: <b>${bestDayName} — ${bestDayScore}%</b><br>
          • Book tip: <b>${book.title}</b> — ${book.tip}
        `;
            }
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
        const plan = getPlan();
        const features = planFeatures(plan);

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

            // limit by plan
            if (masterHabits.length >= features.maxHabits) {
                alert(`Limit reached: max ${features.maxHabits} habits for your plan (${plan.toUpperCase()}).`);
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
