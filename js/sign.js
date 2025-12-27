// ===============================
// API BASE URL (auto-detect)
// ===============================
const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

const API_BASE_URL = isLocal
    ? "http://localhost:8080"
    : "https://selfio-backend.onrender.com"; // прод-backend

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

        const email = document.querySelector("input[type='email']")?.value?.trim();
        const password = document.querySelector("input[type='password']")?.value;

        if (!email || !password) {
            alert("Enter email and password");
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            // безпечний парсинг (щоб не падало, якщо відповідь не JSON)
            const contentType = res.headers.get("content-type") || "";
            const data = contentType.includes("application/json")
                ? await res.json()
                : {};

            if (!res.ok) {
                alert(data.error || "Invalid credentials");
                return;
            }

            localStorage.setItem("token", data.token);
            alert("Login successful");

            window.location.href = "/pages/community.html";
        } catch (err) {
            console.error("Network error:", err);
            alert("Backend is not reachable");
        }
    });
});
