import Foundation

enum CaptureError: LocalizedError {
  case consentRequired, stateChanged, reviewRequired
  var errorDescription: String? {
    switch self {
    case .consentRequired: return "먼저 TTodo 앱에서 기기 내 AI 분석에 동의해 주세요."
    case .stateChanged: return "분석 상태가 변경되었어요. 앱의 분석함에서 확인해 주세요."
    case .reviewRequired: return "이 결과는 앱에서 내용을 확인한 뒤 저장해 주세요."
    }
  }
}
struct CaptureRegistration { let id: String; let created: Bool }
extension SharedStore {
  func transaction<T>(_ action: () throws -> T) throws -> T {
    try execSQL("BEGIN IMMEDIATE")
    do { let value = try action(); try execSQL("COMMIT"); return value }
    catch { try? execSQL("ROLLBACK"); throw error }
  }
  func hasLocalAIConsent() throws -> Bool {
    try querySQL("SELECT value FROM preferences WHERE key='ai_local_consent'", params: []).first?["value"] as? String == "yes"
  }
  func registerCapture(fingerprint: String, channel: String, retryFailed: Bool = false, now: Date = Date()) throws -> CaptureRegistration {
    guard ["manual", "share", "shortcuts"].contains(channel) else { throw CaptureError.stateChanged }
    return try transaction {
      guard try hasLocalAIConsent() else { throw CaptureError.consentRequired }
      let existing = try querySQL("SELECT id,status FROM analyses WHERE image_fingerprint=?", params: [fingerprint]).first
      let time = ISO8601DateFormatter().string(from: now)
      let expires = ISO8601DateFormatter().string(from: now.addingTimeInterval(7 * 86400))
      if let existing, let id = existing["id"] as? String {
        if retryFailed && existing["status"] as? String == "failed" {
          try runSQL("UPDATE analyses SET status='processing',error_code=NULL,received_at=?,expires_at=? WHERE id=?", params: [time, expires, id])
          return CaptureRegistration(id: id, created: true)
        }
        return CaptureRegistration(id: id, created: false)
      }
      let id = UUID().uuidString.lowercased()
      try runSQL("INSERT INTO analyses(id,image_fingerprint,captured_at,received_at,status,source_channel,expires_at) VALUES(?,?,NULL,?,'processing',?,?)", params: [id, fingerprint, time, channel, expires])
      return CaptureRegistration(id: id, created: true)
    }
  }
  func finishCapture(id: String, tasks: [NativeSuggestion], provider: String) throws {
    try transaction {
      guard try hasLocalAIConsent() else { throw CaptureError.consentRequired }
      let current = try querySQL("SELECT status FROM analyses WHERE id=?", params: [id]).first?["status"] as? String
      guard current == "processing" else { throw CaptureError.stateChanged }
      for task in tasks {
        try runSQL("INSERT INTO extracted_tasks(id,analysis_id,title,description,due_at,due_precision,assignee,confidence,evidence_text,needs_confirmation) VALUES(?,?,?,?,?,?,?,?,?,?)", params: [UUID().uuidString.lowercased(), id, task.title, task.description, task.due_at, task.due_precision, task.assignee, String(task.confidence), task.evidence_text, task.needs_confirmation ? "1" : "0"])
      }
      try runSQL("UPDATE analyses SET status=?,model_version=?,error_code=NULL WHERE id=?", params: [tasks.isEmpty ? "empty" : "review", provider, id])
    }
  }
  func failCapture(id: String, code: String) throws {
    try runSQL("UPDATE analyses SET status='failed',error_code=? WHERE id=? AND status='processing'", params: [code, id])
  }
}
