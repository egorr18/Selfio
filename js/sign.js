document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".auth__form");
    if (!form) return;

    const savedEmail = localStorage.getItem("prefill_email");
    if (savedEmail) {
        const emailInput = form.querySelector("input[type='email']");
        if (emailInput) emailInput.value = savedEmail;
    }

    const isLocal =
        location.hostname === "localhost" ||
        location.hostname === "127.0.0.1";

    const isServedByBackend = isLocal && location.port === "8080";

    const API_BASE_URL = isServedByBackend
        ? ""
        : (isLocal ? "http://localhost:8080" : "https://selfio-backend.onrender.com");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = form.querySelector("input[type='email']").value.trim();
        const password = form.querySelector("input[type='password']").value;

        try {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const contentType = res.headers.get("content-type") || "";
            const data = contentType.includes("application/json") ? await res.json() : {};

            if (!res.ok) {
                alert(data.error || "Invalid email or password");
                return;
            }

            localStorage.setItem("token", data.token);

            alert("Login successful");
            window.location.href = "/pages/community.html";

        } catch (err) {
            console.error(err);
            alert("Backend is not reachable");
        }
    });
});
