/* RingTracker – Import der Daten aus dem iOS-Kurzbefehl.
   Der Kurzbefehl kopiert einen Text dieser Form in die Zwischenablage:

     RINGTRACKER
     ## Schritte
     <Startdatum je Messung, eine pro Zeile>
     ==
     <Wert je Messung, eine pro Zeile>
     ## Schlaf
     <Startdatum>
     ==
     <Wert, z. B. „Tiefschlaf“>
     ==
     <Enddatum>

   Der Parser ist absichtlich tolerant: deutsche und englische Abschnittsnamen,
   ISO- oder deutsches Datumsformat, Komma oder Punkt als Dezimalzeichen,
   einzelne Messungen oder schon nach Tag gruppierte Werte. */
(function (root) {
  "use strict";

  const METRICS = {
    steps:            { cumulative: true },
    activeEnergy:     { cumulative: true },
    heartRate:        { cumulative: false },
    restingHeartRate: { cumulative: false },
    hrv:              { cumulative: false },
    oxygen:           { cumulative: false },
    respiratoryRate:  { cumulative: false },
  };

  // Abschnittsnamen → interne Namen (Reihenfolge zählt: spezifische zuerst)
  const ALIASES = [
    [/ruhe|resting/i, "restingHeartRate"],
    [/hrv|variab/i, "hrv"],
    [/atem|respir/i, "respiratoryRate"],
    [/sauerstoff|spo2|oxygen|o2/i, "oxygen"],
    [/schlaf|sleep/i, "sleep"],
    [/schritt|step/i, "steps"],
    [/energie|energy|kcal|kalorien|aktiv/i, "activeEnergy"],
    [/puls|herz|heart|hr\b/i, "heartRate"],
  ];

  function sectionName(raw) {
    for (const [re, name] of ALIASES) if (re.test(raw)) return name;
    return null;
  }

  // ---------- Zahlen ----------
  function parseNumber(raw) {
    if (raw == null) return NaN;
    let s = String(raw).trim().replace(/ | /g, " ");
    const m = s.match(/-?[\d.,' ]*\d/);
    if (!m) return NaN;
    s = m[0].replace(/[' ]/g, "");
    const hasComma = s.includes(","), hasDot = s.includes(".");
    if (hasComma && hasDot) {
      // Das zuletzt stehende Zeichen ist das Dezimalzeichen
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
      else s = s.replace(/,/g, "");
    } else if (hasComma) {
      s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
    } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, ""); // 10.234 = zehntausend
    }
    return parseFloat(s);
  }

  // ---------- Datum ----------
  const MONTHS = { jan: 0, feb: 1, mär: 2, mae: 2, mar: 2, apr: 3, mai: 4, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, dez: 11, dec: 11 };

  function parseDate(raw) {
    if (!raw) return null;
    const s = String(raw).trim().replace(/ | /g, " ");
    // ISO 8601: 2026-11-25T23:41:00+01:00 (auch mit Leerzeichen statt T)
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?/);
    if (m) {
      if (m[7]) {
        const d = new Date(s.replace(" ", "T"));
        if (!isNaN(d)) return d;
      }
      return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    // Deutsch: 25.11.2026, 23:41 oder 25.11.26 um 23:41
    m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:,|\s+um)?\s*(\d{1,2})?:?(\d{2})?(?::(\d{2}))?/);
    if (m) {
      let y = +m[3]; if (y < 100) y += 2000;
      return new Date(y, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    }
    // Deutsch ausgeschrieben: 25. Nov. 2026 um 23:41
    m = s.match(/^(\d{1,2})\.\s*([A-Za-zäÄ]{3})[a-zäÄ]*\.?\s+(\d{4})(?:,|\s+um)?\s*(\d{1,2})?:?(\d{2})?/);
    if (m && MONTHS[m[2].toLowerCase()] != null) {
      return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +(m[4] || 0), +(m[5] || 0));
    }
    // Englisch u. a.: vom Browser lesen lassen („Nov 25, 2026 at 11:41 PM“)
    const d = new Date(s.replace(/\s+at\s+/i, " "));
    return isNaN(d) ? null : d;
  }

  // ---------- Schlafphasen ----------
  function sleepStage(raw) {
    const s = String(raw || "").toLowerCase();
    if (/bett|bed/.test(s)) return null; // „Im Bett“ ist kein Schlaf
    if (/wach|awake/.test(s)) return "awake";
    if (/tief|deep/.test(s)) return "deep";
    if (/rem/.test(s)) return "rem";
    if (/kern|core|leicht|light/.test(s)) return "core";
    if (/schlaf|asleep|sleep|unspec/.test(s)) return "unspecified";
    // HealthKit-Rohwerte, falls Zahlen kommen
    const n = parseNumber(s);
    return { 1: "unspecified", 2: "awake", 3: "core", 4: "deep", 5: "rem" }[n] || null;
  }

  // ---------- Hauptfunktion ----------
  function parse(text) {
    const result = { metrics: {}, sleep: [], warnings: [], sections: [] };
    if (!text || !/##/.test(text)) {
      result.warnings.push("Kein RingTracker-Text erkannt. Bitte zuerst den Kurzbefehl ausführen.");
      return result;
    }
    const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
    let current = null;
    const sections = [];
    for (const line of lines) {
      const h = line.match(/^\s*#{2,}\s*(.+?)\s*$/);
      if (h) { current = { raw: h[1], name: sectionName(h[1]), blocks: [[]] }; sections.push(current); continue; }
      if (!current) continue;
      if (/^\s*={2,}\s*$/.test(line)) { current.blocks.push([]); continue; }
      if (line.trim() !== "") current.blocks[current.blocks.length - 1].push(line.trim());
    }

    for (const sec of sections) {
      if (!sec.name) { result.warnings.push(`Abschnitt „${sec.raw}“ unbekannt, übersprungen.`); continue; }
      const [dates = [], values = [], ends = []] = sec.blocks;
      if (sec.name === "sleep") {
        let ok = 0;
        for (let i = 0; i < Math.min(dates.length, values.length, ends.length); i++) {
          const start = parseDate(dates[i]), end = parseDate(ends[i]), stage = sleepStage(values[i]);
          if (!start || !end || end <= start || stage === null) continue;
          result.sleep.push({ start, end, stage }); ok++;
        }
        if (dates.length && !ends.length) result.warnings.push("Schlaf: Enddatum fehlt (dritter Block nach „==“).");
        result.sections.push({ name: "sleep", count: ok });
      } else {
        const list = result.metrics[sec.name] || (result.metrics[sec.name] = []);
        let ok = 0;
        for (let i = 0; i < Math.min(dates.length, values.length); i++) {
          const t = parseDate(dates[i]); let v = parseNumber(values[i]);
          if (!t || !isFinite(v)) continue;
          if (sec.name === "oxygen" && v <= 1) v *= 100; // 0,97 → 97 %
          list.push({ t, v }); ok++;
        }
        if (dates.length !== values.length) result.warnings.push(`${sec.raw}: ${dates.length} Daten, aber ${values.length} Werte.`);
        result.sections.push({ name: sec.name, count: ok });
      }
    }
    return result;
  }

  // ---------- Zusammenfassen ----------
  function dayKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  /** Nacht gehört zum Tag des Aufwachens (Ende + 6 h). */
  function nightKey(end) { return dayKey(new Date(end.getTime() + 6 * 3600e3)); }

  /** Baut aus dem geparsten Ergebnis Tageswerte, Nächte und Einzelmessungen. */
  function aggregate(parsed) {
    const days = {}, latest = {}, intraday = {};
    for (const [name, list] of Object.entries(parsed.metrics)) {
      if (!METRICS[name] || !list.length) continue;
      const buckets = {};
      for (const { t, v } of list) (buckets[dayKey(t)] || (buckets[dayKey(t)] = [])).push(v);
      for (const [k, vals] of Object.entries(buckets)) {
        const sum = vals.reduce((a, b) => a + b, 0);
        (days[k] || (days[k] = {}))[name] = METRICS[name].cumulative ? sum : sum / vals.length;
      }
      const sorted = list.slice().sort((a, b) => a.t - b.t);
      const last = sorted[sorted.length - 1];
      latest[name] = { v: last.v, t: last.t.toISOString() };
      // Einzelmessungen der letzten 2 Tage für den Tagesverlauf
      const cutoff = Date.now() - 2 * 86400e3;
      intraday[name] = sorted.filter(p => p.t.getTime() >= cutoff).map(p => [p.t.toISOString(), p.v]);
    }

    const nights = {};
    for (const s of parsed.sleep) {
      const k = nightKey(s.end);
      const n = nights[k] || (nights[k] = { deep: 0, core: 0, rem: 0, unspecified: 0, awake: 0, start: null, end: null });
      n[s.stage] += (s.end - s.start) / 1000;
      if (s.stage !== "awake") {
        if (!n.start || s.start < new Date(n.start)) n.start = s.start.toISOString();
        if (!n.end || s.end > new Date(n.end)) n.end = s.end.toISOString();
      }
    }
    // Überlappungen (z. B. „Schlafend“ und Phasen gleichzeitig) nicht doppelt zählen
    for (const n of Object.values(nights)) {
      const staged = n.deep + n.core + n.rem;
      if (staged > 0 && n.unspecified > 0 && n.start && n.end) {
        const span = (new Date(n.end) - new Date(n.start)) / 1000;
        if (staged + n.unspecified > span * 1.05) n.unspecified = 0;
      }
    }
    for (const k of Object.keys(nights)) {
      const n = nights[k];
      if (n.deep + n.core + n.rem + n.unspecified <= 0) delete nights[k];
    }
    return { days, latest, intraday, nights };
  }

  /** Neue Daten in den Bestand übernehmen: importierte Tage ersetzen alte. */
  function merge(store, agg) {
    const out = {
      version: 1,
      days: Object.assign({}, store && store.days),
      latest: Object.assign({}, store && store.latest),
      intraday: Object.assign({}, store && store.intraday),
      nights: Object.assign({}, store && store.nights),
      updated: new Date().toISOString(),
    };
    for (const [k, vals] of Object.entries(agg.days)) out.days[k] = Object.assign({}, out.days[k], vals);
    for (const [name, v] of Object.entries(agg.latest)) {
      if (!out.latest[name] || new Date(v.t) >= new Date(out.latest[name].t)) out.latest[name] = v;
    }
    Object.assign(out.intraday, agg.intraday);
    Object.assign(out.nights, agg.nights);
    return out;
  }

  const api = { parse, aggregate, merge, parseNumber, parseDate, sleepStage, dayKey, nightKey, METRICS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RTImport = api;
})(typeof window !== "undefined" ? window : globalThis);
