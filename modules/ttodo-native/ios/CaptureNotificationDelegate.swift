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
      if response.actionIdentifier == CaptureNotifications.addAction {
        guard let taskId = content.userInfo["proposal_id"] as? String, UUID(uuidString: taskId) != nil else { throw CaptureError.reviewRequired }
        _ = try store.approveSingleCapture(id: id, expectedTaskId: taskId)
      } else {
        guard let taskIds = content.userInfo["proposal_ids"] as? [String], !taskIds.isEmpty, taskIds.allSatisfy({ UUID(uuidString: $0) != nil }) else { throw CaptureError.reviewRequired }
        try store.ignoreCapture(id: id, expectedTaskIds: taskIds)
      }
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
