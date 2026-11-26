import SwiftUI
import HealthKit

struct MetricValue: Equatable {
    let value: Double
    let date: Date
}

struct DayPoint: Identifiable, Equatable {
    let date: Date
    let value: Double
    var id: Date { date }
}

/// Einzelmessung im Tagesverlauf (z. B. Puls).
struct SamplePoint: Identifiable, Equatable {
    let date: Date
    let value: Double
    var id: Date { date }
}

// MARK: - Schlaf

enum SleepStage: String, CaseIterable, Identifiable {
    case deep, core, rem, unspecified, awake

    var id: String { rawValue }

    /// Reihenfolge für Balken: vom tiefsten zum leichtesten Schlaf.
    static let asleepStages: [SleepStage] = [.deep, .core, .rem, .unspecified]

    init?(value: Int) {
        switch HKCategoryValueSleepAnalysis(rawValue: value) {
        case .asleepDeep: self = .deep
        case .asleepCore: self = .core
        case .asleepREM: self = .rem
        case .asleepUnspecified: self = .unspecified
        case .awake: self = .awake
        default: return nil // „Im Bett“ zählt nicht als Schlaf
        }
    }

    var title: String {
        switch self {
        case .deep: "Tiefschlaf"
        case .core: "Leichtschlaf"
        case .rem: "REM"
        case .unspecified: "Schlaf"
        case .awake: "Wach"
        }
    }

    var color: Color {
        switch self {
        case .deep: Theme.deepViolet
        case .core: Theme.violet
        case .rem: Theme.blue
        case .unspecified: Theme.accent2
        case .awake: Theme.amber
        }
    }
}

struct SleepNight: Identifiable, Equatable {
    /// Tag, an dem aufgewacht wurde.
    let date: Date
    var durations: [SleepStage: TimeInterval] = [:]
    var start: Date?
    var end: Date?
    var source: String = ""

    var id: Date { date }

    var asleep: TimeInterval {
        SleepStage.asleepStages.reduce(0) { $0 + (durations[$1] ?? 0) }
    }

    var total: TimeInterval {
        durations.values.reduce(0, +)
    }

    func share(of stage: SleepStage) -> Double {
        asleep > 0 ? (durations[stage] ?? 0) / asleep : 0
    }

    /// Hat der Ring Schlafphasen geliefert oder nur „geschlafen“?
    var hasStages: Bool {
        (durations[.deep] ?? 0) + (durations[.rem] ?? 0) + (durations[.core] ?? 0) > 0
    }
}

extension TimeInterval {
    var hoursMinutes: String {
        let minutes = Int((self / 60).rounded())
        return minutes >= 60 ? "\(minutes / 60) h \(minutes % 60) min" : "\(minutes) min"
    }

    var hoursDecimal: Double { self / 3600 }
}

// MARK: - Erholung

struct Recovery: Equatable {
    struct Part: Identifiable, Equatable {
        let title: String
        let detail: String
        let score: Double
        var id: String { title }
    }

    let score: Int
    let parts: [Part]

    var label: String {
        switch score {
        case 75...: "Gut erholt"
        case 50..<75: "Ausgeglichen"
        default: "Ruhig angehen"
        }
    }

    var advice: String {
        switch score {
        case 75...: "Dein Körper ist bereit für eine fordernde Einheit."
        case 50..<75: "Normaler Tag. Moderate Belastung passt gut."
        default: "Heute lieber locker bewegen und früh schlafen gehen."
        }
    }

    var color: Color {
        switch score {
        case 75...: Theme.ok
        case 50..<75: Theme.warn
        default: Theme.over
        }
    }

    /// Erholung aus Schlafdauer, HRV und Ruhepuls im Vergleich zu deinen eigenen 30-Tage-Werten.
    static func compute(sleep: TimeInterval?, sleepGoal: TimeInterval,
                        hrv: Double?, hrvBaseline: Double?,
                        restingHR: Double?, restingBaseline: Double?) -> Recovery? {
        var parts: [Part] = []
        var weighted = 0.0
        var weights = 0.0

        func clamp(_ x: Double) -> Double { min(max(x, 0), 100) }

        if let sleep, sleep > 0 {
            let s = clamp(sleep / sleepGoal * 100)
            parts.append(Part(title: "Schlaf", detail: "\(sleep.hoursMinutes) von \(sleepGoal.hoursMinutes)", score: s))
            weighted += s * 0.4; weights += 0.4
        }
        if let hrv, let base = hrvBaseline, base > 0 {
            let ratio = hrv / base
            let s = clamp(50 + (ratio - 1) * 250)
            let pct = Int(((ratio - 1) * 100).rounded())
            parts.append(Part(title: "HRV", detail: "\(Int(hrv.rounded())) ms, \(pct >= 0 ? "+" : "")\(pct) % zum Schnitt", score: s))
            weighted += s * 0.35; weights += 0.35
        }
        if let rhr = restingHR, let base = restingBaseline, base > 0 {
            let diff = base - rhr
            let s = clamp(50 + diff * 6.25)
            let d = Int((rhr - base).rounded())
            parts.append(Part(title: "Ruhepuls", detail: "\(Int(rhr.rounded())) bpm, \(d >= 0 ? "+" : "")\(d) zum Schnitt", score: s))
            weighted += s * 0.25; weights += 0.25
        }
        guard weights > 0 else { return nil }
        return Recovery(score: Int((weighted / weights).rounded()), parts: parts)
    }
}
