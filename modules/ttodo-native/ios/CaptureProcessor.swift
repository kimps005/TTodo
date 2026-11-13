import Foundation

struct CaptureOutcome { let id: String; let count: Int; let duplicate: Bool }
enum CaptureProcessor {
  typealias Extract = (String, String?, String, String?) async throws -> String
  static func analyze(data: Data, messageDate: String?, channel: String = "shortcuts", retryFailed: Bool = false,
    storeFactory: () throws -> SharedStore = { try SharedStore() },
    recognize: (Data) throws -> String = VisionOCR.recognize,
    extract: Extract) async throws -> CaptureOutcome {
    guard !data.isEmpty, data.count <= VisionOCR.maximumBytes else { throw OCRFailure.tooLarge }
    if let messageDate, !ExtractionValidator.validDate(messageDate) { throw ExtractionValidationError.invalid }
    let store = try storeFactory()
    let registration = try store.registerCapture(fingerprint: VisionOCR.fingerprint(data), channel: channel, retryFailed: retryFailed)
    if !registration.created { return CaptureOutcome(id: registration.id, count: 0, duplicate: true) }
    do {
      let text = try recognize(data)
      guard !ExtractionValidator.isSensitive(text) else { throw ExtractionValidationError.sensitive }
      let tasks: [NativeSuggestion]
      if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { tasks = [] }
      else {
        let json = try await extract(text, nil, TimeZone.current.identifier, messageDate)
        tasks = try ExtractionValidator.validate(json, sourceText: text, messageDate: messageDate)
      }
      try Task.checkCancellation()
      try store.finishCapture(id: registration.id, tasks: tasks, provider: "apple-ondevice/prompt-v1")
      return CaptureOutcome(id: registration.id, count: tasks.count, duplicate: false)
    } catch {
      let code: String
      if error is CancellationError { code = "CANCELLED" }
      else if error is OCRFailure { code = "OCR_FAILED" }
      else if let validation = error as? ExtractionValidationError, validation == .sensitive { code = "SENSITIVE_TEXT" }
      else if error is CaptureError { code = "STATE_CHANGED" }
      else { code = "LOCAL_AI_FAILED" }
      try? store.failCapture(id: registration.id, code: code)
      throw error
    }
  }
}
