import Foundation
import UserNotifications

enum CaptureNotifications {
  static let category = "TTODO_CAPTURE_REVIEW"
  static let singleCategory = "TTODO_CAPTURE_SINGLE"
  static let openAction = "TTODO_CAPTURE_OPEN"
  static let addAction = "TTODO_CAPTURE_ADD"
  static let ignoreAction = "TTODO_CAPTURE_IGNORE"
  static func suggest(_ outcome: CaptureOutcome) async {
    guard !outcome.duplicate, outcome.count > 0 else { return }
    let center = UNUserNotificationCenter.current()
    let settings = await center.notificationSettings()
    guard [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) else { return }
    guard let store = try? SharedStore(),
      let analysis = try? store.querySQL("SELECT status,expires_at FROM analyses WHERE id=?", params: [outcome.id]).first,
      analysis["status"] as? String == "review", let expires = analysis["expires_at"] as? String,
      let expiry = ExtractionValidator.timestamp(expires), expiry > Date(),
      let tasks = try? store.querySQL("SELECT title,needs_confirmation,review_status FROM extracted_tasks WHERE analysis_id=?", params: [outcome.id]),
      let snapshot = try? store.snapshot() else { return }
    let pending = tasks.filter { $0["review_status"] as? String == "pending" }
    guard !pending.isEmpty else { return }
    let quick = !snapshot.hideTitles && tasks.count == 1 && pending[0]["needs_confirmation"] as? Int64 == 0
    let open = UNNotificationAction(identifier: openAction, title: "확인하기", options: [.foreground])
    let add = UNNotificationAction(identifier: addAction, title: "추가", options: [])
    let ignore = UNNotificationAction(identifier: ignoreAction, title: "무시", options: [.destructive])
    let review = UNNotificationCategory(identifier: category, actions: [open, ignore], intentIdentifiers: [], options: [])
    let single = UNNotificationCategory(identifier: singleCategory, actions: [add, ignore, open], intentIdentifiers: [], options: [])
    var categories = await center.notificationCategories()
    categories = Set(categories.filter { ![category, singleCategory].contains($0.identifier) }); categories.insert(review); categories.insert(single)
    center.setNotificationCategories(categories)
    let content = UNMutableNotificationContent()
    content.title = "할 일 \(pending.count)개를 발견했어요"
    content.body = quick ? pending[0]["title"] as? String ?? "분석함에서 내용을 확인하세요." : "분석함에서 내용을 확인하고 필요한 항목만 저장하세요."
    content.categoryIdentifier = quick ? singleCategory : category
    content.userInfo = ["analysis_id": outcome.id]
    // Original conversation and images never appear. Task titles require explicit title visibility.
    guard (try? store.hasLocalAIConsent()) == true,
      (try? store.querySQL("SELECT status FROM analyses WHERE id=?", params: [outcome.id]).first?["status"] as? String) == "review" else { return }
    // Settings may change while notification categories are being loaded.
    if (try? store.snapshot().hideTitles) != false {
      content.body = "분석함에서 내용을 확인하고 필요한 항목만 저장하세요."
      content.categoryIdentifier = category
    }
    try? await center.add(UNNotificationRequest(identifier: "ttodo.capture.\(outcome.id)", content: content, trigger: nil))
  }
  static func clearAll() async {
    let center = UNUserNotificationCenter.current()
    let delivered = await center.deliveredNotifications().map { $0.request.identifier }.filter { $0.hasPrefix("ttodo.capture.") }
    let pending = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix("ttodo.capture.") }
    center.removeDeliveredNotifications(withIdentifiers: delivered)
    center.removePendingNotificationRequests(withIdentifiers: pending)
  }
  static func requestReviewAfterFailure(id: String) {
    let content = UNMutableNotificationContent()
    content.title = "분석함에서 내용을 확인해 주세요"
    content.body = "알림에서 바로 처리하지 못했어요. 저장 상태를 확인한 뒤 다시 시도해 주세요."
    content.categoryIdentifier = category; content.userInfo = ["analysis_id": id]
    UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "ttodo.capture.\(id)", content: content, trigger: nil), withCompletionHandler: nil)
  }
}
