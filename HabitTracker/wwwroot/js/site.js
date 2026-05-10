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
  const frequency = form.querySelector("[name='Frequency']");
  const id = form.querySelector("[name='Id']");
  const isNewHabit = !id?.value;
  const preferences = readHabitPreferences();

  if (preferences && isNewHabit) {
    if (frequency) frequency.value = preferences.defaultFrequency || "1";
    if (priority) priority.value = preferences.defaultPriority || "2";
    if (color && !color.value) color.value = preferences.defaultColor || "";
    if (icon && !icon.value) icon.value = preferences.defaultIcon || "";
  }

  document.querySelectorAll(".template-card").forEach((button) => {
    button.addEventListener("click", () => {
      if (title) title.value = button.dataset.title || "";
      if (description) description.value = button.dataset.description || "";
      if (icon) icon.value = button.dataset.icon || "";
      if (color) color.value = button.dataset.color || "";
      if (priority) priority.value = button.dataset.priority || "2";
      if (frequency && !frequency.value) frequency.value = preferences?.defaultFrequency || "1";

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

const readHabitPreferences = () => {
  try {
    return JSON.parse(localStorage.getItem("habitTrackerHabitPreferences") || "null");
  } catch {
    return null;
  }
};

const initializeHabitPreferences = () => {
  const form = document.querySelector("[data-habit-preferences-form]");

  if (!form) {
    return;
  }

  const status = document.querySelector("[data-preference-status]");
  const preferences = readHabitPreferences() || {
    defaultFrequency: "1",
    defaultPriority: "2",
    defaultColor: "#2f6f5e",
    defaultIcon: "H",
  };

  form.defaultFrequency.value = preferences.defaultFrequency || "1";
  form.defaultPriority.value = preferences.defaultPriority || "2";
  form.defaultColor.value = preferences.defaultColor || "#2f6f5e";
  form.defaultIcon.value = preferences.defaultIcon || "H";

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const nextPreferences = {
      defaultFrequency: form.defaultFrequency.value || "1",
      defaultPriority: form.defaultPriority.value || "2",
      defaultColor: form.defaultColor.value.trim() || "#2f6f5e",
      defaultIcon: form.defaultIcon.value.trim() || "H",
    };

    localStorage.setItem("habitTrackerHabitPreferences", JSON.stringify(nextPreferences));

    if (status) {
      status.textContent = "Параметри збережено.";
    }
  });
};

const initializeProfileTabs = () => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");

  if (!tab) {
    return;
  }

  const tabButton = document.querySelector(`[data-bs-target="#${tab}"]`);

  if (tabButton && window.bootstrap?.Tab) {
    window.bootstrap.Tab.getOrCreateInstance(tabButton).show();
  }
};

const initializeThemeControls = () => {
  const toggle = document.querySelector("[data-theme-toggle]");
  const text = document.querySelector(".theme-toggle-text");
  const icon = document.querySelector(".theme-toggle-icon");
  const choices = document.querySelectorAll("[data-theme-choice]");

  const applyTheme = (theme) => {
    const nextTheme = theme === "light" ? "light" : "dark";

    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("habitTrackerTheme", nextTheme);

    if (text) {
      text.textContent = nextTheme === "dark" ? "Темна" : "Світла";
    }

    if (icon) {
      icon.textContent = nextTheme === "dark" ? "●" : "○";
    }

    choices.forEach((choice) => {
      const isActive = choice.dataset.themeChoice === nextTheme;
      choice.classList.toggle("is-selected", isActive);
      choice.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  applyTheme(localStorage.getItem("habitTrackerTheme") || "dark");

  if (toggle) {
    toggle.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  }

  choices.forEach((choice) => {
    choice.addEventListener("click", () => {
      applyTheme(choice.dataset.themeChoice);
    });
  });
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initializeThemeControls();
    initializeHabitPreferences();
    initializeProfileTabs();
    initializeHabitForm();
  });
} else {
  initializeThemeControls();
  initializeHabitPreferences();
  initializeProfileTabs();
  initializeHabitForm();
}
