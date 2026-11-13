import ExpoModulesCore
import ExpoNotifications
import UserNotifications
import WidgetKit

final class CaptureNotificationDelegate: NotificationDelegate {
  static let shared = CaptureNotificationDelegate()
  func didReceive(_ response: UNNotificationResponse, completionHandler: @escaping () -> Void) -> Bool {
    let content = response.notification.request.content
    guard [CaptureNotifications.category, CaptureNotifications.singleCategory].contains(content.categoryIdentifier),
      [CaptureNotifications.addAction, CaptureNotifications.ignoreAction].contains(response.actionIdentifier),
      let id = content.userInfo["analysis_id"] as? String, UUID(uuidString: id) != nil else { return false }
    // SDK 58's NotificationCenterManager completes after delegates return. Finish the short
    // local transaction synchronously here; an asynchronous model/network job would be unsafe.
    do {
      let store = try SharedStore()
      if response.actionIdentifier == CaptureNotifications.addAction { _ = try store.approveSingleCapture(id: id) }
      else { try store.ignoreCapture(id: id) }
      UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [response.notification.request.identifier])
      WidgetCenter.shared.reloadAllTimelines()
      Task { try? await TodoActivityManager.refresh() }
    } catch { CaptureNotifications.requestReviewAfterFailure(id: id) }
    return true
  }
}
public class CaptureAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func subscriberDidRegister() {
    NotificationCenterManager.shared.addDelegate(CaptureNotificationDelegate.shared)
  }
}
