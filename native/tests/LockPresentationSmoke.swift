import ActivityKit
import Foundation

@main struct LockPresentationSmoke {
  @MainActor static func main() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = try SharedStore(directoryOverride: directory)
    let secret = "민감한 합성 제목"
    let now = ISO8601DateFormatter().date(from: "2026-11-18T12:00:00Z")!
    for (id, title, due, status) in [("later", "다음 할 일", "2099-01-01", "pending"), ("first", secret, "2026-11-18", "pending"), ("done", "완료한 비밀", "2026-11-18", "completed")] {
      try store.runSQL("INSERT INTO todos(id,title,description,due_at,due_precision,status,created_at,updated_at) VALUES(?,?,?,?,'date',?,?,?)", params: [id, title, "민감한 메모", due, status, "2026-11-17", "2026-11-17"])
    }
    for privacy in ["yes", "no"] {
      for hideAll in ["yes", "no"] {
        try store.runSQL("INSERT OR REPLACE INTO preferences(key,value) VALUES(?,?),(?,?)", params: ["private_lock", privacy, "hide_lock_content", hideAll])
        let snapshot = try store.snapshot(now: now)
        let entry = TodoProvider().entry { snapshot }
        let state = try TodoActivityManager.state(from: snapshot)
        let full = hideAll == "yes"
        let masked = full || privacy == "yes"
        let expectedTitles = full ? [] : (masked ? ["할 일", "할 일"] : [secret, "다음 할 일"])
        precondition(entry.tasks.map(\.title) == expectedTitles && state.tasks.map(\.title) == expectedTitles)
        precondition(entry.count == (full ? 0 : 2) && state.count == entry.count)
        precondition(entry.contentHidden == full && state.hideContent == full)
        precondition(entry.hidden == masked && state.hideTitles == masked)
        precondition(entry.deadlineText == (masked ? nil : "2026.11.18"))
        let payload = String(decoding: try JSONEncoder().encode(state), as: UTF8.self)
        precondition(!payload.contains("민감한 메모") && !payload.contains("완료한 비밀"))
        precondition(payload.contains(secret) == !masked)
      }
    }
    let unavailable = TodoProvider().entry { throw StoreError.unavailable }
    precondition(unavailable.unavailable && unavailable.hidden && unavailable.count == 0 && unavailable.tasks.isEmpty && unavailable.deadlineText == nil)
    func check(_ action: ActivityAction, _ preference: String?, _ enabled: Bool, _ active: [String], _ stale: [String], keep: String?, create: Bool) {
      let inventory: [(String, ActivityState)] = [("expired", .ended), ("removed", .dismissed)] + active.map { ($0, .active) } + stale.map { ($0, .stale) }
      let plan = ActivityRecovery(action: action, preference: preference, enabled: enabled, activities: inventory)
      precondition(plan.keep == keep && plan.create == create)
    }
    check(.foreground, "yes", true, [], [], keep: nil, create: true)
    check(.foreground, "yes", true, ["live", "duplicate"], ["old"], keep: "live", create: false)
    check(.foreground, "yes", true, [], ["outdated"], keep: "outdated", create: false)
    check(.foreground, nil, true, [], [], keep: nil, create: false)
    check(.foreground, nil, true, ["legacy"], [], keep: "legacy", create: false)
    check(.foreground, "no", true, ["old"], [], keep: nil, create: false)
    check(.foreground, "yes", false, [], [], keep: nil, create: false)
    check(.stop, "yes", true, ["live"], [], keep: nil, create: false)
    check(.start, "no", true, [], [], keep: nil, create: true)
  }
}
