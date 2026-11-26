/* Test für den Health-Export. Aufruf: node web/tests/export.test.js [MB]
   Erzeugt eine Testdatei mit python3 und liest sie wie im Browser. */
const assert = require("assert");
const { execFileSync } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
globalThis.RTImport = require("../rt-import.js");
const RTExport = require("../rt-export.js");
(async () => {
  const mb = +process.argv[2] || 5;
  const zip = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rt-")), "export.zip");
  execFileSync("python3", [path.join(__dirname, "export-beispiel.py"), zip, String(mb)]);
  const file = await fs.openAsBlob(zip);
  const t0 = Date.now();
  const parsed = await RTExport.importFile(file, { days: 120 });
  const ms = Date.now() - t0;
  assert.strictEqual(parsed.sources.steps, "RingConn");
  assert.strictEqual(parsed.sources.sleep, "RingConn");
  assert.ok(parsed.metrics.heartRate.length > 1000, "Puls mit Unterelementen gelesen");
  const agg = RTImport.aggregate(parsed);
  const y = new Date(); y.setDate(y.getDate() - 1);
  const d = agg.days[RTImport.dayKey(y)];
  assert.ok(d.steps > 6000 && d.steps < 16000, "Schritte nur von RingConn: " + d.steps);
  assert.ok(d.activeEnergy > 200 && d.activeEnergy < 800, "kJ → kcal: " + d.activeEnergy);
  assert.ok(d.oxygen > 90, "Sauerstoff in %");
  const nights = Object.values(agg.nights);
  assert.ok(nights.length >= 40, "Nächte: " + nights.length);
  const n = agg.nights[RTImport.dayKey(new Date())];
  const asleep = n.deep + n.core + n.rem + n.unspecified;
  assert.ok(asleep > 5.5 * 3600 && asleep < 8.5 * 3600, "Schlafdauer: " + asleep / 3600);
  assert.ok(!Object.keys(agg.days).some(k => k < "2025"), "alte Daten verworfen");
  console.log(`✓ Export ${mb} MB Füllmaterial gelesen in ${ms} ms, ${nights.length} Nächte`);
})().catch(e => { console.error(e); process.exit(1); });
