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

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.querySelector("input[type='email']").value;
    const password = document.querySelector("input[type='password']").value;

    try {
      const res = await fetch("http://localhost:8080/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
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

