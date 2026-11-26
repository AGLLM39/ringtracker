import SwiftUI

@main
struct RingTrackerApp: App {
    @State private var health = HealthManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(health)
                .tint(Theme.accent)
        }
    }
}

struct ContentView: View {
    @Environment(HealthManager.self) private var health
    @Environment(\.scenePhase) private var scenePhase
    @State private var tab = 0

    var body: some View {
        Group {
            if health.hasRequestedAuthorization {
                TabView(selection: $tab) {
                    TodayView()
                        .tabItem { Label("Heute", systemImage: "sun.max.fill") }
                        .tag(0)
                    WeekView()
                        .tabItem { Label("Woche", systemImage: "chart.bar.fill") }
                        .tag(1)
                    ProfileView()
                        .tabItem { Label("Profil", systemImage: "person.crop.circle") }
                        .tag(2)
                }
                .sensoryFeedback(.selection, trigger: tab)
                .task {
                    health.startObserving()
                    await health.refresh(force: true)
                }
            } else {
                OnboardingView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: health.hasRequestedAuthorization)
        .onChange(of: scenePhase) { _, phase in
            if phase == .active && health.hasRequestedAuthorization {
                Task { await health.refresh() }
            }
        }
    }
}
