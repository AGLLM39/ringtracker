import Foundation
import HealthKit
import Observation

/// Liest alle Daten aus Apple Health. Der RingConn-Ring schreibt seine Messungen über
/// die RingConn-App dorthin; diese App liest sie nur (keine Schreibrechte).
@MainActor
@Observable
final class HealthManager {
    @ObservationIgnored let store = HKHealthStore()
    @ObservationIgnored private var sourceCache: [String: Set<HKSource>] = [:]
    @ObservationIgnored private var observers: [HKObserverQuery] = []
    @ObservationIgnored private var lastRefresh = Date.distantPast
    @ObservationIgnored private let defaults = UserDefaults.standard

    // MARK: Zustand

    var hasRequestedAuthorization = false
    var isLoading = false
    var errorMessage: String?

    var today: [Metric: MetricValue] = [:]
    /// Durchschnitt der letzten 7 Tage (ohne heute) für die Trendanzeige.
    var weekAverage: [Metric: Double] = [:]
    var lastNight: SleepNight?
    var recovery: Recovery?
    var detectedSources: [String] = []
    var lastUpdated: Date?

    // MARK: Einstellungen

    var onlyRingConn: Bool = true {
        didSet { defaults.set(onlyRingConn, forKey: Keys.onlyRingConn); sourceCache = [:] }
    }
    var stepGoal: Int = 10_000 {
        didSet { defaults.set(stepGoal, forKey: Keys.stepGoal) }
    }
    var energyGoal: Int = 500 {
        didSet { defaults.set(energyGoal, forKey: Keys.energyGoal) }
    }
    /// Schlafziel in Minuten.
    var sleepGoalMinutes: Int = 480 {
        didSet { defaults.set(sleepGoalMinutes, forKey: Keys.sleepGoal) }
    }

    var sleepGoal: TimeInterval { TimeInterval(sleepGoalMinutes * 60) }

    private enum Keys {
        static let requested = "hasRequestedAuthorization"
        static let onlyRingConn = "onlyRingConn"
        static let stepGoal = "stepGoal"
        static let energyGoal = "energyGoal"
        static let sleepGoal = "sleepGoalMinutes"
    }

    init() {
        let stored = UserDefaults.standard
        hasRequestedAuthorization = stored.bool(forKey: Keys.requested)
        onlyRingConn = stored.object(forKey: Keys.onlyRingConn) as? Bool ?? true
        stepGoal = stored.object(forKey: Keys.stepGoal) as? Int ?? 10_000
        energyGoal = stored.object(forKey: Keys.energyGoal) as? Int ?? 500
        sleepGoalMinutes = stored.object(forKey: Keys.sleepGoal) as? Int ?? 480
    }

    var isHealthAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    var hasAnyData: Bool { !today.isEmpty || lastNight != nil }

    var ringConnFound: Bool {
        detectedSources.contains { $0.localizedCaseInsensitiveContains("ringconn") }
    }

    private var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>(Metric.allCases.map { $0.quantityType })
        types.insert(HKCategoryType(.sleepAnalysis))
        return types
    }

    private var sampleTypes: [HKSampleType] {
        Metric.allCases.map { $0.quantityType as HKSampleType } + [HKCategoryType(.sleepAnalysis)]
    }

    // MARK: Berechtigung

    func requestAuthorization() async {
        guard isHealthAvailable else {
            errorMessage = "Apple Health ist auf diesem Gerät nicht verfügbar."
            return
        }
        do {
            try await store.requestAuthorization(toShare: [], read: readTypes)
            hasRequestedAuthorization = true
            defaults.set(true, forKey: Keys.requested)
            errorMessage = nil
            startObserving()
            await refresh(force: true)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Meldet neue Daten in Health, solange die App offen ist (z. B. nach dem Sync der RingConn-App).
    func startObserving() {
        guard observers.isEmpty, hasRequestedAuthorization else { return }
        for type in sampleTypes {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { [weak self] _, completion, _ in
                completion()
                Task { @MainActor in
                    await self?.refresh()
                }
            }
            store.execute(query)
            observers.append(query)
        }
    }

    // MARK: Aktualisieren

    func refresh(force: Bool = false) async {
        guard !isLoading else { return }
        // Mehrere Meldungen kurz hintereinander nur einmal laden.
        if !force && Date.now.timeIntervalSince(lastRefresh) < 5 { return }
        isLoading = true
        defer { isLoading = false }
        lastRefresh = .now
        sourceCache = [:]

        var values: [Metric: MetricValue] = [:]
        var averages: [Metric: Double] = [:]
        for metric in Metric.allCases {
            if let v = await currentValue(metric) { values[metric] = v }
            if !metric.isCumulative {
                let week = await dailySeries(metric, days: 8).filter { !Calendar.current.isDateInToday($0.date) }
                if !week.isEmpty { averages[metric] = week.map(\.value).reduce(0, +) / Double(week.count) }
            }
        }
        today = values
        weekAverage = averages
        lastNight = await sleepNights(count: 2).last { Calendar.current.isDateInToday($0.date) }

        // Erholung: aktuelle Werte gegen den eigenen 30-Tage-Schnitt
        let hrvBase = await baseline(.hrv)
        let rhrBase = await baseline(.restingHeartRate)
        recovery = Recovery.compute(
            sleep: lastNight?.asleep, sleepGoal: sleepGoal,
            hrv: values[.hrv]?.value, hrvBaseline: hrvBase,
            restingHR: values[.restingHeartRate]?.value, restingBaseline: rhrBase)

        await loadDetectedSources()
        lastUpdated = .now
    }

    private func baseline(_ metric: Metric) async -> Double? {
        let points = await dailySeries(metric, days: 31).filter { !Calendar.current.isDateInToday($0.date) }
        guard points.count >= 3 else { return nil }
        return points.map(\.value).reduce(0, +) / Double(points.count)
    }

    // MARK: Datenquellen

    private func isRingConn(_ source: HKSource) -> Bool {
        source.name.localizedCaseInsensitiveContains("ringconn")
            || source.bundleIdentifier.localizedCaseInsensitiveContains("ringconn")
    }

    private func sources(for type: HKSampleType) async -> Set<HKSource> {
        if let cached = sourceCache[type.identifier] { return cached }
        let result: Set<HKSource> = await withCheckedContinuation { continuation in
            let query = HKSourceQuery(sampleType: type, samplePredicate: nil) { _, sources, _ in
                continuation.resume(returning: sources ?? [])
            }
            store.execute(query)
        }
        sourceCache[type.identifier] = result
        return result
    }

    /// Schränkt auf RingConn ein, wenn gewünscht und für diesen Typ vorhanden.
    /// Gibt es keine RingConn-Daten für den Typ, werden alle Quellen genutzt.
    private func sourcePredicate(for type: HKSampleType) async -> NSPredicate? {
        guard onlyRingConn else { return nil }
        let ring = await sources(for: type).filter { self.isRingConn($0) }
        return ring.isEmpty ? nil : HKQuery.predicateForObjects(from: ring)
    }

    private func predicate(for type: HKSampleType, from start: Date, to end: Date = .now) async -> NSPredicate {
        let date = HKQuery.predicateForSamples(withStart: start, end: end)
        guard let source = await sourcePredicate(for: type) else { return date }
        return NSCompoundPredicate(andPredicateWithSubpredicates: [date, source])
    }

    func loadDetectedSources() async {
        var names = Set<String>()
        for type in sampleTypes {
            for source in await sources(for: type) { names.insert(source.name) }
        }
        detectedSources = names.sorted { a, b in
            let ra = a.localizedCaseInsensitiveContains("ringconn")
            let rb = b.localizedCaseInsensitiveContains("ringconn")
            return ra != rb ? ra : a.localizedStandardCompare(b) == .orderedAscending
        }
    }

    // MARK: Abfragen

    /// Summe heute (Schritte, Energie) oder letzte Messung (alles andere).
    func currentValue(_ metric: Metric) async -> MetricValue? {
        let type = metric.quantityType
        let calendar = Calendar.current
        if metric.isCumulative {
            let start = calendar.startOfDay(for: .now)
            let pred = await predicate(for: type, from: start)
            let descriptor = HKStatisticsQueryDescriptor(
                predicate: .quantitySample(type: type, predicate: pred),
                options: .cumulativeSum)
            let stats = try? await descriptor.result(for: store)
            let sum = stats?.sumQuantity()?.doubleValue(for: metric.unit) ?? 0
            return MetricValue(value: sum, date: .now)
        } else {
            guard let start = calendar.date(byAdding: .day, value: -metric.latestLookbackDays, to: .now) else { return nil }
            let pred = await predicate(for: type, from: start)
            let descriptor = HKSampleQueryDescriptor(
                predicates: [.quantitySample(type: type, predicate: pred)],
                sortDescriptors: [SortDescriptor(\.endDate, order: .reverse)],
                limit: 1)
            guard let sample = (try? await descriptor.result(for: store))?.first else { return nil }
            return MetricValue(value: sample.quantity.doubleValue(for: metric.unit), date: sample.endDate)
        }
    }

    /// Ein Wert pro Tag (Summe oder Durchschnitt), älteste zuerst.
    func dailySeries(_ metric: Metric, days: Int) async -> [DayPoint] {
        let calendar = Calendar.current
        let end = Date.now
        guard let start = calendar.date(byAdding: .day, value: -(days - 1), to: calendar.startOfDay(for: end)) else { return [] }
        let type = metric.quantityType
        let pred = await predicate(for: type, from: start, to: end)
        let descriptor = HKStatisticsCollectionQueryDescriptor(
            predicate: .quantitySample(type: type, predicate: pred),
            options: metric.isCumulative ? .cumulativeSum : .discreteAverage,
            anchorDate: start,
            intervalComponents: DateComponents(day: 1))
        guard let collection = try? await descriptor.result(for: store) else { return [] }
        var points: [DayPoint] = []
        collection.enumerateStatistics(from: start, to: end) { stats, _ in
            let quantity = metric.isCumulative ? stats.sumQuantity() : stats.averageQuantity()
            if let quantity {
                points.append(DayPoint(date: stats.startDate, value: quantity.doubleValue(for: metric.unit)))
            }
        }
        return points
    }

    /// Einzelmessungen eines Tages, z. B. für den Pulsverlauf.
    func samples(_ metric: Metric, on day: Date) async -> [SamplePoint] {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: day)
        guard let end = calendar.date(byAdding: .day, value: 1, to: start) else { return [] }
        let type = metric.quantityType
        let pred = await predicate(for: type, from: start, to: min(end, .now))
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.quantitySample(type: type, predicate: pred)],
            sortDescriptors: [SortDescriptor(\.startDate)])
        guard let samples = try? await descriptor.result(for: store) else { return [] }
        return samples.map { SamplePoint(date: $0.startDate, value: $0.quantity.doubleValue(for: metric.unit)) }
    }

    /// Schlaf der letzten Nächte, älteste zuerst. Eine Nacht gehört zum Tag des Aufwachens.
    /// Liefern mehrere Geräte Schlafdaten, zählt pro Nacht nur eine Quelle (RingConn bevorzugt),
    /// damit nichts doppelt gerechnet wird.
    func sleepNights(count: Int) async -> [SleepNight] {
        let calendar = Calendar.current
        let todayStart = calendar.startOfDay(for: .now)
        guard let start = calendar.date(byAdding: .hour, value: -(count * 24 + 6), to: todayStart) else { return [] }
        let type = HKCategoryType(.sleepAnalysis)
        let pred = HKQuery.predicateForSamples(withStart: start, end: .now)
        let descriptor = HKSampleQueryDescriptor(
            predicates: [.categorySample(type: type, predicate: pred)],
            sortDescriptors: [SortDescriptor(\.startDate)])
        guard let samples = try? await descriptor.result(for: store) else { return [] }

        var grouped: [Date: [String: [HKCategorySample]]] = [:]
        for sample in samples {
            let night = calendar.startOfDay(for: sample.endDate.addingTimeInterval(6 * 3600))
            grouped[night, default: [:]][sample.sourceRevision.source.bundleIdentifier, default: []].append(sample)
        }

        var nights: [SleepNight] = []
        for (day, bySource) in grouped {
            let candidates = bySource.values.map { makeNight(day: day, samples: $0) }.filter { $0.asleep > 0 }
            let ring = candidates.first { $0.source.localizedCaseInsensitiveContains("ringconn") }
            let chosen: SleepNight?
            if onlyRingConn, let ring {
                chosen = ring
            } else {
                chosen = ring ?? candidates.max { $0.asleep < $1.asleep }
            }
            if let chosen { nights.append(chosen) }
        }
        let first = calendar.date(byAdding: .day, value: -(count - 1), to: todayStart) ?? todayStart
        return nights.filter { $0.date >= first }.sorted { $0.date < $1.date }
    }

    private func makeNight(day: Date, samples: [HKCategorySample]) -> SleepNight {
        var night = SleepNight(date: day)
        night.source = samples.first?.sourceRevision.source.name ?? ""
        for sample in samples {
            guard let stage = SleepStage(value: sample.value) else { continue }
            night.durations[stage, default: 0] += sample.endDate.timeIntervalSince(sample.startDate)
            if stage != .awake {
                night.start = min(night.start ?? sample.startDate, sample.startDate)
                night.end = max(night.end ?? sample.endDate, sample.endDate)
            }
        }
        return night
    }
}
