/* Optional. The page is readable with this file blocked. */
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce && "IntersectionObserver" in window) {
    document.documentElement.classList.add("motion");
    const nodes = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    nodes.forEach((el) => io.observe(el));
    window.setTimeout(() => {
      nodes.forEach((el) => el.classList.add("is-in"));
    }, 1600);
  }

  document.querySelectorAll(".nav--drawer a").forEach((link) => {
    link.addEventListener("click", () => {
      const menu = link.closest("details");
      if (menu) menu.open = false;
    });
  });

  document.querySelectorAll("button[data-copy]").forEach((button) => {
    const clipboard = navigator.clipboard;
    if (!clipboard || !clipboard.writeText) return;
    const status = button.parentElement.querySelector("[data-copy-status]");
    button.hidden = false;
    button.addEventListener("click", async () => {
      try {
        await clipboard.writeText(button.dataset.copy || "");
        if (status) status.textContent = "Copied";
      } catch {
        if (status) status.textContent = "Could not copy";
      }
      window.setTimeout(() => {
        if (status) status.textContent = "";
      }, 2000);
    });
  });
})();
