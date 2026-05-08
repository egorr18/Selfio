const initializeHabitForm = () => {
  const form = document.querySelector(".habit-form");

  if (!form) {
    return;
  }

  const title = form.querySelector("[name='Title']");
  const description = form.querySelector("[name='Description']");
  const icon = form.querySelector("[name='Icon']");
  const color = form.querySelector("[name='Color']");
  const priority = form.querySelector("[name='Priority']");

  document.querySelectorAll(".template-card").forEach((button) => {
    button.addEventListener("click", () => {
      if (title) title.value = button.dataset.title || "";
      if (description) description.value = button.dataset.description || "";
      if (icon) icon.value = button.dataset.icon || "";
      if (color) color.value = button.dataset.color || "";
      if (priority) priority.value = button.dataset.priority || "2";

      document.querySelectorAll(".template-card").forEach((item) => item.classList.remove("is-selected"));
      button.classList.add("is-selected");
    });
  });

  document.querySelectorAll(".color-dot").forEach((button) => {
    button.addEventListener("click", () => {
      if (color) {
        color.value = button.dataset.color || "";
      }
    });
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeHabitForm);
} else {
  initializeHabitForm();
}
