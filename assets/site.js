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
        mount(root, series);
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

  function moneyExact(n) {
    const sign = n < 0 ? "−" : n > 0 ? "+" : "";
    return sign + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function plainMoney(n) {
    return money(n).replace(/^\+/, "");
  }

  function pretty(iso) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [y, m, d] = iso.split("-").map(Number);
    return d + " " + months[m - 1] + " " + y;
  }

  function sliceRange(series, mode) {
    if (mode !== "1m" || !series.length) return series;
    const end = Date.parse(series[series.length - 1].date + "T00:00:00Z");
    const start = end - 30 * 86400000;
    const cut = series.filter((row) => Date.parse(row.date + "T00:00:00Z") >= start);
    return cut.length ? cut : series;
  }

  function mount(root, series) {
    let mode = "all";
    const paint = () => renderRange(root, sliceRange(series, mode), series);
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(paint, 150);
    });
    root.querySelectorAll("[data-range]").forEach((button) => {
      button.addEventListener("click", () => {
        mode = button.dataset.range || "all";
        root.querySelectorAll("[data-range]").forEach((other) => {
          other.setAttribute("aria-pressed", other === button ? "true" : "false");
        });
        paint();
      });
    });
    const tableHost = root.querySelector("[data-table]");
    if (tableHost) tableHost.replaceChildren(dailyTable(withEquity(series)));
    paint();
  }

  function renderRange(root, series, full) {
    const points = withEquity(series);
    const weeks = weeksOf(series);
    const maxDd = points.reduce((m, p) => Math.max(m, p.dd), 0);
    const net = points[points.length - 1].cum;
    const trades = series.reduce((sum, row) => sum + row.settled_trades, 0);
    const upDays = series.filter((row) => row.net_pnl_usd > 0).length;
    const value = root.querySelector("[data-perf-value]");
    const period = root.querySelector("[data-perf-period]");
    if (value) {
      value.textContent = money(net);
      value.classList.toggle("is-down", net < 0);
    }
    if (period) period.textContent = pretty(points[0].date) + " – " + pretty(points[points.length - 1].date);
    root.querySelector("[data-strip]").replaceChildren(
      stat("Net P&L", money(net)),
      stat("Settled trades", trades.toLocaleString("en-US")),
      stat("Drawdown, daily closes", plainMoney(maxDd)),
      stat("Profitable days", upDays + " of " + series.length),
    );
    const underLabel = root.querySelector("[data-under-label]");
    if (underLabel) underLabel.textContent = "Drawdown on daily closes · " + plainMoney(maxDd);
    const frame = frameOf(points);
    const equityHost = root.querySelector("[data-equity]");
    const tip = root.querySelector("[data-tip]");
    equityHost.replaceChildren(equitySvg(points, frame, maxDd));
    root.querySelector("[data-under]").replaceChildren(underSvg(points, frame));
    root.querySelector("[data-weekly]").replaceChildren(weeklySvg(weeks, frame, tip, root));
    bindCrosshair(equityHost, points, frame, tip, root);
    const fullNet = withEquity(full)[full.length - 1].cum;
    equityHost.setAttribute("aria-label", "Cumulative net P&L " + money(net) + " from " + pretty(points[0].date) + " to " + pretty(points[points.length - 1].date) + ". Drawdown on daily closes " + plainMoney(maxDd) + ". Full-window trade-level drawdown " + plainMoney(2462) + ". Full-window net " + money(fullNet) + ".");
    armDraw(root.querySelector("[data-equity] svg"));
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

  const NS = "http://www.w3.org/2000/svg";
  let gradSeq = 0;

  function frameOf(points) {
    const compact = window.matchMedia("(max-width: 700px)").matches;
    const width = compact ? 480 : 800;
    const height = compact ? 300 : 360;
    const pad = compact ? { l: 64, r: 14, t: 42, b: 40 } : { l: 54, r: 20, t: 36, b: 36 };
    const font = compact ? 18 : 13;
    const hi = Math.max(...points.map((p) => p.cum), 0);
    const lo = Math.min(0, ...points.map((p) => p.cum));
    const yMax = Math.max(hi * 1.18, 16000);
    const yMin = lo;
    const t0 = Date.parse(points[0].date + "T00:00:00Z");
    const t1 = Date.parse(points[points.length - 1].date + "T00:00:00Z");
    const xOf = (date) => {
      const t = Date.parse(date + "T00:00:00Z");
      const u = t1 === t0 ? 0.5 : (t - t0) / (t1 - t0);
      return pad.l + u * (width - pad.l - pad.r);
    };
    const yOf = (value) => pad.t + (1 - (value - yMin) / (yMax - yMin || 1)) * (height - pad.t - pad.b);
    return { width, height, pad, yMax, yMin, t0, t1, xOf, yOf, font };
  }

  function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  }

  function equitySvg(points, frame, maxDd) {
    const { width, height, pad, yOf, xOf } = frame;
    const svg = el("svg", { viewBox: "0 0 " + width + " " + height, role: "img", "aria-hidden": "true" });
    const gid = "pnlFill" + (++gradSeq);
    const defs = el("defs", {});
    const grad = el("linearGradient", { id: gid, x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.append(el("stop", { offset: "0%", "stop-color": "#1E5E48", "stop-opacity": "0.28" }));
    grad.append(el("stop", { offset: "100%", "stop-color": "#1E5E48", "stop-opacity": "0" }));
    defs.append(grad);
    svg.append(defs);
    for (const tick of [0, 5000, 10000, 15000]) {
      if (tick > frame.yMax) continue;
      const y = yOf(tick);
      svg.append(el("line", { x1: pad.l, x2: width - pad.r, y1: y, y2: y, stroke: "#E0D8CC", "stroke-width": "1" }));
      const label = el("text", { x: pad.l - 8, y: y + 4, "text-anchor": "end", fill: "#5E584E", "font-family": "Inter, sans-serif", "font-size": frame.font });
      label.textContent = tick === 0 ? "$0" : "$" + tick / 1000 + "K";
      svg.append(label);
    }
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const byMonth = new Map();
    for (const point of points) {
      const key = point.date.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(point);
    }
    for (const [key, group] of byMonth) {
      const mid = group[Math.floor(group.length / 2)];
      const text = el("text", { x: xOf(mid.date), y: height - 12, "text-anchor": "middle", fill: "#5E584E", "font-family": "Inter, sans-serif", "font-size": frame.font });
      text.textContent = months[Number(key.slice(5)) - 1];
      svg.append(text);
    }
    let line = "";
    points.forEach((point, i) => {
      line += (i ? " L " : "M ") + xOf(point.date) + " " + yOf(point.cum);
    });
    const area = el("path", { d: line + " L " + xOf(points[points.length - 1].date) + " " + yOf(0) + " L " + xOf(points[0].date) + " " + yOf(0) + " Z", fill: "url(#" + gid + ")", class: "chart-area" });
    const stroke = el("path", { d: line, fill: "none", stroke: "#1E5E48", "stroke-width": frame.font > 16 ? "4.5" : "2.75", "stroke-linecap": "round", "stroke-linejoin": "round", class: "chart-line" });
    svg.append(area, stroke);
    const last = points[points.length - 1];
    const lx = xOf(last.date);
    const ly = yOf(last.cum);
    svg.append(el("circle", { cx: lx, cy: ly, r: "5.5", fill: "#1E5E48", stroke: "#F4F0E6", "stroke-width": "2" }));
    const endLabel = el("text", { x: lx - 10, y: Math.max(frame.font + 4, ly - 12), "text-anchor": "end", fill: "#1E5E48", "font-family": "Inter, sans-serif", "font-size": frame.font + 1, "font-weight": "600" });
    endLabel.textContent = money(last.cum);
    svg.append(endLabel);
    svg.dataset.maxDd = String(maxDd);
    const hair = el("line", { class: "crosshair", x1: 0, x2: 0, y1: pad.t, y2: height - pad.b, stroke: "#5E584E", "stroke-dasharray": "3 3", visibility: "hidden" });
    const dot = el("circle", { class: "crossdot", r: "4.5", fill: "#F4F0E6", stroke: "#1E5E48", "stroke-width": "2", visibility: "hidden" });
    svg.append(hair, dot);
    return svg;
  }

  function underSvg(points, frame) {
    const height = 92;
    const { width, pad, xOf } = frame;
    const maxDd = Math.max(...points.map((p) => p.dd), 1);
    const yOf = (dd) => 14 + (dd / maxDd) * (height - 28);
    const svg = el("svg", { viewBox: "0 0 " + width + " " + height, role: "img", "aria-hidden": "true" });
    svg.append(el("line", { x1: pad.l, x2: width - pad.r, y1: yOf(0), y2: yOf(0), stroke: "#E0D8CC" }));
    let d = "M " + xOf(points[0].date) + " " + yOf(points[0].dd);
    for (let i = 1; i < points.length; i++) d += " L " + xOf(points[i].date) + " " + yOf(points[i].dd);
    svg.append(el("path", { d: d + " L " + xOf(points[points.length - 1].date) + " " + yOf(0) + " L " + xOf(points[0].date) + " " + yOf(0) + " Z", fill: "rgba(122, 31, 43, 0.16)" }));
    svg.append(el("path", { d, fill: "none", stroke: "#7A1F2B", "stroke-width": "1.75", "stroke-linejoin": "round" }));
    return svg;
  }

  function weeklySvg(weeks, frame, tip, root) {
    const height = 148;
    const { width, pad, xOf, t0, t1 } = frame;
    const svg = el("svg", { viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": "Weekly settled net P&L" });
    const maxAbs = Math.max(...weeks.map((week) => Math.abs(week.net_pnl_usd)), 1);
    const yOf = (value) => {
      const mid = 18 + (height - 36) / 2;
      return mid - (value / maxAbs) * ((height - 36) / 2);
    };
    svg.append(el("line", { x1: pad.l, x2: width - pad.r, y1: yOf(0), y2: yOf(0), stroke: "#E0D8CC" }));
    const span = Math.max(t1 - t0, 1);
    const weekWidth = Math.max(8, Math.min(34, ((7 * 86400000) / span) * (width - pad.l - pad.r) * 0.62));
    for (const week of weeks) {
      const midDate = weekMid(week.start);
      const x = xOf(midDate) - weekWidth / 2;
      const y = Math.min(yOf(week.net_pnl_usd), yOf(0));
      const h = Math.max(2, Math.abs(yOf(week.net_pnl_usd) - yOf(0)));
      const rect = el("rect", {
        x, y, width: weekWidth, height: h, rx: "4",
        fill: week.net_pnl_usd < 0 ? "#7A1F2B" : "#1E5E48",
        tabindex: "0", role: "button",
      });
      const label = "Week of " + pretty(week.start) + ". Net " + moneyExact(week.net_pnl_usd) + ". " + week.settled_trades.toLocaleString("en-US") + " settled trades.";
      rect.setAttribute("aria-label", label);
      const show = (event) => placeTip(tip, root, event.currentTarget, label);
      rect.addEventListener("pointerenter", show);
      rect.addEventListener("focus", show);
      rect.addEventListener("pointerleave", () => { tip.hidden = true; });
      rect.addEventListener("blur", () => { tip.hidden = true; });
      svg.append(rect);
    }
    return svg;
  }

  function weekMid(start) {
    const dt = new Date(Date.parse(start + "T00:00:00Z") + 3 * 86400000);
    return dt.toISOString().slice(0, 10);
  }

  function bindCrosshair(host, points, frame, tip, root) {
    const svg = host.querySelector("svg");
    const hair = svg.querySelector(".crosshair");
    const dot = svg.querySelector(".crossdot");
    let index = points.length - 1;
    const show = (clientX) => {
      const box = svg.getBoundingClientRect();
      const rel = ((clientX - box.left) / box.width) * frame.width;
      let best = 0;
      let dist = Infinity;
      points.forEach((point, i) => {
        const dx = Math.abs(frame.xOf(point.date) - rel);
        if (dx < dist) { dist = dx; best = i; }
      });
      index = best;
      const point = points[best];
      const x = frame.xOf(point.date);
      const y = frame.yOf(point.cum);
      hair.setAttribute("x1", x);
      hair.setAttribute("x2", x);
      hair.setAttribute("visibility", "visible");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.setAttribute("visibility", "visible");
      const text = pretty(point.date) + "\nDaily " + moneyExact(point.net_pnl_usd) + "\nCumulative " + moneyExact(point.cum);
      placeTip(tip, root, svg, text, (x / frame.width) * box.width, (y / frame.height) * box.height);
    };
    host.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      show(event.clientX);
    });
    host.addEventListener("pointerdown", (event) => show(event.clientX));
    host.addEventListener("pointerleave", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      hair.setAttribute("visibility", "hidden");
      dot.setAttribute("visibility", "hidden");
      tip.hidden = true;
    });
    host.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      index = Math.max(0, Math.min(points.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
      const point = points[index];
      const x = frame.xOf(point.date);
      const y = frame.yOf(point.cum);
      hair.setAttribute("x1", x);
      hair.setAttribute("x2", x);
      hair.setAttribute("visibility", "visible");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", y);
      dot.setAttribute("visibility", "visible");
      const box = svg.getBoundingClientRect();
      placeTip(tip, root, svg, pretty(point.date) + "\nDaily " + moneyExact(point.net_pnl_usd) + "\nCumulative " + moneyExact(point.cum), (x / frame.width) * box.width, (y / frame.height) * box.height);
    });
  }

  function placeTip(tip, root, anchor, text, localX, localY) {
    tip.hidden = false;
    tip.textContent = text;
    const stack = root.querySelector(".chart-stack");
    const host = (stack || tip.parentElement).getBoundingClientRect();
    const box = anchor.getBoundingClientRect();
    const x = localX == null ? box.left - host.left : box.left - host.left + localX;
    const y = localY == null ? box.top - host.top - tip.offsetHeight - 8 : box.top - host.top + localY - tip.offsetHeight - 12;
    const width = tip.offsetWidth || 160;
    tip.style.left = Math.max(8, Math.min(x - width / 2, host.width - width - 8)) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }

  function armDraw(svg) {
    if (!svg) return;
    svg.classList.add("is-drawn");
    const line = svg.querySelector(".chart-line");
    if (!line || reduce) return;
    const length = line.getTotalLength();
    if (!length) return;
    line.style.transition = "none";
    line.style.strokeDasharray = String(length);
    line.style.strokeDashoffset = String(length);
    const reveal = () => {
      line.style.transition = "stroke-dashoffset 1.15s cubic-bezier(0.16, 1, 0.3, 1)";
      line.style.strokeDashoffset = "0";
    };
    requestAnimationFrame(reveal);
    window.setTimeout(() => {
      line.style.transition = "none";
      line.style.strokeDashoffset = "0";
    }, 1400);
  }

  function dailyTable(points) {
    const table = document.createElement("table");
    table.className = "perf-table";
    const caption = document.createElement("caption");
    caption.textContent = "Daily settled P&L and the cumulative total. Drawdown in the chart is measured on these daily closes.";
    const head = document.createElement("thead");
    head.innerHTML = "<tr><th scope=\"col\">Date</th><th scope=\"col\">Daily P&L</th><th scope=\"col\">Cumulative</th><th scope=\"col\">Settled trades</th></tr>";
    const body = document.createElement("tbody");
    for (const point of points) {
      const tr = document.createElement("tr");
      const cells = [pretty(point.date), moneyExact(point.net_pnl_usd), moneyExact(point.cum), point.settled_trades.toLocaleString("en-US")];
      cells.forEach((text, i) => {
        const cell = document.createElement(i ? "td" : "th");
        if (!i) cell.scope = "row";
        cell.textContent = text;
        if (i === 1) cell.className = point.net_pnl_usd < 0 ? "is-down" : "is-up";
        tr.append(cell);
      });
      body.append(tr);
    }
    table.append(caption, head, body);
    return table;
  }
})();
