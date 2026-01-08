document.addEventListener("DOMContentLoaded", () => {
    const labels = Array.from(document.querySelectorAll(".toggle-label[data-period]"));
    const prices = Array.from(document.querySelectorAll(".price"));
    const switchEl = document.querySelector(".toggle-switch");

    function setPeriod(period) {
        labels.forEach((l) => l.classList.toggle("active", l.getAttribute("data-period") === period));
        prices.forEach((p) => {
            const v = p.getAttribute(`data-${period}`);
            if (v != null) p.textContent = `$${v}`;
        });

        if (switchEl) switchEl.classList.toggle("yearly", period === "yearly");
    }

    labels.forEach((l) => l.addEventListener("click", () => setPeriod(l.getAttribute("data-period"))));

    const startPeriod =
        labels.find((l) => l.classList.contains("active"))?.getAttribute("data-period") || "monthly";
    setPeriod(startPeriod);
});
