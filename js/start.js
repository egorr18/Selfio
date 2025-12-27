document.addEventListener("DOMContentLoaded", () => {
    const btn = document.querySelector(".start-btn");
    const emailInput = document.querySelector("input[type='email']");

    if (!btn || !emailInput) return;

    btn.addEventListener("click", () => {
        const email = emailInput.value.trim();

        if (!email) {
            alert("Enter your email");
            return;
        }

        localStorage.setItem("prefill_email", email);

        // редірект на signin
        window.location.href = "/pages/signin.html";
    });
});
