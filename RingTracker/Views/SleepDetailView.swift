import SwiftUI
import Charts

struct SleepDetailView: View {
    @Environment(HealthManager.self) private var health

    @State private var days = 7
    @State private var nights: [SleepNight] = []
    @State private var selected: Date?
    @State private var loaded = false

    private var averageAsleep: TimeInterval {
        nights.isEmpty ? 0 : nights.map(\.asleep).reduce(0, +) / Double(nights.count)
    }

    private var selectedNight: SleepNight? {
        guard let selected else { return nil }
        return nights.first { Calendar.current.isDate($0.date, inSameDayAs: selected) }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                if let night = health.lastNight {
                    lastNightCard(night).riseIn(0)
                }
                RangePicker(days: $days).riseIn(1)
                chartCard.riseIn(2)
                if !nights.isEmpty {
                    averagesCard.riseIn(3)
                    rhythmCard.riseIn(4)
                    nightsCard.riseIn(5)
                }
            }
            .padding(16)
        }
        .screenBackground()
        .navigationTitle("Schlaf")
        .navigationBarTitleDisplayMode(.inline)
        .task(id: days) {
            nights = await health.sleepNights(count: days)
            loaded = true
        }
    }

    // MARK: Karten

    private func lastNightCard(_ night: SleepNight) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Letzte Nacht", icon: "moon.stars.fill", color: Theme.violet,
                       pill: night.source.isEmpty ? nil : night.source)
            HStack(alignment: .firstTextBaseline) {
                Text(night.asleep.hoursMinutes)
                    .font(.system(size: 36, weight: .heavy))
                    .tracking(-1.2)
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                Spacer()
                if let start = night.start, let end = night.end {
                    Text("\(start.formatted(date: .omitted, time: .shortened)) – \(end.formatted(date: .omitted, time: .shortened))")
                        .font(.system(size: 14, weight: .medium))
                        .monospacedDigit()
                        .foregroundStyle(Theme.muted)
                }
            }
            StageBar(night: night, height: 14)
            StageLegend(night: night)
            if let awake = night.durations[.awake], awake > 0, let start = night.start, let end = night.end {
                let inBed = end.timeIntervalSince(start)
                let efficiency = inBed > 0 ? night.asleep / inBed : 0
                Text("Schlafeffizienz \(Int((min(efficiency, 1) * 100).rounded())) % · \(awake.hoursMinutes) wach")
                    .font(.system(size: 13.5))
                    .foregroundStyle(Theme.muted)
            }
        }
        .card(hero: true, padding: 18)
    }

    private var chartCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(selectedNight.map { $0.date.formatted(.dateTime.weekday(.abbreviated).day().month()) } ?? "Durchschnitt")
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Theme.muted)
                Text(nights.isEmpty ? "–" : (selectedNight?.asleep ?? averageAsleep).hoursMinutes)
                    .font(.system(size: 22, weight: .bold))
                    .tracking(-0.6)
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
            }
            if nights.isEmpty {
                Text(loaded ? "Keine Schlafdaten in diesem Zeitraum." : "Lädt …")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
                    .frame(maxWidth: .infinity, minHeight: 220)
            } else {
                Chart {
                    ForEach(nights) { night in
                        let dimmed = selectedNight != nil && selectedNight?.id != night.id
                        ForEach(SleepStage.asleepStages) { stage in
                            BarMark(x: .value("Nacht", night.date, unit: .day),
                                    y: .value("Stunden", (night.durations[stage] ?? 0).hoursDecimal))
                                .foregroundStyle(by: .value("Phase", stage.title))
                                .opacity(dimmed ? 0.35 : 1)
                        }
                    }
                    RuleMark(y: .value("Ziel", health.sleepGoal.hoursDecimal))
                        .foregroundStyle(Theme.muted.opacity(0.6))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                        .annotation(position: .top, alignment: .leading) {
                            Text("Ziel").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.muted)
                        }
                }
                .chartForegroundStyleScale(domain: SleepStage.asleepStages.map(\.title),
                                           range: SleepStage.asleepStages.map(\.color))
                .chartLegend(position: .bottom, spacing: 12)
                .chartXSelection(value: $selected)
                .chartXAxis {
                    AxisMarks(values: .stride(by: .day, count: days <= 7 ? 1 : (days <= 30 ? 7 : 30))) { _ in
                        AxisGridLine().foregroundStyle(Theme.line)
                        AxisValueLabel(format: days <= 7 ? Date.FormatStyle.dateTime.weekday(.narrow) : Date.FormatStyle.dateTime.day().month(.abbreviated))
                            .foregroundStyle(Theme.muted)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .trailing) { value in
                        AxisGridLine().foregroundStyle(Theme.line)
                        AxisValueLabel {
                            if let h = value.as(Double.self) { Text("\(Int(h)) h").foregroundStyle(Theme.muted) }
                        }
                    }
                }
                .sensoryFeedback(.selection, trigger: selectedNight?.id)
                .frame(height: 240)
            }
        }
        .card()
    }

    private var averagesCard: some View {
        let count = Double(nights.count)
        let reached = nights.filter { $0.asleep >= health.sleepGoal }.count
        return VStack(alignment: .leading, spacing: 0) {
            CardHeader(title: "Durchschnitt \(days) Tage", icon: "chart.bar.fill", color: Theme.violet)
                .padding(.bottom, 6)
            StatRow(label: "Schlafdauer", value: averageAsleep.hoursMinutes)
            ForEach(SleepStage.allCases.filter { stage in nights.contains { ($0.durations[stage] ?? 0) > 0 } }) { stage in
                Divider().overlay(Theme.line)
                let avg = nights.map { $0.durations[stage] ?? 0 }.reduce(0, +) / count
                HStack(spacing: 8) {
                    Circle().fill(stage.color).frame(width: 8, height: 8)
                    StatRow(label: stage.title, value: avg.hoursMinutes)
                }
            }
            Divider().overlay(Theme.line)
            StatRow(label: "Ziel erreicht", value: "\(reached) von \(nights.count) Nächten",
                    color: reached > 0 ? Theme.ok : Theme.ink)
        }
        .card()
    }

    /// Regelmäßigkeit: durchschnittliche Einschlaf- und Aufwachzeit.
    private var rhythmCard: some View {
        let starts = nights.compactMap(\.start)
        let ends = nights.compactMap(\.end)
        return VStack(alignment: .leading, spacing: 0) {
            CardHeader(title: "Rhythmus", icon: "clock.arrow.circlepath", color: Theme.blue)
                .padding(.bottom, 6)
            StatRow(label: "Eingeschlafen im Schnitt", value: averageClock(starts))
            Divider().overlay(Theme.line)
            StatRow(label: "Aufgewacht im Schnitt", value: averageClock(ends))
            Divider().overlay(Theme.line)
            StatRow(label: "Schwankung Einschlafzeit", value: "± \(spreadMinutes(starts)) min")
        }
        .card()
    }

    private var nightsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Nächte", icon: "list.bullet", color: Theme.accent)
            ForEach(nights.reversed()) { night in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(night.date.formatted(.dateTime.weekday(.wide).day().month()))
                            .font(.system(size: 14.5, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        Text(night.asleep.hoursMinutes)
                            .font(.system(size: 14.5, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(night.asleep >= health.sleepGoal ? Theme.ok : Theme.ink)
                    }
                    StageBar(night: night, height: 8)
                }
                .padding(.vertical, 2)
            }
        }
        .card()
    }

    // MARK: Uhrzeiten mitteln (über Mitternacht hinweg)

    /// Minuten seit 18 Uhr, damit 23:30 und 0:30 sinnvoll gemittelt werden.
    private func minutesFromEvening(_ date: Date) -> Double {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        var m = Double((c.hour ?? 0) * 60 + (c.minute ?? 0)) - 18 * 60
        if m < 0 { m += 24 * 60 }
        return m
    }

    private func averageClock(_ dates: [Date]) -> String {
        guard !dates.isEmpty else { return "–" }
        let avg = dates.map(minutesFromEvening).reduce(0, +) / Double(dates.count)
        let total = (Int(avg.rounded()) + 18 * 60) % (24 * 60)
        return String(format: "%d:%02d Uhr", total / 60, total % 60)
    }

    private func spreadMinutes(_ dates: [Date]) -> Int {
        guard dates.count > 1 else { return 0 }
        let mins = dates.map(minutesFromEvening)
        let mean = mins.reduce(0, +) / Double(mins.count)
        let variance = mins.map { ($0 - mean) * ($0 - mean) }.reduce(0, +) / Double(mins.count)
        return Int(variance.squareRoot().rounded())
    }
}
