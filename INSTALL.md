# RingTracker aufs iPhone (ohne Xcode)

Du brauchst: deinen Computer (Windows oder Mac), das iPhone-Kabel und deine normale Apple-ID.

## Einmalig

1. **App herunterladen:** [RingTracker.ipa](https://github.com/AGLLM39/ringtracker/releases/download/app/RingTracker.ipa) auf den Computer laden.
2. **Sideloadly installieren:** [sideloadly.io](https://sideloadly.io) → Download → installieren.
   Nur Windows: zusätzlich **iTunes** und **iCloud** von apple.com installieren (nicht aus dem Microsoft Store).
3. **iPhone anschließen** per Kabel. Auf dem iPhone „Vertrauen“ tippen und Code eingeben.
4. **In Sideloadly:**
   - `RingTracker.ipa` ins Fenster ziehen.
   - Oben bei „Apple ID“ deine Apple-ID eintragen.
   - **Start** klicken, Passwort und ggf. Bestätigungscode eingeben.
   - Warten bis „Done“ erscheint.
5. **Auf dem iPhone freigeben:**
   - Einstellungen → Allgemein → **VPN & Geräteverwaltung** → deine Apple-ID → **Vertrauen**.
   - Einstellungen → Datenschutz & Sicherheit → **Entwicklermodus** → an → iPhone neu starten → „Aktivieren“.
6. **RingTracker öffnen** → bei der Health-Abfrage **Alle aktivieren** → Erlauben.

Fertig. Die App liest ab jetzt automatisch aus Apple Health, kein Export und kein Kurzbefehl nötig.

## Alle 7 Tage

Mit einer kostenlosen Apple-ID läuft die App 7 Tage. Danach Schritt 3 und 4 wiederholen (deine Daten bleiben erhalten).
Tipp: In Sideloadly ist „Automatic refresh“ möglich, dann erneuert es sich selbst, wenn Computer und iPhone im selben WLAN sind.
