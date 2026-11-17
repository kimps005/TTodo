import Foundation
import CoreGraphics

private actor Gate {
  var continuation: CheckedContinuation<Void, Never>?
  var started = false
  func wait() async { started = true; await withCheckedContinuation { continuation = $0 } }
  func release() { continuation?.resume(); continuation = nil }
  func isStarted() -> Bool { started }
}
@main
struct PipelineSmoke {
  static func check(_ value: Bool) { precondition(value) }
  static func main() async throws {
    func block(_ text: String, _ x: Double, _ y: Double, _ width: Double = 0.30) -> VisionOCR.Block {
      VisionOCR.Block(text: text, box: CGRect(x: x, y: y, width: width, height: 0.02))
    }
    let turns = [block("왼쪽 첫 요청", 0.10, 0.80), block("오른쪽 첫 답변", 0.60, 0.68), block("왼쪽 다음 요청", 0.11, 0.56), block("오른쪽 다음 답변", 0.58, 0.44)]
    let output = VisionOCR.preprocess([block("상태바 시계", 0.1, 0.96), block("홈 표시", 0.1, 0.00)] + Array(turns.reversed()))
    check(output == "[상대방] 왼쪽 첫 요청\n[나] 오른쪽 첫 답변\n[상대방] 왼쪽 다음 요청\n[나] 오른쪽 다음 답변")
    check(!VisionOCR.preprocess([block("표 왼쪽", 0.1, 0.80), block("표 오른쪽", 0.6, 0.80), block("표 왼쪽 다음", 0.1, 0.60), block("표 오른쪽 다음", 0.6, 0.60)]).contains("[나]"))
    check(!VisionOCR.preprocess([block("본문", 0.10, 0.8, 0.8), block("다음 본문", 0.10, 0.6, 0.8)]).contains("[상대방]"))
    check(!VisionOCR.preprocess(Array(turns.prefix(2))).contains("[나]"))
    check(VisionOCR.preprocess([block("경계 본문", 0.1, 0.92)]).contains("경계 본문"))
    let reference = ExtractionValidator.referenceContext(now: ExtractionValidator.timestamp("2026-11-17T10:14:00Z")!, timezone: "Asia/Seoul", messageDate: "2026-11-16")
    check(reference["current_datetime"] == "2026-11-17 화요일 19:14")
    check(reference["message_date_with_weekday"] == "2026-11-16 월요일")
    check(!ExtractionValidator.detectedDates("November 20, 2026").isEmpty)
    check(!ExtractionValidator.dateDisagrees(due: "2026-11-20", precision: "date", evidence: "2026-11-20까지 자료 보내줘", messageDate: nil, timezone: "America/Los_Angeles"))
    check(ExtractionValidator.dateDisagrees(due: "2026-11-18", precision: "date", evidence: "다음 주 화요일까지 자료 보내줘", messageDate: "2026-11-13", timezone: "Asia/Seoul"))
    check(!ExtractionValidator.dateDisagrees(due: "2026-11-17", precision: "date", evidence: "다음 주 화요일까지 자료 보내줘", messageDate: "2026-11-13", timezone: "Asia/Seoul"))
    check(ExtractionValidator.dateDisagrees(due: "2026-11-19T00:30:00Z", precision: "datetime", evidence: "내일 오전 자료 보내줘", messageDate: "2026-11-17", timezone: "Asia/Seoul"))
    check(!ExtractionValidator.dateDisagrees(due: "2026-11-17T15:30:00Z", precision: "datetime", evidence: "내일 오전 자료 보내줘", messageDate: "2026-11-17", timezone: "Asia/Seoul"))
    check(try ExtractionValidator.validate("[]", sourceText: "풍경과 밈, 단순한 안내", messageDate: nil).isEmpty)
    for evidence in ["별도 조치는 필요하지 않습니다", "이용에 참고 바랍니다", "지금 30% 할인", "보고서 요청은 취소됐어요. 제출하지 마세요."] {
      let raw = try JSONSerialization.data(withJSONObject: [["is_actionable": true, "title": "모델의 억지 생성", "evidence_text": evidence, "due_at": NSNull(), "due_precision": "unknown", "confidence": 0.9, "needs_confirmation": true]])
      check(try ExtractionValidator.validate(String(decoding: raw, as: UTF8.self), sourceText: evidence, messageDate: nil).isEmpty)
    }
    let candidates = ExtractionValidator.ocrCandidates("\n[나] 직접 고른 문구\n다른 문구\n")
    check(candidates.count == 2 && candidates[0].title == "직접 고른 문구" && candidates.allSatisfy { $0.confidence == 0 && $0.needs_confirmation && $0.due_at == nil })
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let factory = { try SharedStore(directoryOverride: directory) }
    let store = try factory()
    try store.runSQL("INSERT INTO preferences(key,value) VALUES(?,?)", params: ["ai_local_consent", "yes"])
    let gate = Gate()
    let first = Task {
      try await CaptureProcessor.analyze(data: Data("capture-A".utf8), messageDate: nil, storeFactory: factory,
        recognize: { _ in "A 요청" }, extract: { _, _, _, _ in await gate.wait(); throw LocalAIError.unavailable })
    }
    while !(await gate.isStarted()) { await Task.yield() }
    let second = Task {
      try await CaptureProcessor.analyze(data: Data("capture-B".utf8), messageDate: nil, channel: "share", storeFactory: factory,
        recognize: { _ in "B 요청" }, availability: { "intelligence_disabled" }, extract: { _, _, _, _ in fatalError("Unavailable model called") })
    }
    var queued = false
    for _ in 0..<10_000 {
      queued = !(try store.querySQL("SELECT id FROM analyses WHERE status='queued'", params: [])).isEmpty
      if queued { break }; await Task.yield()
    }
    check(queued)
    check(try store.querySQL("SELECT id FROM todos", params: []).isEmpty)
    await gate.release()
    let a = try await first.value, b = try await second.value
    check(a.id != b.id && a.semiAutomatic && b.semiAutomatic)
    let aItems = try store.captureReviewItems(id: a.id), bItems = try store.captureReviewItems(id: b.id)
    check(aItems.count == 1 && bItems.count == 1 && aItems[0].title == "A 요청" && bItems[0].title == "B 요청")
    check(!aItems[0].selected && !bItems[0].selected)
    check(try store.querySQL("SELECT id FROM todos", params: []).isEmpty)
    let due = ISO8601DateFormatter().string(from: Date().addingTimeInterval(3600))
    let edit = CaptureTaskEdit(id: aItems[0].id, title: "승인한 제목", description: nil, dueAt: due, duePrecision: "datetime", reminder: true)
    check(try store.approveReviewedCapture(id: a.id, edits: [edit]) == 1)
    check(try store.approveReviewedCapture(id: a.id, edits: [edit]) == 0)
    check(try store.reminderPlans().count == 1)
    do {
      _ = try store.approveReviewedCapture(id: b.id, edits: [CaptureTaskEdit(id: bItems[0].id, title: "승인한 제목", description: nil, dueAt: due, duePrecision: "datetime")])
      fatalError("Duplicate was approved")
    } catch CaptureError.duplicate { }
    check(try store.querySQL("SELECT id FROM todos", params: []).count == 1)
    let lease = try store.registerCapture(fingerprint: "stale-lease", channel: "share", queued: true)
    check(lease.token!.split(separator: "-").last.flatMap { Int64($0) } != nil)
    try store.failCapture(id: lease.id, code: "CANCELLED", token: lease.token!)
    do { try store.startQueuedCapture(id: lease.id, token: lease.token!); fatalError("Stale queue lease started") }
    catch CaptureError.stateChanged { }
    print("OCR layout, weekday/date safeguards, empty output, unavailable fallback, queue isolation, approval, duplicates and reminders passed (synthetic; real AI accuracy unmeasured)")
  }
}
