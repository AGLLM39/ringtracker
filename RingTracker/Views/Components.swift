import SwiftUI

// MARK: - Kopf

struct LogoBadge: View {
    var size: CGFloat = 30

    var body: some View {
        RoundedRectangle(cornerRadius: size / 3, style: .continuous)
            .fill(Theme.accentGradient)
            .frame(width: size, height: size)
            .overlay {
                Circle()
                    .strokeBorder(Theme.onAccent, lineWidth: size * 0.11)
                    .frame(width: size * 0.56, height: size * 0.56)
            }
            .shadow(color: Theme.accent.opacity(0.55), radius: size * 0.2, y: size * 0.13)
            .accessibilityHidden(true)
    }
}

struct AppHeader: View {
    var subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(spacing: 9) {
                LogoBadge()
                Text("RingTracker")
                    .font(Theme.logoFont(22))
                    .tracking(0.4)
                    .foregroundStyle(Theme.ink)
            }
            Text(subtitle)
                .font(.system(size: 13.5))
                .foregroundStyle(Theme.muted)
                .padding(.leading, 39)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// Überschrift einer Karte: farbiges Symbol, Titel, optional eine Pille rechts.
struct CardHeader: View {
    let title: String
    let icon: String
    let color: Color
    var pill: String?
    var chevron = false

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 20)
            Text(title)
                .font(.system(size: 15.5, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Spacer(minLength: 4)
            if let pill {
                Pill(text: pill)
            }
            if chevron {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.muted.opacity(0.6))
            }
        }
    }
}

struct Pill: View {
    let text: String
    var color: Color = Theme.ink
    var background: Color = Theme.surface2

    var body: some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 9)
            .padding(.vertical, 3)
            .background(background, in: Capsule())
    }
}

// MARK: - Ring

/// Fortschrittsring, der sich beim Anzeigen füllt (wie die Ringe in NährWert).
struct ProgressRing<Center: View>: View {
    let progress: Double
    let color: Color
    var lineWidth: CGFloat = 8
    @ViewBuilder let center: () -> Center

    @State private var animated = 0.0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        ZStack {
            Circle()
                .stroke(Theme.surface2.opacity(0.9), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: animated)
                .stroke(
                    AngularGradient(colors: [color.opacity(0.75), color], center: .center,
                                    startAngle: .degrees(0), endAngle: .degrees(360 * max(animated, 0.01))),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            center()
        }
        .padding(lineWidth / 2)
        .onAppear { update() }
        .onChange(of: progress) { _, _ in update() }
    }

    private func update() {
        let target = min(max(progress, 0), 1)
        if reduceMotion { animated = target } else { withAnimation(Theme.ringCurve) { animated = target } }
    }
}

/// Kleiner Ring mit Beschriftung darunter (Zeile unter der Startkarte).
struct RingCell: View {
    let title: String
    let value: String
    let sub: String
    let progress: Double
    let color: Color

    var body: some View {
        VStack(spacing: 7) {
            ProgressRing(progress: progress, color: color, lineWidth: 7) {
                Text("\(Int((min(progress, 9.99) * 100).rounded())) %")
                    .font(.system(size: 13, weight: .bold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
            }
            .frame(width: 64, height: 64)
            Text(title)
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(Theme.ink)
            VStack(spacing: 0) {
                Text(value)
                    .font(.system(size: 13.5, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                Text(sub)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Schlafphasen

struct StageBar: View {
    let night: SleepNight
    var height: CGFloat = 12

    var body: some View {
        let stages = SleepStage.allCases.filter { (night.durations[$0] ?? 0) > 0 }
        let total = max(night.total, 1)
        GeometryReader { geo in
            let spacing: CGFloat = 2
            let available = geo.size.width - spacing * CGFloat(max(stages.count - 1, 0))
            HStack(spacing: spacing) {
                ForEach(stages) { stage in
                    RoundedRectangle(cornerRadius: height / 3, style: .continuous)
                        .fill(stage.color)
                        .frame(width: max(3, available * (night.durations[stage] ?? 0) / total))
                }
            }
        }
        .frame(height: height)
        .accessibilityHidden(true)
    }
}

struct StageLegend: View {
    let night: SleepNight

    var body: some View {
        let stages = SleepStage.allCases.filter { (night.durations[$0] ?? 0) > 0 }
        LazyVGrid(columns: [GridItem(.flexible(), alignment: .leading), GridItem(.flexible(), alignment: .leading)],
                  alignment: .leading, spacing: 8) {
            ForEach(stages) { stage in
                HStack(spacing: 7) {
                    Circle().fill(stage.color).frame(width: 8, height: 8)
                    Text(stage.title)
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.ink)
                    Spacer(minLength: 2)
                    Text((night.durations[stage] ?? 0).hoursMinutes)
                        .font(.system(size: 13.5, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.muted)
                }
                .padding(.trailing, 8)
            }
        }
    }
}

// MARK: - Trend

struct TrendBadge: View {
    let metric: Metric
    let current: Double
    let average: Double?

    var body: some View {
        if let average, average > 0 {
            let change = (current - average) / average
            let flat = abs(change) < 0.03
            let good: Bool? = flat ? nil : metric.higherIsBetter.map { $0 == (change > 0) }
            let color: Color = good == nil ? Theme.muted : (good! ? Theme.ok : Theme.over)
            HStack(spacing: 3) {
                Image(systemName: flat ? "arrow.right" : (change > 0 ? "arrow.up.right" : "arrow.down.right"))
                    .font(.system(size: 11, weight: .bold))
                Text(flat ? "wie üblich" : "\(change > 0 ? "+" : "")\(Int((change * 100).rounded())) %")
                    .font(.system(size: 13, weight: .semibold))
                    .monospacedDigit()
            }
            .foregroundStyle(color)
            .accessibilityLabel(flat ? "wie im Wochenschnitt" : "\(Int((change * 100).rounded())) Prozent zum Wochenschnitt")
        }
    }
}

// MARK: - Kachel

struct MetricTile: View {
    let metric: Metric
    let value: MetricValue?
    let average: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 7) {
                Image(systemName: metric.icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(metric.color)
                Text(metric.title)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(value.map { metric.format($0.value) } ?? "–")
                    .font(.system(size: 26, weight: .bold))
                    .tracking(-0.6)
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                Text(metric.unitLabel)
                    .font(.system(size: 13.5, weight: .medium))
                    .foregroundStyle(Theme.muted)
            }
            HStack {
                if let value {
                    TrendBadge(metric: metric, current: value.value, average: average)
                    Spacer(minLength: 4)
                    Text(value.date.formatted(.relative(presentation: .named, unitsStyle: .abbreviated)))
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.muted)
                        .lineLimit(1)
                } else {
                    Text("Keine Daten")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.muted)
                }
            }
        }
        .card(padding: 14)
        .contentShape(Rectangle())
    }
}

// MARK: - Zeitraum

struct RangePicker: View {
    @Binding var days: Int
    var options: [Int] = [7, 30, 90]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(options, id: \.self) { option in
                Button {
                    withAnimation(.snappy(duration: 0.25)) { days = option }
                } label: {
                    Text("\(option) Tage")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(days == option ? Theme.accent : Theme.muted)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background {
                            if days == option {
                                Capsule().fill(Theme.accentSoft)
                            }
                        }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Theme.surface, in: Capsule())
        .shadow(color: .black.opacity(0.05), radius: 6, y: 3)
    }
}

// MARK: - Hinweis ohne Daten

struct EmptyHint: View {
    var title = "Noch keine Daten"
    var text = "Öffne die RingConn-App, damit sie die Messungen an Apple Health überträgt. Danach hier nach unten ziehen."

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            CardHeader(title: title, icon: "arrow.triangle.2.circlepath", color: Theme.warn)
            Text(text)
                .font(.system(size: 14))
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .card()
    }
}

struct StatRow: View {
    let label: String
    let value: String
    var color: Color = Theme.ink

    var body: some View {
        HStack {
            Text(label).foregroundStyle(Theme.muted)
            Spacer()
            Text(value).fontWeight(.semibold).monospacedDigit().foregroundStyle(color)
        }
        .font(.system(size: 15))
        .padding(.vertical, 8)
    }
}
