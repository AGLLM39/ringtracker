import SwiftUI

struct OnboardingView: View {
    @Environment(HealthManager.self) private var health
    @State private var isRequesting = false

    var body: some View {
        ZStack {
            HeroBackground().ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer(minLength: 24)

                LogoBadge(size: 84)
                    .riseIn(0)

                Text("RingTracker")
                    .font(Theme.logoFont(34))
                    .tracking(0.6)
                    .foregroundStyle(Theme.ink)
                    .padding(.top, 20)
                    .riseIn(1)

                Text("Schlaf, Puls, HRV und Bewegung von deinem RingConn-Ring, übersichtlich an einem Ort.")
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)
                    .padding(.horizontal, 12)
                    .riseIn(2)

                VStack(alignment: .leading, spacing: 16) {
                    feature("moon.zzz.fill", Theme.violet, "Schlafphasen", "Tief-, Leicht- und REM-Schlaf jeder Nacht")
                    feature("leaf.fill", Theme.accent, "Erholung", "Score aus Schlaf, HRV und Ruhepuls")
                    feature("chart.bar.fill", Theme.amber, "Verläufe", "7, 30 und 90 Tage mit Trends")
                    feature("lock.fill", Theme.blue, "Privat", "Alles bleibt auf deinem iPhone")
                }
                .card(padding: 20)
                .padding(.top, 28)
                .riseIn(3)

                Spacer(minLength: 24)

                Button {
                    isRequesting = true
                    Task {
                        await health.requestAuthorization()
                        isRequesting = false
                    }
                } label: {
                    HStack(spacing: 8) {
                        if isRequesting { ProgressView().tint(Theme.onAccent) }
                        Text("Mit Apple Health verbinden")
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(isRequesting)
                .riseIn(4)

                Text("Die RingConn-App muss ihre Daten an Apple Health übertragen. RingTracker liest sie nur.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)
                    .padding(.top, 12)

                if let error = health.errorMessage {
                    Text(error)
                        .font(.system(size: 13.5))
                        .foregroundStyle(Theme.over)
                        .multilineTextAlignment(.center)
                        .padding(.top, 8)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 16)
        }
    }

    private func feature(_ icon: String, _ color: Color, _ title: String, _ text: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 38, height: 38)
                .background(color.opacity(0.14), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.system(size: 15.5, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Text(text)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.muted)
            }
        }
    }
}
