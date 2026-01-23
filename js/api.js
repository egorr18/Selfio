// js/api.js
(() => {
    const isGitHubPages = location.hostname.endsWith("github.io");
    const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";

    const DEFAULT_BASE = isGitHubPages
        ? "https://selfio-backend.onrender.com"
        : (isLocalhost ? "http://localhost:8080" : "https://selfio-backend.onrender.com");

    const API_BASE = window.SELFIO_API_BASE || DEFAULT_BASE;

    function ensureToastEl() {
        let el = document.getElementById("selfio-toast");
        if (el) return el;
        el = document.createElement("div");
        el.id = "selfio-toast";
        el.className = "selfio-toast selfio-toast--hidden";
        document.body.appendChild(el);
        return el;
    }

    let toastTimer = null;
    function toast(message, type = "info", ms = 2200) {
        const el = ensureToastEl();
        el.textContent = String(message || "");
        el.dataset.type = type;
        el.classList.remove("selfio-toast--hidden");
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.add("selfio-toast--hidden"), ms);
    }

    function setLoading(btn, loading, text = "Loading...") {
        if (!btn) return;
        if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
        btn.disabled = !!loading;
        btn.textContent = loading ? text : btn.dataset.originalText;
        btn.setAttribute("aria-busy", loading ? "true" : "false");
    }

    async function readBody(res) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
            try { return await res.json(); } catch { return {}; }
        }
        const text = await res.text().catch(() => "");
        return text ? { message: text } : {};
    }

    async function apiFetch(path, opts = {}) {
        const {
            method = "GET",
            body,
            token,
            headers = {},
            timeoutMs = 12000,
        } = opts;

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), timeoutMs);

        try {
            const res = await fetch(`${API_BASE}${path}`, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...headers,
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
                cache: "no-store",
                signal: ctrl.signal,
            });

            const data = await readBody(res);
            return { ok: res.ok, status: res.status, data };
        } catch (err) {
            const isTimeout = err?.name === "AbortError";
            return {
                ok: false,
                status: 0,
                data: {
                    error: isTimeout ? "timeout" : "network_error",
                    message: isTimeout ? "Request timeout" : "Network error",
                },
            };
        } finally {
            clearTimeout(t);
        }
    }

    // ✅ НЕ перезатираємо window.Selfio повністю
    window.Selfio = window.Selfio || {};
    window.Selfio.API_BASE = API_BASE;
    window.Selfio.apiFetch = apiFetch;
    window.Selfio.toast = toast;
    window.Selfio.setLoading = setLoading;
})();
