import Foundation

// An accepted URL does not prove arrival at notification controls.
enum NotificationSettingsRouter {
  enum Destination: String { case notifications, application, simulator, failed }
  static func open(simulator: Bool, openNotifications: () async -> Bool,
    openApplication: () async -> Bool) async -> Destination {
    // Recorded CI runtimes hide Notifications even when open returns true.
    if simulator { return await openApplication() ? .simulator : .failed }
    if await openNotifications() { return .notifications }
    return await openApplication() ? .application : .failed
  }
}
