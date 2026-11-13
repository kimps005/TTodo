import Foundation
import UserNotifications

enum CaptureNotifications {
  static let category = "TTODO_CAPTURE_REVIEW"
  static let openAction = "TTODO_CAPTURE_OPEN"
  static func suggest(_ outcome: CaptureOutcome) async {
    guard !outcome.duplicate, outcome.count > 0 else { return }
    let center = UNUserNotificationCenter.current()
    let settings = await center.notificationSettings()
    guard [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) else { return }
    let open = UNNotificationAction(identifier: openAction, title: "확인하기", options: [.foreground])
    let review = UNNotificationCategory(identifier: category, actions: [open], intentIdentifiers: [], options: [])
    var categories = await center.notificationCategories()
    categories = Set(categories.filter { $0.identifier != category }); categories.insert(review)
    center.setNotificationCategories(categories)
    let content = UNMutableNotificationContent()
    content.title = "할 일 \(outcome.count)개를 발견했어요"
    content.body = "분석함에서 내용을 확인하고 필요한 항목만 저장하세요."
    content.categoryIdentifier = category
    content.userInfo = ["analysis_id": outcome.id]
    // No original conversation, task title or image appears on the lock screen.
    try? await center.add(UNNotificationRequest(identifier: "ttodo.capture.\(outcome.id)", content: content, trigger: nil))
  }
}
