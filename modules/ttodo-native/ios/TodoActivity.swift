import ActivityKit
import Foundation
struct TodoActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var tasks: [LockTask]
    var count: Int
    var hideTitles: Bool
  }
  let name: String
}
enum TodoActivityManager {
  static func state() throws -> TodoActivityAttributes.ContentState {
    let snapshot = try SharedStore().snapshot()
    return .init(tasks: snapshot.tasks, count: snapshot.count, hideTitles: snapshot.hideTitles)
  }
  static func refresh() async throws {
    let content = ActivityContent(state: try state(), staleDate: Date().addingTimeInterval(3600))
    for activity in Activity<TodoActivityAttributes>.activities { await activity.update(content) }
  }
  static func start() async throws {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { throw NSError(domain: "TTodo", code: 1, userInfo: [NSLocalizedDescriptionKey: "iOS 설정에서 실시간 현황을 허용해 주세요."]) }
    if !Activity<TodoActivityAttributes>.activities.isEmpty { try await refresh(); return }
    _ = try Activity.request(attributes: TodoActivityAttributes(name: "오늘의 할 일"), content: ActivityContent(state: try state(), staleDate: Date().addingTimeInterval(3600)), pushType: nil)
  }
  static func end() async {
    for activity in Activity<TodoActivityAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
  }
}
