import Foundation
import SQLite3

enum StoreError: LocalizedError {
  case unavailable, invalidTitle, database, newerSchema
  var errorDescription: String? {
    switch self {
    case .unavailable: return "공유 저장소에 접근할 수 없어요. 기기를 한 번 잠금 해제하고 앱 설정을 확인해 주세요."
    case .invalidTitle: return "할 일은 1자부터 200자까지 입력해 주세요."
    case .database: return "할 일을 저장하거나 읽지 못했어요. 다시 시도해 주세요."
    case .newerSchema: return "앱을 최신 버전으로 업데이트해 주세요."
    }
  }
}
struct LockTask: Codable, Hashable {
  let id: String
  let title: String
}
struct LockSnapshot {
  let tasks: [LockTask]
  let count: Int
  let hideTitles: Bool
  let hideContent: Bool
}
final class SharedStore {
  private var db: OpaquePointer?
  static func directory() throws -> URL {
    guard let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: TTodoConfiguration.appGroup) else { throw StoreError.unavailable }
    let directory = root.appendingPathComponent("TTodo", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
    // No device-to-device or cloud backup of sensitive local data in this MVP.
    var resource = URLResourceValues(); resource.isExcludedFromBackup = true
    var url = directory; try url.setResourceValues(resource)
    return directory
  }
  init(directoryOverride: URL? = nil) throws {
    let directory = try directoryOverride ?? Self.directory()
    let path = directory.appendingPathComponent("ttodo.sqlite").path
    guard sqlite3_open_v2(path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
      sqlite3_close(db); db = nil; throw StoreError.database
    }
    do {
      sqlite3_busy_timeout(db, 5000)
      try execute("PRAGMA journal_mode=DELETE; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; PRAGMA temp_store=MEMORY;")
      try execute("BEGIN IMMEDIATE")
      do {
        let version = try scalar("PRAGMA user_version")
        if version > TTodoConfiguration.schemaVersion { throw StoreError.newerSchema }
        if version == 1 { try execute(TTodoConfiguration.migrationFromOneSQL) }
        else if version < TTodoConfiguration.schemaVersion { try execute(TTodoConfiguration.schemaSQL) }
        try execute("COMMIT")
      } catch { try? execute("ROLLBACK"); throw error }
      // Existing DB and sidecars must follow the same policy as newly created files.
      #if os(iOS)
      for suffix in ["", "-wal", "-shm"] where FileManager.default.fileExists(atPath: path + suffix) {
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: path + suffix)
      }
      #endif
    } catch { sqlite3_close(db); db = nil; throw error }
  }
  deinit { sqlite3_close(db) }
  private func execute(_ sql: String) throws {
    guard sqlite3_exec(db, sql, nil, nil, nil) == SQLITE_OK else { throw StoreError.database }
  }
  private func statement(_ sql: String) throws -> OpaquePointer {
    var pointer: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &pointer, nil) == SQLITE_OK, let statement = pointer else { throw StoreError.database }
    return statement
  }
  private func scalar(_ sql: String) throws -> Int {
    let stmt = try statement(sql); defer { sqlite3_finalize(stmt) }
    guard sqlite3_step(stmt) == SQLITE_ROW else { throw StoreError.database }
    return Int(sqlite3_column_int(stmt, 0))
  }
  func execSQL(_ sql: String) throws { try execute(sql) }
  private func bind(_ params: [String?], to stmt: OpaquePointer) throws {
    guard sqlite3_bind_parameter_count(stmt) == params.count else { throw StoreError.database }
    let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    for (index, value) in params.enumerated() {
      let status: Int32
      if let value { status = sqlite3_bind_text(stmt, Int32(index + 1), value, -1, transient) }
      else { status = sqlite3_bind_null(stmt, Int32(index + 1)) }
      guard status == SQLITE_OK else { throw StoreError.database }
    }
  }
  func runSQL(_ sql: String, params: [String?]) throws {
    let stmt = try statement(sql); defer { sqlite3_finalize(stmt) }
    try bind(params, to: stmt)
    guard sqlite3_step(stmt) == SQLITE_DONE else { throw StoreError.database }
  }
  func querySQL(_ sql: String, params: [String?]) throws -> [[String: Any]] {
    let stmt = try statement(sql); defer { sqlite3_finalize(stmt) }
    try bind(params, to: stmt)
    var rows: [[String: Any]] = []
    var result = sqlite3_step(stmt)
    while result == SQLITE_ROW {
      var row: [String: Any] = [:]
      for column in 0..<sqlite3_column_count(stmt) {
        let name = String(cString: sqlite3_column_name(stmt, column))
        switch sqlite3_column_type(stmt, column) {
        case SQLITE_INTEGER: row[name] = sqlite3_column_int64(stmt, column)
        case SQLITE_FLOAT: row[name] = sqlite3_column_double(stmt, column)
        case SQLITE_TEXT: row[name] = String(cString: sqlite3_column_text(stmt, column))
        default: row[name] = NSNull()
        }
      }
      rows.append(row); result = sqlite3_step(stmt)
    }
    guard result == SQLITE_DONE else { throw StoreError.database }
    return rows
  }
  func add(title raw: String) throws {
    let title = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    // Unicode scalar count matches the JS/SQLite storage limit (including composed emoji).
    guard !title.isEmpty && title.unicodeScalars.count <= 200 else { throw StoreError.invalidTitle }
    let stmt = try statement("INSERT INTO todos(id,title,created_at,updated_at,sort_order) VALUES(?,?,?,?,?)")
    defer { sqlite3_finalize(stmt) }
    let time = ISO8601DateFormatter().string(from: Date())
    let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    for (index, value) in [UUID().uuidString.lowercased(), title, time, time].enumerated() {
      guard sqlite3_bind_text(stmt, Int32(index + 1), value, -1, transient) == SQLITE_OK else { throw StoreError.database }
    }
    sqlite3_bind_double(stmt, 5, Date().timeIntervalSince1970 * 1000)
    guard sqlite3_step(stmt) == SQLITE_DONE else { throw StoreError.database }
  }
  func snapshot() throws -> LockSnapshot {
    try execute("BEGIN")
    do {
      let count = try scalar("SELECT COUNT(*) FROM todos WHERE status='pending'")
      // Privacy defaults to hidden if unset or unavailable.
      let hideAll = try scalar("SELECT CASE WHEN (SELECT value FROM preferences WHERE key='hide_lock_content')='yes' THEN 1 ELSE 0 END") != 0
      let configuredHide = try scalar("SELECT CASE WHEN (SELECT value FROM preferences WHERE key='private_lock')='no' THEN 0 ELSE 1 END") != 0
      let hide = hideAll || configuredHide
      let stmt = try statement("WITH pending AS (SELECT *,CASE WHEN due_precision='datetime' THEN date(due_at,'localtime') ELSE substr(due_at,1,10) END AS due_day FROM todos WHERE status='pending') SELECT id,title FROM pending ORDER BY CASE WHEN due_day=date('now','localtime') THEN 0 WHEN due_day<date('now','localtime') THEN 1 WHEN due_at IS NULL THEN 2 ELSE 3 END,due_day,CASE WHEN due_precision='date' THEN 0 ELSE 1 END,julianday(due_at),sort_order,created_at LIMIT 5")
      defer { sqlite3_finalize(stmt) }
      var tasks: [LockTask] = []
      var status = sqlite3_step(stmt)
      while status == SQLITE_ROW {
        tasks.append(LockTask(id: String(cString: sqlite3_column_text(stmt, 0)), title: hide ? "할 일" : String(cString: sqlite3_column_text(stmt, 1))))
        status = sqlite3_step(stmt)
      }
      guard status == SQLITE_DONE else { throw StoreError.database }
      try execute("COMMIT")
      return LockSnapshot(tasks: hideAll ? [] : tasks, count: hideAll ? 0 : count, hideTitles: hide, hideContent: hideAll)
    } catch { try? execute("ROLLBACK"); throw error }
  }
}
