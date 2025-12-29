document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

    const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const API_BASE_URL = isLocal ? (location.port === "8080" ? "" : "http://localhost:8080")
        : "https://selfio-backend.onrender.com";

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

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = form.querySelector("input[type='email']")?.value.trim() || "";
        const password = form.querySelector("input[type='password']")?.value || "";

        if (!email || !password) {
            alert("Enter email and password");
            return;
        }

        try {
            // 1) try register
            let res = await post("/auth/register", { email, password });

            // if user exists -> login
            if (res.status === 409) {
                res = await post("/auth/login", { email, password });
            }

            const data = await readBody(res);

            if (!res.ok) {
                alert(data.error || data.message || "Request failed");
                return;
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("prefill_email", email);

            // signin.html is inside /pages, so relative redirect works in both localhost + GitHub Pages
            window.location.href = "community.html";
        } catch (err) {
            console.error(err);
            alert("Backend is not reachable");
        }
    });
});
