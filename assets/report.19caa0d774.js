/* Jake Liu — Annual Report 2026.
   Progressive enhancement only: every page reads fully without this file. */
(() => {
  "use strict";
  const doc = document;
  const calm = matchMedia("(prefers-reduced-motion: no-preference)");

  /* Footnotes: open the note's text and source in a popover next to the number.
     Without popover support the superscript stays a plain link to the Notes list. */
  if (Object.prototype.hasOwnProperty.call(HTMLElement.prototype, "popover")) {
    const pop = doc.createElement("div");
    pop.className = "fn-pop";
    pop.setAttribute("popover", "auto");
    pop.setAttribute("role", "dialog");
    pop.tabIndex = -1;
    doc.body.append(pop);
    let trigger = null;
    let restoreFocus = false;

    const place = () => {
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const vw = doc.documentElement.clientWidth;
      const vh = innerHeight;
      const w = pop.offsetWidth;
      const h = pop.offsetHeight;
      const left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12);
      let top = r.bottom + 10;
      if (top + h > vh - 12) top = Math.max(12, r.top - h - 10);
      pop.style.left = `${left}px`;
      pop.style.top = `${top}px`;
    };

    doc.addEventListener("click", (event) => {
      const link = event.target.closest("sup.fn a");
      if (!link) return;
      const note = doc.getElementById(link.hash.slice(1));
      if (!note) return;
      event.preventDefault();
      if (pop.matches(":popover-open") && trigger === link) {
        pop.hidePopover();
        return;
      }
      const n = link.dataset.note;
      const label = doc.createElement("span");
      label.className = "fn-pop__n";
      label.textContent = `Note ${n}`;
      const all = doc.createElement("a");
      all.className = "fn-pop__all";
      all.href = link.hash;
      all.textContent = `Go to note ${n} in the list`;
      all.addEventListener("click", () => pop.hidePopover());
      const parts = [".note__text", ".note__source", ".note__evidence"]
        .map((sel) => note.querySelector(sel))
        .filter(Boolean)
        .map((el) => el.cloneNode(true));
      pop.replaceChildren(label, ...parts, all);
      pop.setAttribute("aria-label", `Note ${n}`);
      if (pop.matches(":popover-open")) pop.hidePopover();
      trigger = link;
      pop.showPopover();
      place();
      pop.focus({ preventScroll: true });
    });

    pop.addEventListener("beforetoggle", (event) => {
      if (event.newState === "closed") restoreFocus = pop.contains(doc.activeElement);
    });
    pop.addEventListener("toggle", (event) => {
      if (event.newState !== "closed") return;
      if (restoreFocus && trigger) trigger.focus({ preventScroll: true });
      trigger = null;
    });
    addEventListener("resize", place, { passive: true });
    addEventListener("scroll", place, { passive: true });
  }

  /* Copy the email address. */
  for (const button of doc.querySelectorAll("button.copy[data-copy]")) {
    if (!navigator.clipboard) continue;
    const status = button.nextElementSibling;
    button.hidden = false;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        status.textContent = "Copied";
      } catch {
        status.textContent = "Couldn't copy";
      }
      setTimeout(() => { status.textContent = ""; }, 2200);
    });
  }

  /* Print, which the print stylesheet turns into a clean report. */
  for (const button of doc.querySelectorAll("button.print")) {
    button.hidden = false;
    button.addEventListener("click", () => print());
  }

  /* Sortable index table. */
  for (const table of doc.querySelectorAll("table[data-sortable]")) {
    const heads = [...table.tHead.rows[0].cells];
    const body = table.tBodies[0];
    [...body.rows].forEach((row, i) => { row.style.viewTransitionName = `index-row-${i}`; });
    heads.forEach((th, col) => {
      if (!th.dataset.sort) return;
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent = th.textContent.trim();
      th.replaceChildren(button);
      button.addEventListener("click", () => {
        const ascending = th.getAttribute("aria-sort") !== "ascending";
        for (const h of heads) h.removeAttribute("aria-sort");
        th.setAttribute("aria-sort", ascending ? "ascending" : "descending");
        const key = (row) => (row.cells[col].dataset.value ?? row.cells[col].textContent).trim();
        const rows = [...body.rows].sort(
          (a, b) => key(a).localeCompare(key(b), "en", { numeric: true }) * (ascending ? 1 : -1),
        );
        const apply = () => body.append(...rows);
        if (doc.startViewTransition && calm.matches) doc.startViewTransition(apply);
        else apply();
      });
    });
  }

  /* Running head: name the section being read in the masthead. */
  const running = doc.querySelector("[data-section]");
  const folios = doc.querySelectorAll("[data-folio]");
  if (running && folios.length && "IntersectionObserver" in window) {
    const seen = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const folio = entry.target.dataset.folio;
        const on = folio !== "Cover";
        running.textContent = on ? folio : "";
        running.classList.toggle("is-on", on);
      }
    }, { rootMargin: "-40% 0px -55% 0px" });
    folios.forEach((el) => seen.observe(el));
  }
})();
