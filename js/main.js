// ======================================
// MAIN.JS — UI + AUTH (FINAL VERSION)
// ======================================

document.addEventListener("DOMContentLoaded", () => {

  // ===============================
  // Prefill email (from start page)
  // ===============================
  const savedEmail = localStorage.getItem("prefill_email");
  if (savedEmail) {
    const emailInput = document.querySelector("input[type='email']");
    if (emailInput) emailInput.value = savedEmail;
  }


  // ===============================
  // Intersection Observer animations
  // ===============================
  const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.15 }
  );

  document.querySelectorAll("section.animate").forEach(section => {
    observer.observe(section);
  });


  // ===============================
  // Pricing toggle logic
  // ===============================
  const toggle = document.querySelector(".toggle-switch");
  const labels = document.querySelectorAll(".toggle-label");
  const prices = document.querySelectorAll(".price");

  if (toggle) {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("yearly");

      const isYearly = toggle.classList.contains("yearly");

      labels.forEach(label => {
        label.classList.toggle(
            "active",
            label.dataset.period === (isYearly ? "yearly" : "monthly")
        );
      });

      prices.forEach(price => {
        price.textContent = `$${isYearly ? price.dataset.yearly : price.dataset.monthly}`;
      });
    });
  }


  // ===============================
  // AUTH LOGIN (signin.html only)
  // ===============================
  const form = document.querySelector("form");
  if (!form) return; // якщо не signin.html — нічого не робимо

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.querySelector("input[type='email']").value.trim();
    const password = document.querySelector("input[type='password']").value;

    if (!email || !password) {
      alert("Email and password are required");
      return;
    }

    // зберігаємо email для автозаповнення
    localStorage.setItem("prefill_email", email);

    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      let data = {};
      const contentType = res.headers.get("content-type");

      // безпечний парсинг
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      }

      if (!res.ok) {
        alert(data.error || "Invalid email or password");
        return;
      }

      // SUCCESS
      localStorage.setItem("token", data.token);

      alert("Login successful");

      // редірект після успіху
      window.location.href = "/pages/community.html";

    } catch (err) {
      console.error("Network error:", err);
      alert("Backend is not reachable");
    }
  });

});
