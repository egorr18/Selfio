window.Selfio = window.Selfio || {};

(function () {
    const KEY = "selfio_app_v1";

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
        try {
        if (!window.Selfio?.cloud?.loadState) throw new Error("Selfio.cloud not ready");
        const cloudState = await window.Selfio.cloud.loadState();
        return cloudState ?? localLoad();
        } catch (e) {
        console.warn("[Selfio.store] cloud load failed, fallback to local:", e?.message || e);
        return localLoad();
        }
    }

    if (m === "local") return localLoad();
    return localLoad();
    }

    async function save(state) {
    const m = mode();

    localSave(state);

    if (m === "cloud") {
        try {
        if (!window.Selfio?.cloud?.saveState) throw new Error("Selfio.cloud not ready");
        await window.Selfio.cloud.saveState(state);
        } catch (e) {
        console.warn("[Selfio.store] cloud save failed (kept local):", e?.message || e);
        }
    }
    }
})();
