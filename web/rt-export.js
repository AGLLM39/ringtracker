/* RingTracker – Import des Apple-Health-Exports (export.zip oder export.xml).
   Health → Profil → „Alle Gesundheitsdaten exportieren“ erzeugt eine ZIP-Datei mit export.xml.
   Die Datei kann mehrere hundert MB groß sein. Deshalb wird sie hier gestreamt:
   ZIP-Eintrag finden → mit DecompressionStream entpacken → Text stückweise nach <Record …> durchsuchen.
   Es werden nur die benötigten Typen der letzten `days` Tage behalten. */
(function (root) {
  "use strict";

  const TYPES = {
    HKQuantityTypeIdentifierStepCount: "steps",
    HKQuantityTypeIdentifierActiveEnergyBurned: "activeEnergy",
    HKQuantityTypeIdentifierHeartRate: "heartRate",
    HKQuantityTypeIdentifierRestingHeartRate: "restingHeartRate",
    HKQuantityTypeIdentifierHeartRateVariabilitySDNN: "hrv",
    HKQuantityTypeIdentifierOxygenSaturation: "oxygen",
    HKQuantityTypeIdentifierRespiratoryRate: "respiratoryRate",
    HKCategoryTypeIdentifierSleepAnalysis: "sleep",
  };

  // „2026-11-25 23:41:00 +0100“ → Date
  function parseExportDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(s);
    if (!m) return null;
    const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    const off = (+m[8] * 60 + +m[9]) * (m[7] === "+" ? 1 : -1);
    return new Date(utc - off * 60e3);
  }

  function attrs(tag) {
    const out = {};
    const re = /(\w+)="([^"]*)"/g;
    let m;
    while ((m = re.exec(tag))) out[m[1]] = m[2];
    return out;
  }

  const isRing = name => /ringconn/i.test(name || "");

  /** Sammelt Datensätze, nach Typ und Quelle getrennt. */
  function makeCollector(days) {
    const cutoff = new Date(Date.now() - days * 86400e3);
    const cutStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
    const bins = {}; // name → source → list
    let seen = 0, kept = 0;
    function add(tag) {
      seen++;
      const ti = tag.indexOf('type="');
      if (ti < 0) return;
      const type = tag.slice(ti + 6, tag.indexOf('"', ti + 6));
      const name = TYPES[type];
      if (!name) return;
      const si = tag.indexOf('startDate="');
      if (si < 0 || tag.slice(si + 11, si + 21) < cutStr) return; // zu alt: früh aussortieren
      const a = attrs(tag);
      const start = parseExportDate(a.startDate);
      if (!start) return;
      const src = a.sourceName || "?";
      const list = ((bins[name] || (bins[name] = {}))[src] || (bins[name][src] = []));
      if (name === "sleep") {
        const end = parseExportDate(a.endDate);
        const stage = root.RTImport.sleepStage(String(a.value || "").replace("HKCategoryValueSleepAnalysis", ""));
        if (!end || end <= start || stage === null) return;
        list.push({ start, end, stage });
      } else {
        let v = parseFloat(a.value);
        if (!isFinite(v)) return;
        if (name === "activeEnergy" && /kJ/i.test(a.unit || "")) v /= 4.184;
        if (name === "oxygen" && v <= 1) v *= 100;
        if (name === "hrv" && a.unit === "s") v *= 1000;
        list.push({ t: start, v });
      }
      kept++;
    }
    /** Pro Typ eine Quelle: RingConn, sonst die mit den meisten Einträgen (vermeidet Doppelzählung). */
    function result() {
      const parsed = { metrics: {}, sleep: [], warnings: [], sections: [], sources: {} };
      for (const [name, bySrc] of Object.entries(bins)) {
        const names = Object.keys(bySrc);
        const chosen = names.find(isRing) || names.sort((x, y) => bySrc[y].length - bySrc[x].length)[0];
        parsed.sources[name] = chosen;
        if (name === "sleep") parsed.sleep = bySrc[chosen];
        else parsed.metrics[name] = bySrc[chosen];
        parsed.sections.push({ name, count: bySrc[chosen].length });
      }
      return parsed;
    }
    return { add, result, get seen() { return seen; }, get kept() { return kept; } };
  }

  // ---------- ZIP ----------
  async function readBytes(file, start, end) {
    return new DataView(await file.slice(start, end).arrayBuffer());
  }

  /** Findet export.xml in der ZIP-Datei über das zentrale Verzeichnis. */
  async function findZipEntry(file) {
    const tailLen = Math.min(file.size, 70000);
    const tail = await readBytes(file, file.size - tailLen, file.size);
    let eocd = -1;
    for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error("Keine gültige ZIP-Datei.");
    let cdSize = tail.getUint32(eocd + 12, true), cdOff = tail.getUint32(eocd + 16, true);
    if (cdOff === 0xffffffff || cdSize === 0xffffffff) {
      // ZIP64: Locator steht 20 Bytes vor dem EOCD
      const loc = eocd - 20;
      if (loc >= 0 && tail.getUint32(loc, true) === 0x07064b50) {
        const off64 = Number(tail.getBigUint64(loc + 8, true));
        const e64 = await readBytes(file, off64, off64 + 56);
        cdSize = Number(e64.getBigUint64(40, true));
        cdOff = Number(e64.getBigUint64(48, true));
      }
    }
    const cd = await readBytes(file, cdOff, cdOff + cdSize);
    const dec = new TextDecoder();
    let p = 0, best = null;
    while (p + 46 <= cd.byteLength && cd.getUint32(p, true) === 0x02014b50) {
      const method = cd.getUint16(p + 10, true);
      let comp = cd.getUint32(p + 20, true), size = cd.getUint32(p + 24, true);
      const nLen = cd.getUint16(p + 28, true), xLen = cd.getUint16(p + 30, true), cLen = cd.getUint16(p + 32, true);
      let local = cd.getUint32(p + 42, true);
      const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nLen));
      // ZIP64-Zusatzfeld
      let x = p + 46 + nLen;
      const xEnd = x + xLen;
      while (x + 4 <= xEnd) {
        const id = cd.getUint16(x, true), len = cd.getUint16(x + 2, true);
        if (id === 0x0001) {
          let q = x + 4;
          if (size === 0xffffffff) { size = Number(cd.getBigUint64(q, true)); q += 8; }
          if (comp === 0xffffffff) { comp = Number(cd.getBigUint64(q, true)); q += 8; }
          if (local === 0xffffffff) { local = Number(cd.getBigUint64(q, true)); }
        }
        x += 4 + len;
      }
      if (/(^|\/)export\.xml$/i.test(name)) best = { name, method, comp, size, local };
      p += 46 + nLen + xLen + cLen;
    }
    if (!best) throw new Error("In der ZIP-Datei fehlt export.xml. Ist das der Export aus Apple Health?");
    const lh = await readBytes(file, best.local, best.local + 30);
    const dataStart = best.local + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    return Object.assign(best, { dataStart });
  }

  /** Liest die Datei und ruft onProgress(0…1) auf. Gibt ein Ergebnis im Format von RTImport.parse zurück. */
  async function importFile(file, { days = 120, onProgress } = {}) {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isZip = head[0] === 0x50 && head[1] === 0x4b;
    let stream, total;
    if (isZip) {
      const e = await findZipEntry(file);
      const raw = file.slice(e.dataStart, e.dataStart + e.comp).stream();
      if (e.method === 0) stream = raw;
      else if (e.method === 8) {
        if (typeof DecompressionStream === "undefined") throw new Error("Dieser Browser kann ZIP nicht entpacken. Bitte iOS aktualisieren oder export.xml direkt wählen.");
        stream = raw.pipeThrough(new DecompressionStream("deflate-raw"));
      } else throw new Error("Unbekannte ZIP-Kompression.");
      total = e.size || e.comp * 12;
    } else {
      stream = file.stream();
      total = file.size;
    }

    const col = makeCollector(days);
    const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
    let rest = "", done = 0, lastTick = 0;
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      done += value.length; // Zeichen ≈ Bytes (XML ist fast nur ASCII)
      let text = rest + value;
      let i = 0;
      for (;;) {
        const s = text.indexOf("<Record ", i);
        if (s < 0) { rest = text.slice(Math.max(i, text.length - 8)); break; }
        const e = text.indexOf(">", s);
        if (e < 0) { rest = text.slice(s); i = text.length; break; }
        col.add(text.slice(s + 8, e));
        i = e + 1;
      }
      if (onProgress && Date.now() - lastTick > 120) {
        lastTick = Date.now();
        onProgress(Math.min(0.99, done / total), col.kept);
        await new Promise(r => setTimeout(r, 0)); // Oberfläche aktualisieren lassen
      }
    }
    if (onProgress) onProgress(1, col.kept);
    const parsed = col.result();
    if (!parsed.sections.length) parsed.warnings.push("Keine passenden Werte gefunden. Überträgt die RingConn-App an Apple Health?");
    return parsed;
  }

  const api = { importFile, parseExportDate, makeCollector, TYPES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RTExport = api;
})(typeof window !== "undefined" ? window : globalThis);
