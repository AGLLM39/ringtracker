import SwiftUI
import UIKit

// Gestaltung nach dem Vorbild von NährWert:
// warmes Leinen als Grund, Blattgrün als Leitfarbe, weiche Karten mit 18 pt Radius,
// Ringe, die sich beim Anzeigen füllen, und Avenir Next für den Schriftzug.

extension UIColor {
    convenience init(hex: UInt32) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255,
                  green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255,
                  alpha: 1)
    }
}

extension Color {
    /// Farbe mit eigenem Wert für hellen und dunklen Modus.
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
        })
    }
}

enum Theme {
    // Flächen
    static let bg = Color(light: 0xF4F3EE, dark: 0x101411)
    static let surface = Color(light: 0xFFFFFF, dark: 0x192019)
    static let surface2 = Color(light: 0xEFEEE8, dark: 0x222A23)
    static let line = Color(light: 0xE7E5DD, dark: 0x2A332B)

    // Schrift
    static let ink = Color(light: 0x1E2A21, dark: 0xE7ECE5)
    static let muted = Color(light: 0x59625A, dark: 0xAAB3A8)

    // Leitfarbe
    static let accent = Color(light: 0x2E7D57, dark: 0x6CC08E)
    static let accent2 = Color(light: 0x5DAA7A, dark: 0x9BD8B1)
    static let accentSoft = Color(light: 0xE2F0E7, dark: 0x1E3427)
    static let onAccent = Color(light: 0xFFFFFF, dark: 0x0D2015)

    // Zustände
    static let ok = Color(light: 0x3B9462, dark: 0x6CC08E)
    static let warn = Color(light: 0xD3982A, dark: 0xE4B35B)
    static let warnInk = Color(light: 0x8A5D0B, dark: 0xE4B35B)
    static let over = Color(light: 0xC8553F, dark: 0xE2826D)

    // Bereichsfarben (aus der NährWert-Palette)
    static let blue = Color(light: 0x3D7EBE, dark: 0x77AADC)
    static let amber = Color(light: 0xD98E2B, dark: 0xE8AE5B)
    static let violet = Color(light: 0x8C62B8, dark: 0xB694DE)
    static let deepViolet = Color(light: 0x5B3F8C, dark: 0x8F72C4)
    static let drink = Color(light: 0x2E7FA8, dark: 0x67B4D8)
    static let raspberry = Color(light: 0xB5476A, dark: 0xE38AA5)

    // Verlauf der Startkarte
    static let heroTint1 = Color(light: 0xE4F2E9, dark: 0x1F3A2A)
    static let heroTint2 = Color(light: 0xF3EFE2, dark: 0x262A1D)

    static let radius: CGFloat = 18

    static var accentGradient: LinearGradient {
        LinearGradient(colors: [accent2, accent], startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    static func logoFont(_ size: CGFloat) -> Font {
        .custom("AvenirNext-Bold", size: size)
    }

    static let riseCurve = Animation.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.45)
    static let ringCurve = Animation.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.9)
}

// MARK: - Karten

struct HeroBackground: View {
    var body: some View {
        ZStack {
            Theme.surface
            RadialGradient(colors: [Theme.heroTint1, Theme.heroTint1.opacity(0)],
                           center: .topLeading, startRadius: 0, endRadius: 340)
            RadialGradient(colors: [Theme.heroTint2, Theme.heroTint2.opacity(0)],
                           center: .bottomTrailing, startRadius: 0, endRadius: 260)
        }
    }
}

struct CardModifier: ViewModifier {
    var hero = false
    var padding: CGFloat = 16
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: Theme.radius, style: .continuous)
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background {
                if hero { HeroBackground() } else { Theme.surface }
            }
            .clipShape(shape)
            .overlay {
                shape.strokeBorder(scheme == .dark ? Theme.line : Color.clear, lineWidth: 1)
            }
            .shadow(color: .black.opacity(scheme == .dark ? 0.30 : 0.04), radius: 1, y: 1)
            .shadow(color: Color(red: 30 / 255, green: 42 / 255, blue: 33 / 255)
                        .opacity(scheme == .dark ? 0.0 : 0.10), radius: 12, y: 6)
    }
}

/// Karten gleiten beim ersten Anzeigen sanft herein (wie die Ansichten in NährWert).
struct RiseIn: ViewModifier {
    let index: Int
    @State private var shown = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .opacity(shown || reduceMotion ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 10)
            .onAppear {
                guard !shown else { return }
                withAnimation(Theme.riseCurve.delay(Double(min(index, 5)) * 0.04)) { shown = true }
            }
    }
}

extension View {
    func card(hero: Bool = false, padding: CGFloat = 16) -> some View {
        modifier(CardModifier(hero: hero, padding: padding))
    }

    func riseIn(_ index: Int) -> some View {
        modifier(RiseIn(index: index))
    }

    /// Hintergrund für ganze Bildschirme.
    func screenBackground() -> some View {
        background(Theme.bg.ignoresSafeArea())
    }
}

/// Grüner Knopf mit Verlauf, wie `button.primary` in NährWert.
struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Theme.onAccent)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(Theme.accentGradient, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .shadow(color: Theme.accent.opacity(0.45), radius: 8, y: 6)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Karten, die beim Tippen leicht nachgeben.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}
