document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".start-trial__form");
    if (!form) return;

    const isLocal =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1";

    // якщо відкрито з бекенда (localhost:8080) — можна слати відносно "/auth/..."
    const isServedByBackend = isLocal && location.port === "8080";

    const API_BASE_URL = isServedByBackend
        ? "" // same-origin
        : (isLocal ? "http://localhost:8080" : "https://selfio-backend.onrender.com");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = form.querySelector("input[type='email']").value.trim();
        const password = form.querySelector("input[type='password']").value;

        if (!email || !password) {
            alert("Fill email and password");
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const contentType = res.headers.get("content-type") || "";
            const data = contentType.includes("application/json") ? await res.json() : {};

            if (!res.ok) {
                alert(data.error || "Registration failed");
                return;
            }

            // для автопідстановки email на signin
            localStorage.setItem("prefill_email", email);

            alert("Account created! Now sign in.");
            window.location.href = "/pages/signin.html";

        } catch (err) {
            console.error(err);
            alert("Backend is not reachable");
        }
    });
});
