import Foundation

struct CaptureOutcome { let id: String; let count: Int; let duplicate: Bool; var semiAutomatic = false }
// Each process serializes expensive OCR/model work. Separate app/extension
// processes still use independent DB IDs and leases, never a shared image slot.
private actor CaptureWorkQueue {
  static let shared = CaptureWorkQueue()
  private var busy = false
  private var waiting: [CheckedContinuation<Void, Never>] = []
  func acquire() async {
    if !busy { busy = true; return }
    await withCheckedContinuation { waiting.append($0) }
  }
  func release() {
    if waiting.isEmpty { busy = false } else { waiting.removeFirst().resume() }
  }
}
enum CaptureProcessor {
  typealias Extract = (String, String?, String, String?) async throws -> String
  static func analyze(data: Data, messageDate: String?, channel: String = "shortcuts", retryFailed: Bool = false, reanalyzeUnstored: Bool = false, expected: CaptureReanalysisSnapshot? = nil,
    storeFactory: () throws -> SharedStore = { try SharedStore() },
    recognize: (Data) throws -> String = VisionOCR.recognize,
    availability: @escaping () -> String = { "available" },
    extract: @escaping Extract) async throws -> CaptureOutcome {
    try await analyze(data: data, messageDate: messageDate, channel: channel, retryFailed: retryFailed,
      reanalyzeUnstored: reanalyzeUnstored, expected: expected, storeFactory: storeFactory, recognize: recognize,
      service: ClosureTodoExtractionService(status: availability, request: extract))
  }
  static func analyze(data: Data, messageDate: String?, channel: String = "shortcuts", retryFailed: Bool = false,
    reanalyzeUnstored: Bool = false, expected: CaptureReanalysisSnapshot? = nil,
    storeFactory: () throws -> SharedStore = { try SharedStore() },
    recognize: (Data) throws -> String = VisionOCR.recognize,
    service: any TodoExtractionServiceProtocol) async throws -> CaptureOutcome {
    try Task.checkCancellation()
    guard !data.isEmpty, data.count <= VisionOCR.maximumBytes else { throw OCRFailure.tooLarge }
    return try await analyze(fingerprint: VisionOCR.fingerprint(data), messageDate: messageDate, channel: channel,
      retryFailed: retryFailed, reanalyzeUnstored: reanalyzeUnstored, expected: expected, storeFactory: storeFactory,
      recognize: { try recognize(data) }, service: service)
  }
  static func analyze(fileURL: URL, messageDate: String?, channel: String = "share", retryFailed: Bool = false,
    reanalyzeUnstored: Bool = false, expected: CaptureReanalysisSnapshot? = nil,
    storeFactory: () throws -> SharedStore = { try SharedStore() },
    service: any TodoExtractionServiceProtocol) async throws -> CaptureOutcome {
    try Task.checkCancellation()
    return try await analyze(fingerprint: VisionOCR.fingerprint(fileURL: fileURL), messageDate: messageDate, channel: channel,
      retryFailed: retryFailed, reanalyzeUnstored: reanalyzeUnstored, expected: expected, storeFactory: storeFactory,
      recognize: { try VisionOCR.recognize(fileURL: fileURL) }, service: service)
  }
  private static func analyze(fingerprint: String, messageDate: String?, channel: String, retryFailed: Bool,
    reanalyzeUnstored: Bool, expected: CaptureReanalysisSnapshot?, storeFactory: () throws -> SharedStore,
    recognize: () throws -> String, service: any TodoExtractionServiceProtocol) async throws -> CaptureOutcome {
    if let messageDate, !ExtractionValidator.validDate(messageDate) { throw ExtractionValidationError.invalid }
    let store = try storeFactory()
    let registration = try store.registerCapture(fingerprint: fingerprint, channel: channel, retryFailed: retryFailed, reanalyzeUnstored: reanalyzeUnstored, expected: expected, queued: true)
    if !registration.created { return CaptureOutcome(id: registration.id, count: 0, duplicate: true) }
    guard let token = registration.token else { throw CaptureError.stateChanged }
    await CaptureWorkQueue.shared.acquire()
    do {
      try Task.checkCancellation()
      try store.startQueuedCapture(id: registration.id, token: token)
      let text = try recognize()
      try Task.checkCancellation()
      guard !ExtractionValidator.isSensitive(text) else { throw ExtractionValidationError.sensitive }
      let tasks: [NativeSuggestion]
      var semiAutomatic = false
      if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { tasks = [] }
      else if service.availability() != "available" {
        semiAutomatic = true; tasks = ExtractionValidator.ocrCandidates(text)
      }
      else {
        do {
          let json = try await service.extract(text: text, capturedAt: nil, timezone: TimeZone.current.identifier, messageDate: messageDate)
          try Task.checkCancellation()
          tasks = try ExtractionValidator.validate(json, sourceText: text, messageDate: messageDate)
        } catch LocalAIError.unavailable {
          semiAutomatic = true; tasks = ExtractionValidator.ocrCandidates(text)
        }
      }
      try Task.checkCancellation()
      try store.finishCapture(id: registration.id, tasks: tasks, provider: semiAutomatic ? "vision-ocr/manual-v1" : "apple-ondevice/prompt-v4", token: token)
      await CaptureWorkQueue.shared.release()
      return CaptureOutcome(id: registration.id, count: tasks.count, duplicate: false, semiAutomatic: semiAutomatic)
    } catch {
      let code: String
      if error is CancellationError { code = "CANCELLED" }
      else if error is OCRFailure { code = "OCR_FAILED" }
      else if let validation = error as? ExtractionValidationError, validation == .sensitive { code = "SENSITIVE_TEXT" }
      else if error is CaptureError { code = "STATE_CHANGED" }
      else { code = "LOCAL_AI_FAILED" }
      try? store.failCapture(id: registration.id, code: code, token: token)
      await CaptureWorkQueue.shared.release()
      throw error
    }
  }
}
