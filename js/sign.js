document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

    // plan з URL: signin.html?plan=free|pro|premium
    const plan = new URLSearchParams(location.search).get("plan");
    if (plan) localStorage.setItem("selfio_plan", plan);

    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const isServedByBackend = isLocal && location.port === "8080";

    const API_BASE_URL = isServedByBackend
        ? "" // same-origin (коли відкриваєш через localhost:8080)
        : (isLocal ? "http://localhost:8080" : "https://selfio-backend.onrender.com");

    const post = (path, body) =>
        fetch(`${API_BASE_URL}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

    const readBody = async (res) => {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) return res.json();
        const text = await res.text();
        return text ? { message: text } : {};
    };

    let submitting = false;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (submitting) return;
        submitting = true;

        const btn = form.querySelector("button[type='submit']");
        if (btn) btn.disabled = true;

        const email = form.querySelector("input[type='email']")?.value.trim() || "";
        const password = form.querySelector("input[type='password']")?.value || "";

        try {
            if (!email || !password) {
                alert("Enter email and password");
                return;
            }

            // 1) register
            const reg = await post("/auth/register", { email, password });

            // якщо реєстрація НЕ ок і НЕ 409 → показуємо помилку
            if (!(reg.ok || reg.status === 409)) {
                const data = await readBody(reg);
                alert(data.error || data.message || `Register failed: ${reg.status}`);
                return;
            }

            // 2) login (завжди)
            const login = await post("/auth/login", { email, password });
            const data = await readBody(login);

            if (!login.ok) {
                alert(data.error || data.message || `Login failed: ${login.status}`);
                return;
            }

            localStorage.setItem("selfio_token", data.token); // або data.accessToken — як у тебе
            localStorage.setItem("selfio_email", email);

            // pages/signin.html -> pages/community.html
            window.location.href = "app.html";
        } catch (err) {
            console.error(err);
            alert("Backend is not reachable");
        } finally {
            submitting = false;
            if (btn) btn.disabled = false;
        }
    });
});
