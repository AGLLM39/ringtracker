import SwiftUI

struct TodayView: View {
    @Environment(HealthManager.self) private var health

    private let columns = [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    AppHeader(subtitle: Date.now.formatted(.dateTime.weekday(.wide).day().month(.wide)))
                        .padding(.bottom, 2)

                    HeroCard()
                        .riseIn(0)

                    if let night = health.lastNight {
                        NavigationLink(value: Route.sleep) {
                            SleepCard(night: night)
                        }
                        .buttonStyle(PressableStyle())
                        .riseIn(1)
                    }

                    if let recovery = health.recovery {
                        RecoveryCard(recovery: recovery)
                            .riseIn(2)
                    }

                    if !health.isLoading && !health.hasAnyData {
                        EmptyHint()
                    }

                    sectionTitle("Vitalwerte")
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(Array(Metric.vitals.enumerated()), id: \.element) { index, metric in
                            NavigationLink(value: Route.metric(metric)) {
                                MetricTile(metric: metric, value: health.today[metric], average: health.weekAverage[metric])
                            }
                            .buttonStyle(PressableStyle())
                            .riseIn(3 + index)
                        }
                    }

                    if let updated = health.lastUpdated {
                        Text("Aktualisiert \(updated.formatted(date: .omitted, time: .shortened)) Uhr · nach unten ziehen zum Neuladen")
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.muted)
                            .multilineTextAlignment(.center)
                            .padding(.top, 4)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
            .screenBackground()
            .refreshable { await health.refresh(force: true) }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { $0.destination }
            .overlay {
                if health.isLoading && !health.hasAnyData {
                    ProgressView().tint(Theme.accent)
                }
            }
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 17, weight: .bold))
            .foregroundStyle(Theme.ink)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 6)
    }
}

/// Ziele für Navigation, damit alle Tabs dieselben Detailseiten nutzen.
enum Route: Hashable {
    case sleep
    case metric(Metric)

    @MainActor @ViewBuilder
    var destination: some View {
        switch self {
        case .sleep: SleepDetailView()
        case .metric(let metric): MetricDetailView(metric: metric)
        }
    }
}

// MARK: - Startkarte

private struct HeroCard: View {
    @Environment(HealthManager.self) private var health

    var body: some View {
        let night = health.lastNight
        let asleep = night?.asleep ?? 0
        let steps = health.today[.steps]?.value ?? 0
        let energy = health.today[.activeEnergy]?.value ?? 0

        VStack(spacing: 0) {
            HStack(alignment: .center, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Schlaf letzte Nacht")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Theme.muted)
                    Text(asleep > 0 ? asleep.hoursMinutes : "–")
                        .font(.system(size: 32, weight: .heavy))
                        .tracking(-1.1)
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                    if let start = night?.start, let end = night?.end {
                        Text("\(start.formatted(date: .omitted, time: .shortened)) – \(end.formatted(date: .omitted, time: .shortened)) Uhr")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.muted)
                    } else {
                        Text("Ziel \(health.sleepGoal.hoursMinutes)")
                            .font(.system(size: 14))
                            .foregroundStyle(Theme.muted)
                    }
                }
                Spacer(minLength: 0)
                ProgressRing(progress: asleep / health.sleepGoal, color: Theme.violet, lineWidth: 10) {
                    VStack(spacing: 0) {
                        Text("\(Int((asleep / health.sleepGoal * 100).rounded()))")
                            .font(.system(size: 22, weight: .heavy))
                            .tracking(-0.5)
                            .monospacedDigit()
                        Text("% Ziel")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Theme.muted)
                    }
                    .foregroundStyle(Theme.ink)
                }
                .frame(width: 96, height: 96)
            }

            Divider().overlay(Theme.line).padding(.top, 16).padding(.bottom, 14)

            HStack(alignment: .top, spacing: 6) {
                RingCell(title: "Schritte",
                         value: Metric.steps.format(steps),
                         sub: "von \(health.stepGoal.formatted())",
                         progress: steps / Double(max(health.stepGoal, 1)),
                         color: Metric.steps.color)
                RingCell(title: "Aktive Energie",
                         value: "\(Metric.activeEnergy.format(energy)) kcal",
                         sub: "von \(health.energyGoal.formatted())",
                         progress: energy / Double(max(health.energyGoal, 1)),
                         color: Metric.activeEnergy.color)
                if let recovery = health.recovery {
                    RingCell(title: "Erholung",
                             value: "\(recovery.score) von 100",
                             sub: recovery.label,
                             progress: Double(recovery.score) / 100,
                             color: recovery.color)
                }
            }
        }
        .card(hero: true, padding: 18)
    }
}

// MARK: - Schlafkarte

private struct SleepCard: View {
    let night: SleepNight

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Schlafphasen", icon: "moon.zzz.fill", color: Theme.violet,
                       pill: night.hasStages ? "Tief + REM \(Int(((night.share(of: .deep) + night.share(of: .rem)) * 100).rounded())) %" : nil,
                       chevron: true)
            StageBar(night: night)
            StageLegend(night: night)
        }
        .card()
        .contentShape(Rectangle())
    }
}

// MARK: - Erholung

private struct RecoveryCard: View {
    let recovery: Recovery

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            CardHeader(title: "Erholung", icon: "leaf.fill", color: recovery.color,
                       pill: recovery.label)
            Text(recovery.advice)
                .font(.system(size: 15))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
            VStack(spacing: 9) {
                ForEach(recovery.parts) { part in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(part.title)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(Theme.ink)
                            Spacer()
                            Text(part.detail)
                                .font(.system(size: 13))
                                .monospacedDigit()
                                .foregroundStyle(Theme.muted)
                        }
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Theme.surface2)
                                Capsule()
                                    .fill(LinearGradient(colors: [color(for: part.score).opacity(0.8), color(for: part.score)],
                                                         startPoint: .leading, endPoint: .trailing))
                                    .frame(width: max(9, geo.size.width * part.score / 100))
                            }
                        }
                        .frame(height: 9)
                    }
                }
            }
            .padding(.top, 2)
            Text("Verglichen mit deinem eigenen Durchschnitt der letzten 30 Tage.")
                .font(.system(size: 13))
                .foregroundStyle(Theme.muted)
        }
        .card()
    }

    private func color(for score: Double) -> Color {
        switch score {
        case 75...: Theme.ok
        case 50..<75: Theme.warn
        default: Theme.over
        }
    }
}
