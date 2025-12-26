// API BASE URL (env-based logic)
const API_BASE_URL =
  window.location.hostname === "localhost"
    window.location.hostname === "127.0.0.1"
    ? "http://localhost:8080"
    : "https://selfio-backend.onrender.com"; // 🔁 пізніше заміниш на реальний backend URL


// Intersection Observer animations
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


// Pricing toggle logic
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


// AUTH LOGIN
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
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });
// API BASE URL (LOCAL ONLY)
const API_BASE_URL = "http://localhost:8080";

// Intersection Observer
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

// Pricing toggle
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

// AUTH LOGIN
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.querySelector("input[type='email']").value.trim();
    const password = document.querySelector("input[type='password']").value.trim();

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      console.log("Login response:", data);

      if (!res.ok) {
        alert(data.error || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      alert("Login successful");
    } catch (err) {
      console.error("Fetch error:", err);
      alert("Server error");
    }
  });
});

      const data = await res.json();
      console.log("Login response:", data);

      if (data.token) {
        localStorage.setItem("token", data.token);
        alert("Login successful");
      } else {
        alert(data.error || "Login failed");
      }
    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  });
});
