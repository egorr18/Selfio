window.Selfio = window.Selfio || {};

(function () {
    const KEY = "selfio_app_v1"; // якщо в тебе інший ключ — скажеш, я піджену

    function mode() {
        return (window.Selfio.config?.mode || "demo");
    }

    function setMode(m) {
        localStorage.setItem("selfio_mode", m);
        window.Selfio.config.mode = m;
    }

    function localLoad() {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    }

    function localSave(state) {
        localStorage.setItem(KEY, JSON.stringify(state || {}));
    }

    async function load() {
        const m = mode();

        if (m === "cloud") {
            const cloudState = await window.Selfio.cloud.loadState();
            // якщо в хмарі пусто — не ламаємо demo
            return cloudState ?? localLoad();
        }

        // local backend (docker) — підключимо коли додамо /state
        if (m === "local") {
            return localLoad(); // тимчасово
        }

        return localLoad();
    }

    async function save(state) {
        const m = mode();

        // завжди зберігаємо локально (щоб не втрачати дані)
        localSave(state);

        if (m === "cloud") {
            await window.Selfio.cloud.saveState(state);
        }

        // local backend (docker) — потім додамо api save
    }

    window.Selfio.store = { mode, setMode, load, save, localLoad, localSave };
})();
