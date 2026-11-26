/* Erzeugt Beispieltext wie vom Kurzbefehl (für Tests und die Demo).
   Aufruf: node web/rt-beispiel.js [tage] > beispiel.txt */
function iso(d) {
  const p = n => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset(), s = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00${s}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}
function generate(days = 30, seed = 7) {
  let x = seed; const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sec = { Schritte: [], "Aktive Energie": [], Herzfrequenz: [], Ruhepuls: [], HRV: [], Blutsauerstoff: [], Atemfrequenz: [] };
  const sleep = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today); day.setDate(day.getDate() - i);
    const isToday = i === 0;
    const hours = isToday ? Math.max(1, new Date().getHours()) : 22;
    for (let h = 7; h < hours; h++) {
      const t = new Date(day); t.setHours(h, 30);
      sec.Schritte.push([iso(t), Math.round(300 + rnd() * 900)]);
      sec["Aktive Energie"].push([iso(t), (15 + rnd() * 45).toFixed(1).replace(".", ",")]);
      for (let m = 0; m < 60; m += 20) { const u = new Date(t); u.setMinutes(m); sec.Herzfrequenz.push([iso(u), Math.round(62 + rnd() * 35)]); }
    }
    const night = new Date(day); night.setHours(0, 0);
    sec.Ruhepuls.push([iso(new Date(day.getTime() + 7 * 3600e3)), Math.round(52 + rnd() * 6)]);
    sec.HRV.push([iso(new Date(day.getTime() + 4 * 3600e3)), Math.round(38 + rnd() * 22)]);
    sec.Blutsauerstoff.push([iso(new Date(day.getTime() + 3 * 3600e3)), (0.94 + rnd() * 0.05).toFixed(2)]);
    sec.Atemfrequenz.push([iso(new Date(day.getTime() + 3 * 3600e3)), (13 + rnd() * 3).toFixed(1).replace(".", ",")]);
    // Schlaf: Beginn am Vorabend 22:30–0:30
    let t = new Date(day.getTime() - (1.5 - rnd() * 2) * 3600e3);
    const end = new Date(t.getTime() + (6.2 + rnd() * 2.2) * 3600e3);
    const stages = ["Kernschlaf", "Tiefschlaf", "Kernschlaf", "REM-Schlaf", "Wach"];
    let k = 0;
    while (t < end) {
      const st = stages[k++ % stages.length];
      const len = (st === "Wach" ? 5 + rnd() * 10 : st === "Tiefschlaf" ? 20 + rnd() * 40 : 25 + rnd() * 45) * 60e3;
      const e = new Date(Math.min(end, t.getTime() + len));
      sleep.push([iso(t), st, iso(e)]); t = e;
    }
  }
  let out = "RINGTRACKER\n";
  for (const [name, list] of Object.entries(sec)) {
    out += `## ${name}\n${list.map(r => r[0]).join("\n")}\n==\n${list.map(r => r[1]).join("\n")}\n`;
  }
  out += `## Schlaf\n${sleep.map(r => r[0]).join("\n")}\n==\n${sleep.map(r => r[1]).join("\n")}\n==\n${sleep.map(r => r[2]).join("\n")}\n`;
  return out;
}
if (typeof module !== "undefined" && require.main === module) process.stdout.write(generate(+process.argv[2] || 30));
if (typeof module !== "undefined") module.exports = { generate };
if (typeof window !== "undefined") window.RTBeispiel = { generate };
