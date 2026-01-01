(function () {
    const TOKEN_KEY = "selfio_token";
    const EMAIL_KEY = "selfio_email";
    const PLAN_KEY  = "selfio_plan";
    const APP_KEY   = "selfio_app_v1";

    function ymd(d = new Date()) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    function loadApp() {
        try { return JSON.parse(localStorage.getItem(APP_KEY)) || {}; }
        catch { return {}; }
    }

    function saveApp(state) {
        localStorage.setItem(APP_KEY, JSON.stringify(state));
    }

    function requireAuth() {
        const token = localStorage.getItem(TOKEN_KEY);
        // якщо немає токена — кидаємо на sign in
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
        const btn = document.querySelector("[data-logout]");
        if (!btn) return;
        btn.addEventListener("click", () => {
            localStorage.removeItem(TOKEN_KEY);
            // не чіпаю email/plan — можеш видалити теж, якщо хочеш “чисто”
            location.href = "../index.html";
        });
    }

    function todayPage() {
        const page = document.body.getAttribute("data-page");
        if (page !== "today") return;

        const state = loadApp();
        const dayKey = ymd();

        state.days = state.days || {};
        state.days[dayKey] = state.days[dayKey] || {
            mood: 3,
            focus: "Deep work",
            tasks: ["", "", ""],
            tasksDone: [false, false, false],
            habits: [
                { name: "Drink water", done: false },
                { name: "Study 30 min", done: false },
                { name: "Walk 10 min", done: false }
            ],
            note: ""
        };

        const day = state.days[dayKey];

        // mood
        document.querySelectorAll("[data-mood]").forEach(btn => {
            const val = Number(btn.getAttribute("data-mood"));
            btn.setAttribute("data-active", String(val === day.mood));
            btn.addEventListener("click", () => {
                day.mood = val;
                document.querySelectorAll("[data-mood]").forEach(b => {
                    const v = Number(b.getAttribute("data-mood"));
                    b.setAttribute("data-active", String(v === day.mood));
                });
                saveApp(state);
            });
        });

        // focus
        const focus = document.querySelector("[data-focus]");
        if (focus) {
            focus.value = day.focus;
            focus.addEventListener("change", () => {
                day.focus = focus.value;
                saveApp(state);
            });
        }

        // tasks
        document.querySelectorAll("[data-task]").forEach((row, idx) => {
            const cb = row.querySelector("input[type='checkbox']");
            const input = row.querySelector("input[type='text']");
            cb.checked = !!day.tasksDone[idx];
            input.value = day.tasks[idx] || "";

            cb.addEventListener("change", () => {
                day.tasksDone[idx] = cb.checked;
                saveApp(state);
            });
            input.addEventListener("input", () => {
                day.tasks[idx] = input.value;
                saveApp(state);
            });
        });

        // habits
        const habitsWrap = document.querySelector("[data-habits]");
        if (habitsWrap) {
            habitsWrap.innerHTML = "";
            day.habits.forEach((h, i) => {
                const div = document.createElement("div");
                div.className = "item";
                div.innerHTML = `
          <input type="checkbox" ${h.done ? "checked" : ""} />
          <input type="text" value="${escapeHtml(h.name)}" />
        `;
                const cb = div.querySelector("input[type='checkbox']");
                const tx = div.querySelector("input[type='text']");
                cb.addEventListener("change", () => {
                    day.habits[i].done = cb.checked;
                    saveApp(state);
                });
                tx.addEventListener("input", () => {
                    day.habits[i].name = tx.value;
                    saveApp(state);
                });
                habitsWrap.appendChild(div);
            });
        }

        // note
        const note = document.querySelector("[data-note]");
        if (note) {
            note.value = day.note || "";
            note.addEventListener("input", () => {
                day.note = note.value;
                saveApp(state);
            });
        }

        // reset today
        const reset = document.querySelector("[data-reset-today]");
        if (reset) {
            reset.addEventListener("click", () => {
                state.days[dayKey] = {
                    mood: 3,
                    focus: "Deep work",
                    tasks: ["", "", ""],
                    tasksDone: [false, false, false],
                    habits: day.habits.map(h => ({ name: h.name, done: false })),
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

        const state = loadApp();
        state.days = state.days || {};

        const wrap = document.querySelector("[data-week]");
        if (!wrap) return;

        const now = new Date();
        // старт тижня: понеділок
        const day = (now.getDay() + 6) % 7; // Mon=0
        const monday = new Date(now);
        monday.setDate(now.getDate() - day);

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
            const habitsDone = (data.habits || []).filter(h => h.done).length;
            const habitsTotal = (data.habits || []).length || 0;

            const el = document.createElement("div");
            el.className = "day";
            el.innerHTML = `
        <div class="day__head">
          <div>
            <div class="day__name">${names[i]} <span class="pill ${isToday ? "pill--today" : ""}">${isToday ? "Today" : ""}</span></div>
            <div class="day__date">${key}</div>
          </div>
          <a class="pill" href="app.html">Open</a>
        </div>
        <div class="mini">Tasks: ${tasksDone}/${tasksTotal} • Habits: ${habitsDone}/${habitsTotal}</div>
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

        const state = loadApp();
        const dayKey = ymd();
        state.days = state.days || {};
        state.days[dayKey] = state.days[dayKey] || { habits: [] };
        state.days[dayKey].habits = state.days[dayKey].habits || [];

        const list = document.querySelector("[data-habits-list]");
        const input = document.querySelector("[data-habit-input]");
        const add = document.querySelector("[data-habit-add]");

        function render() {
            list.innerHTML = "";
            state.days[dayKey].habits.forEach((h, i) => {
                const div = document.createElement("div");
                div.className = "item";
                div.innerHTML = `
          <input type="checkbox" ${h.done ? "checked" : ""} />
          <input type="text" value="${escapeHtml(h.name)}" />
          <button class="btn btn--ghost" type="button" data-del="${i}">Remove</button>
        `;
                const cb = div.querySelector("input[type='checkbox']");
                const tx = div.querySelector("input[type='text']");
                const del = div.querySelector("[data-del]");

                cb.addEventListener("change", () => {
                    state.days[dayKey].habits[i].done = cb.checked;
                    saveApp(state);
                });
                tx.addEventListener("input", () => {
                    state.days[dayKey].habits[i].name = tx.value;
                    saveApp(state);
                });
                del.addEventListener("click", () => {
                    state.days[dayKey].habits.splice(i, 1);
                    saveApp(state);
                    render();
                });

                list.appendChild(div);
            });
        }

        add.addEventListener("click", () => {
            const name = (input.value || "").trim();
            if (!name) return;
            state.days[dayKey].habits.push({ name, done: false });
            input.value = "";
            saveApp(state);
            render();
        });

        render();
    }

    function escapeHtml(s) {
        return String(s)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    // init
    const isAppPage = document.body.hasAttribute("data-app");
    if (isAppPage) {
        if (!requireAuth()) return;
        setHeaderMeta();
        bindLogout();
        todayPage();
        weeklyPage();
        habitsPage();
        settingsPage();
    }
})();
