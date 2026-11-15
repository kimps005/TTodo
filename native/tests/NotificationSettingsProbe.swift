import UIKit
import UserNotifications
import OSLog

// CI-only comparison app: no Expo, extensions, App Group or remote notifications.
@main
final class NotificationSettingsProbe: UIResponder, UIApplicationDelegate {
  var window: UIWindow?
  private let logger = Logger(subsystem: "app.ttodo.ci", category: "notification-settings")
  private let status = UILabel()
  private var opened: Bool?

  func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    let controller = UIViewController()
    controller.view.backgroundColor = .systemBackground
    status.accessibilityIdentifier = "probe-status"
    status.numberOfLines = 0
    let request = UIButton(type: .system)
    request.setTitle("Request notifications", for: .normal)
    request.accessibilityIdentifier = "probe-request"
    request.addTarget(self, action: #selector(requestPermission), for: .touchUpInside)
    let settings = UIButton(type: .system)
    settings.setTitle("Open notification settings", for: .normal)
    settings.accessibilityIdentifier = "probe-open"
    settings.addTarget(self, action: #selector(openSettings), for: .touchUpInside)
    let stack = UIStackView(arrangedSubviews: [status, request, settings])
    stack.axis = .vertical; stack.spacing = 24; stack.translatesAutoresizingMaskIntoConstraints = false
    controller.view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.centerYAnchor.constraint(equalTo: controller.view.centerYAnchor),
      stack.leadingAnchor.constraint(equalTo: controller.view.leadingAnchor, constant: 24),
      stack.trailingAnchor.constraint(equalTo: controller.view.trailingAnchor, constant: -24)
    ])
    window = UIWindow(frame: UIScreen.main.bounds)
    window?.rootViewController = controller; window?.makeKeyAndVisible()
    Task { await refresh() }
    return true
  }
  func applicationDidBecomeActive(_ application: UIApplication) { Task { await refresh() } }
  @MainActor private func refresh() async {
    let settings = await UNUserNotificationCenter.current().notificationSettings()
    status.text = "authorization=\(settings.authorizationStatus.rawValue) opened=\(opened.map(String.init) ?? "unset")"
  }
  @objc private func requestPermission() {
    Task { @MainActor in
      do { _ = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) }
      catch { status.text = "request failed"; return }
      await refresh()
    }
  }
  @objc private func openSettings() {
    Task { @MainActor in
      guard let url = URL(string: UIApplication.openNotificationSettingsURLString) else { return }
      let settings = await UNUserNotificationCenter.current().notificationSettings()
      logger.notice("TTodoNotificationSettingsDiagnostic probe before bundle=\(Bundle.main.bundleIdentifier ?? "missing", privacy: .public) authorization=\(settings.authorizationStatus.rawValue) appState=\(UIApplication.shared.applicationState.rawValue) url=\(url.absoluteString, privacy: .public)")
      let result = await UIApplication.shared.open(url)
      opened = result
      logger.notice("TTodoNotificationSettingsDiagnostic probe after opened=\(result, privacy: .public)")
      await refresh()
    }
  }
}
