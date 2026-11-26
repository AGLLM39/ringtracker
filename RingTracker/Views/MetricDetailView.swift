import SwiftUI
import Charts

struct MetricDetailView: View {
    @Environment(HealthManager.self) private var health
    let metric: Metric

    @State private var days = 7
    @State private var points: [DayPoint] = []
    @State private var intraday: [SamplePoint] = []
    @State private var selected: Date?
    @State private var loaded = false

    private var values: [Double] { points.map(\.value) }
    private var average: Double? { values.isEmpty ? nil : values.reduce(0, +) / Double(values.count) }

    private var goal: Double? {
        switch metric {
        case .steps: Double(health.stepGoal)
        case .activeEnergy: Double(health.energyGoal)
        default: nil
        }
    }

    private var selectedPoint: DayPoint? {
        guard let selected else { return nil }
        return points.first { Calendar.current.isDate($0.date, inSameDayAs: selected) }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                summaryCard.riseIn(0)
                RangePicker(days: $days).riseIn(1)
                chartCard.riseIn(2)
                if metric == .heartRate || metric == .hrv || metric == .oxygen {
                    intradayCard.riseIn(3)
                }
                if !points.isEmpty { statsCard.riseIn(4) }
                infoCard.riseIn(5)
            }
            .padding(16)
        }
        .screenBackground()
        .navigationTitle(metric.title)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: days) {
            points = await health.dailySeries(metric, days: days)
            loaded = true
        }
        .task {
            intraday = await health.samples(metric, on: .now)
        }
    }

    // MARK: Karten

    private var summaryCard: some View {
        let current = health.today[metric]
        return VStack(alignment: .leading, spacing: 6) {
            CardHeader(title: metric.isCumulative ? "Heute" : "Zuletzt gemessen", icon: metric.icon, color: metric.color)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(current.map { metric.format($0.value) } ?? "–")
                    .font(.system(size: 40, weight: .heavy))
                    .tracking(-1.4)
                    .monospacedDigit()
                    .foregroundStyle(Theme.ink)
                Text(metric.unitLabel)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Theme.muted)
                Spacer()
                if let current, !metric.isCumulative {
                    TrendBadge(metric: metric, current: current.value, average: health.weekAverage[metric])
                }
            }
            if let current {
                if let goal {
                    ProgressView(value: min(current.value / goal, 1))
                        .tint(metric.color)
                        .padding(.top, 2)
                    Text("\(Int((current.value / goal * 100).rounded())) % vom Tagesziel (\(metric.formatWithUnit(goal)))")
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.muted)
                } else {
                    Text(current.date.formatted(.dateTime.weekday(.wide).hour().minute()) + " Uhr")
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.muted)
                }
            }
        }
        .card(hero: true, padding: 18)
    }

    private var chartCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(selectedPoint.map { $0.date.formatted(.dateTime.weekday(.abbreviated).day().month()) } ?? "Durchschnitt")
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.muted)
                    Text((selectedPoint?.value ?? average).map { metric.formatWithUnit($0) } ?? "–")
                        .font(.system(size: 22, weight: .bold))
                        .tracking(-0.6)
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                        .contentTransition(.numericText())
                }
                Spacer()
            }

            if points.isEmpty {
                Text(loaded ? "Keine Daten in diesem Zeitraum." : "Lädt …")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
                    .frame(maxWidth: .infinity, minHeight: 220)
            } else {
                chart.frame(height: 220)
            }
        }
        .card()
    }

    @ViewBuilder
    private var chart: some View {
        let factor = metric.displayFactor
        Chart {
            ForEach(points) { point in
                let isToday = Calendar.current.isDateInToday(point.date)
                let highlighted = selectedPoint.map { $0.id == point.id } ?? isToday
                if metric.isCumulative {
                    BarMark(x: .value("Tag", point.date, unit: .day),
                            y: .value(metric.title, point.value * factor))
                        .foregroundStyle(LinearGradient(colors: [metric.color.opacity(0.7), metric.color],
                                                        startPoint: .top, endPoint: .bottom))
                        .opacity(highlighted ? 1 : 0.45)
                        .cornerRadius(days > 30 ? 2 : 6)
                } else {
                    AreaMark(x: .value("Tag", point.date, unit: .day),
                             y: .value(metric.title, point.value * factor))
                        .foregroundStyle(LinearGradient(colors: [metric.color.opacity(0.22), metric.color.opacity(0)],
                                                        startPoint: .top, endPoint: .bottom))
                        .interpolationMethod(.catmullRom)
                    LineMark(x: .value("Tag", point.date, unit: .day),
                             y: .value(metric.title, point.value * factor))
                        .foregroundStyle(metric.color)
                        .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
                        .interpolationMethod(.catmullRom)
                    if days <= 30 || highlighted {
                        PointMark(x: .value("Tag", point.date, unit: .day),
                                  y: .value(metric.title, point.value * factor))
                            .foregroundStyle(metric.color)
                            .symbolSize(highlighted ? 60 : 22)
                    }
                }
            }
            if let goal {
                RuleMark(y: .value("Ziel", goal * factor))
                    .foregroundStyle(Theme.muted.opacity(0.6))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .annotation(position: .top, alignment: .leading) {
                        Text("Ziel").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.muted)
                    }
            } else if let average, selectedPoint == nil {
                RuleMark(y: .value("Durchschnitt", average * factor))
                    .foregroundStyle(Theme.muted.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
            }
            if let selectedPoint {
                RuleMark(x: .value("Auswahl", selectedPoint.date, unit: .day))
                    .foregroundStyle(Theme.line)
            }
        }
        .chartXSelection(value: $selected)
        .chartYScale(domain: .automatic(includesZero: metric.isCumulative))
        .chartXAxis {
            AxisMarks(values: .stride(by: .day, count: days <= 7 ? 1 : (days <= 30 ? 7 : 30))) { _ in
                AxisGridLine().foregroundStyle(Theme.line)
                AxisValueLabel(format: days <= 7 ? Date.FormatStyle.dateTime.weekday(.narrow) : Date.FormatStyle.dateTime.day().month(.abbreviated))
                    .foregroundStyle(Theme.muted)
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing) { _ in
                AxisGridLine().foregroundStyle(Theme.line)
                AxisValueLabel().foregroundStyle(Theme.muted)
            }
        }
        .sensoryFeedback(.selection, trigger: selectedPoint?.id)
    }

    private var intradayCard: some View {
        let factor = metric.displayFactor
        let vals = intraday.map { $0.value * factor }
        return VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Heute im Verlauf", icon: "clock", color: metric.color,
                       pill: intraday.isEmpty ? nil : "\(intraday.count) Messungen")
            if intraday.isEmpty {
                Text("Heute noch keine Einzelmessungen.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
            } else {
                Chart(intraday) { sample in
                    PointMark(x: .value("Zeit", sample.date), y: .value(metric.title, sample.value * factor))
                        .foregroundStyle(metric.color.opacity(0.8))
                        .symbolSize(14)
                }
                .chartYScale(domain: (vals.min()! - 3)...(vals.max()! + 3))
                .chartXScale(domain: Calendar.current.startOfDay(for: .now)...Date.now)
                .chartXAxis {
                    AxisMarks(values: .stride(by: .hour, count: 6)) { _ in
                        AxisGridLine().foregroundStyle(Theme.line)
                        AxisValueLabel(format: .dateTime.hour()).foregroundStyle(Theme.muted)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .trailing) { _ in
                        AxisGridLine().foregroundStyle(Theme.line)
                        AxisValueLabel().foregroundStyle(Theme.muted)
                    }
                }
                .frame(height: 160)
                HStack(spacing: 8) {
                    Pill(text: "Min \(metric.format(vals.min()! / factor))")
                    Pill(text: "Max \(metric.format(vals.max()! / factor))")
                }
            }
        }
        .card()
    }

    private var statsCard: some View {
        let lo = values.min() ?? 0
        let hi = values.max() ?? 0
        return VStack(alignment: .leading, spacing: 0) {
            CardHeader(title: "Statistik \(days) Tage", icon: "chart.bar.xaxis", color: metric.color)
                .padding(.bottom, 6)
            StatRow(label: "Durchschnitt", value: average.map { metric.formatWithUnit($0) } ?? "–")
            Divider().overlay(Theme.line)
            StatRow(label: "Niedrigster Tag", value: metric.formatWithUnit(lo))
            Divider().overlay(Theme.line)
            StatRow(label: "Höchster Tag", value: metric.formatWithUnit(hi))
            if metric.isCumulative {
                Divider().overlay(Theme.line)
                StatRow(label: "Summe", value: metric.formatWithUnit(values.reduce(0, +)))
                if let goal {
                    Divider().overlay(Theme.line)
                    let reached = values.filter { $0 >= goal }.count
                    StatRow(label: "Ziel erreicht", value: "\(reached) von \(values.count) Tagen",
                            color: reached > 0 ? Theme.ok : Theme.ink)
                }
            }
        }
        .card()
    }

    private var infoCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            CardHeader(title: "Was bedeutet das?", icon: "info.circle.fill", color: Theme.accent)
            Text(metric.explanation)
                .font(.system(size: 14.5))
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .card()
    }
}
