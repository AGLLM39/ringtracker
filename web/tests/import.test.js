/* Tests für den Import. Aufruf: node web/tests/import.test.js */
const assert = require("assert");
const RT = require("../rt-import.js");
const { generate } = require("../rt-beispiel.js");

let n = 0; const ok = (name, fn) => { fn(); n++; console.log("✓", name); };

ok("Zahlen", () => {
  assert.strictEqual(RT.parseNumber("54,3"), 54.3);
  assert.strictEqual(RT.parseNumber("10.234"), 10234);
  assert.strictEqual(RT.parseNumber("10,234"), 10234);
  assert.strictEqual(RT.parseNumber("1.234,5 kcal"), 1234.5);
  assert.strictEqual(RT.parseNumber("97 %"), 97);
  assert.strictEqual(RT.parseNumber("62 count/min"), 62);
  assert.strictEqual(RT.parseNumber("0.97"), 0.97);
});
ok("Datum", () => {
  const a = RT.parseDate("2026-11-25T23:41:00+01:00");
  assert.strictEqual(a.toISOString(), "2026-11-25T22:41:00.000Z");
  const b = RT.parseDate("25.11.2026, 23:41");
  assert.deepStrictEqual([b.getDate(), b.getMonth(), b.getHours(), b.getMinutes()], [25, 10, 23, 41]);
  const c = RT.parseDate("25. Nov. 2026 um 07:05");
  assert.deepStrictEqual([c.getDate(), c.getMonth(), c.getHours()], [25, 10, 7]);
  const d = RT.parseDate("Nov 25, 2026 at 11:41 PM");
  assert.strictEqual(d.getHours(), 23);
});
ok("Schlafphasen", () => {
  assert.strictEqual(RT.sleepStage("Tiefschlaf"), "deep");
  assert.strictEqual(RT.sleepStage("Kernschlaf"), "core");
  assert.strictEqual(RT.sleepStage("REM-Schlaf"), "rem");
  assert.strictEqual(RT.sleepStage("Wach"), "awake");
  assert.strictEqual(RT.sleepStage("Im Bett"), null);
  assert.strictEqual(RT.sleepStage("Schlafend"), "unspecified");
  assert.strictEqual(RT.sleepStage("Asleep (Deep)"), "deep");
});
ok("Kompletter Beispieltext", () => {
  const parsed = RT.parse(generate(30));
  assert.deepStrictEqual(parsed.warnings, []);
  assert.ok(parsed.metrics.steps.length > 100);
  assert.ok(parsed.sleep.length > 50);
  const agg = RT.aggregate(parsed);
  const keys = Object.keys(agg.nights).sort();
  assert.strictEqual(keys.length, 30);
  const last = agg.nights[keys[keys.length - 1]];
  const asleep = last.deep + last.core + last.rem;
  assert.ok(asleep > 5 * 3600 && asleep < 9 * 3600, "Schlafdauer plausibel: " + asleep / 3600);
  const today = RT.dayKey(new Date());
  assert.ok(agg.days[today].restingHeartRate >= 52);
  assert.ok(agg.days[today].oxygen > 90 && agg.days[today].oxygen <= 100);
  const merged = RT.merge({ days: { "2020-01-01": { steps: 5 } } }, agg);
  assert.strictEqual(merged.days["2020-01-01"].steps, 5);
  const y = new Date(); y.setDate(y.getDate() - 1);
  assert.ok(merged.days[RT.dayKey(y)].steps > 3000);
});
ok("Unbekannter Text", () => {
  const p = RT.parse("Hallo");
  assert.strictEqual(p.warnings.length, 1);
});
ok("Gruppierte Tageswerte ohne Uhrzeit", () => {
  const p = RT.parse("## Schritte\n2026-11-24\n2026-11-25\n==\n8.512\n12.004\n");
  const a = RT.aggregate(p);
  assert.strictEqual(a.days["2026-11-25"].steps, 12004);
});
ok("Schlaf ohne Doppelzählung", () => {
  const d = (h, m) => new Date(2026, 10, h < 12 ? 26 : 25, h, m);
  const phases = [[23, 52, 1, 30, "core"], [1, 30, 2, 40, "deep"], [2, 40, 3, 0, "awake"], [3, 0, 5, 0, "core"], [5, 0, 6, 44, "rem"]]
    .map(([h1, m1, h2, m2, stage]) => ({ start: d(h1, m1), end: d(h2, m2), stage }));
  // Jede Phase doppelt (zweimal synchronisiert) plus „Schlafend“ über die ganze Nacht
  const sleep = [...phases, ...phases.map(x => ({ ...x })), { start: d(23, 52), end: d(6, 44), stage: "unspecified" }];
  const n = RT.aggregate({ metrics: {}, sleep }).nights["2026-11-26"];
  const asleep = (n.deep + n.core + n.rem + n.unspecified) / 3600;
  assert.ok(Math.abs(asleep - (6 + 52 / 60 - 20 / 60)) < 1e-6, asleep);
  assert.strictEqual(n.awake, 20 * 60);
  assert.strictEqual(n.unspecified, 0);
  assert.strictEqual(new Date(n.start).getHours(), 23);
  assert.strictEqual(new Date(n.end).getMinutes(), 44);
});
console.log(`${n} Tests bestanden`);
