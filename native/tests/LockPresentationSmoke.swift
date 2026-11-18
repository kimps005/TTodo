import ActivityKit
import Foundation

@main struct LockPresentationSmoke {
  @MainActor static func main() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = try SharedStore(directoryOverride: directory)
    let now = ISO8601DateFormatter().date(from: "2026-11-18T12:00:00Z")!
    let titles = (1...6).map { "비공개 제목 \($0)" }
    for (index, title) in (titles + ["완료한 비밀"]).enumerated() {
      let day = "2026-12-0\(index + 1)"
      try store.runSQL("INSERT INTO todos(id,title,description,due_at,due_precision,status,created_at,updated_at) VALUES(?,?,?,?,'date',?,?,?)",
        params: [String(index), title, "비공개 세부 메모", day, index < titles.count ? "pending" : "completed", day, day])
    }

    // An absent preference is the pre-onboarding default. The last case also
    // covers switching back to title display after suppressing all content.
    let cases: [(privacy: String?, hideAll: String?, masked: Bool, full: Bool)] = [
      (nil, nil, true, false), ("yes", "no", true, false),
      ("no", "yes", true, true), ("yes", "yes", true, true), ("no", "no", false, false)
    ]
    for mode in cases {
      if let privacy = mode.privacy, let hideAll = mode.hideAll {
        try store.runSQL("INSERT OR REPLACE INTO preferences(key,value) VALUES(?,?),(?,?)",
          params: ["private_lock", privacy, "hide_lock_content", hideAll])
      }
      let snapshot = try store.snapshot(now: now)
      let entry = TodoProvider().entry { snapshot }
      let state = try TodoActivityManager.state(from: snapshot)
      let expectedCount = mode.full ? 0 : titles.count
      let rows: [[String: String]] = mode.full ? [] : titles.prefix(5).enumerated().map { index, title in
        ["id": String(index), "title": mode.masked ? "할 일" : title]
      }
      let modeName = "private_lock=\(mode.privacy ?? "unset"), hide_lock_content=\(mode.hideAll ?? "unset")"
      let widgetRows = try JSONSerialization.jsonObject(with: JSONEncoder().encode(entry.tasks)) as? [[String: String]]
      precondition(!entry.unavailable && widgetRows == rows, "Widget rows: \(modeName)")
      precondition(entry.count == expectedCount && entry.contentHidden == mode.full && entry.hidden == mode.masked, "Widget header: \(modeName)")
      precondition(entry.deadlineText == (mode.masked ? nil : "2026.12.01"), "Widget deadline: \(modeName)")

      // Compare the entire encoded state so details leaking outside task.title
      // (including descriptions, dates or surplus rows) fail the test too.
      let payload = try JSONSerialization.jsonObject(with: JSONEncoder().encode(state)) as? NSDictionary
      let expected: NSDictionary = ["tasks": rows, "count": expectedCount, "hideTitles": mode.masked, "hideContent": mode.full]
      precondition(payload == expected, "Activity payload: \(modeName)")
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
