import Foundation

@main
struct CaptureSmoke {
  static func check(_ condition: Bool) { precondition(condition) }
  static func main() async throws {
    func reviewItem(_ id: String, evidence: String = "합성 원문", confirmation: Bool = false) -> CaptureReviewItem {
      CaptureReviewItem(id: id, title: "새 제안", description: nil, dueAt: nil, duePrecision: "unknown", evidence: evidence, needsConfirmation: confirmation, dateText: "", timeText: "")
    }
    var draft = reviewItem("same")
    draft.title = "편집한 제목"; draft.description = "편집한 설명"; draft.selected = false
    draft.dateText = "2026-12-01"; draft.timeText = "09:30"; draft.dateEdited = true
    let reconciled = CaptureReviewItem.reconciled(current: [draft, reviewItem("removed")], stored: [reviewItem("same", evidence: "", confirmation: true), reviewItem("new")])
    check(reconciled.count == 2 && reconciled[0].id == "same" && reconciled[1].id == "new")
    check(reconciled[0].title == draft.title && reconciled[0].description == draft.description && !reconciled[0].selected)
    check(reconciled[0].dateText == draft.dateText && reconciled[0].timeText == draft.timeText && reconciled[0].dateEdited)
    check(reconciled[0].evidence.isEmpty && reconciled[0].needsConfirmation)
    check(reconciled[1].title == "새 제안" && !reconciled[1].selected)
    check(CaptureReviewItem.reconciled(current: [draft], stored: []).isEmpty)
    var unchanged = reviewItem("same"); unchanged.dateText = "2026-11-20"
    check(CaptureReviewItem.reconciled(current: [unchanged], stored: [reviewItem("same")])[0].dateText.isEmpty)
    struct SensitiveCase: Decodable { let text: String; let expected: Bool }
    let sensitiveData = try Data(contentsOf: URL(fileURLWithPath: "evaluation/sensitive-seed.json"))
    for item in try JSONDecoder().decode([SensitiveCase].self, from: sensitiveData) {
      check(ExtractionValidator.isSensitive(item.text) == item.expected)
    }
    struct DuplicateCase: Decodable { let source: String; let evidence: String; let expected: Bool }
    let duplicateData = try Data(contentsOf: URL(fileURLWithPath: "evaluation/duplicate-seed.json"))
    for item in try JSONDecoder().decode([DuplicateCase].self, from: duplicateData) {
      check(DuplicateEvidence.resembles(source: item.source, evidence: item.evidence) == item.expected)
    }
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("ttodo-capture-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let store = try SharedStore(directoryOverride: directory)
    let factory = { try SharedStore(directoryOverride: directory) }
    let text = "2026년 11월 20일까지 자료 보내줘."
    let raw = #"[{"is_actionable":true,"title":"자료 전달","description":null,"due_at":"2026-11-20","due_precision":"date","assignee":null,"confidence":0.8,"evidence_text":"2026년 11월 20일까지 자료 보내줘.","needs_confirmation":true}]"#
    for assignee in ["", " \n\t", "\u{00A0}", "  사용자  "] {
      var rows = try JSONSerialization.jsonObject(with: Data(raw.utf8)) as! [[String: Any]]
      rows[0]["assignee"] = assignee; rows[0]["needs_confirmation"] = false
      let json = String(decoding: try JSONSerialization.data(withJSONObject: rows), as: UTF8.self)
      let result = try ExtractionValidator.validate(json, sourceText: text, messageDate: nil)[0]
      let expected = assignee.trimmingCharacters(in: .whitespacesAndNewlines)
      check(result.assignee == (expected.isEmpty ? nil : expected))
      check(result.needs_confirmation == expected.isEmpty)
    }
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
    let bridgeData = try JSONEncoder().encode(guarded)
    let bridgeRows = try JSONSerialization.jsonObject(with: bridgeData) as! [[String: Any]]
    check(bridgeRows[0]["description"] is NSNull && bridgeRows[0]["due_at"] is NSNull && bridgeRows[0]["assignee"] is NSNull)
    if let output = ProcessInfo.processInfo.environment["TTODO_CONTRACT_OUTPUT"] {
      try bridgeData.write(to: URL(fileURLWithPath: output))
    }
    do { _ = try store.approveSingleCapture(id: first.id, expectedTaskId: "old-task"); fatalError("Ambiguous task was approved without review") }
    catch CaptureError.reviewRequired { }
    try store.ignoreCapture(id: first.id)
    try store.runSQL("UPDATE preferences SET value='yes' WHERE key='ai_local_consent'", params: [])
    try store.runSQL("INSERT INTO preferences(key,value) VALUES('private_lock','no')", params: [])
    let quick = try store.registerCapture(fingerprint: "quick", channel: "shortcuts")
    let clear = raw.replacingOccurrences(of: #""assignee":null"#, with: #""assignee":"사용자""#).replacingOccurrences(of: #""needs_confirmation":true"#, with: #""needs_confirmation":false"#)
    try store.finishCapture(id: quick.id, tasks: ExtractionValidator.validate(clear, sourceText: text, messageDate: nil), provider: "test-only", token: quick.token!)
    let quickId = (try store.captureReviewItems(id: quick.id))[0].id
    check(try store.approveSingleCapture(id: quick.id, expectedTaskId: quickId))
    check(try !store.approveSingleCapture(id: quick.id, expectedTaskId: quickId))
    let similar = try store.registerCapture(fingerprint: "reencoded-quick", channel: "share")
    try store.finishCapture(id: similar.id, tasks: ExtractionValidator.validate(clear, sourceText: text, messageDate: nil), provider: "test-only", token: similar.token!)
    check(!(try store.similarCaptures(id: similar.id)).isEmpty)
    let similarId = (try store.captureReviewItems(id: similar.id))[0].id
    do { _ = try store.approveSingleCapture(id: similar.id, expectedTaskId: similarId); fatalError("Similar capture bypassed review") }
    catch CaptureError.reviewRequired { }
    check(try store.similarCaptures(id: similar.id, now: Date.distantFuture).isEmpty)
    check(DuplicateEvidence.resembles(source: "２０２６년 １１월 ２０일까지 발표 자료를 보내 주세요!", evidence: "2026년 11월 20일까지 발표자료를 보내주세요."))
    check(!DuplicateEvidence.resembles(source: "2026년 11월 21일까지 발표자료를 보내주세요.", evidence: "2026년 11월 20일까지 발표자료를 보내주세요."))
    check((try store.querySQL("SELECT COUNT(*) AS count FROM todos", params: []))[0]["count"] as? Int64 == 1)
    try store.ignoreCapture(id: first.id)
    check((try store.querySQL("SELECT evidence_text FROM extracted_tasks WHERE analysis_id=?", params: [first.id]))[0]["evidence_text"] as? String == "")
    let expired = try store.registerCapture(fingerprint: "expired", channel: "shortcuts")
    try store.finishCapture(id: expired.id, tasks: ExtractionValidator.validate(clear, sourceText: text, messageDate: nil), provider: "test-only", token: expired.token!)
    try store.runSQL("UPDATE analyses SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?", params: [expired.id])
    do { _ = try store.approveSingleCapture(id: expired.id, expectedTaskId: "old-task"); fatalError("Expired result was approved") }
    catch CaptureError.reviewRequired { }
    check((try store.captureReviewItems(id: expired.id)).isEmpty)
    check((try store.querySQL("SELECT evidence_text FROM extracted_tasks WHERE analysis_id=?", params: [expired.id]))[0]["evidence_text"] as? String == "")
    let multi = try store.registerCapture(fingerprint: "share-multiple", channel: "share")
    var firstTask = try ExtractionValidator.validate(clear, sourceText: text, messageDate: nil)[0]
    firstTask.title = "첫 번째 제안"
    var secondTask = firstTask; secondTask.title = "두 번째 제안"
    try store.finishCapture(id: multi.id, tasks: [firstTask, secondTask], provider: "test-only", token: multi.token!)
    let review = try store.captureReviewItems(id: multi.id)
    let firstEdit = CaptureTaskEdit(id: review[0].id, title: "검토 후 수정", description: nil, dueAt: "2026-12-01", duePrecision: "date")
    do {
      _ = try store.approveReviewedCapture(id: multi.id, edits: [firstEdit, CaptureTaskEdit(id: review[1].id, title: " ", description: nil, dueAt: nil, duePrecision: "unknown")])
      fatalError("Partial review save was committed")
    } catch CaptureError.reviewRequired { }
    check((try store.captureReviewItems(id: multi.id)).count == 2)
    check((try store.querySQL("SELECT COUNT(*) AS count FROM todos", params: []))[0]["count"] as? Int64 == 1)
    check(try store.approveReviewedCapture(id: multi.id, edits: [firstEdit]) == 1)
    check(try store.approveReviewedCapture(id: multi.id, edits: [firstEdit]) == 0)
    check((try store.querySQL("SELECT source_type FROM todos WHERE source_id=?", params: [review[0].id]))[0]["source_type"] as? String == "share")
    try store.ignoreCapture(id: multi.id)
    check((try store.captureReviewItems(id: multi.id)).isEmpty)
    let stale = try store.registerCapture(fingerprint: "retry-race", channel: "share")
    try store.failCapture(id: stale.id, code: "INTERRUPTED", token: stale.token!)
    let retried = try store.registerCapture(fingerprint: "retry-race", channel: "share", retryFailed: true)
    check(retried.created && retried.token != stale.token)
    do { try store.finishCapture(id: stale.id, tasks: [firstTask], provider: "stale", token: stale.token!); fatalError("Stale worker completed a new attempt") }
    catch CaptureError.stateChanged { }
    try store.failCapture(id: stale.id, code: "STALE_ERROR", token: stale.token!)
    check((try store.querySQL("SELECT status FROM analyses WHERE id=?", params: [stale.id]))[0]["status"] as? String == "processing")
    try store.finishCapture(id: retried.id, tasks: [firstTask], provider: "current", token: retried.token!)
    check((try store.captureReviewItems(id: retried.id)).count == 1)
    let previousId = (try store.captureReviewItems(id: retried.id))[0].id
    let redone = try store.registerCapture(fingerprint: "retry-race", channel: "share", reanalyzeUnstored: true)
    check(redone.created && redone.token != retried.token)
    check((try store.captureReviewItems(id: redone.id)).isEmpty)
    do { try store.finishCapture(id: retried.id, tasks: [firstTask], provider: "stale", token: retried.token!); fatalError("Previous attempt overwrote reanalysis") }
    catch CaptureError.stateChanged { }
    try store.finishCapture(id: redone.id, tasks: [secondTask], provider: "redone", token: redone.token!)
    check((try store.captureReviewItems(id: redone.id))[0].title == secondTask.title)
    do { _ = try store.approveSingleCapture(id: redone.id, expectedTaskId: previousId); fatalError("Stale notification approved new proposal") }
    catch CaptureError.reviewRequired { }
    do { try store.ignoreCapture(id: redone.id, expectedTaskIds: [previousId]); fatalError("Stale notification ignored new proposal") }
    catch CaptureError.stateChanged { }
    check((try store.captureReviewItems(id: redone.id)).count == 1)
    do { _ = try store.registerCapture(fingerprint: "share-multiple", channel: "share", reanalyzeUnstored: true); fatalError("Partially saved capture was reanalyzed") }
    catch CaptureError.alreadyStored { }
    try store.runSQL("DELETE FROM todos WHERE source_id=?", params: [review[0].id])
    do { _ = try store.registerCapture(fingerprint: "share-multiple", channel: "share", reanalyzeUnstored: true); fatalError("Deleted saved item was reanalyzed") }
    catch CaptureError.alreadyStored { }
    let local = try ExtractionValidator.localDeadline(day: "2026-11-20", time: "9:30")
    let fields = ExtractionValidator.deadlineFields(due: local.dueAt, precision: local.precision)
    check(fields.day == "2026-11-20" && fields.time == "09:30")
    do { _ = try ExtractionValidator.localDeadline(day: "2026-11-20", time: "24:00"); fatalError("Invalid time accepted") }
    catch DeadlineInputError.invalid { }
    do { _ = try ExtractionValidator.localDeadline(day: "2026-03-08", time: "02:30", timezone: TimeZone(identifier: "America/New_York")!); fatalError("Nonexistent local time accepted") }
    catch DeadlineInputError.invalid { }
    let alreadyCancelledData = Data("cancel-before-registration".utf8)
    let alreadyCancelled = Task {
      withUnsafeCurrentTask { $0?.cancel() }
      return try await CaptureProcessor.analyze(data: alreadyCancelledData, messageDate: nil, storeFactory: factory,
        recognize: { _ in fatalError("Cancelled task started OCR") },
        extract: { _, _, _, _ in fatalError("Cancelled task started the model") })
    }
    do { _ = try await alreadyCancelled.value; fatalError("Pre-cancelled task succeeded") }
    catch is CancellationError { }
    check(try store.querySQL("SELECT id FROM analyses WHERE image_fingerprint=?", params: [VisionOCR.fingerprint(alreadyCancelledData)]).isEmpty)
    for cancelDuringOCR in [true, false] {
      let data = Data("cancel-boundary-\(cancelDuringOCR)".utf8)
      let cancelled = Task {
        try await CaptureProcessor.analyze(data: data, messageDate: nil, storeFactory: factory, recognize: { _ in
          if cancelDuringOCR { withUnsafeCurrentTask { $0?.cancel() } }
          return text
        }, extract: { _, _, _, _ in
          if cancelDuringOCR { fatalError("Cancellation after OCR still started the model") }
          withUnsafeCurrentTask { $0?.cancel() }
          return raw
        })
      }
      do { _ = try await cancelled.value; fatalError("Cancelled result succeeded") }
      catch is CancellationError { }
      let row = try store.querySQL("SELECT id,status,error_code FROM analyses WHERE image_fingerprint=?", params: [VisionOCR.fingerprint(data)])[0]
      check(row["status"] as? String == "failed" && row["error_code"] as? String == "CANCELLED")
      check(try store.querySQL("SELECT id FROM extracted_tasks WHERE analysis_id=?", params: [row["id"] as? String]).isEmpty)
    }
    let notification = try store.registerCapture(fingerprint: "notification-current", channel: "shortcuts")
    try store.finishCapture(id: notification.id, tasks: [firstTask], provider: "test-only", token: notification.token!)
    let notificationIds = try store.captureReviewItems(id: notification.id).map(\.id)
    check(try store.captureNotificationIsCurrent(id: notification.id, expectedTaskIds: notificationIds))
    check(try !store.captureNotificationIsCurrent(id: notification.id, expectedTaskIds: []))
    check(try !store.captureNotificationIsCurrent(id: notification.id, expectedTaskIds: notificationIds, now: Date.distantFuture))
    try store.runSQL("UPDATE preferences SET value='no' WHERE key='ai_local_consent'", params: [])
    check(try !store.captureNotificationIsCurrent(id: notification.id, expectedTaskIds: notificationIds))
    try store.runSQL("UPDATE preferences SET value='yes' WHERE key='ai_local_consent'", params: [])
    let replacement = try store.registerCapture(fingerprint: "notification-current", channel: "shortcuts", reanalyzeUnstored: true)
    check(try !store.captureNotificationIsCurrent(id: notification.id, expectedTaskIds: notificationIds))
    try store.finishCapture(id: replacement.id, tasks: [secondTask], provider: "test-only", token: replacement.token!)
    check(try !store.captureNotificationIsCurrent(id: notification.id, expectedTaskIds: notificationIds))
    let currentIds = try store.captureReviewItems(id: replacement.id).map(\.id)
    check(try store.captureNotificationIsCurrent(id: replacement.id, expectedTaskIds: currentIds))
    try store.ignoreCapture(id: replacement.id, expectedTaskIds: currentIds)
    check(try !store.captureNotificationIsCurrent(id: replacement.id, expectedTaskIds: currentIds))
    let legacy = try store.registerCapture(fingerprint: "legacy-empty-assignee", channel: "shortcuts")
    var legacyTask = firstTask
    legacyTask.evidence_text = "보고서 9876543210번의 첨부 자료를 확인해서 제출해 주세요."
    // Deliberately emulate a prior stored response with a wrong confirmation flag.
    legacyTask.assignee = nil; legacyTask.needs_confirmation = false
    try store.finishCapture(id: legacy.id, tasks: [legacyTask], provider: "test-only", token: legacy.token!)
    let legacyId = try store.captureReviewItems(id: legacy.id)[0].id
    check(try store.similarCaptures(id: legacy.id).isEmpty)
    for assignee in [nil, "", " \n\t", "\u{00A0}"] as [String?] {
      try store.runSQL("UPDATE extracted_tasks SET assignee=?,needs_confirmation=0 WHERE id=?", params: [assignee, legacyId])
      check(try store.captureReviewItems(id: legacy.id)[0].needsConfirmation)
      do { _ = try store.approveSingleCapture(id: legacy.id, expectedTaskId: legacyId); fatalError("Empty legacy assignee bypassed review") }
      catch CaptureError.reviewRequired { }
      check(try store.querySQL("SELECT id FROM todos WHERE source_id=?", params: [legacyId]).isEmpty)
    }
    print("네이티브 캡처 동의·근거·중복·저장 전 확인·민감정보 검사 통과 (OCR/모델은 테스트 주입)")
  }
}
