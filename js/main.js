const savedEmail = localStorage.getItem("prefill_email");
if (savedEmail) {
  const emailInput = document.querySelector("input[type='email']");
  if (emailInput) emailInput.value = savedEmail;
}

// Animations (залишаємо як є)
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


// Pricing toggle (залишаємо)
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

// AUTH LOGIN (ОСЬ ТУТ FETCH)
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.querySelector("input[type='email']").value;
    const password = document.querySelector("input[type='password']").value;

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      // 🔑 ОЦЕ КЛЮЧОВЕ
      const contentType = res.headers.get("content-type");
      let data = {};

      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      }

      if (!res.ok) {
        alert(data.error || "Invalid email or password");
        return;
      }

      // ✅ УСПІШНИЙ LOGIN
      localStorage.setItem("token", data.token);

      alert("Login successful");

      // 👉 редірект ПІСЛЯ успіху
      window.location.href = "/pages/community.html";

    } catch (err) {
      console.error("Network error:", err);
      alert("Backend is not reachable");
    }
  });
});
