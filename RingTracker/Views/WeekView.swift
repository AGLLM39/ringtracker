import SwiftUI
import Charts

/// Wochenübersicht: je eine Karte mit den letzten 7 Tagen, heute hervorgehoben.
struct WeekView: View {
    @Environment(HealthManager.self) private var health

    @State private var series: [Metric: [DayPoint]] = [:]
    @State private var nights: [SleepNight] = []

    private let order: [Metric] = [.steps, .activeEnergy, .restingHeartRate, .hrv, .heartRate, .oxygen, .respiratoryRate]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    AppHeader(subtitle: "Die letzten 7 Tage")
                        .padding(.bottom, 2)

                    NavigationLink(value: Route.sleep) {
                        sleepCard
                    }
                    .buttonStyle(PressableStyle())
                    .riseIn(0)

                    ForEach(Array(order.enumerated()), id: \.element) { index, metric in
                        NavigationLink(value: Route.metric(metric)) {
                            WeekMetricCard(metric: metric, points: series[metric] ?? [],
                                           goal: goal(for: metric))
                        }
                        .buttonStyle(PressableStyle())
                        .riseIn(index + 1)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
            .screenBackground()
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { $0.destination }
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func load() async {
        var result: [Metric: [DayPoint]] = [:]
        for metric in order {
            result[metric] = await health.dailySeries(metric, days: 7)
        }
        series = result
        nights = await health.sleepNights(count: 7)
    }

    private func goal(for metric: Metric) -> Double? {
        switch metric {
        case .steps: Double(health.stepGoal)
        case .activeEnergy: Double(health.energyGoal)
        default: nil
        }
    }

    private var sleepCard: some View {
        let avg = nights.isEmpty ? 0 : nights.map(\.asleep).reduce(0, +) / Double(nights.count)
        return VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: "Schlaf", icon: "moon.zzz.fill", color: Theme.violet,
                       pill: nights.isEmpty ? nil : "Ø \(avg.hoursMinutes)", chevron: true)
            if nights.isEmpty {
                Text("Noch keine Schlafdaten.")
                    .font(.system(size: 14)).foregroundStyle(Theme.muted)
            } else {
                Chart {
                    ForEach(nights) { night in
                        BarMark(x: .value("Nacht", night.date, unit: .day),
                                y: .value("Stunden", night.asleep.hoursDecimal))
                            .foregroundStyle(LinearGradient(colors: [Theme.violet.opacity(0.7), Theme.violet],
                                                            startPoint: .top, endPoint: .bottom))
                            .opacity(Calendar.current.isDateInToday(night.date) ? 1 : 0.45)
                            .cornerRadius(6)
                    }
                    RuleMark(y: .value("Ziel", health.sleepGoal.hoursDecimal))
                        .foregroundStyle(Theme.muted.opacity(0.6))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                }
                .chartXAxis {
                    AxisMarks(values: .stride(by: .day)) { _ in
                        AxisValueLabel(format: .dateTime.weekday(.narrow)).foregroundStyle(Theme.muted)
                    }
                }
                .chartYAxis(.hidden)
                .frame(height: 110)
            }
        }
        .card()
    }
}

private struct WeekMetricCard: View {
    let metric: Metric
    let points: [DayPoint]
    let goal: Double?

    var body: some View {
        let avg = points.isEmpty ? nil : points.map(\.value).reduce(0, +) / Double(points.count)
        let factor = metric.displayFactor
        VStack(alignment: .leading, spacing: 12) {
            CardHeader(title: metric.title, icon: metric.icon, color: metric.color,
                       pill: avg.map { "Ø \(metric.formatWithUnit($0))" }, chevron: true)
            if points.isEmpty {
                Text("Keine Daten in den letzten 7 Tagen.")
                    .font(.system(size: 14)).foregroundStyle(Theme.muted)
            } else {
                Chart {
                    ForEach(points) { point in
                        let today = Calendar.current.isDateInToday(point.date)
                        if metric.isCumulative {
                            BarMark(x: .value("Tag", point.date, unit: .day),
                                    y: .value(metric.title, point.value * factor))
                                .foregroundStyle(LinearGradient(colors: [metric.color.opacity(0.7), metric.color],
                                                                startPoint: .top, endPoint: .bottom))
                                .opacity(today ? 1 : 0.45)
                                .cornerRadius(6)
                        } else {
                            LineMark(x: .value("Tag", point.date, unit: .day),
                                     y: .value(metric.title, point.value * factor))
                                .foregroundStyle(metric.color)
                                .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round))
                                .interpolationMethod(.catmullRom)
                            PointMark(x: .value("Tag", point.date, unit: .day),
                                      y: .value(metric.title, point.value * factor))
                                .foregroundStyle(metric.color)
                                .symbolSize(today ? 60 : 24)
                        }
                    }
                    if let goal {
                        RuleMark(y: .value("Ziel", goal * factor))
                            .foregroundStyle(Theme.muted.opacity(0.6))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    }
                }
                .chartYScale(domain: .automatic(includesZero: metric.isCumulative))
                .chartXAxis {
                    AxisMarks(values: .stride(by: .day)) { _ in
                        AxisValueLabel(format: .dateTime.weekday(.narrow)).foregroundStyle(Theme.muted)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { _ in
                        AxisGridLine().foregroundStyle(Theme.line)
                        AxisValueLabel().foregroundStyle(Theme.muted)
                    }
                }
                .frame(height: 110)
            }
        }
        .card()
        .contentShape(Rectangle())
    }
}
