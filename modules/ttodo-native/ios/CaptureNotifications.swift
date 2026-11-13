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
      let tasks = try? store.querySQL("SELECT id,title,needs_confirmation,review_status FROM extracted_tasks WHERE analysis_id=?", params: [outcome.id]),
      let snapshot = try? store.snapshot() else { return }
    let pending = tasks.filter { $0["review_status"] as? String == "pending" }
    guard !pending.isEmpty else { return }
    let quick = !snapshot.hideTitles && tasks.count == 1 && pending[0]["needs_confirmation"] as? Int64 == 0 && (try? store.similarCaptures(id: outcome.id))?.isEmpty == true
    let open = UNNotificationAction(identifier: openAction, title: "확인하기", options: [.foreground])
    let add = UNNotificationAction(identifier: addAction, title: "추가", options: [])
    let ignore = UNNotificationAction(identifier: ignoreAction, title: "무시", options: [.destructive])
    let review = UNNotificationCategory(identifier: category, actions: [open, ignore], intentIdentifiers: [], options: [])
    let single = UNNotificationCategory(identifier: singleCategory, actions: [add, ignore, open], intentIdentifiers: [], options: [])
    var categories = await center.notificationCategories()
    categories = Set(categories.filter { ![category, singleCategory].contains($0.identifier) }); categories.insert(review); categories.insert(single)
    center.setNotificationCategories(categories)
    let content = UNMutableNotificationContent()
    content.title = snapshot.hideContent ? "새 분석 결과가 있어요" : "할 일 \(pending.count)개를 발견했어요"
    content.body = quick ? pending[0]["title"] as? String ?? "분석함에서 내용을 확인하세요." : "분석함에서 내용을 확인하고 필요한 항목만 저장하세요."
    content.categoryIdentifier = quick ? singleCategory : category
    content.userInfo = ["analysis_id": outcome.id, "proposal_ids": pending.compactMap { $0["id"] as? String }]
    if quick { content.userInfo["proposal_id"] = pending[0]["id"] as? String }
    // Original conversation and images never appear. Task titles require explicit title visibility.
    guard (try? store.captureNotificationIsCurrent(id: outcome.id, expectedTaskIds: pending.compactMap { $0["id"] as? String })) == true else { return }
    // Settings may change while notification categories are being loaded.
    let latestPrivacy = try? store.snapshot()
    if latestPrivacy?.hideTitles != false {
      content.body = "분석함에서 내용을 확인하고 필요한 항목만 저장하세요."
      content.categoryIdentifier = category
    }
    if latestPrivacy?.hideContent != false { content.title = "새 분석 결과가 있어요" }
    try? await center.add(UNNotificationRequest(identifier: "ttodo.capture.\(outcome.id)", content: content, trigger: nil))
  }
  static func clearAll() async {
    let center = UNUserNotificationCenter.current()
    let delivered = await center.deliveredNotifications().map { $0.request.identifier }.filter { $0.hasPrefix("ttodo.capture.") }
    let pending = await center.pendingNotificationRequests().map(\.identifier).filter { $0.hasPrefix("ttodo.capture.") }
    center.removeDeliveredNotifications(withIdentifiers: delivered)
    center.removePendingNotificationRequests(withIdentifiers: pending)
  }
  static func clearAnalysis(_ id: String) {
    let identifiers = ["ttodo.capture.\(id)"]
    let center = UNUserNotificationCenter.current()
    center.removeDeliveredNotifications(withIdentifiers: identifiers)
    center.removePendingNotificationRequests(withIdentifiers: identifiers)
  }
  static func requestReviewAfterFailure(id: String) {
    let content = UNMutableNotificationContent()
    content.title = "분석함에서 내용을 확인해 주세요"
    content.body = "알림에서 바로 처리하지 못했어요. 저장 상태를 확인한 뒤 다시 시도해 주세요."
    // Only tapping to review is offered after stale/failed actions; do not attach
    // an Ignore action whose proposal identities were never shown to the user.
    content.userInfo = ["analysis_id": id]
    UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "ttodo.capture.\(id)", content: content, trigger: nil), withCompletionHandler: nil)
  }
}
