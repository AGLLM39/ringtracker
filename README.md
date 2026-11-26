# RingTracker

iPhone-App für die Daten des RingConn Gen 2. Gestaltung nach dem Vorbild von NährWert
(Leinen-Hintergrund, Blattgrün, weiche Karten, Ringe).

RingConn bietet keine offene Schnittstelle. Die RingConn-App überträgt ihre Messungen an
Apple Health, und RingTracker liest sie dort (nur lesen, nichts wird gesendet).

## Funktionen

- **Heute:** Schlaf der letzten Nacht mit Zielring, Schritte, aktive Energie, Erholungs-Score,
  Schlafphasen, Vitalwerte (Ruhepuls, HRV, Puls, Blutsauerstoff, Atemfrequenz) mit Trend
  zum Wochenschnitt
- **Erholung:** Score 0–100 aus Schlafdauer, HRV und Ruhepuls im Vergleich zu deinen eigenen
  30-Tage-Werten
- **Woche:** alle Werte der letzten 7 Tage auf einen Blick
- **Details:** 7/30/90 Tage, Antippen eines Tages zeigt den Wert, Statistik, Tagesverlauf
  einzelner Messungen (Puls, HRV, Sauerstoff)
- **Schlaf:** Phasen pro Nacht, Durchschnitt, Schlafeffizienz, Einschlaf-/Aufwachrhythmus
- **Profil:** Tagesziele, Filter „nur RingConn“, erkannte Datenquellen, Einrichtungshilfe
- Aktualisiert sich automatisch, sobald neue Daten in Health ankommen
- Hell- und Dunkelmodus

## Auf das iPhone bringen

Voraussetzungen: Mac mit Xcode 16 oder neuer, iPhone mit iOS 17 oder neuer, Apple-ID.

1. `RingTracker.xcodeproj` in Xcode öffnen.
2. Links das Projekt **RingTracker** → Target **RingTracker** → **Signing & Capabilities**:
   unter *Team* deine Apple-ID auswählen (ggf. erst unter *Xcode → Settings → Accounts* hinzufügen).
   Meldet Xcode, die Bundle-ID sei vergeben, ändere sie z. B. in `de.deinname.ringtracker`.
3. iPhone per Kabel anschließen, oben als Ziel auswählen, **▶︎** drücken.
4. Beim ersten Mal auf dem iPhone: *Einstellungen → Datenschutz & Sicherheit → Entwicklermodus*
   einschalten und unter *Allgemein → VPN & Geräteverwaltung* deinem Entwicklerprofil vertrauen.
5. In der App „Mit Apple Health verbinden“ tippen und alle Kategorien erlauben.

Mit einer kostenlosen Apple-ID läuft die App 7 Tage, danach einfach erneut aus Xcode starten.
Mit dem Apple Developer Program (99 €/Jahr) ein Jahr, oder dauerhaft über TestFlight.

## RingConn-App einrichten

RingConn-App → Profil → Apple Health → alle Kategorien einschalten. Die RingConn-App
überträgt neue Daten, wenn sie geöffnet wird.

## Aufbau

| Datei | Inhalt |
|---|---|
| `HealthManager.swift` | Alle HealthKit-Abfragen, Quellenfilter, Erholung |
| `Metric.swift` | Messwerte, Einheiten, Farben, Erklärungen |
| `Models.swift` | Schlafnacht, Schlafphasen, Erholungs-Score |
| `Theme.swift` | Farben und Kartenstil nach NährWert |
| `Views/` | Heute, Woche, Details, Schlaf, Profil, Onboarding |
