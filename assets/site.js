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

  loadPerformance();

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

  function loadPerformance() {
    const root = document.querySelector("[data-performance]");
    if (!root) return;
    fetch("/data/daily.json", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        const series = normalize(payload);
        if (!series.length) return;
        draw(root, series);
        root.hidden = false;
      })
      .catch(() => {});
  }

  function normalize(payload) {
    if (!Array.isArray(payload)) return [];
    const rows = [];
    for (const row of payload) {
      if (!row || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
      const pnl = Number(row.net_pnl_usd);
      const trades = Number(row.settled_trades);
      if (!Number.isFinite(pnl) || !Number.isFinite(trades)) continue;
      rows.push({ date: row.date, net_pnl_usd: pnl, settled_trades: trades });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  }

  function withEquity(series) {
    let cum = 0;
    let peak = 0;
    return series.map((row) => {
      cum += row.net_pnl_usd;
      if (cum > peak) peak = cum;
      return { ...row, cum, peak, dd: peak - cum };
    });
  }

  function weeksOf(series) {
    const groups = new Map();
    for (const row of series) {
      const key = weekStart(row.date);
      const cur = groups.get(key) || { start: key, net_pnl_usd: 0, settled_trades: 0 };
      cur.net_pnl_usd += row.net_pnl_usd;
      cur.settled_trades += row.settled_trades;
      groups.set(key, cur);
    }
    return [...groups.values()];
  }

  function weekStart(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = dt.getUTCDay();
    dt.setUTCDate(dt.getUTCDate() - (day === 0 ? 6 : day - 1));
    return dt.toISOString().slice(0, 10);
  }

  function money(n) {
    const sign = n < 0 ? "−" : n > 0 ? "+" : "";
    const abs = Math.abs(n);
    const digits = abs >= 1000 ? 0 : 2;
    return sign + "$" + abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }

  function draw(root, series) {
    const points = withEquity(series);
    const weeks = weeksOf(series);
    const maxDd = points.reduce((m, p) => Math.max(m, p.dd), 0);
    const net = points.length ? points[points.length - 1].cum : 0;
    const trades = series.reduce((s, r) => s + r.settled_trades, 0);
    const upDays = series.filter((r) => r.net_pnl_usd > 0).length;
    const strip = root.querySelector("[data-strip]");
    strip.replaceChildren(
      stat("Net P&L", money(net)),
      stat("Settled trades", trades.toLocaleString("en-US")),
      stat("Drawdown, daily closes", money(maxDd).replace(/^\+/, "")),
      stat("Profitable days", upDays + " of " + series.length),
    );
    root.querySelector("[data-equity]").replaceChildren(equitySvg(points));
    const weekly = root.querySelector("[data-weekly]");
    const tip = root.querySelector("[data-tip]");
    weekly.replaceChildren(weeklyBars(weeks, tip));
  }

  function stat(label, value) {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    wrap.append(dt, dd);
    return wrap;
  }

  function equitySvg(points) {
    const w = 800;
    const h = 320;
    const pad = { l: 56, r: 16, t: 16, b: 28 };
    const vals = points.flatMap((p) => [p.cum, p.peak, 0]);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (lo === hi) { lo -= 1; hi += 1; }
    const x = (i) => pad.l + (points.length === 1 ? (w - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (w - pad.l - pad.r));
    const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b);
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("role", "img");
    const last = points[points.length - 1];
    const maxDd = points.reduce((m, p) => Math.max(m, p.dd), 0);
    svg.setAttribute("aria-label", "Cumulative net P&L ending at " + money(last.cum) + ". Largest drawdown on daily closes " + money(maxDd) + ".");
    const shade = document.createElementNS(ns, "path");
    let d = "M " + x(0) + " " + y(points[0].peak);
    for (let i = 1; i < points.length; i++) d += " L " + x(i) + " " + y(points[i].peak);
    for (let i = points.length - 1; i >= 0; i--) d += " L " + x(i) + " " + y(points[i].cum);
    shade.setAttribute("d", d + " Z");
    shade.setAttribute("fill", "rgba(122, 31, 43, 0.16)");
    const zero = document.createElementNS(ns, "line");
    zero.setAttribute("x1", pad.l);
    zero.setAttribute("x2", w - pad.r);
    zero.setAttribute("y1", y(0));
    zero.setAttribute("y2", y(0));
    zero.setAttribute("stroke", "#E0D8CC");
    const line = document.createElementNS(ns, "path");
    let ld = "M " + x(0) + " " + y(points[0].cum);
    for (let i = 1; i < points.length; i++) ld += " L " + x(i) + " " + y(points[i].cum);
    line.setAttribute("d", ld);
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#12110F");
    line.setAttribute("stroke-width", "2");
    svg.append(shade, zero, line);
    return svg;
  }

  function weeklyBars(weeks, tip) {
    const list = document.createElement("div");
    list.className = "bars";
    list.setAttribute("role", "list");
    const max = Math.max(...weeks.map((w) => Math.abs(w.net_pnl_usd)), 1);
    for (const week of weeks) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bar" + (week.net_pnl_usd < 0 ? " is-down" : "");
      btn.style.height = Math.max(2, (Math.abs(week.net_pnl_usd) / max) * 100) + "%";
      btn.setAttribute("role", "listitem");
      const label = "Week of " + week.start + ", " + money(week.net_pnl_usd) + ", " + week.settled_trades.toLocaleString("en-US") + " settled trades";
      btn.setAttribute("aria-label", label);
      const show = () => {
        tip.hidden = false;
        tip.textContent = label;
        const host = tip.parentElement.getBoundingClientRect();
        const box = btn.getBoundingClientRect();
        tip.style.left = Math.max(0, box.left - host.left) + "px";
        tip.style.top = Math.max(0, box.top - host.top - 46) + "px";
      };
      const hide = () => { tip.hidden = true; tip.textContent = ""; };
      btn.addEventListener("pointerenter", show);
      btn.addEventListener("focus", show);
      btn.addEventListener("pointerleave", hide);
      btn.addEventListener("blur", hide);
      list.append(btn);
    }
    return list;
  }
})();
