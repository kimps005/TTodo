import Foundation
import SQLite3

// Runs the production Swift SQLite implementation on the macOS CI host.
// App Group entitlements, file protection and locked-device input still need iPhone tests.
@main
struct StoreSmoke {
  private static func check(_ condition: Bool) { precondition(condition) }
  static func main() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("ttodo-store-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    // Widget deadlines share list priority, but must not leak in count/hidden modes.
    do {
      let widgetDirectory = directory.appendingPathComponent("widget-deadlines")
      try FileManager.default.createDirectory(at: widgetDirectory, withIntermediateDirectories: true)
      let widget = try SharedStore(directoryOverride: widgetDirectory)
      let now = ISO8601DateFormatter().date(from: "2026-11-15T12:00:00Z")!
      var calendar = Calendar(identifier: .gregorian); calendar.timeZone = .current
      let dayFormat = DateFormatter(); dayFormat.locale = Locale(identifier: "en_US_POSIX")
      dayFormat.calendar = calendar; dayFormat.timeZone = .current; dayFormat.dateFormat = "yyyy-MM-dd"
      func day(_ offset: Int) -> String { dayFormat.string(from: calendar.date(byAdding: .day, value: offset, to: now)!) }
      func add(_ id: String, due: String?, precision: String = "date", completed: Bool = false) throws {
        try widget.runSQL("INSERT INTO todos(id,title,due_at,due_precision,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)", params: [id, id, due, due == nil ? "unknown" : precision, completed ? "completed" : "pending", "2026-11-15T12:00:00Z", "2026-11-15T12:00:00Z"])
      }
      try add("older-past", due: day(-5)); try add("recent-past", due: day(-1))
      try add("today-date", due: day(0))
      try add("today-time", due: "2026-11-15T21:00:00+09:00", precision: "datetime")
      for index in 0..<6 { try add("undated-\(index)", due: nil) }
      try add("future", due: day(1)); try add("completed", due: day(-10), completed: true)
      check(try widget.snapshot(now: now).deadlineText == nil) // Default: count only.
      try widget.runSQL("INSERT INTO preferences(key,value) VALUES('private_lock','no')", params: [])
      let today = try widget.snapshot(now: now)
      check(today.count == 11 && Array(today.tasks.map { $0.id }.prefix(4)) == ["today-date", "today-time", "older-past", "recent-past"])
      check(today.deadlineText == day(0).replacingOccurrences(of: "-", with: "."))
      try widget.runSQL("UPDATE todos SET status='completed' WHERE id=?", params: ["today-date"])
      let localTime = DateFormatter(); localTime.locale = Locale(identifier: "en_US_POSIX")
      localTime.calendar = calendar; localTime.timeZone = .current; localTime.dateFormat = "yyyy.MM.dd HH:mm"
      check(try widget.snapshot(now: now).deadlineText == localTime.string(from: now))
      try widget.runSQL("INSERT INTO preferences(key,value) VALUES('hide_lock_content','yes')", params: [])
      let hiddenDeadline = try widget.snapshot(now: now)
      check(hiddenDeadline.deadlineText == nil && hiddenDeadline.tasks.isEmpty && hiddenDeadline.count == 0)
      try widget.runSQL("UPDATE preferences SET value='no' WHERE key='hide_lock_content'", params: [])
      try widget.runSQL("UPDATE todos SET status='completed' WHERE id=?", params: ["today-time"])
      check(try widget.snapshot(now: now).deadlineText == day(-5).replacingOccurrences(of: "-", with: "."))
      try widget.runSQL("UPDATE todos SET status='completed' WHERE id IN (?,?)", params: ["older-past", "recent-past"])
      let future = try widget.snapshot(now: now)
      check(future.tasks.count == 5 && !future.tasks.contains { $0.id == "future" })
      check(future.deadlineText == day(1).replacingOccurrences(of: "-", with: "."))
      try widget.runSQL("UPDATE todos SET status='completed' WHERE id=?", params: ["future"])
      check(try widget.snapshot(now: now).deadlineText == nil)
    }
    let v2Directory = directory.appendingPathComponent("v2", isDirectory: true)
    try FileManager.default.createDirectory(at: v2Directory, withIntermediateDirectories: true)
    var v2Database: OpaquePointer?
    precondition(sqlite3_open(v2Directory.appendingPathComponent("ttodo.sqlite").path, &v2Database) == SQLITE_OK)
    let v2 = TTodoConfiguration.schemaSQL.replacingOccurrences(of: "processing_token TEXT, ", with: "").replacingOccurrences(of: "PRAGMA user_version = 3", with: "PRAGMA user_version = 2")
    precondition(sqlite3_exec(v2Database, v2, nil, nil, nil) == SQLITE_OK)
    precondition(sqlite3_exec(v2Database, "INSERT INTO todos(id,title,created_at,updated_at) VALUES('v2-todo','이전 데이터','2026-11-13','2026-11-13')", nil, nil, nil) == SQLITE_OK)
    sqlite3_close(v2Database)
    let migrated = try SharedStore(directoryOverride: v2Directory)
    check((try migrated.querySQL("PRAGMA user_version", params: []))[0]["user_version"] as? Int64 == 3)
    check((try migrated.querySQL("SELECT title FROM todos WHERE id='v2-todo'", params: []))[0]["title"] as? String == "이전 데이터")
    check((try migrated.querySQL("SELECT processing_token FROM analyses", params: [])).isEmpty)
    var old: OpaquePointer?
    precondition(sqlite3_open(directory.appendingPathComponent("ttodo.sqlite").path, &old) == SQLITE_OK)
    let v1 = TTodoConfiguration.schemaSQL.replacingOccurrences(of: "captured_at TEXT,", with: "captured_at TEXT NOT NULL,").replacingOccurrences(of: "processing_token TEXT, ", with: "").replacingOccurrences(of: "PRAGMA user_version = 3", with: "PRAGMA user_version = 1")
    precondition(sqlite3_exec(old, v1, nil, nil, nil) == SQLITE_OK)
    precondition(sqlite3_exec(old, "INSERT INTO analyses(id,image_fingerprint,captured_at,received_at,status,source_channel,expires_at) VALUES('old','old-hash','2026-11-13','2026-11-13','empty','manual','2026-11-20')", nil, nil, nil) == SQLITE_OK)
    sqlite3_close(old)
    let store = try SharedStore(directoryOverride: directory)
    check((try store.querySQL("PRAGMA user_version", params: []))[0]["user_version"] as? Int64 == 3)
    check((try store.querySQL("SELECT COUNT(*) AS count FROM analyses", params: []))[0]["count"] as? Int64 == 1)
    try store.add(title: "  실제 Swift 저장 테스트  ")
    let first = try store.snapshot()
    precondition(first.count == 1 && first.hideTitles && first.tasks[0].title == "할 일")
    try store.runSQL("INSERT INTO preferences(key,value) VALUES('hide_lock_content','yes')", params: [])
    let hidden = try store.snapshot()
    check(hidden.hideContent && hidden.hideTitles && hidden.count == 0 && hidden.tasks.isEmpty)
    try store.runSQL("UPDATE preferences SET value='no' WHERE key='hide_lock_content'", params: [])
    try store.runSQL("INSERT INTO preferences(key,value) VALUES(?,?)", params: ["private_lock", "no"])
    check((try store.snapshot()).tasks[0].title == "실제 Swift 저장 테스트")
    try store.add(title: "제목'); DROP TABLE todos; --")
    check((try store.snapshot()).count == 2)
    try store.runSQL("UPDATE todos SET description=?,sort_order=?", params: [nil, "12.5"])
    let rows = try store.querySQL("SELECT description,sort_order FROM todos", params: [])
    precondition(rows[0]["description"] is NSNull && rows[0]["sort_order"] as? Double == 12.5)
    try store.execSQL("BEGIN IMMEDIATE")
    try store.add(title: "롤백할 항목")
    try store.execSQL("ROLLBACK")
    check((try store.snapshot()).count == 2)
    do { try store.add(title: String(repeating: "한", count: 201)); fatalError("Length validation failed") }
    catch StoreError.invalidTitle { }
    try store.runSQL("INSERT INTO analyses(id,image_fingerprint,captured_at,received_at,status,source_channel,expires_at) VALUES(?,?,?,?,?,?,?)", params: ["new", "new-hash", nil, "2026-11-13", "processing", "manual", "2026-11-20"])
    check((try store.querySQL("SELECT captured_at FROM analyses WHERE id=?", params: ["new"]))[0]["captured_at"] is NSNull)
    print("Swift 저장소 마이그레이션·개인정보 표시·바인딩·롤백 검사 통과")
  }
}
