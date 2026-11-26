/* RingTracker – App
   Daten kommen per iOS-Kurzbefehl aus Apple Health (siehe rt-import.js) und bleiben
   nur im Browser dieses Geräts (localStorage). Nichts wird an einen Server gesendet. */
(function () {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const DATA_KEY = "rt-data-v1";
  const SET_KEY = "rt-settings-v1";
  const APP_URL = "https://agllm39.github.io/ringtracker/";

  // ---------- Symbole ----------
  const ICON = {
    steps: '<path d="M8 20c-1.7 0-3-1.3-3-3.2 0-2 1-3.3 1-5.3S5 8 6.6 6.6C8.1 5.4 10 6.4 10 9c0 2.4-1 3.6-1 6 0 1.7.6 2-1 5Z"/><path d="M16 15c1.7 0 3-1.2 3-3 0-2-1-3-1-5s1-3.2-.6-4.4C15.9 1.5 14 2.4 14 5c0 2.4 1 3.5 1 6 0 1.6-.6 2 1 4Z"/>',
    activeEnergy: '<path d="M12 22c4 0 7-2.8 7-6.8 0-4.5-3.6-6.6-4.4-11.2-2.4 1.6-3.6 4-3.6 6.4-1-.6-1.8-1.9-2-3.2C7.2 9 5 11.6 5 15.2 5 19.2 8 22 12 22Z"/>',
    heartRate: '<path d="M12 20s-7.5-4.6-9.2-9.5C1.6 6.9 4 4 7 4c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3 0 5.4 2.9 4.2 6.5C19.5 15.4 12 20 12 20Z"/>',
    restingHeartRate: '<path d="M12 20s-7.5-4.6-9.2-9.5C1.6 6.9 4 4 7 4c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3 0 5.4 2.9 4.2 6.5C19.5 15.4 12 20 12 20Z"/><path d="M7 11h2.5l1.5-2 2 4 1.5-2H17"/>',
    hrv: '<path d="M2 12h4l2-6 4 12 3-8 2 2h5"/>',
    oxygen: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"/>',
    respiratoryRate: '<path d="M12 4v8M12 12c-2 0-3-2-3-2M12 12c2 0 3-2 3-2"/><path d="M9 7C6 7 3 11 3 16c0 2 1 4 3 4 3 0 3-3 3-6V7ZM15 7c3 0 6 4 6 9 0 2-1 4-3 4-3 0-3-3-3-6V7Z"/>',
    sleep: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19c3-4 6-6 10-8"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chart: '<path d="M5 20V11M10 20V5M15 20v-7M20 20V8"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    sync: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    shortcut: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 12h8M12 8v8"/>',
    warn: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
    paint: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M12 3a9 9 0 0 1 0 18"/>',
  };
  const svg = (name, color, cls = "ic") =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="${color || "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ""}</svg>`;

  // ---------- Messwerte ----------
  const M = {
    steps: { title: "Schritte", unit: "", color: "var(--accent)", cumulative: true, higher: true, dec: 0,
      explain: "Alle Schritte des Tages. Der Ring zählt auch dann, wenn das iPhone liegen bleibt." },
    activeEnergy: { title: "Aktive Energie", unit: "kcal", color: "var(--amber)", cumulative: true, higher: true, dec: 0,
      explain: "Kalorien, die du durch Bewegung zusätzlich zum Grundumsatz verbrauchst." },
    restingHeartRate: { title: "Ruhepuls", unit: "bpm", color: "var(--rasp)", cumulative: false, higher: false, dec: 0,
      explain: "Puls in völliger Ruhe, meist im Schlaf gemessen. Ein sinkender Ruhepuls spricht für gute Fitness und Erholung." },
    hrv: { title: "HRV", unit: "ms", color: "var(--blue)", cumulative: false, higher: true, dec: 0,
      explain: "Herzratenvariabilität: wie stark der Abstand zwischen Herzschlägen schwankt. Höher heißt meist besser erholt. Vergleiche nur mit deinen eigenen Werten." },
    heartRate: { title: "Herzfrequenz", unit: "bpm", color: "var(--over)", cumulative: false, higher: null, dec: 0,
      explain: "Durchschnitt aller Pulsmessungen des Tages. Im Tagesverlauf siehst du einzelne Messungen." },
    oxygen: { title: "Blutsauerstoff", unit: "%", color: "var(--drink)", cumulative: false, higher: true, dec: 1,
      explain: "Sauerstoffsättigung im Blut. Werte zwischen 95 und 100 % sind üblich, nachts etwas weniger." },
    respiratoryRate: { title: "Atemfrequenz", unit: "/min", color: "var(--accent-2)", cumulative: false, higher: null, dec: 1,
      explain: "Atemzüge pro Minute im Schlaf. Ein plötzlicher Anstieg kann auf eine Erkältung hindeuten." },
  };
  const VITALS = ["restingHeartRate", "hrv", "heartRate", "oxygen", "respiratoryRate"];
  const WEEK_ORDER = ["steps", "activeEnergy", "restingHeartRate", "hrv", "heartRate", "oxygen", "respiratoryRate"];
  const STAGES = [
    ["deep", "Tiefschlaf"], ["core", "Leichtschlaf"], ["rem", "REM"], ["unspecified", "Schlaf"], ["awake", "Wach"],
  ];
  const ASLEEP = ["deep", "core", "rem", "unspecified"];

  // ---------- Speicher ----------
  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === "object" ? v : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast("Speichern nicht möglich: " + e.message); return false; }
  }
  let data = load(DATA_KEY, null);
  const settings = Object.assign({ stepGoal: 10000, energyGoal: 500, sleepGoal: 480, theme: "auto" }, load(SET_KEY, {}));

  // ---------- Hilfen ----------
  const nf = (n, dec = 0) => Number(n).toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: dec });
  const fmt = (m, v) => v == null || !isFinite(v) ? "–" : nf(v, M[m].dec);
  const fmtU = (m, v) => v == null || !isFinite(v) ? "–" : (M[m].unit ? `${fmt(m, v)} ${M[m].unit}` : fmt(m, v));
  const hm = s => { const m = Math.round(s / 60); return m >= 60 ? (m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`) : `${m} min`; };
  const hmShort = s => { const m = Math.round(s / 60); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
  const dayKey = d => RTImport.dayKey(d);
  const keyDate = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  const todayKey = () => dayKey(new Date());
  const time = iso => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  function lastKeys(n) {
    const out = [], d = new Date(); d.setHours(12, 0, 0, 0);
    for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); out.push(dayKey(x)); }
    return out;
  }
  function relTime(iso) {
    const diff = (Date.now() - new Date(iso)) / 60000;
    if (diff < 1) return "gerade eben";
    if (diff < 60) return `vor ${Math.round(diff)} min`;
    if (diff < 60 * 24) return `vor ${Math.round(diff / 60)} h`;
    const d = Math.round(diff / 1440);
    return d === 1 ? "gestern" : `vor ${d} Tagen`;
  }
  const asleepOf = n => n ? ASLEEP.reduce((a, k) => a + (n[k] || 0), 0) : 0;
  const totalOf = n => n ? asleepOf(n) + (n.awake || 0) : 0;
  const sleepGoalSec = () => settings.sleepGoal * 60;

  // ---------- Berechnungen ----------
  function series(m, n) {
    return lastKeys(n).map(k => ({ key: k, v: data && data.days[k] ? data.days[k][m] : undefined }));
  }
  function current(m) {
    if (!data) return null;
    if (M[m].cumulative) {
      const v = data.days[todayKey()] && data.days[todayKey()][m];
      return v == null ? null : { v, t: data.updated, today: true };
    }
    const l = data.latest[m];
    if (!l || Date.now() - new Date(l.t) > 7 * 86400e3) return null;
    return l;
  }
  function weekAvg(m) {
    const vals = series(m, 8).slice(0, 7).map(p => p.v).filter(v => v != null);
    return avg(vals);
  }
  function baseline(m) {
    const vals = series(m, 31).slice(0, 30).map(p => p.v).filter(v => v != null);
    return vals.length >= 3 ? avg(vals) : null;
  }
  function lastNight() {
    if (!data) return null;
    const k = todayKey();
    if (data.nights[k]) return Object.assign({ key: k }, data.nights[k]);
    return null;
  }
  function nightsFor(n) {
    return lastKeys(n).map(k => ({ key: k, night: data && data.nights[k] }));
  }
  function recovery() {
    const parts = []; let w = 0, sum = 0;
    const n = lastNight();
    if (n && asleepOf(n) > 0) {
      const s = clamp(asleepOf(n) / sleepGoalSec() * 100, 0, 100);
      parts.push({ title: "Schlaf", detail: `${hm(asleepOf(n))} von ${hm(sleepGoalSec())}`, score: s }); sum += s * .4; w += .4;
    }
    const hrv = current("hrv"), hb = baseline("hrv");
    if (hrv && hb) {
      const r = hrv.v / hb, s = clamp(50 + (r - 1) * 250, 0, 100), pct = Math.round((r - 1) * 100);
      parts.push({ title: "HRV", detail: `${Math.round(hrv.v)} ms, ${pct >= 0 ? "+" : ""}${pct} % zum Schnitt`, score: s }); sum += s * .35; w += .35;
    }
    const rhr = current("restingHeartRate"), rb = baseline("restingHeartRate");
    if (rhr && rb) {
      const s = clamp(50 + (rb - rhr.v) * 6.25, 0, 100), d = Math.round(rhr.v - rb);
      parts.push({ title: "Ruhepuls", detail: `${Math.round(rhr.v)} bpm, ${d >= 0 ? "+" : ""}${d} zum Schnitt`, score: s }); sum += s * .25; w += .25;
    }
    if (!w) return null;
    const score = Math.round(sum / w);
    const level = score >= 75 ? "ok" : score >= 50 ? "warn" : "over";
    return {
      score, parts, level,
      label: { ok: "Gut erholt", warn: "Ausgeglichen", over: "Ruhig angehen" }[level],
      advice: {
        ok: "Dein Körper ist bereit für eine fordernde Einheit.",
        warn: "Normaler Tag. Moderate Belastung passt gut.",
        over: "Heute lieber locker bewegen und früh schlafen gehen.",
      }[level],
    };
  }
  const levelColor = l => ({ ok: "var(--ok)", warn: "var(--warn)", over: "var(--over)" }[l]);
  const scoreLevel = s => s >= 75 ? "ok" : s >= 50 ? "warn" : "over";

  // ---------- Bausteine ----------
  function ring(progress, color, size, stroke, centerHtml) {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, p = clamp(progress || 0, 0, 1);
    return `<div class="ring" style="width:${size}px;height:${size}px">
      <svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" stroke="${color}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}"${p === 0 ? ' opacity="0"' : ""}/></svg>
      <div class="center">${centerHtml}</div></div>`;
  }
  function ringCell(title, value, sub, progress, color) {
    return `<div class="ringcell">${ring(progress, color, 64, 7, `<span style="font-size:13px">${Math.round(clamp(progress, 0, 9.99) * 100)} %</span>`)}
      <div class="lbl">${title}</div><div class="val num">${value}</div><div class="sub">${sub}</div></div>`;
  }
  function stageBar(n, thin) {
    const total = totalOf(n) || 1;
    return `<div class="stagebar${thin ? " thin" : ""}">${STAGES.filter(([k]) => n[k] > 0)
      .map(([k]) => `<i class="s-${k}" style="flex:${(n[k] / total).toFixed(4)}"></i>`).join("")}</div>`;
  }
  function legend(n) {
    return `<div class="legend">${STAGES.filter(([k]) => n[k] > 0)
      .map(([k, t]) => `<div><span class="dot s-${k}"></span>${t}<b>${n[k] >= 3600 ? hmShort(n[k]) + " h" : hm(n[k])}</b></div>`).join("")}</div>`;
  }
  function trend(m, v, base) {
    if (v == null || !base) return "";
    const ch = (v - base) / base;
    if (Math.abs(ch) < .03) return `<span class="trend flat">→ wie üblich</span>`;
    const good = M[m].higher == null ? null : (ch > 0) === M[m].higher;
    const cls = good == null ? "flat" : good ? "good" : "bad";
    return `<span class="trend ${cls}">${ch > 0 ? "↗" : "↘"} ${ch > 0 ? "+" : ""}${Math.round(ch * 100)} %</span>`;
  }
  function cardHead(title, icon, color, pill, chevron, pillCls = "") {
    return `<h3>${svg(icon, color)}<span class="grow">${title}</span>${pill ? `<span class="pill ${pillCls}">${pill}</span>` : ""}${chevron ? svg("chev", null, "chev") : ""}</h3>`;
  }
  function segmented(name, value, options) {
    return `<div class="seg" role="group">${options.map(o => `<button data-seg="${name}" data-val="${o}" aria-pressed="${o === value}">${o} Tage</button>`).join("")}</div>`;
  }

  // ---------- Diagramme (SVG) ----------
  /** points: [{key, v}], mode: "bar" | "line". Gibt HTML zurück; Antippen wählt einen Tag. */
  function chart(id, points, opt) {
    const W = 340, H = opt.height || 200, padT = 16, padB = 22, padR = opt.axis === false ? 0 : 34;
    const vals = points.map(p => p.v).filter(v => v != null && isFinite(v));
    if (!vals.length) return `<div class="empty">Keine Daten in diesem Zeitraum.</div>`;
    let lo = opt.zero ? 0 : Math.min(...vals), hi = Math.max(...vals, opt.goal || -Infinity);
    if (!opt.zero) { const span = (hi - lo) || Math.max(1, hi * .1); lo -= span * .25; hi += span * .15; }
    if (hi === lo) hi = lo + 1;
    const tick = niceStep((hi - lo) / 3);
    lo = Math.floor(lo / tick) * tick; hi = Math.ceil(hi * (opt.zero ? 1.04 : 1) / tick) * tick;
    const ticks = []; for (let v = lo; v <= hi + tick / 2; v += tick) ticks.push(v);
    const n = points.length, cw = (W - padR) / n;
    const x = i => i * cw + cw / 2, y = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
    const todayIdx = points.findIndex(p => p.key === todayKey());
    let s = `<svg class="chart" id="${id}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || "")}">`;
    // Gitter + Achse rechts
    if (opt.axis !== false) {
      for (const v of ticks) {
        const yy = y(v);
        s += `<line class="grid" x1="0" x2="${W - padR}" y1="${yy}" y2="${yy}"/><text class="axis" x="${W - padR + 6}" y="${yy + 4}">${opt.axisFmt ? opt.axisFmt(v) : nf(v)}</text>`;
      }
    }
    // Tageslabels
    const step = n <= 7 ? 1 : n <= 31 ? 7 : 30;
    points.forEach((p, i) => {
      if ((n - 1 - i) % step) return;
      const d = keyDate(p.key);
      const label = n <= 7 ? d.toLocaleDateString("de-DE", { weekday: "narrow" }) : d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" });
      s += `<text class="axis" x="${x(i)}" y="${H - 4}" text-anchor="middle">${label}</text>`;
    });
    if (opt.goal) s += `<line class="goal" x1="0" x2="${W - padR}" y1="${y(opt.goal)}" y2="${y(opt.goal)}"/><text class="goaltxt" x="2" y="${y(opt.goal) - 5}">Ziel</text>`;
    else if (opt.avgLine && vals.length > 1) { const a = avg(vals); s += `<line class="goal" x1="0" x2="${W - padR}" y1="${y(a)}" y2="${y(a)}"/>`; }

    if (opt.mode === "bar" || opt.mode === "stack") {
      const bw = Math.max(2, Math.min(26, cw * .62)), rx = n > 31 ? 1.5 : 5;
      points.forEach((p, i) => {
        const on = i === todayIdx ? " on" : "";
        if (opt.mode === "stack" && p.stack) {
          let acc = 0;
          p.stack.forEach(([v, color], j) => {
            if (!v) return;
            const y1 = y(acc + v), y0 = y(acc); acc += v;
            s += `<rect class="bar${on}" data-i="${i}" x="${x(i) - bw / 2}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1)}" rx="${j === p.stack.length - 1 ? rx : 1}" fill="${color}"/>`;
          });
        } else if (p.v != null) {
          s += `<rect class="bar${on}" data-i="${i}" x="${x(i) - bw / 2}" y="${y(p.v)}" width="${bw}" height="${Math.max(2, y(lo) - y(p.v))}" rx="${rx}" fill="url(#g-${id})"/>`;
        }
      });
      s += `<defs><linearGradient id="g-${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${opt.color}" stop-opacity=".72"/><stop offset="1" stop-color="${opt.color}"/></linearGradient></defs>`;
    } else {
      const pts = points.map((p, i) => p.v != null ? [x(i), y(p.v), i] : null).filter(Boolean);
      if (pts.length > 1) {
        const d = smooth(pts);
        s += `<defs><linearGradient id="g-${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${opt.color}" stop-opacity=".22"/><stop offset="1" stop-color="${opt.color}" stop-opacity="0"/></linearGradient></defs>`;
        s += `<path d="${d} L${pts[pts.length - 1][0]},${H - padB} L${pts[0][0]},${H - padB} Z" fill="url(#g-${id})"/>`;
        s += `<path class="line" d="${d}" stroke="${opt.color}"/>`;
      }
      pts.forEach(([px, py, i]) => {
        if (n > 31 && i !== todayIdx) return;
        s += `<circle class="pt" data-i="${i}" cx="${px}" cy="${py}" r="${i === todayIdx ? 4.5 : 3}" fill="${opt.color}"/>`;
      });
    }
    s += `<line class="sel" id="${id}-sel" x1="0" x2="0" y1="${padT}" y2="${H - padB}" visibility="hidden"/>`;
    points.forEach((p, i) => { s += `<rect class="hit" data-i="${i}" x="${i * cw}" y="0" width="${cw}" height="${H}"/>`; });
    s += `</svg>`;
    charts[id] = { points, opt, x, cw };
    return `<div class="chartwrap">${s}</div>`;
  }
  const charts = {};
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }

  /** Weiche Linie (Catmull-Rom als Bézier). */
  function smooth(pts) {
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  function selectPoint(id, i) {
    const c = charts[id]; if (!c) return;
    const el = document.getElementById(id); if (!el) return;
    const sel = document.getElementById(id + "-sel");
    const same = c.selected === i;
    c.selected = same ? null : i;
    el.querySelectorAll(".bar").forEach(b => b.classList.toggle("on", c.selected == null ? b.dataset.i == c.points.findIndex(p => p.key === todayKey()) : +b.dataset.i === c.selected));
    if (sel) {
      if (c.selected == null) sel.setAttribute("visibility", "hidden");
      else { sel.setAttribute("x1", c.x(i)); sel.setAttribute("x2", c.x(i)); sel.setAttribute("visibility", "visible"); }
    }
    if (c.opt.onSelect) c.opt.onSelect(c.selected == null ? null : c.points[i]);
    if (navigator.vibrate) navigator.vibrate(5);
  }

  // ---------- Ansichten ----------
  const views = {};

  views.welcome = () => `
    <div class="welcome">
      <div class="logo"><i></i></div>
      <h2>RingTracker</h2>
      <p>Schlaf, Puls, HRV und Bewegung von deinem RingConn-Ring, übersichtlich an einem Ort.</p>
    </div>
    <div class="card"><div class="features">
      ${feature("sleep", "var(--violet)", "Schlafphasen", "Tief-, Leicht- und REM-Schlaf jeder Nacht")}
      ${feature("leaf", "var(--accent)", "Erholung", "Score aus Schlaf, HRV und Ruhepuls")}
      ${feature("chart", "var(--amber)", "Verläufe", "7, 30 und 90 Tage mit Trends")}
      ${feature("lock", "var(--blue)", "Privat", "Alles bleibt auf deinem iPhone")}
    </div></div>
    <div class="card">
      ${cardHead("So kommen die Daten hierher", "shortcut", "var(--accent)")}
      <p class="small muted" style="margin:0 0 12px">Ein Kurzbefehl holt die Werte deines Rings aus Apple Health und legt sie in die Zwischenablage. Hier tippst du dann auf „Einfügen“.</p>
      <div class="btnrow">
        <button class="primary" data-go="import">Daten einfügen</button>
        <button class="secondary" data-go="anleitung">Kurzbefehl einrichten</button>
        <button class="secondary" data-action="demo">Erst mit Beispieldaten ansehen</button>
      </div>
    </div>`;
  const feature = (icon, color, title, text) =>
    `<div><span class="fi" style="background:color-mix(in srgb, ${color} 14%, transparent)">${svg(icon, color, "")}</span><span><b>${title}</b><span>${text}</span></span></div>`;

  views.heute = () => {
    const n = lastNight(), asleep = asleepOf(n), goal = sleepGoalSec();
    const st = current("steps"), en = current("activeEnergy"), rec = recovery();
    const stale = data && Date.now() - new Date(data.updated) > 18 * 3600e3;
    let h = "";
    if (data && data.demo) h += `<div class="card banner">${svg("info", "var(--blue)")}<div class="small"><b>Beispieldaten</b><br><span class="muted">So sieht RingTracker mit echten Werten aus.</span> <a href="#import">Echte Daten einfügen</a></div></div>`;
    else if (stale) h += `<button class="card link banner" data-go="import">${svg("sync", "var(--warn)")}<div class="small"><b>Daten von ${relTime(data.updated)}</b><br><span class="muted">Kurzbefehl ausführen und hier tippen, um neue Werte einzufügen.</span></div></button>`;

    h += `<div class="card hero">
      <div class="herotop">
        <div class="txt">
          <div class="lbl">Schlaf letzte Nacht</div>
          <div class="big">${asleep ? hm(asleep).replace(/(\d+) h (\d+) min/, "$1<small> h </small>$2<small> min</small>") : "–"}</div>
          <div class="small muted">${n && n.start ? `${time(n.start)} – ${time(n.end)} Uhr` : `Ziel ${hm(goal)}`}</div>
        </div>
        ${ring(asleep / goal, "var(--violet)", 96, 10, `<span style="font-size:22px">${Math.round(asleep / goal * 100)}</span><small>% Ziel</small>`)}
      </div>
      <div class="ringrow">
        ${ringCell("Schritte", fmt("steps", st ? st.v : 0), `von ${nf(settings.stepGoal)}`, (st ? st.v : 0) / settings.stepGoal, "var(--accent)")}
        ${ringCell("Aktive Energie", `${fmt("activeEnergy", en ? en.v : 0)} kcal`, `von ${nf(settings.energyGoal)}`, (en ? en.v : 0) / settings.energyGoal, "var(--amber)")}
        ${rec ? ringCell("Erholung", `${rec.score} von 100`, rec.label, rec.score / 100, levelColor(rec.level))
              : ringCell("Erholung", "–", "braucht HRV", 0, "var(--ok)")}
      </div>
    </div>`;

    if (n && asleep) {
      const deepRem = (n.deep + n.rem) / asleep;
      h += `<button class="card link" data-go="schlaf">
        ${cardHead("Schlafphasen", "sleep", "var(--violet)", n.deep + n.rem > 0 ? `Tief + REM ${Math.round(deepRem * 100)} %` : null, true)}
        ${stageBar(n)}${legend(n)}
      </button>`;
    }
    if (rec) {
      h += `<div class="card">
        ${cardHead("Erholung", "leaf", levelColor(rec.level), rec.label, false, rec.level)}
        <div style="font-size:15px">${rec.advice}</div>
        <div class="bars">${rec.parts.map(p => `<div class="row"><b>${p.title}</b><span>${p.detail}</span>
          <div class="meter"><i style="width:${Math.max(4, p.score)}%;background-color:${levelColor(scoreLevel(p.score))}"></i></div></div>`).join("")}</div>
        <div class="tiny muted" style="margin-top:10px">Verglichen mit deinem eigenen Durchschnitt der letzten 30 Tage.</div>
      </div>`;
    }
    h += `<h2 class="section">Vitalwerte</h2><div class="grid2">`;
    for (const m of VITALS) {
      const c = current(m);
      h += `<button class="card link tile" data-go="m/${m}">
        <div class="head">${svg(m, M[m].color, "")}${M[m].title}</div>
        <div class="v">${c ? fmt(m, c.v) : "–"}<small>${M[m].unit}</small></div>
        <div class="foot">${c ? `${trend(m, c.v, weekAvg(m))}<span>${relTime(c.t)}</span>` : "<span>Keine Daten</span>"}</div>
      </button>`;
    }
    h += `</div>`;
    if (data) h += `<p class="tiny muted" style="text-align:center;margin-top:16px">Stand: ${new Date(data.updated).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" })} Uhr</p>`;
    return h;
  };

  views.woche = () => {
    const nights = nightsFor(7);
    const nv = nights.filter(x => x.night).map(x => asleepOf(x.night));
    let h = `<button class="card link" data-go="schlaf">
      ${cardHead("Schlaf", "sleep", "var(--violet)", nv.length ? `Ø ${hm(avg(nv))}` : null, true)}
      ${chart("w-sleep", nights.map(x => ({ key: x.key, v: x.night ? asleepOf(x.night) / 3600 : null })),
        { mode: "bar", color: "var(--violet)", zero: true, goal: settings.sleepGoal / 60, height: 130, axis: false, label: "Schlaf der letzten 7 Nächte" })}
    </button>`;
    for (const m of WEEK_ORDER) {
      const pts = series(m, 7), a = avg(pts.map(p => p.v).filter(v => v != null));
      h += `<button class="card link" data-go="m/${m}">
        ${cardHead(M[m].title, m, M[m].color, a != null ? `Ø ${fmtU(m, a)}` : null, true)}
        ${chart("w-" + m, pts, { mode: M[m].cumulative ? "bar" : "line", color: M[m].color, zero: M[m].cumulative,
          goal: m === "steps" ? settings.stepGoal : m === "activeEnergy" ? settings.energyGoal : null, height: 130, axis: false, label: M[m].title })}
      </button>`;
    }
    return h;
  };

  let range = { detail: 7, schlaf: 7 };

  views.detail = (m) => {
    if (!M[m]) return views.heute();
    const c = current(m), days = range.detail, pts = series(m, days);
    const vals = pts.map(p => p.v).filter(v => v != null);
    const a = avg(vals);
    const goal = m === "steps" ? settings.stepGoal : m === "activeEnergy" ? settings.energyGoal : null;
    let h = `<div class="card hero">
      ${cardHead(M[m].cumulative ? "Heute" : "Zuletzt gemessen", m, M[m].color)}
      <div style="display:flex;align-items:baseline;gap:8px;justify-content:space-between">
        <div class="big" style="font-size:40px">${c ? fmt(m, c.v) : "–"}<small> ${M[m].unit}</small></div>
        ${c && !M[m].cumulative ? trend(m, c.v, weekAvg(m)) : ""}
      </div>
      ${c && goal ? `<div class="meter" style="margin:10px 0 6px"><i style="width:${clamp(c.v / goal * 100, 2, 100)}%;background-color:${M[m].color}"></i></div>
        <div class="small muted">${Math.round(c.v / goal * 100)} % vom Tagesziel (${fmtU(m, goal)})</div>` :
        c ? `<div class="small muted">${new Date(c.t).toLocaleString("de-DE", { weekday: "long", hour: "2-digit", minute: "2-digit" })} Uhr</div>` : ""}
    </div>
    ${segmented("detail", days, [7, 30, 90])}
    <div class="card">
      <div class="readout"><div><div class="k" id="ro-k">Durchschnitt</div><div class="v" id="ro-v">${fmtU(m, a)}</div></div></div>
      ${chart("d-chart", pts, { mode: M[m].cumulative ? "bar" : "line", color: M[m].color, zero: M[m].cumulative, goal, avgLine: !goal,
        axisFmt: v => nf(v, M[m].dec && v < 100 ? 1 : 0), label: `${M[m].title}, ${days} Tage`,
        onSelect: p => {
          $("#ro-k").textContent = p ? keyDate(p.key).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }) : "Durchschnitt";
          $("#ro-v").textContent = p ? fmtU(m, p.v) : fmtU(m, a);
        } })}
    </div>`;

    const intra = data && data.intraday && data.intraday[m];
    if (!M[m].cumulative && intra && intra.length > 2) {
      const today = intra.filter(([t]) => dayKey(new Date(t)) === todayKey());
      const list = today.length > 2 ? today : intra.filter(([t]) => dayKey(new Date(t)) === dayKey(new Date(intra[intra.length - 1][0])));
      if (list.length > 2) h += intradayCard(m, list);
    }

    if (vals.length) {
      h += `<div class="card">${cardHead(`Statistik ${days} Tage`, "chart", M[m].color)}
        <div class="stat"><span>Durchschnitt</span><b>${fmtU(m, a)}</b></div>
        <div class="stat"><span>Niedrigster Tag</span><b>${fmtU(m, Math.min(...vals))}</b></div>
        <div class="stat"><span>Höchster Tag</span><b>${fmtU(m, Math.max(...vals))}</b></div>
        <div class="stat"><span>Tage mit Daten</span><b>${vals.length} von ${days}</b></div>
        ${goal ? (() => { const r = vals.filter(v => v >= goal).length; return `<div class="stat"><span>Ziel erreicht</span><b class="${r ? "ok" : ""}">${r} von ${vals.length} Tagen</b></div>`; })() : ""}
      </div>`;
    }
    h += `<div class="card">${cardHead("Was bedeutet das?", "info", "var(--accent)")}<div class="small muted">${M[m].explain}</div></div>`;
    return h;
  };

  function intradayCard(m, list) {
    const W = 340, H = 150, padT = 10, padB = 22, padR = 34;
    const vals = list.map(([, v]) => v), lo0 = Math.min(...vals), hi0 = Math.max(...vals);
    const lo = lo0 - Math.max(2, (hi0 - lo0) * .15), hi = hi0 + Math.max(2, (hi0 - lo0) * .15);
    const day0 = new Date(list[0][0]); day0.setHours(0, 0, 0, 0);
    const x = t => (new Date(t) - day0) / 86400e3 * (W - padR), y = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Einzelmessungen">`;
    for (let t = 0; t <= 2; t++) { const v = lo + (hi - lo) * t / 2; s += `<line class="grid" x1="0" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${W - padR + 6}" y="${y(v) + 4}">${nf(v)}</text>`; }
    for (let hr = 0; hr <= 24; hr += 6) s += `<text class="axis" x="${hr / 24 * (W - padR)}" y="${H - 4}" text-anchor="${hr === 0 ? "start" : hr === 24 ? "end" : "middle"}">${hr}</text>`;
    s += list.map(([t, v]) => `<circle cx="${x(t).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.6" fill="${M[m].color}" opacity=".8"/>`).join("");
    s += `</svg>`;
    const isToday = dayKey(day0) === todayKey();
    return `<div class="card">${cardHead(isToday ? "Heute im Verlauf" : "Letzter Tag im Verlauf", "clock", M[m].color, `${list.length} Messungen`)}
      <div class="chartwrap">${s}</div>
      <div style="display:flex;gap:8px;margin-top:10px"><span class="pill">Min ${fmt(m, lo0)}</span><span class="pill">Max ${fmt(m, hi0)}</span></div></div>`;
  }

  views.schlaf = () => {
    const days = range.schlaf, list = nightsFor(days), with_ = list.filter(x => x.night);
    const n = lastNight();
    const asleepVals = with_.map(x => asleepOf(x.night)), a = avg(asleepVals) || 0;
    let h = "";
    if (n) {
      const span = n.start && n.end ? (new Date(n.end) - new Date(n.start)) / 1000 : 0;
      h += `<div class="card hero">
        ${cardHead("Letzte Nacht", "sleep", "var(--violet)")}
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
          <div class="big" style="font-size:36px">${hm(asleepOf(n)).replace(/(\d+) h (\d+) min/, "$1<small> h </small>$2<small> min</small>")}</div>
          ${n.start ? `<span class="small muted num">${time(n.start)} – ${time(n.end)}</span>` : ""}
        </div>
        ${stageBar(n)}${legend(n)}
        ${span ? `<div class="tiny muted" style="margin-top:10px">Schlafeffizienz ${Math.round(clamp(asleepOf(n) / span, 0, 1) * 100)} %${n.awake ? ` · ${hm(n.awake)} wach` : ""}</div>` : ""}
      </div>`;
    }
    h += segmented("schlaf", days, [7, 30, 90]);
    const pts = list.map(x => ({
      key: x.key, v: x.night ? asleepOf(x.night) / 3600 : null,
      stack: x.night ? [[x.night.deep / 3600, "var(--deep)"], [x.night.core / 3600, "var(--violet)"], [x.night.rem / 3600, "var(--blue)"], [x.night.unspecified / 3600, "var(--accent-2)"]] : null,
    }));
    h += `<div class="card">
      <div class="readout"><div><div class="k" id="ro-k">Durchschnitt</div><div class="v" id="ro-v">${with_.length ? hm(a) : "–"}</div></div></div>
      ${chart("s-chart", pts, { mode: "stack", color: "var(--violet)", zero: true, goal: settings.sleepGoal / 60, axisFmt: v => `${Math.round(v)} h`,
        label: `Schlaf, ${days} Nächte`,
        onSelect: p => {
          $("#ro-k").textContent = p ? keyDate(p.key).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" }) : "Durchschnitt";
          $("#ro-v").textContent = p && p.v != null ? hm(p.v * 3600) : with_.length ? hm(a) : "–";
        } })}
      <div class="legend" style="margin-top:10px">${STAGES.slice(0, 4).map(([k, t]) => `<div><span class="dot s-${k}"></span>${t}</div>`).join("")}</div>
    </div>`;
    if (with_.length) {
      const reached = asleepVals.filter(v => v >= sleepGoalSec()).length;
      h += `<div class="card">${cardHead(`Durchschnitt ${days} Tage`, "chart", "var(--violet)")}
        <div class="stat"><span>Schlafdauer</span><b>${hm(a)}</b></div>
        ${STAGES.filter(([k]) => with_.some(x => x.night[k] > 0)).map(([k, t]) =>
          `<div class="stat"><span><span class="dot s-${k}" style="display:inline-block;margin-right:7px"></span>${t}</span><b>${hm(avg(with_.map(x => x.night[k] || 0)))}</b></div>`).join("")}
        <div class="stat"><span>Ziel erreicht</span><b class="${reached ? "ok" : ""}">${reached} von ${with_.length} Nächten</b></div>
      </div>`;
      const starts = with_.map(x => x.night.start).filter(Boolean), ends = with_.map(x => x.night.end).filter(Boolean);
      h += `<div class="card">${cardHead("Rhythmus", "clock", "var(--blue)")}
        <div class="stat"><span>Eingeschlafen im Schnitt</span><b>${avgClock(starts)}</b></div>
        <div class="stat"><span>Aufgewacht im Schnitt</span><b>${avgClock(ends)}</b></div>
        <div class="stat"><span>Schwankung Einschlafzeit</span><b>± ${spread(starts)} min</b></div>
      </div>`;
      h += `<div class="card">${cardHead("Nächte", "list", "var(--accent)")}
        ${with_.slice().reverse().map(x => `<div class="nightrow"><div class="top"><span>${keyDate(x.key).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "numeric" })}</span>
          <b class="num ${asleepOf(x.night) >= sleepGoalSec() ? "ok" : ""}">${hm(asleepOf(x.night))}</b></div>${stageBar(x.night, true)}</div>`).join("")}
      </div>`;
    }
    return h;
  };
  const eveMin = iso => { const d = new Date(iso); let m = d.getHours() * 60 + d.getMinutes() - 18 * 60; if (m < 0) m += 1440; return m; };
  function avgClock(list) {
    if (!list.length) return "–";
    const t = (Math.round(avg(list.map(eveMin))) + 18 * 60) % 1440;
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")} Uhr`;
  }
  function spread(list) {
    if (list.length < 2) return 0;
    const v = list.map(eveMin), a = avg(v);
    return Math.round(Math.sqrt(avg(v.map(x => (x - a) ** 2))));
  }

  views.profil = () => {
    const stepper = (key, label, step, min, max, f) => `<div class="setting"><span>${label}</span>
      <div class="stepper"><button data-step="${key}" data-d="${-step}" data-min="${min}" data-max="${max}" aria-label="${label} verringern">−</button>
      <b id="v-${key}">${f(settings[key])}</b>
      <button data-step="${key}" data-d="${step}" data-min="${min}" data-max="${max}" aria-label="${label} erhöhen">+</button></div></div>`;
    const nDays = data ? Object.keys(data.days).length : 0, nNights = data ? Object.keys(data.nights).length : 0;
    return `
    <div class="card">${cardHead("Tagesziele", "target", "var(--accent)")}
      ${stepper("stepGoal", "Schritte", 500, 1000, 40000, v => nf(v))}
      ${stepper("energyGoal", "Aktive Energie", 50, 100, 3000, v => `${nf(v)} kcal`)}
      ${stepper("sleepGoal", "Schlaf", 15, 300, 660, v => hm(v * 60))}
    </div>
    <div class="card">${cardHead("Daten", "sync", "var(--blue)", data ? relTime(data.updated) : "leer")}
      <div class="stat"><span>Tage mit Werten</span><b>${nDays}</b></div>
      <div class="stat"><span>Nächte</span><b>${nNights}</b></div>
      <div class="btnrow">
        <button class="primary" data-go="import">Neue Daten einfügen</button>
        <button class="secondary" data-go="anleitung">Kurzbefehl einrichten</button>
        ${data ? `<button class="secondary danger" data-action="wipe">Alle Daten löschen</button>` : ""}
      </div>
    </div>
    <div class="card">${cardHead("Darstellung", "paint", "var(--violet)")}
      <div class="setting"><span>Erscheinungsbild</span>
        <select id="themeSel"><option value="auto">Wie System</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></div>
    </div>
    <div class="card">${cardHead("Datenschutz", "lock", "var(--accent)")}
      <div class="small muted">Alle Werte bleiben im Browser dieses Geräts. RingTracker sendet nichts ins Internet und braucht kein Konto. Die Werte ersetzen keine ärztliche Beratung.</div>
    </div>
    <p class="tiny muted" style="text-align:center">RingTracker 1.0 · <a href="https://github.com/AGLLM39/ringtracker">Quellcode</a></p>`;
  };

  views.import = () => `
    <div class="card hero">
      ${cardHead("Daten einfügen", "sync", "var(--accent)")}
      <p class="small muted" style="margin:0 0 12px">Führe zuerst den Kurzbefehl „RingTracker“ aus. Er kopiert die Werte aus Apple Health. Dann hier tippen:</p>
      <button class="primary" data-action="paste">Aus Zwischenablage einfügen</button>
      <div id="importResult"></div>
    </div>
    <div class="card">
      <details class="fold"><summary>${svg("list", "var(--muted)")}Text von Hand einfügen</summary>
        <textarea id="importText" placeholder="RINGTRACKER&#10;## Schritte&#10;…" autocapitalize="off" autocomplete="off" spellcheck="false"></textarea>
        <div class="btnrow"><button class="secondary" data-action="importText">Übernehmen</button></div>
      </details>
    </div>
    ${guide()}`;

  function guide(open) {
    const sec = (name, type, extra = "") => `## ${name}\n[${type} · Startdatum · ISO 8601]\n==\n[${type} · Wert]${extra}`;
    const tpl = ["RINGTRACKER",
      sec("Schritte", "Schritte"), sec("Aktive Energie", "Aktive Energie"), sec("Herzfrequenz", "Herzfrequenz"),
      sec("Ruhepuls", "Ruhepuls"), sec("HRV", "HRV"), sec("Blutsauerstoff", "Blutsauerstoff"), sec("Atemfrequenz", "Atemfrequenz"),
      sec("Schlaf", "Schlaf", "\n==\n[Schlaf · Enddatum · ISO 8601]")].join("\n");
    return `<div class="card" id="anleitung">
      <details class="fold"${open ? " open" : ""}><summary>${svg("shortcut", "var(--accent)")}Kurzbefehl einrichten (einmalig, ca. 10 min)</summary>
      <ol class="steps">
        <li><span>In der <b>RingConn-App</b>: Profil → Apple Health → alle Kategorien einschalten. Die RingConn-App überträgt neue Werte, sobald du sie öffnest.</span></li>
        <li><span>App <b>Kurzbefehle</b> öffnen → <b>+</b> → oben den Namen <b>RingTracker</b> eintragen.</span></li>
        <li><span>Aktion suchen: <b>„Health“</b> → <b>Health-Proben suchen</b> (englisch: <i>Find Health Samples</i>). Einstellen:<br>
          Typ: <b>Schritte</b> · Filter: <b>Startdatum</b> ist in den letzten <b>30 Tagen</b> · Filter hinzufügen: <b>Quelle</b> ist <b>RingConn</b> · Sortieren nach Startdatum · Ohne Limit.</span></li>
        <li><span>Die Aktion noch 7-mal hinzufügen (oder duplizieren) für: <b>Aktive Energie</b>, <b>Herzfrequenz</b> (hier reichen 7 Tage), <b>Ruhepuls</b>, <b>Herzfrequenzvariabilität</b>, <b>Blutsauerstoff</b>, <b>Atemfrequenz</b> und <b>Schlafanalyse</b>.<br>
          <span class="muted">Tipp: Lang auf die Aktion drücken → Duplizieren, dann nur den Typ ändern.</span></span></li>
        <li><span>Aktion <b>Text</b> hinzufügen und diesen Aufbau nachbauen. Jedes <code>[ … ]</code> ist eine Variable: tippe an die Stelle, wähle oben <b>Variable auswählen</b> und tippe auf das Ergebnis der passenden Suche. Dann die Variable antippen und <b>Startdatum</b>, <b>Wert</b> oder <b>Enddatum</b> wählen; beim Datum als Format <b>ISO 8601</b>.
          <pre class="code">${esc(tpl)}</pre></span></li>
        <li><span>Aktion <b>In Zwischenablage kopieren</b> hinzufügen. Fertig.</span></li>
        <li><span>Ausführen, dann RingTracker öffnen und <b>Aus Zwischenablage einfügen</b> tippen. Beim ersten Mal fragt iOS, ob Health-Daten gelesen werden dürfen: erlauben.</span></li>
        <li><span><b>Jeden Morgen automatisch:</b> Kurzbefehle → Automation → <b>+</b> → Tageszeit, z. B. 8:00 → „Sofort ausführen“ → Kurzbefehl RingTracker. Danach reicht in der App ein Tipp auf „Einfügen“.</span></li>
      </ol>
      <p class="tiny muted" style="margin:12px 0 0">Wenn etwas nicht klappt: Text von Hand einfügen. RingTracker zeigt dann, welche Abschnitte erkannt wurden.</p>
      </details></div>`;
  }

  // ---------- Import ----------
  function doImport(text) {
    const parsed = RTImport.parse(text);
    const box = $("#importResult");
    const total = parsed.sections.reduce((a, s) => a + s.count, 0);
    if (!total) {
      if (box) box.innerHTML = `<div class="small" style="margin-top:12px;color:var(--over)">${esc(parsed.warnings[0] || "Keine Werte gefunden.")}</div>`;
      toast("Keine Werte gefunden");
      return false;
    }
    const agg = RTImport.aggregate(parsed);
    const base = data && !data.demo ? data : null;
    data = RTImport.merge(base, agg);
    save(DATA_KEY, data);
    const nn = Object.keys(agg.nights).length, nd = Object.keys(agg.days).length;
    const names = { sleep: "Schlaf", ...Object.fromEntries(Object.entries(M).map(([k, v]) => [k, v.title])) };
    const missing = Object.keys(names).filter(k => !parsed.sections.some(s => s.name === k && s.count));
    if (box) box.innerHTML = `<div class="small" style="margin-top:12px">
      <b style="color:var(--ok)">✓ ${nd} Tage und ${nn} Nächte übernommen.</b>
      <div class="muted" style="margin-top:4px">${parsed.sections.filter(s => s.count).map(s => `${names[s.name]} ${s.count}`).join(" · ")}</div>
      ${missing.length ? `<div style="margin-top:4px;color:var(--warn-ink)">Nicht enthalten: ${missing.map(k => names[k]).join(", ")}</div>` : ""}
      ${parsed.warnings.length ? `<div class="muted" style="margin-top:4px">${parsed.warnings.map(esc).join("<br>")}</div>` : ""}
    </div>`;
    toast(`${nn} Nächte, ${nd} Tage übernommen`);
    setTimeout(() => { if (location.hash === "#import") go("heute"); }, missing.length || parsed.warnings.length ? 3500 : 1400);
    return true;
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      doImport(text);
    } catch (e) {
      toast("Kein Zugriff auf die Zwischenablage. Bitte von Hand einfügen.");
      const d = $("details.fold"); if (d) d.open = true;
      const ta = $("#importText"); if (ta) ta.focus();
    }
  }

  // ---------- Navigation ----------
  const TITLES = { heute: null, woche: "Woche", profil: "Profil", schlaf: "Schlaf", import: "Daten einfügen", welcome: null };
  let current_ = "heute";

  function go(route) { location.hash = route; }

  function render() {
    let route = decodeURIComponent(location.hash.slice(1)) || "heute";
    if (route === "anleitung") { route = "import"; setTimeout(() => { const d = $("#anleitung details"); if (d) { d.open = true; $("#anleitung").scrollIntoView({ behavior: "smooth" }); } }, 60); }
    if (!data && !["import", "welcome"].includes(route)) route = "welcome";
    const [name, arg] = route.split("/");
    const viewName = name === "m" ? "detail" : (views[name] ? name : "heute");
    current_ = viewName;
    for (const id of Object.keys(charts)) delete charts[id];

    const el = document.getElementById("view-" + viewName);
    el.innerHTML = viewName === "detail" ? views.detail(arg) : views[viewName]();
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v === el));

    const sub = ["detail", "schlaf", "import"].includes(viewName);
    $("#header").classList.toggle("sub", sub);
    $("#title").textContent = viewName === "detail" ? (M[arg] ? M[arg].title : "") : (TITLES[viewName] || "RingTracker");
    $("#subtitle").textContent = sub ? "" : viewName === "woche" ? "Die letzten 7 Tage" : viewName === "profil" ? "Ziele und Einstellungen"
      : new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
    $("#importBtn").hidden = !data || sub;
    document.body.classList.toggle("noapp", !data || viewName === "welcome");
    const tab = ["heute", "woche", "profil"].includes(viewName) ? viewName : viewName === "detail" || viewName === "schlaf" ? null : null;
    document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-current", String(b.dataset.tab === tab)));
    if (viewName === "profil") { const s = $("#themeSel"); if (s) s.value = settings.theme; }
    window.scrollTo(0, 0);
  }

  // ---------- Ereignisse ----------
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-go],[data-tab],[data-action],[data-seg],[data-step],.hit,#backBtn,#importBtn");
    if (!t) return;
    if (t.classList.contains("hit")) { const svgEl = t.closest("svg"); if (svgEl && /^(d|s)-/.test(svgEl.id)) selectPoint(svgEl.id, +t.dataset.i); else { const card = t.closest("[data-go]"); if (card) go(card.dataset.go); } return; }
    if (t.id === "backBtn") { history.length > 1 ? history.back() : go("heute"); return; }
    if (t.id === "importBtn") { go("import"); return; }
    if (t.dataset.tab) { go(t.dataset.tab); return; }
    if (t.dataset.go) { go(t.dataset.go); return; }
    if (t.dataset.seg) { range[t.dataset.seg] = +t.dataset.val; const y = window.scrollY; render(); window.scrollTo(0, y); return; }
    if (t.dataset.step) {
      const k = t.dataset.step, v = clamp(settings[k] + +t.dataset.d, +t.dataset.min, +t.dataset.max);
      settings[k] = v; save(SET_KEY, settings);
      const f = { stepGoal: x => nf(x), energyGoal: x => `${nf(x)} kcal`, sleepGoal: x => hm(x * 60) }[k];
      $("#v-" + k).textContent = f(v);
      return;
    }
    const a = t.dataset.action;
    if (a === "paste") pasteFromClipboard();
    else if (a === "importText") doImport($("#importText").value);
    else if (a === "demo") {
      const parsed = RTImport.parse(RTBeispiel.generate(90));
      data = RTImport.merge(null, RTImport.aggregate(parsed)); data.demo = true;
      save(DATA_KEY, data); go("heute"); render();
    } else if (a === "wipe") {
      if (confirmWipe(t)) { data = null; try { localStorage.removeItem(DATA_KEY); } catch (e) {} toast("Alle Daten gelöscht"); go("welcome"); }
    }
  });
  // Zweimal tippen statt Dialog (Dialoge stören auf iOS-Home-Bildschirm-Apps)
  function confirmWipe(btn) {
    if (btn.dataset.armed) return true;
    btn.dataset.armed = "1"; btn.textContent = "Wirklich löschen? Nochmal tippen";
    setTimeout(() => { delete btn.dataset.armed; btn.textContent = "Alle Daten löschen"; }, 4000);
    return false;
  }
  document.addEventListener("change", e => {
    if (e.target.id === "themeSel") { settings.theme = e.target.value; save(SET_KEY, settings); applyTheme(); }
  });
  window.addEventListener("hashchange", render);

  function applyTheme() {
    if (settings.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", settings.theme);
  }

  let toastTimer;
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  // Neu rendern, wenn die App nach längerer Zeit wieder geöffnet wird (neuer Tag)
  let lastShown = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - lastShown > 10 * 60e3) render();
    if (document.visibilityState === "hidden") lastShown = Date.now();
  });

  applyTheme();
  render();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  window.RT = { get data() { return data; }, doImport, render, APP_URL };
})();
