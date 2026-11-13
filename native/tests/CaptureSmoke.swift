import Foundation

@main
struct CaptureSmoke {
  static func check(_ condition: Bool) { precondition(condition) }
  static func main() async throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("ttodo-capture-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = try SharedStore(directoryOverride: directory)
    let factory = { try SharedStore(directoryOverride: directory) }
    let text = "2026년 11월 20일까지 자료 보내줘."
    let raw = #"[{"is_actionable":true,"title":"자료 전달","description":null,"due_at":"2026-11-20","due_precision":"date","assignee":null,"confidence":0.8,"evidence_text":"2026년 11월 20일까지 자료 보내줘.","needs_confirmation":true}]"#
    var calls = 0
    let extract: CaptureProcessor.Extract = { _, _, _, _ in calls += 1; return raw }
    do {
      _ = try await CaptureProcessor.analyze(data: Data("no-consent".utf8), messageDate: nil, storeFactory: factory, recognize: { _ in text }, extract: extract)
      fatalError("Consent was bypassed")
    } catch CaptureError.consentRequired { }
    check(calls == 0)
    try store.runSQL("INSERT INTO preferences(key,value) VALUES('ai_local_consent','yes')", params: [])
    let first = try await CaptureProcessor.analyze(data: Data("first".utf8), messageDate: nil, storeFactory: factory, recognize: { _ in text }, extract: extract)
    check(first.count == 1 && !first.duplicate && calls == 1)
    check((try store.querySQL("SELECT COUNT(*) AS count FROM todos", params: []))[0]["count"] as? Int64 == 0)
    check((try store.querySQL("SELECT status FROM analyses WHERE id=?", params: [first.id]))[0]["status"] as? String == "review")
    let duplicate = try await CaptureProcessor.analyze(data: Data("first".utf8), messageDate: nil, storeFactory: factory, recognize: { _ in text }, extract: extract)
    check(duplicate.duplicate && calls == 1)
    do {
      _ = try await CaptureProcessor.analyze(data: Data("invalid".utf8), messageDate: nil, storeFactory: factory, recognize: { _ in "다른 문장" }, extract: extract)
      fatalError("Unsupported evidence was stored")
    } catch ExtractionValidationError.invalid { }
    check((try store.querySQL("SELECT COUNT(*) AS count FROM analyses WHERE status='failed'", params: []))[0]["count"] as? Int64 == 1)
    let beforeSensitive = calls
    do {
      _ = try await CaptureProcessor.analyze(data: Data("sensitive".utf8), messageDate: nil, storeFactory: factory, recognize: { _ in "인증번호 123456" }, extract: extract)
      fatalError("Sensitive text reached the model")
    } catch ExtractionValidationError.sensitive { }
    check(calls == beforeSensitive)
    do {
      _ = try await CaptureProcessor.analyze(data: Data("revoked".utf8), messageDate: nil, storeFactory: factory, recognize: { _ in text }, extract: { _, _, _, _ in
        try store.runSQL("UPDATE preferences SET value='no' WHERE key='ai_local_consent'", params: []); return raw
      })
      fatalError("Result stored after consent withdrawal")
    } catch CaptureError.consentRequired { }
    check((try store.querySQL("SELECT COUNT(*) AS count FROM extracted_tasks", params: []))[0]["count"] as? Int64 == 1)
    check(!ExtractionValidator.validDate("2026-02-30"))
    check(!ExtractionValidator.validDue("2026-02-30T17:00:00+09:00", precision: "datetime"))
    let relative = raw.replacingOccurrences(of: text, with: "내일 자료 보내줘.")
    let guarded = try ExtractionValidator.validate(relative, sourceText: "내일 자료 보내줘.", messageDate: nil)
    check(guarded[0].due_at == nil && guarded[0].needs_confirmation)
    print("네이티브 캡처 동의·근거·중복·저장 전 확인·민감정보 검사 통과 (OCR/모델은 테스트 주입)")
  }
}
