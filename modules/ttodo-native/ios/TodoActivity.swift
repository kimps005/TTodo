import ActivityKit
import WidgetKit
import Foundation
struct TodoActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var tasks: [LockTask]
    var count: Int
    var hideTitles: Bool
    var hideContent: Bool? = nil
  }
  let name: String
}
enum TodoActivityManager {
  @discardableResult
  static func publishLockChange() -> Task<Void, Never> {
    WidgetCenter.shared.reloadAllTimelines()
    return Task { do { try await refresh() } catch { /* Retry on foreground. */ } }
  }
  static func status() -> String {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return "disabled" }
    let activities = Activity<TodoActivityAttributes>.activities
    if activities.contains(where: { $0.activityState == .active }) { return "active" }
    if activities.contains(where: { $0.activityState == .stale }) { return "stale" }
    return "inactive"
  }
  static func state(from snapshot: LockSnapshot) throws -> TodoActivityAttributes.ContentState {
    var state = TodoActivityAttributes.ContentState(tasks: snapshot.tasks, count: snapshot.count, hideTitles: snapshot.hideTitles, hideContent: snapshot.hideContent)
    // Five 200-scalar titles can exceed ActivityKit's 4 KB payload limit.
    // Keep the leading rows and the actual total even with escaped Unicode.
    while !state.tasks.isEmpty {
      if try JSONEncoder().encode(state).count <= 3900 { break }
      state.tasks.removeLast()
    }
    return state
  }
  static func refresh() async throws {
    let current = Activity<TodoActivityAttributes>.activities.filter { $0.activityState == .active || $0.activityState == .stale }
    guard !current.isEmpty else { return }
    let snapshotTime = Date()
    let content = ActivityContent(state: try state(from: SharedStore().snapshot(now: snapshotTime)), staleDate: snapshotTime.addingTimeInterval(3600))
    for activity in current {
      await activity.update(content, timestamp: snapshotTime)
    }
  }
  // Foreground recovery and explicit controls must finish in order across awaits.
  @MainActor private static var previous: Task<Void, Never>?
  @MainActor static func perform(_ action: ActivityAction) async throws {
    let predecessor = previous
    let operation = Task {
      await predecessor?.value
      try await reconcile(action)
    }
    previous = Task { _ = try? await operation.value }
    try await operation.value
  }

  private static func reconcile(_ action: ActivityAction) async throws {
    let activities = Activity<TodoActivityAttributes>.activities.sorted { $0.id < $1.id }
    if action == .stop {
      // Ending cards must still run if clearing the preference fails. After
      // delete-all, UPDATE leaves the empty preferences table untouched.
      do {
        try SharedStore().runSQL("UPDATE preferences SET value=? WHERE key=?", params: ["no", "live_activity_enabled"])
      } catch {
        for activity in activities { await activity.end(nil, dismissalPolicy: .immediate) }
        throw error
      }
      for activity in activities { await activity.end(nil, dismissalPolicy: .immediate) }
      return
    }
    let store = try SharedStore()
    let preference = try store.querySQL("SELECT value FROM preferences WHERE key=?", params: ["live_activity_enabled"]).first?["value"] as? String
    let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
    if action == .start && !enabled {
      throw NSError(domain: "TTodo", code: 1, userInfo: [NSLocalizedDescriptionKey: "iOS 설정에서 실시간 현황을 허용해 주세요."])
    }
    if action == .start {
      try store.runSQL("INSERT OR REPLACE INTO preferences(key,value) VALUES(?,?)", params: ["live_activity_enabled", "yes"])
    }
    let plan = ActivityRecovery(action: action, preference: preference, enabled: enabled,
      activities: activities.map { ($0.id, $0.activityState) })
    for activity in activities where activity.id != plan.keep {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
    guard plan.create || plan.keep != nil else { return }
    let time = Date()
    let content = ActivityContent(state: try state(from: store.snapshot(now: time)), staleDate: time.addingTimeInterval(3600))
    if let current = activities.first(where: { $0.id == plan.keep }) {
      await current.update(content, timestamp: time)
    } else if plan.create {
      _ = try Activity.request(attributes: TodoActivityAttributes(name: "오늘의 할 일"), content: content, pushType: nil)
    }
  }
}

enum ActivityAction { case foreground, start, stop }

struct ActivityRecovery {
  let keep: String?
  let create: Bool
  init(action: ActivityAction, preference: String?, enabled: Bool, activities: [(String, ActivityState)]) {
    // A pre-upgrade card has no stored preference. Keep it until it ends.
    let allowed = enabled && action != .stop && (action == .start || preference != "no")
    let current = activities.first { $0.1 == .active } ?? activities.first { $0.1 == .stale }
    keep = allowed ? current?.0 : nil
    create = allowed && keep == nil && (action == .start || preference == "yes")
  }
}
