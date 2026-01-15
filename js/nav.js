// js/nav.js
(() => {
  const body = document.body;
  const toggle = document.querySelector("[data-nav-toggle]");
  const drawer = document.querySelector("[data-nav-drawer]");

  if (!toggle || !drawer) return;

  // Make sure aria-controls points to a real id
  const controlsId = toggle.getAttribute("aria-controls");
  if (controlsId && !drawer.id) drawer.id = controlsId;

  // Accessibility defaults
  if (!toggle.getAttribute("aria-label")) toggle.setAttribute("aria-label", "Open menu");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-haspopup", "true");
  drawer.setAttribute("aria-hidden", "true");

  // Prevent focus when closed (supported in modern browsers)
  drawer.setAttribute("inert", "");

  let lastFocused = null;

  const focusableSelector = [
    'a[href]',
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  const isOpen = () => body.classList.contains("nav-open");

  const getFocusable = () =>
      Array.from(drawer.querySelectorAll(focusableSelector)).filter((el) => {
        // ignore hidden elements
        return el instanceof HTMLElement && el.offsetParent !== null;
      });

  const openMenu = () => {
    if (isOpen()) return;

    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    body.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");

    drawer.setAttribute("aria-hidden", "false");
    drawer.removeAttribute("inert");

    // optional scroll lock (приємно на мобілці)
    body.dataset.prevOverflow = body.style.overflow || "";
    body.style.overflow = "hidden";

    // Focus first item in menu
    requestAnimationFrame(() => {
      const items = getFocusable();
      if (items[0]) items[0].focus();
    });
  };

  const closeMenu = (returnFocus = true) => {
    if (!isOpen()) return;

    body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");

    drawer.setAttribute("aria-hidden", "true");
    drawer.setAttribute("inert", "");

    // restore scroll
    body.style.overflow = body.dataset.prevOverflow ?? "";
    delete body.dataset.prevOverflow;

    if (returnFocus) {
      requestAnimationFrame(() => (lastFocused ? lastFocused.focus() : toggle.focus()));
    }

    lastFocused = null;
  };

  const toggleMenu = () => (isOpen() ? closeMenu(true) : openMenu());

  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    toggleMenu();
  });

  // Close on click outside
  document.addEventListener("click", (e) => {
    if (!isOpen()) return;
    const t = e.target;
    if (t instanceof Node && !drawer.contains(t) && !toggle.contains(t)) {
      closeMenu(false);
    }
  });

  // ESC closes + Tab trap inside drawer
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
      return;
    }

    if (e.key !== "Tab") return;

    const items = getFocusable();
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      if (active === first || !drawer.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // If user rotates / resizes to desktop — close menu
  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 769px)").matches) {
      closeMenu(false);
    }
  });
})();
