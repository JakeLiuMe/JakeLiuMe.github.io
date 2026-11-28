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


  /* ---------- Performance: one cumulative line ---------- */

  function loadPerformance() {
    const root = document.querySelector("[data-performance]");
    if (!root) return;
    const getJson = (url) => fetch(url, { credentials: "same-origin" }).then((res) => (res.ok ? res.json() : null)).catch(() => null);
    Promise.all([getJson("/data/daily.json"), getJson("/data/meta.json")])
      .then(([payload, meta]) => {
        const series = normalize(payload);
        if (!series.length) return;
        root.hidden = false;
        try { bindFigures(series, meta && typeof meta === "object" ? meta : null); } catch (e) { /* static text stays */ }
        try { mountWeek(root, series); } catch (e) { /* card stays hidden */ }
        mount(root, series);
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
      const contracts = row.contracts == null ? NaN : Number(row.contracts);
      const notional = row.notional_usd == null ? NaN : Number(row.notional_usd);
      rows.push({ date: row.date, net_pnl_usd: pnl, settled_trades: trades,
        contracts: Number.isFinite(contracts) ? contracts : null, notional_usd: Number.isFinite(notional) ? notional : null });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  }

  function withEquity(series) {
    let cum = 0;
    return series.map((row) => {
      cum = Math.round((cum + row.net_pnl_usd) * 100) / 100;
      return { ...row, cum };
    });
  }

  function dollars(n) {
    const sign = n < 0 ? "\u2212" : n > 0 ? "+" : "";
    return sign + "$" + Math.round(Math.abs(n)).toLocaleString("en-US");
  }

  function moneyExact(n) {
    const sign = n < 0 ? "\u2212" : n > 0 ? "+" : "";
    return sign + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function pretty(iso) {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const [y, m, d] = iso.split("-").map(Number);
    return d + " " + months[m - 1] + " " + y;
  }

  function short(iso) {
    return pretty(iso).replace(/ \d{4}$/, "");
  }

  function axisMoney(n) {
    if (n === 0) return "$0";
    const sign = n < 0 ? "\u2212" : "";
    const abs = Math.abs(n);
    if (abs < 1000) return sign + "$" + abs;
    return sign + "$" + String(Math.round(abs / 100) / 10).replace(/\.0$/, "") + "k";
  }

  const RANGES = { "1w": { rows: 7, label: "past 7 days" }, "1m": { rows: 30, label: "past 30 days" }, all: { rows: Infinity, label: "" } };

  function niceStep(raw) {
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
  }

  /* Monotone cubic path: smooth, and never overshoots the data. */
  function smoothPath(pts) {
    const n = pts.length;
    if (n < 2) return "M" + pts[0][0] + " " + pts[0][1];
    const dx = [];
    const m = [];
    for (let i = 0; i < n - 1; i++) {
      dx.push(pts[i + 1][0] - pts[i][0]);
      m.push((pts[i + 1][1] - pts[i][1]) / dx[i]);
    }
    const t = [m[0]];
    for (let i = 1; i < n - 1; i++) {
      t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
    }
    t.push(m[n - 2]);
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i];
      const b = t[i + 1] / m[i];
      const s = a * a + b * b;
      if (s > 9) {
        const k = 3 / Math.sqrt(s);
        t[i] = k * a * m[i];
        t[i + 1] = k * b * m[i];
      }
    }
    const f = (v) => Math.round(v * 100) / 100;
    let d = "M" + f(pts[0][0]) + " " + f(pts[0][1]);
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += "C" + f(pts[i][0] + h) + " " + f(pts[i][1] + t[i] * h) + " " + f(pts[i + 1][0] - h) + " " + f(pts[i + 1][1] - t[i + 1] * h) + " " + f(pts[i + 1][0]) + " " + f(pts[i + 1][1]);
    }
    return d;
  }

  function svgEl(name, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const key in attrs) el.setAttribute(key, attrs[key]);
    return el;
  }

  /* ---------- Dates, ET calendar weeks (Monday start), compact money ---------- */

  const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MONTHS = MONTHS_LONG.map((m) => m.slice(0, 3));
  const dayMs = 86400000;
  const utc = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);
  const addDays = (iso, n) => isoOf(utc(iso) + n * dayMs);
  const weekStart = (iso) => addDays(iso, -((new Date(utc(iso)).getUTCDay() + 6) % 7));
  const dm = (iso) => { const [, m, d] = iso.split("-").map(Number); return { d, m: m - 1 }; };
  const sum = (rows, key) => rows.reduce((t, r) => t + (r[key] || 0), 0);
  const round2 = (n) => Math.round(n * 100) / 100;
  const plain = (n) => "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const plainR = (n) => "$" + Math.round(Math.abs(n)).toLocaleString("en-US");

  function compactMoney(n) {
    const a = Math.abs(n);
    if (a >= 1e6) return "$" + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M";
    if (a >= 1e4) return "$" + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "K";
    return "$" + Math.round(a).toLocaleString("en-US");
  }

  function spanDates(a, b) {
    const x = dm(a), y = dm(b);
    if (a === b) return x.d + " " + MONTHS[x.m];
    if (x.m === y.m) return x.d + "\u2013" + y.d + " " + MONTHS[y.m];
    return x.d + " " + MONTHS[x.m] + " \u2013 " + y.d + " " + MONTHS[y.m];
  }

  /* ---------- This week (ET calendar week, Monday to Sunday), computed from the latest date in the data ---------- */

  function sparkPath(vals, w, h, pad) {
    const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
    const span = hi - lo || 1;
    const x = (i) => pad + (i / (vals.length - 1)) * (w - pad * 2);
    const y = (v) => pad + (1 - (v - lo) / span) * (h - pad * 2);
    return { pts: vals.map((v, i) => [x(i), y(v)]), zero: y(0), spans: lo < 0 };
  }

  function mountWeek(root, series) {
    const card = root.querySelector("[data-weekcard]");
    if (!card) return;
    const last = series[series.length - 1];
    const monday = weekStart(last.date);
    const week = series.filter((r) => r.date >= monday);
    const prevWeek = series.filter((r) => r.date >= addDays(monday, -7) && r.date < monday);
    if (!week.length) return;
    const total = round2(sum(week, "net_pnl_usd"));
    const $ = (sel) => card.querySelector(sel);

    $("[data-wk-range]").textContent = "\u00b7 " + spanDates(monday, last.date);
    const val = $("[data-wk-value]");
    val.textContent = dollars(total);
    val.classList.toggle("is-down", total < 0);
    card.classList.toggle("is-down", total < 0);
    $("[data-wk-sub]").textContent = prevWeek.length ? "Last week " + dollars(round2(sum(prevWeek, "net_pnl_usd"))) : "";

    const hasVol = series.some((r) => r.contracts != null);
    const volRow = card.querySelector(".weekcard__vol");
    const note = $("[data-wk-note]");
    if (hasVol) {
      const fill = (el, c, n) => {
        el.replaceChildren();
        const big = document.createElement("span");
        big.className = "weekcard__big";
        big.textContent = Math.round(c).toLocaleString("en-US");
        const unit = document.createElement("small");
        unit.textContent = " contracts";
        big.append(unit);
        const sub = document.createElement("span");
        sub.className = "weekcard__small";
        sub.textContent = compactMoney(n) + " traded";
        el.append(big, sub);
      };
      fill($("[data-wk-vol]"), sum(week, "contracts"), sum(week, "notional_usd"));
      fill($("[data-wk-volall]"), sum(series, "contracts"), sum(series, "notional_usd"));
    } else {
      if (volRow) volRow.hidden = true;
      if (note) note.hidden = true;
    }

    const spark = $("[data-wk-spark]");
    let cum = 0;
    const vals = [0].concat(week.map((r) => (cum = round2(cum + r.net_pnl_usd))));
    spark.setAttribute("aria-label", "This week's cumulative net P&L, from $0 to " + dollars(total) + " over " + week.length + (week.length === 1 ? " day" : " days"));
    card.hidden = false;

    const draw = () => {
      const w = Math.round(spark.clientWidth), h = Math.round(spark.clientHeight);
      if (!w || !h) return;
      const { pts, zero, spans } = sparkPath(vals, w, h, 8);
      const svg = svgEl("svg", { width: w, height: h, viewBox: "0 0 " + w + " " + h, "aria-hidden": "true", focusable: "false" });
      const defs = svgEl("defs", {});
      const grad = svgEl("linearGradient", { id: "wk-grad", x1: 0, x2: 0, y1: 0, y2: 1 });
      grad.append(svgEl("stop", { offset: "0", class: "wk-s0" }), svgEl("stop", { offset: "1", class: "wk-s1" }));
      defs.append(grad);
      svg.append(defs);
      const line = smoothPath(pts);
      svg.append(svgEl("path", { class: "wk-area", d: line + "L" + pts[pts.length - 1][0] + " " + h + "L" + pts[0][0] + " " + h + "Z" }));
      if (spans) svg.append(svgEl("line", { class: "wk-zero", x1: 0, x2: w, y1: zero, y2: zero }));
      svg.append(svgEl("path", { class: "wk-line", d: line }));
      const end = pts[pts.length - 1];
      svg.append(svgEl("circle", { class: "wk-halo", cx: end[0], cy: end[1], r: 9 }));
      svg.append(svgEl("circle", { class: "wk-dot", cx: end[0], cy: end[1], r: 4.5 }));
      spark.replaceChildren(svg);
    };
    draw();
    let lw = 0;
    if ("ResizeObserver" in window) new ResizeObserver(() => { const w = Math.round(spark.clientWidth); if (w !== lw) { lw = w; draw(); } }).observe(spark);
  }

  /* ---------- Text figures: every number on the page that comes from the ledgers is rendered from the data ---------- */

  const WORDS = ["none", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five", "twenty-six", "twenty-seven"];
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  function dayList(dates) {
    const sorted = dates.slice().sort();
    const parts = sorted.map(dm);
    const sameMonth = parts.every((p) => p.m === parts[0].m);
    const items = sameMonth ? parts.map((p) => String(p.d)) : parts.map((p) => p.d + " " + MONTHS[p.m]);
    const joined = items.length < 3 ? items.join(" and ") : items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
    return sameMonth ? joined + " " + MONTHS_LONG[parts[0].m] : joined;
  }

  function figures(series, meta) {
    const f = {};
    const days = series.length;
    const total = meta && meta.total_pnl_usd != null ? Number(meta.total_pnl_usd) : round2(sum(series, "net_pnl_usd"));
    const trades = meta && meta.settled_trades != null ? Number(meta.settled_trades) : sum(series, "settled_trades");
    const first = series[0].date, last = series[days - 1].date;
    const fm = dm(first), lm = dm(last);
    f.total_x = moneyExact(total);
    f.total_r = plainR(total);
    f.total_k = (total < 0 ? "\u2212" : "+") + "$" + (Math.abs(total) / 1000).toFixed(1);
    f.trades = trades.toLocaleString("en-US");
    f.days = String(days);
    f.prof_days = String(series.filter((r) => r.net_pnl_usd > 0).length);
    f.avg_day = moneyExact(round2(sum(series, "net_pnl_usd") / days));
    const wk = new Map();
    for (const r of series) wk.set(weekStart(r.date), round2((wk.get(weekStart(r.date)) || 0) + r.net_pnl_usd));
    f.weeks = String(wk.size);
    f.prof_weeks = String([...wk.values()].filter((v) => v > 0).length);
    let best = series[0], worst = series[0];
    for (const r of series) { if (r.net_pnl_usd > best.net_pnl_usd) best = r; if (r.net_pnl_usd < worst.net_pnl_usd) worst = r; }
    f.best_day = moneyExact(best.net_pnl_usd); f.best_day_date = short(best.date);
    f.worst_day = moneyExact(worst.net_pnl_usd); f.worst_day_date = short(worst.date);
    let cum = 0, peak = 0, dd = 0;
    for (const r of series) { cum = round2(cum + r.net_pnl_usd); peak = Math.max(peak, cum); dd = Math.max(dd, round2(peak - cum)); }
    f.dd_close = plain(dd);
    let run = 0, bestRun = 0, runStart = "", bestStart = "", bestEnd = "";
    for (const r of series) {
      if (r.net_pnl_usd < 0) { if (!run) runStart = r.date; run++; if (run > bestRun) { bestRun = run; bestStart = runStart; bestEnd = r.date; } } else run = 0;
    }
    f.streak_n = String(bestRun);
    f.streak_dates = bestRun ? spanDates(bestStart, bestEnd) : "";
    f.window_short = fm.d + " " + MONTHS[fm.m] + " \u2013 " + lm.d + " " + MONTHS[lm.m] + " " + last.slice(0, 4);
    f.window_short2 = fm.d + " " + MONTHS[fm.m] + "\u2013" + lm.d + " " + MONTHS[lm.m] + " " + last.slice(0, 4);
    f.start_long = fm.d + " " + MONTHS_LONG[fm.m];
    f.end_short = lm.d + " " + MONTHS[lm.m];
    const longDate = (iso) => { const p = dm(iso); return p.d + " " + MONTHS_LONG[p.m] + " " + iso.slice(0, 4); };
    f.end_long = longDate(last);
    if (meta && typeof meta.as_of === "string") {
      const m = meta.as_of.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
      if (m) {
        f.asof_time = m[2];
        f.end_long = longDate(m[1]);
        f.asof_long = fm.d + " " + MONTHS_LONG[fm.m] + "\u2013" + longDate(last).replace(/ \d{4}$/, "") + " " + last.slice(0, 4) + ", " + m[2] + " ET";
      }
    }
    if (meta && meta.max_drawdown_trade_usd != null) {
      f.dd_trade = plain(Number(meta.max_drawdown_trade_usd));
      f.dd_trade_r = plainR(Number(meta.max_drawdown_trade_usd));
    }
    if (meta && meta.strategies != null) {
      const n = Number(meta.strategies);
      f.strategies = String(n);
      f.neg_word = cap(WORDS[Number(meta.strategies_negative)] || String(meta.strategies_negative));
      f.flat_word = WORDS[Number(meta.strategies_flat)] || String(meta.strategies_flat);
      if (meta.largest_strategy_pnl_usd != null && total > 0) {
        const top = Number(meta.largest_strategy_pnl_usd);
        f.top_pnl = moneyExact(top);
        f.top_share = Math.round((top / total) * 100) + "%";
        f.others_n = String(n - 1);
        f.others_pnl = moneyExact(round2(total - top));
        f.top_share_n = (top / total) * 100;
        f.rest_share_n = 100 - (top / total) * 100;
      }
    }
    const top3 = series.slice().sort((a, b) => b.net_pnl_usd - a.net_pnl_usd).slice(0, 3);
    const t3 = round2(sum(top3, "net_pnl_usd"));
    f.top3_days = dayList(top3.map((r) => r.date));
    f.top3_sum = plain(t3);
    f.top3_share = Math.round((t3 / total) * 100) + "%";
    return f;
  }

  function bindFigures(series, meta) {
    const f = figures(series, meta);
    document.querySelectorAll("[data-bind]").forEach((el) => {
      const v = f[el.dataset.bind];
      if (typeof v === "string" && v !== "") el.textContent = v;
    });
    document.querySelectorAll("[data-bind-width]").forEach((el) => {
      const v = f[el.dataset.bindWidth];
      if (typeof v === "number" && Number.isFinite(v)) el.style.width = v.toFixed(1) + "%";
    });
    const split = document.querySelector("[data-bind-aria=\"split\"]");
    if (split && typeof f.top_share_n === "number") {
      const a = Math.round(f.top_share_n);
      split.setAttribute("aria-label", "Share of net P and L. The largest strategy is " + a + " percent. The other strategies are the remaining " + (100 - a) + " percent.");
    }
  }

  function mount(root, series) {
    const all = withEquity(series);
    const host = root.querySelector("[data-equity]");
    const valueEl = root.querySelector("[data-perf-value]");
    const subEl = root.querySelector("[data-perf-period]");
    const liveEl = root.querySelector("[data-perf-live]");
    const buttons = root.querySelectorAll("[data-range]");
    const tableHost = root.querySelector("[data-table]");
    if (tableHost) tableHost.replaceChildren(dailyTable(all));
    if (!host) return;

    const tip = document.createElement("div");
    tip.className = "pf-tip";
    tip.hidden = true;
    const tipDate = document.createElement("span");
    const tipValue = document.createElement("strong");
    tip.append(tipDate, tipValue);

    let mode = "all";
    let view = all;
    let base = 0;
    let geo = null;
    let width = 0;
    let index = -1;

    const rest = () => {
      const last = view[view.length - 1];
      valueEl.textContent = dollars(all[all.length - 1].cum);
      valueEl.classList.toggle("is-down", all[all.length - 1].cum < 0);
      if (mode === "all") {
        subEl.textContent = pretty(view[0].date) + " \u2013 " + pretty(last.date);
      } else {
        const change = Math.round((last.cum - base) * 100) / 100;
        subEl.textContent = dollars(change) + " " + RANGES[mode].label;
      }
    };

    const hide = () => {
      index = -1;
      tip.hidden = true;
      if (geo) {
        geo.cross.setAttribute("visibility", "hidden");
        geo.dot.setAttribute("visibility", "hidden");
      }
      host.classList.remove("is-scrubbing");
      if (view.length) rest();
    };

    const focusPoint = (i, announce) => {
      if (!geo) return;
      i = Math.max(0, Math.min(view.length - 1, i));
      const p = view[i];
      const x = geo.x(i);
      const y = geo.y(p.cum);
      index = i;
      geo.cross.setAttribute("x1", x);
      geo.cross.setAttribute("x2", x);
      geo.cross.setAttribute("visibility", "visible");
      geo.dot.setAttribute("transform", "translate(" + x + " " + y + ")");
      geo.dot.setAttribute("visibility", "visible");
      host.classList.add("is-scrubbing");
      valueEl.textContent = dollars(p.cum);
      valueEl.classList.toggle("is-down", p.cum < 0);
      subEl.textContent = pretty(p.date);
      tipDate.textContent = pretty(p.date);
      tipValue.textContent = dollars(p.cum);
      tip.hidden = false;
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      let left;
      let top;
      if (y - th - 16 >= 0) {
        left = x - tw / 2;
        top = y - th - 16;
      } else {
        left = x < width / 2 ? x + 16 : x - tw - 16;
        top = Math.max(0, Math.min(y - th / 2, geo.bottom - th));
      }
      tip.style.transform = "translate(" + Math.round(Math.max(0, Math.min(left, width - tw))) + "px," + Math.round(top) + "px)";
      if (announce && liveEl) liveEl.textContent = pretty(p.date) + ", cumulative " + dollars(p.cum);
    };

    const nearest = (clientX) => {
      const box = host.getBoundingClientRect();
      const px = clientX - box.left;
      const f = (px - geo.left) / (geo.right - geo.left);
      return Math.round(Math.max(0, Math.min(1, f)) * (view.length - 1));
    };

    const draw = (animate) => {
      width = Math.round(host.clientWidth);
      if (!width) return;
      const compact = width < 560;
      const height = compact ? 280 : 360;
      const left = compact ? 38 : 48;
      const right = 4;
      const top = 14;
      const bottom = 30;
      const pw = width - left - right;
      const ph = height - top - bottom;
      const vals = view.map((p) => p.cum);
      let lo = mode === "all" ? 0 : Math.min(...vals);
      let hi = Math.max(...vals);
      if (hi === lo) hi = lo + 1;
      const pad = (hi - lo) * (mode === "all" ? 0.06 : 0.1);
      hi += pad;
      if (mode !== "all") lo -= pad;
      const step = niceStep((hi - lo) / 4);
      const ticks = [];
      for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
      const y = (v) => top + ph - ((v - lo) / (hi - lo)) * ph;
      const x = (i) => left + (view.length === 1 ? pw : (i / (view.length - 1)) * pw);
      const pts = view.map((p, i) => [x(i), y(p.cum)]);
      const line = smoothPath(pts);
      const floor = top + ph;
      const area = line + "L" + x(view.length - 1) + " " + floor + "L" + x(0) + " " + floor + "Z";

      const svg = svgEl("svg", { viewBox: "0 0 " + width + " " + height, width: width, height: height, "aria-hidden": "true", focusable: "false" });
      const defs = svgEl("defs", {});
      const grad = svgEl("linearGradient", { id: "pf-fill", x1: "0", y1: "0", x2: "0", y2: "1" });
      grad.append(svgEl("stop", { offset: "0", "stop-color": "#1E5E48", "stop-opacity": "0.2" }), svgEl("stop", { offset: "1", "stop-color": "#1E5E48", "stop-opacity": "0" }));
      defs.append(grad);
      svg.append(defs);
      for (const v of ticks) {
        const gy = Math.round(y(v)) + 0.5;
        svg.append(svgEl("line", { class: "pf-grid", x1: left, x2: width - right, y1: gy, y2: gy }));
        const label = svgEl("text", { class: "pf-tick", x: left - 10, y: gy + 4, "text-anchor": "end" });
        label.textContent = axisMoney(v);
        svg.append(label);
      }
      const startLabel = svgEl("text", { class: "pf-tick", x: left, y: height - 6, "text-anchor": "start" });
      startLabel.textContent = short(view[0].date);
      const endLabel = svgEl("text", { class: "pf-tick", x: width - right, y: height - 6, "text-anchor": "end" });
      endLabel.textContent = short(view[view.length - 1].date);
      svg.append(startLabel, endLabel);
      const areaEl = svgEl("path", { class: "pf-area", d: area, fill: "url(#pf-fill)" });
      const lineEl = svgEl("path", { class: "pf-line", d: line });
      const cross = svgEl("line", { class: "pf-cross", x1: 0, x2: 0, y1: top, y2: floor, visibility: "hidden" });
      const dot = svgEl("g", { class: "pf-dot", visibility: "hidden" });
      dot.append(svgEl("circle", { r: 9, class: "pf-halo" }), svgEl("circle", { r: 4.5, class: "pf-core" }));
      svg.append(areaEl, lineEl, cross, dot);

      geo = { x, y, cross, dot, left, right: width - right, bottom: height, floor };
      host.replaceChildren(svg, tip);
      host.style.height = height + "px";
      index = -1;
      tip.hidden = true;
      host.classList.remove("is-scrubbing");
      rest();

      if (animate && !reduce) {
        const len = lineEl.getTotalLength();
        lineEl.style.strokeDasharray = String(len);
        lineEl.style.strokeDashoffset = String(len);
        areaEl.style.opacity = "0";
        const go = () => {
          lineEl.style.transition = "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)";
          areaEl.style.transition = "opacity 0.9s ease 0.25s";
          lineEl.style.strokeDashoffset = "0";
          areaEl.style.opacity = "1";
          window.setTimeout(() => { lineEl.style.strokeDasharray = "none"; lineEl.style.transition = "none"; }, 1500);
        };
        if ("IntersectionObserver" in window) {
          const io = new IntersectionObserver((entries) => {
            if (!entries.some((e) => e.isIntersecting)) return;
            io.disconnect();
            go();
          }, { threshold: 0.35 });
          io.observe(host);
          window.setTimeout(() => { io.disconnect(); go(); }, 6000);
        } else {
          go();
        }
      }
    };

    const setMode = (next, intro) => {
      mode = next;
      const n = RANGES[mode].rows;
      const startAt = Number.isFinite(n) ? Math.max(0, all.length - n) : 0;
      view = all.slice(startAt);
      base = startAt > 0 ? all[startAt - 1].cum : 0;
      buttons.forEach((b) => b.setAttribute("aria-pressed", b.dataset.range === mode ? "true" : "false"));
      draw(!!intro);
      if (intro) return;
      const line = host.querySelector(".pf-line");
      const area = host.querySelector(".pf-area");
      if (!reduce && line) {
        line.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" });
        area.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-out" });
      }
    };

    buttons.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.range || "all")));

    let pending = 0;
    let lastX = 0;
    host.addEventListener("pointerdown", (e) => {
      if (!geo) return;
      lastX = e.clientX;
      if (e.pointerType === "mouse") return;
      focusPoint(nearest(e.clientX), false);
    });
    host.addEventListener("pointermove", (e) => {
      if (!geo) return;
      lastX = e.clientX;
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        const i = nearest(lastX);
        if (i !== index) focusPoint(i, false);
      });
    });
    ["pointerleave", "pointercancel", "pointerup"].forEach((type) => {
      host.addEventListener(type, (e) => {
        if (type === "pointerup" && e.pointerType === "mouse") return;
        if (pending) { cancelAnimationFrame(pending); pending = 0; }
        hide();
      });
    });
    host.addEventListener("keydown", (e) => {
      if (!geo) return;
      const k = e.key;
      if (k !== "ArrowLeft" && k !== "ArrowRight" && k !== "Home" && k !== "End" && k !== "Escape") return;
      e.preventDefault();
      if (k === "Escape") { hide(); return; }
      const next = k === "Home" ? 0 : k === "End" ? view.length - 1 : (index < 0 ? view.length - 1 : index) + (k === "ArrowRight" ? 1 : -1);
      focusPoint(next, true);
    });
    host.addEventListener("blur", hide);

    let lastWidth = 0;
    let rz = 0;
    const onResize = () => {
      cancelAnimationFrame(rz);
      rz = requestAnimationFrame(() => {
        const w = Math.round(host.clientWidth);
        if (w && w !== lastWidth) { lastWidth = w; draw(false); }
      });
    };
    if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(host);
    else window.addEventListener("resize", onResize);

    lastWidth = Math.round(host.clientWidth);
    setMode("all", true);
  }

  function dailyTable(points) {
    const table = document.createElement("table");
    table.className = "perf-table";
    const caption = document.createElement("caption");
    caption.textContent = "Daily settled P&L and the cumulative total. Drawdown is measured on these daily closes.";
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
