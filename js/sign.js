const API_BASE_URL =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
        ? "http://localhost:8080"
        : "https://selfio-backend.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector("form");
    if (!form) return;

    // автопідстановка email
    const savedEmail = localStorage.getItem("prefill_email");
    if (savedEmail) {
        const emailInput = document.querySelector("input[type='email']");
        if (emailInput) emailInput.value = savedEmail;
    }

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.querySelector("input[type='email']").value;
        const password = document.querySelector("input[type='password']").value;

        try {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.error || "Invalid credentials");
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
