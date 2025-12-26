// ===============================
// Prefill email (UI helper only)
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const savedEmail = localStorage.getItem("prefill_email");
  if (savedEmail) {
    const emailInput = document.querySelector("input[type='email']");
    if (emailInput) emailInput.value = savedEmail;
  }
});


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
