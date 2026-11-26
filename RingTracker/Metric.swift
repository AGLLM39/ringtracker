import SwiftUI
import HealthKit

/// Alle Messwerte, die der RingConn-Ring an Apple Health liefert und die App anzeigt.
enum Metric: String, CaseIterable, Identifiable {
    case steps
    case activeEnergy
    case heartRate
    case restingHeartRate
    case hrv
    case oxygen
    case respiratoryRate

    var id: String { rawValue }

    /// Werte, die im Raster „Vitalwerte“ auf der Startseite stehen.
    static let vitals: [Metric] = [.restingHeartRate, .hrv, .heartRate, .oxygen, .respiratoryRate]

    var title: String {
        switch self {
        case .steps: "Schritte"
        case .activeEnergy: "Aktive Energie"
        case .heartRate: "Herzfrequenz"
        case .restingHeartRate: "Ruhepuls"
        case .hrv: "HRV"
        case .oxygen: "Blutsauerstoff"
        case .respiratoryRate: "Atemfrequenz"
        }
    }

    var identifier: HKQuantityTypeIdentifier {
        switch self {
        case .steps: .stepCount
        case .activeEnergy: .activeEnergyBurned
        case .heartRate: .heartRate
        case .restingHeartRate: .restingHeartRate
        case .hrv: .heartRateVariabilitySDNN
        case .oxygen: .oxygenSaturation
        case .respiratoryRate: .respiratoryRate
        }
    }

    var quantityType: HKQuantityType { HKQuantityType(identifier) }

    var unit: HKUnit {
        switch self {
        case .steps: .count()
        case .activeEnergy: .kilocalorie()
        case .heartRate, .restingHeartRate, .respiratoryRate: HKUnit.count().unitDivided(by: .minute())
        case .hrv: .secondUnit(with: .milli)
        case .oxygen: .percent()
        }
    }

    /// Health speichert Sauerstoff als 0…1, angezeigt wird Prozent.
    var displayFactor: Double { self == .oxygen ? 100 : 1 }

    var unitLabel: String {
        switch self {
        case .steps: ""
        case .activeEnergy: "kcal"
        case .heartRate, .restingHeartRate: "bpm"
        case .hrv: "ms"
        case .oxygen: "%"
        case .respiratoryRate: "/min"
        }
    }

    var icon: String {
        switch self {
        case .steps: "figure.walk"
        case .activeEnergy: "flame.fill"
        case .heartRate: "heart.fill"
        case .restingHeartRate: "heart.circle.fill"
        case .hrv: "waveform.path.ecg"
        case .oxygen: "drop.fill"
        case .respiratoryRate: "lungs.fill"
        }
    }

    var color: Color {
        switch self {
        case .steps: Theme.accent
        case .activeEnergy: Theme.amber
        case .heartRate: Theme.over
        case .restingHeartRate: Theme.raspberry
        case .hrv: Theme.blue
        case .oxygen: Theme.drink
        case .respiratoryRate: Theme.accent2
        }
    }

    /// Schritte und Energie werden pro Tag addiert, alles andere gemittelt.
    var isCumulative: Bool { self == .steps || self == .activeEnergy }

    /// Ob ein höherer Wert gut ist (für die Trend-Einfärbung). `nil` = neutral.
    var higherIsBetter: Bool? {
        switch self {
        case .steps, .activeEnergy, .hrv, .oxygen: true
        case .restingHeartRate: false
        case .heartRate, .respiratoryRate: nil
        }
    }

    var explanation: String {
        switch self {
        case .steps:
            "Alle Schritte des Tages. Der Ring zählt auch dann, wenn das iPhone liegen bleibt."
        case .activeEnergy:
            "Kalorien, die du durch Bewegung zusätzlich zum Grundumsatz verbrauchst."
        case .heartRate:
            "Durchschnitt aller Pulsmessungen des Tages. Im Tagesverlauf siehst du einzelne Messungen."
        case .restingHeartRate:
            "Puls in völliger Ruhe, meist im Schlaf gemessen. Ein sinkender Ruhepuls spricht für gute Fitness und Erholung."
        case .hrv:
            "Herzratenvariabilität (SDNN): wie stark der Abstand zwischen Herzschlägen schwankt. Höher heißt meist besser erholt. Vergleiche nur mit deinen eigenen Werten."
        case .oxygen:
            "Sauerstoffsättigung im Blut. Werte zwischen 95 und 100 % sind üblich, nachts etwas weniger."
        case .respiratoryRate:
            "Atemzüge pro Minute im Schlaf. Ein plötzlicher Anstieg kann auf eine Erkältung hindeuten."
        }
    }

    /// Wie weit zurück der „aktuelle“ Wert reichen darf.
    var latestLookbackDays: Int { self == .heartRate ? 1 : 7 }

    func format(_ value: Double) -> String {
        let v = value * displayFactor
        switch self {
        case .oxygen, .respiratoryRate:
            return v.formatted(.number.precision(.fractionLength(0...1)))
        default:
            return v.formatted(.number.precision(.fractionLength(0)))
        }
    }

    func formatWithUnit(_ value: Double) -> String {
        unitLabel.isEmpty ? format(value) : "\(format(value)) \(unitLabel)"
    }
}
