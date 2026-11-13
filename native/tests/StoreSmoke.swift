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
