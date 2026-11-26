import SwiftUI

struct ProfileView: View {
    @Environment(HealthManager.self) private var health

    var body: some View {
        @Bindable var settings = health

        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    AppHeader(subtitle: "Profil und Einstellungen")
                        .padding(.bottom, 2)

                    // Ziele
                    VStack(alignment: .leading, spacing: 4) {
                        CardHeader(title: "Tagesziele", icon: "target", color: Theme.accent)
                            .padding(.bottom, 6)
                        GoalStepper(label: "Schritte", value: $settings.stepGoal, step: 500, range: 1_000...40_000) {
                            $0.formatted()
                        }
                        Divider().overlay(Theme.line)
                        GoalStepper(label: "Aktive Energie", value: $settings.energyGoal, step: 50, range: 100...3_000) {
                            "\($0.formatted()) kcal"
                        }
                        Divider().overlay(Theme.line)
                        GoalStepper(label: "Schlaf", value: $settings.sleepGoalMinutes, step: 15, range: 300...660) {
                            TimeInterval($0 * 60).hoursMinutes
                        }
                    }
                    .card()
                    .riseIn(0)

                    // Datenquelle
                    VStack(alignment: .leading, spacing: 10) {
                        CardHeader(title: "Datenquelle", icon: "circle.circle", color: Theme.violet,
                                   pill: health.ringConnFound ? "RingConn gefunden" : "RingConn fehlt")
                        Toggle(isOn: $settings.onlyRingConn) {
                            Text("Nur Daten vom RingConn-Ring")
                                .font(.system(size: 15))
                                .foregroundStyle(Theme.ink)
                        }
                        .tint(Theme.accent)
                        Text("Wenn aus, zählen auch iPhone und andere Geräte. Fehlt für einen Wert eine RingConn-Messung, nutzt die App automatisch die übrigen Quellen.")
                            .font(.system(size: 13.5))
                            .foregroundStyle(Theme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                        if !health.detectedSources.isEmpty {
                            Divider().overlay(Theme.line).padding(.vertical, 2)
                            Text("Quellen in Apple Health")
                                .font(.system(size: 13.5, weight: .semibold))
                                .foregroundStyle(Theme.ink)
                            ForEach(health.detectedSources, id: \.self) { name in
                                HStack(spacing: 8) {
                                    let isRing = name.localizedCaseInsensitiveContains("ringconn")
                                    Image(systemName: isRing ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(isRing ? Theme.ok : Theme.muted.opacity(0.5))
                                    Text(name)
                                        .font(.system(size: 15))
                                        .foregroundStyle(Theme.ink)
                                }
                            }
                        }
                    }
                    .card()
                    .riseIn(1)

                    // Einrichtung
                    VStack(alignment: .leading, spacing: 10) {
                        CardHeader(title: "So kommen die Ringdaten hierher", icon: "arrow.triangle.2.circlepath", color: Theme.blue)
                        SetupStep(number: 1, text: "In der RingConn-App: Profil → Apple Health → alle Kategorien einschalten.")
                        SetupStep(number: 2, text: "RingConn-App regelmäßig öffnen. Erst dann überträgt sie neue Messungen an Health.")
                        SetupStep(number: 3, text: "In Health → Teilen → Apps → RingTracker: alle Kategorien zum Lesen erlauben.")
                        Link(destination: URL(string: "x-apple-health://")!) {
                            Text("Apple Health öffnen")
                        }
                        .buttonStyle(PrimaryButtonStyle())
                        .padding(.top, 4)
                    }
                    .card()
                    .riseIn(2)

                    // Hinweis
                    VStack(alignment: .leading, spacing: 8) {
                        CardHeader(title: "Datenschutz", icon: "lock.fill", color: Theme.accent)
                        Text("Alle Daten bleiben auf deinem iPhone. RingTracker liest nur aus Apple Health, schreibt nichts und sendet nichts ins Internet. Die Werte ersetzen keine ärztliche Beratung.")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .card()
                    .riseIn(3)

                    Text("RingTracker \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.muted)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
            .screenBackground()
            .toolbar(.hidden, for: .navigationBar)
            .onChange(of: health.onlyRingConn) { _, _ in
                Task { await health.refresh(force: true) }
            }
            .onChange(of: health.sleepGoalMinutes) { _, _ in
                Task { await health.refresh(force: true) }
            }
        }
    }
}

private struct GoalStepper: View {
    let label: String
    @Binding var value: Int
    let step: Int
    let range: ClosedRange<Int>
    let format: (Int) -> String

    var body: some View {
        HStack {
            Text(label)
                .font(.system(size: 15))
                .foregroundStyle(Theme.ink)
            Spacer()
            Text(format(value))
                .font(.system(size: 15, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(Theme.ink)
                .contentTransition(.numericText())
            Stepper(label, value: $value, in: range, step: step)
                .labelsHidden()
        }
        .padding(.vertical, 6)
        .sensoryFeedback(.selection, trigger: value)
    }
}

private struct SetupStep: View {
    let number: Int
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(number)")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Theme.accent)
                .frame(width: 24, height: 24)
                .background(Theme.accentSoft, in: Circle())
            Text(text)
                .font(.system(size: 14.5))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
