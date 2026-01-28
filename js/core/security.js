(function () {
  if (!window.trustedTypes) return;
  if (window.trustedTypes.defaultPolicy) return;

  function sanitizeHTML(input) {
    const html = String(input ?? "");
    const t = document.createElement("template");
    t.innerHTML = html;

    t.content.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((n) => n.remove());

    t.content.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const value = String(attr.value ?? "");
        if (name.startsWith("on")) el.removeAttribute(attr.name);
        if ((name === "href" || name === "src" || name === "xlink:href") && /^\s*javascript:/i.test(value)) {
          el.removeAttribute(attr.name);
        }
      }
    });

    return t.innerHTML;
  }

  try {
    window.trustedTypes.createPolicy("default", {
      createHTML: sanitizeHTML,
      createScriptURL: (s) => String(s ?? ""),
      createScript: (s) => String(s ?? ""),
    });

    window.trustedTypes.createPolicy("selfio", {
      createHTML: sanitizeHTML,
      createScriptURL: (s) => String(s ?? ""),
      createScript: (s) => String(s ?? ""),
    });
  } catch {}
})();
