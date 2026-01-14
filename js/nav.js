(() => {
  // ---- active link highlight ----
  const links = document.querySelectorAll(".nav a");
  const currentPage = location.pathname.split("/").pop() || "index.html";

  links.forEach((link) => {
    const href = link.getAttribute("href") || "";
    if ((href.split("/").pop() || "") === currentPage) {
      link.classList.add("is-active");
    }
  });

  // ---- mobile burger menu ----
  const root = document.documentElement;
  const btn = document.querySelector("[data-nav-toggle]");
  const drawer = document.querySelector("[data-nav-drawer]");

  if (!btn || !drawer) return;

  const setExpanded = (v) => btn.setAttribute("aria-expanded", String(v));

  const closeMenu = () => {
    root.classList.remove("nav-open");
    setExpanded(false);
  };

  const openMenu = () => {
    root.classList.add("nav-open");
    setExpanded(true);
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    root.classList.contains("nav-open") ? closeMenu() : openMenu();
  });

  // close on link click
  drawer.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => closeMenu());
  });

  // close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // close when clicking outside
  document.addEventListener("click", (e) => {
    if (!root.classList.contains("nav-open")) return;
    const t = e.target;
    if (drawer.contains(t) || btn.contains(t)) return;
    closeMenu();
  });

  // close when switching to desktop
  const mq = window.matchMedia("(min-width: 769px)");
  mq.addEventListener("change", () => {
    if (mq.matches) closeMenu();
  });
})();
