import Foundation

enum CaptureError: LocalizedError {
  case consentRequired, stateChanged, reviewRequired, alreadyStored
  var errorDescription: String? {
    switch self {
    case .consentRequired: return "먼저 TTodo 앱에서 기기 내 AI 분석에 동의해 주세요."
    case .stateChanged: return "분석 상태가 변경되었어요. 앱의 분석함에서 확인해 주세요."
    case .reviewRequired: return "이 결과는 앱에서 내용을 확인한 뒤 저장해 주세요."
    case .alreadyStored: return "한 번이라도 할 일을 저장한 캡처는 다시 분석하지 않아요. 저장한 할 일은 앱 목록에서 직접 수정해 주세요."
    }
  }
}
struct CaptureRegistration { let id: String; let created: Bool; let token: String? }
struct SimilarCapture: Identifiable {
  let id: String
  let title: String
  let saved: Bool
}
enum DuplicateEvidence {
  static func resembles(source: String, evidence: String) -> Bool {
    func normalized(_ value: String) -> String {
      value.precomposedStringWithCompatibilityMapping.lowercased().replacingOccurrences(of: "[^\\p{L}\\p{N}]", with: "", options: .regularExpression)
    }
    let current = normalized(source), previous = normalized(evidence)
    guard previous.unicodeScalars.count >= 8, !current.isEmpty else { return false }
    func numbers(_ value: String) -> Set<String> {
      let text = value.precomposedStringWithCompatibilityMapping
      let regex = try! NSRegularExpression(pattern: "[0-9]+(?:[.,][0-9]+)*")
      return Set(regex.matches(in: text, range: NSRange(text.startIndex..., in: text)).compactMap { match -> String? in
        guard let range = Range(match.range, in: text) else { return nil }
        let number = String(text[range])
        return number.range(of: "^[0-9]{1,3}(?:,[0-9]{3})+(?:\\.[0-9]+)?$", options: .regularExpression) != nil ? number.replacingOccurrences(of: ",", with: "") : number
      })
    }
    guard numbers(evidence).isSubset(of: numbers(source)) else { return false }
    if current.contains(previous) { return true }
    guard previous.unicodeScalars.count >= 16 else { return false }
    func grams(_ value: String) -> Set<String> {
      let chars = value.unicodeScalars.map { String($0) }
      guard chars.count >= 3 else { return [] }
      return Set((0...(chars.count - 3)).map { chars[$0...($0 + 2)].joined() })
    }
    let a = grams(current), b = grams(previous)
    return b.count >= 10 && Double(a.intersection(b).count) / Double(b.count) >= 0.93
  }
}
struct CaptureReviewItem: Identifiable {
  let id: String
  var title: String
  var description: String?
  let dueAt: String?
  let duePrecision: String
  let evidence: String
  let needsConfirmation: Bool
  var selected = true
  var dateText: String
  var timeText: String
  var dateEdited = false
  static func reconciled(current: [CaptureReviewItem], stored: [CaptureReviewItem]) -> [CaptureReviewItem] {
    let drafts = Dictionary(uniqueKeysWithValues: current.map { ($0.id, $0) })
    return stored.map { fresh in
      var item = fresh
      guard let draft = drafts[item.id] else { item.selected = false; return item }
      item.title = draft.title; item.description = draft.description; item.selected = draft.selected
      if draft.dateEdited {
        item.dateText = draft.dateText; item.timeText = draft.timeText; item.dateEdited = true
      }
      // Evidence and confirmation always come from storage. Removed/saved/expired
      // IDs disappear; replaced proposals never inherit old edits or selection.
      return item
    }
  }
}
struct CaptureTaskEdit {
  let id: String
  let title: String
  let description: String?
  let dueAt: String?
  let duePrecision: String
}
extension SharedStore {
  func captureNotificationIsCurrent(id: String, expectedTaskIds: [String], now: Date = Date()) throws -> Bool {
    try transaction {
      guard !expectedTaskIds.isEmpty, try hasLocalAIConsent(),
        let analysis = try querySQL("SELECT status,expires_at FROM analyses WHERE id=?", params: [id]).first,
        analysis["status"] as? String == "review", let raw = analysis["expires_at"] as? String,
        let expiry = ExtractionValidator.timestamp(raw), expiry > now else { return false }
      let current = try querySQL("SELECT id FROM extracted_tasks WHERE analysis_id=? AND review_status='pending'", params: [id]).compactMap { $0["id"] as? String }
      return current.sorted() == expectedTaskIds.sorted()
    }
  }
  func similarCaptures(id: String, now: Date = Date()) throws -> [SimilarCapture] {
    let source = try querySQL("SELECT evidence_text FROM extracted_tasks WHERE analysis_id=? AND review_status='pending'", params: [id]).compactMap { $0["evidence_text"] as? String }.joined(separator: "\n")
    let rows = try querySQL("SELECT e.analysis_id,e.title,e.evidence_text,e.review_status,a.received_at,a.expires_at FROM extracted_tasks e JOIN analyses a ON a.id=e.analysis_id WHERE a.id<>? AND e.review_status IN ('pending','saved') AND e.evidence_text<>'' ORDER BY a.received_at DESC,e.rowid DESC LIMIT 200", params: [id])
    var matches: [SimilarCapture] = []
    for row in rows {
      guard let other = row["analysis_id"] as? String, !matches.contains(where: { $0.id == other }),
        let title = row["title"] as? String, let evidence = row["evidence_text"] as? String,
        let raw = row["received_at"] as? String, let received = ExtractionValidator.timestamp(raw),
        let expiryRaw = row["expires_at"] as? String, let expiry = ExtractionValidator.timestamp(expiryRaw),
        now.timeIntervalSince(received) >= 0, now.timeIntervalSince(received) <= 7 * 86400, expiry > now else { continue }
      if DuplicateEvidence.resembles(source: source, evidence: evidence) { matches.append(SimilarCapture(id: other, title: title, saved: row["review_status"] as? String == "saved")) }
      if matches.count == 3 { break }
    }
    return matches
  }
  func transaction<T>(_ action: () throws -> T) throws -> T {
    try execSQL("BEGIN IMMEDIATE")
    do { let value = try action(); try execSQL("COMMIT"); return value }
    catch { try? execSQL("ROLLBACK"); throw error }
  }
  func hasLocalAIConsent() throws -> Bool {
    try querySQL("SELECT value FROM preferences WHERE key='ai_local_consent'", params: []).first?["value"] as? String == "yes"
  }
  func registerCapture(fingerprint: String, channel: String, retryFailed: Bool = false, reanalyzeUnstored: Bool = false, now: Date = Date()) throws -> CaptureRegistration {
    guard ["manual", "share", "shortcuts"].contains(channel) else { throw CaptureError.stateChanged }
    return try transaction {
      guard try hasLocalAIConsent() else { throw CaptureError.consentRequired }
      let existing = try querySQL("SELECT id,status FROM analyses WHERE image_fingerprint=?", params: [fingerprint]).first
      let time = ISO8601DateFormatter().string(from: now)
      let expires = ISO8601DateFormatter().string(from: now.addingTimeInterval(7 * 86400))
      let token = UUID().uuidString.lowercased()
      if let existing, let id = existing["id"] as? String {
        let status = existing["status"] as? String ?? ""
        if reanalyzeUnstored || (retryFailed && status == "failed") {
          let saved = try querySQL("SELECT id FROM extracted_tasks WHERE analysis_id=? AND review_status='saved' LIMIT 1", params: [id])
          guard status != "saved", saved.isEmpty else { throw CaptureError.alreadyStored }
          guard ["failed", "review", "empty", "ignored"].contains(status) else { throw CaptureError.stateChanged }
          try runSQL("DELETE FROM extracted_tasks WHERE analysis_id=?", params: [id])
          try runSQL("UPDATE analyses SET status='processing',model_version=NULL,error_code=NULL,received_at=?,expires_at=?,processing_token=? WHERE id=?", params: [time, expires, token, id])
          return CaptureRegistration(id: id, created: true, token: token)
        }
        return CaptureRegistration(id: id, created: false, token: nil)
      }
      let id = UUID().uuidString.lowercased()
      try runSQL("INSERT INTO analyses(id,image_fingerprint,captured_at,received_at,status,source_channel,expires_at,processing_token) VALUES(?,?,NULL,?,'processing',?,?,?)", params: [id, fingerprint, time, channel, expires, token])
      return CaptureRegistration(id: id, created: true, token: token)
    }
  }
  func finishCapture(id: String, tasks: [NativeSuggestion], provider: String, token: String) throws {
    try transaction {
      guard try hasLocalAIConsent() else { throw CaptureError.consentRequired }
      let current = try querySQL("SELECT status,processing_token FROM analyses WHERE id=?", params: [id]).first
      guard current?["status"] as? String == "processing", current?["processing_token"] as? String == token else { throw CaptureError.stateChanged }
      for task in tasks {
        try runSQL("INSERT INTO extracted_tasks(id,analysis_id,title,description,due_at,due_precision,assignee,confidence,evidence_text,needs_confirmation) VALUES(?,?,?,?,?,?,?,?,?,?)", params: [UUID().uuidString.lowercased(), id, task.title, task.description, task.due_at, task.due_precision, task.assignee, String(task.confidence), task.evidence_text, task.needs_confirmation ? "1" : "0"])
      }
      try runSQL("UPDATE analyses SET status=?,model_version=?,error_code=NULL,processing_token=NULL WHERE id=?", params: [tasks.isEmpty ? "empty" : "review", provider, id])
    }
  }
  func failCapture(id: String, code: String, token: String) throws {
    try runSQL("UPDATE analyses SET status='failed',error_code=?,processing_token=NULL WHERE id=? AND status='processing' AND processing_token=?", params: [code, id, token])
  }
  func approveSingleCapture(id: String, expectedTaskId: String, now: Date = Date()) throws -> Bool {
    try transaction {
      guard let analysis = try querySQL("SELECT status,expires_at,source_channel FROM analyses WHERE id=?", params: [id]).first else { throw CaptureError.stateChanged }
      if analysis["status"] as? String == "saved" { return false }
      guard try querySQL("SELECT value FROM preferences WHERE key='private_lock'", params: []).first?["value"] as? String == "no" else { throw CaptureError.reviewRequired }
      guard try querySQL("SELECT value FROM preferences WHERE key='hide_lock_content'", params: []).first?["value"] as? String != "yes" else { throw CaptureError.reviewRequired }
      guard analysis["status"] as? String == "review", let expires = analysis["expires_at"] as? String,
        let expiry = ExtractionValidator.timestamp(expires), expiry > now else { throw CaptureError.reviewRequired }
      let tasks = try querySQL("SELECT * FROM extracted_tasks WHERE analysis_id=?", params: [id])
      guard tasks.count == 1, let task = tasks.first, task["review_status"] as? String == "pending",
        task["needs_confirmation"] as? Int64 == 0, let taskId = task["id"] as? String, taskId == expectedTaskId,
        let assignee = task["assignee"] as? String, !assignee.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
        let title = task["title"] as? String, !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
        title.unicodeScalars.count <= 200, let precision = task["due_precision"] as? String,
        ExtractionValidator.validDue(task["due_at"] as? String, precision: precision) else { throw CaptureError.reviewRequired }
      guard try similarCaptures(id: id, now: now).isEmpty else { throw CaptureError.reviewRequired }
      let existing = try querySQL("SELECT id FROM todos WHERE source_id=?", params: [taskId]).first?["id"] as? String
      let todoId = existing ?? UUID().uuidString.lowercased()
      if existing == nil {
        let time = ISO8601DateFormatter().string(from: now)
        try runSQL("INSERT INTO todos(id,title,description,due_at,due_precision,created_at,updated_at,source_type,source_id,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)", params: [todoId, title, task["description"] as? String, task["due_at"] as? String, precision, time, time, analysis["source_channel"] as? String == "share" ? "share" : "screenshot", taskId, String(now.timeIntervalSince1970 * 1000)])
      }
      try runSQL("UPDATE extracted_tasks SET review_status='saved',linked_todo_id=? WHERE id=?", params: [todoId, taskId])
      try runSQL("UPDATE analyses SET status='saved' WHERE id=?", params: [id])
      return existing == nil
    }
  }
  func ignoreCapture(id: String, expectedTaskIds: [String]? = nil) throws {
    try transaction {
      if let expectedTaskIds {
        let current = try querySQL("SELECT id FROM extracted_tasks WHERE analysis_id=? AND review_status='pending'", params: [id]).compactMap { $0["id"] as? String }
        guard current.sorted() == expectedTaskIds.sorted() else { throw CaptureError.stateChanged }
      }
      try runSQL("UPDATE extracted_tasks SET review_status='ignored',title='무시한 제안',description=NULL,due_at=NULL,due_precision='unknown',assignee=NULL,evidence_text='',confidence=0 WHERE analysis_id=? AND review_status='pending'", params: [id])
      try runSQL("UPDATE analyses SET status=CASE WHEN EXISTS(SELECT 1 FROM extracted_tasks WHERE analysis_id=? AND review_status='saved') THEN 'saved' ELSE 'ignored' END WHERE id=?", params: [id, id])
    }
  }
  func captureReviewItems(id: String) throws -> [CaptureReviewItem] {
    try transaction {
      if let analysis = try querySQL("SELECT expires_at FROM analyses WHERE id=?", params: [id]).first {
        guard let raw = analysis["expires_at"] as? String, let expiry = ExtractionValidator.timestamp(raw) else { throw CaptureError.stateChanged }
        if expiry <= Date() {
          try runSQL("UPDATE extracted_tasks SET review_status='ignored',title='보존 기간이 지난 제안',description=NULL,due_at=NULL,due_precision='unknown',assignee=NULL,confidence=0 WHERE analysis_id=? AND review_status='pending'", params: [id])
          try runSQL("UPDATE extracted_tasks SET evidence_text='' WHERE analysis_id=?", params: [id])
          try runSQL("UPDATE analyses SET status=CASE WHEN EXISTS(SELECT 1 FROM extracted_tasks WHERE analysis_id=? AND review_status='saved') THEN 'saved' ELSE 'ignored' END WHERE id=? AND status='review'", params: [id, id])
        }
      }
      return try querySQL("SELECT * FROM extracted_tasks WHERE analysis_id=? AND review_status='pending' ORDER BY rowid", params: [id]).map { row in
        guard let taskId = row["id"] as? String, let title = row["title"] as? String,
          let precision = row["due_precision"] as? String else { throw CaptureError.stateChanged }
        let fields = ExtractionValidator.deadlineFields(due: row["due_at"] as? String, precision: precision)
        let assignee = (row["assignee"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        return CaptureReviewItem(id: taskId, title: title, description: row["description"] as? String, dueAt: row["due_at"] as? String, duePrecision: precision, evidence: row["evidence_text"] as? String ?? "", needsConfirmation: row["needs_confirmation"] as? Int64 != 0 || assignee == nil || assignee?.isEmpty == true, dateText: fields.day, timeText: fields.time)
      }
    }
  }
  func approveReviewedCapture(id: String, edits: [CaptureTaskEdit], now: Date = Date()) throws -> Int {
    try transaction {
      guard let analysis = try querySQL("SELECT status,expires_at,source_channel FROM analyses WHERE id=?", params: [id]).first else { throw CaptureError.stateChanged }
      if analysis["status"] as? String == "saved" { return 0 }
      guard analysis["status"] as? String == "review", let expires = analysis["expires_at"] as? String,
        let expiry = ExtractionValidator.timestamp(expires), expiry > now else { throw CaptureError.reviewRequired }
      let time = ISO8601DateFormatter().string(from: now)
      var count = 0
      for edit in edits {
        let title = edit.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, title.unicodeScalars.count <= 200,
          ExtractionValidator.validDue(edit.dueAt, precision: edit.duePrecision),
          let task = try querySQL("SELECT review_status FROM extracted_tasks WHERE id=? AND analysis_id=?", params: [edit.id, id]).first else { throw CaptureError.reviewRequired }
        if task["review_status"] as? String != "pending" { continue }
        let existing = try querySQL("SELECT id FROM todos WHERE source_id=?", params: [edit.id]).first?["id"] as? String
        let todoId = existing ?? UUID().uuidString.lowercased()
        if existing == nil {
          try runSQL("INSERT INTO todos(id,title,description,due_at,due_precision,created_at,updated_at,source_type,source_id,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)", params: [todoId, title, edit.description, edit.dueAt, edit.duePrecision, time, time, analysis["source_channel"] as? String == "share" ? "share" : "screenshot", edit.id, String(now.timeIntervalSince1970 * 1000)])
          count += 1
        }
        try runSQL("UPDATE extracted_tasks SET review_status='saved',linked_todo_id=?,title=?,description=?,due_at=?,due_precision=? WHERE id=?", params: [todoId, title, edit.description, edit.dueAt, edit.duePrecision, edit.id])
      }
      let pending = try querySQL("SELECT COUNT(*) AS count FROM extracted_tasks WHERE analysis_id=? AND review_status='pending'", params: [id]).first?["count"] as? Int64 ?? 0
      try runSQL("UPDATE analyses SET status=? WHERE id=?", params: [pending > 0 ? "review" : "saved", id])
      return count
    }
  }
}
