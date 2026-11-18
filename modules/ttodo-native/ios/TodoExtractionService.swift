import Foundation

// Actor methods alone are reentrant across await. Hold an explicit FIFO permit
// through the entire model response, including callers outside CaptureProcessor.
actor ModelRequestQueue {
  static let shared = ModelRequestQueue()
  private var busy = false
  private var waiting: [CheckedContinuation<Void, Never>] = []
  func acquire() async {
    if !busy { busy = true; return }
    await withCheckedContinuation { waiting.append($0) }
  }
  func release() {
    if waiting.isEmpty { busy = false } else { waiting.removeFirst().resume() }
  }
  func run<T>(_ operation: () async throws -> T) async throws -> T {
    await acquire()
    do {
      try Task.checkCancellation()
      let value = try await operation()
      release()
      return value
    } catch { release(); throw error }
  }
}

enum ModelContextBudget {
  static let contextTokens = 4096
  static let schemaReserve = 1000
  static let responseTokens = 1024
  static let safetyReserve = 256
  static let chunkBytes = 600
  // Schedule likely actions/deadlines first without discarding surrounding OCR,
  // which can change an assignment or cancel a request. Ties retain source order.
  static func processingOrder(_ chunks: [String]) -> [Int] {
    let cues = ["주세요", "부탁", "까지", "마감", "기한", "제출", "취소", "하지 마", "해야", "부탁드", "deadline", "please"]
    var urgent: [Int] = [], remaining: [Int] = []
    for (index, text) in chunks.enumerated() {
      let normalized = text.lowercased()
      if cues.contains(where: { normalized.contains($0) }) { urgent.append(index) }
      else { remaining.append(index) }
    }
    return urgent + remaining
  }
  // UTF-8 bytes are deliberately conservative for Korean/emoji, unlike count/4.
  // This is an estimate, not Apple's private tokenizer. Runtime errors still
  // fail closed, and no partial chunk results reach storage.
  static func estimatedTokens(_ text: String) -> Int { text.utf8.count }
  static func fits(instructions: String, prompt: String) -> Bool {
    estimatedTokens(instructions) + estimatedTokens(prompt) + schemaReserve + responseTokens + safetyReserve <= contextTokens
  }
  static func chunks(_ text: String) throws -> [String] {
    guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      text.utf8.count <= 20_000 else { throw LocalAIError.inputLimit }
    // Preserve complete sentences and order; never cut Korean graphemes or a
    // negation/deadline off an action. Oversized sentences need user editing.
    let regex = try NSRegularExpression(pattern: "(?<=[.!?。！？])\\s+|\\n+")
    let range = NSRange(text.startIndex..., in: text)
    var units: [String] = [], start = text.startIndex
    for match in regex.matches(in: text, range: range) {
      guard let gap = Range(match.range, in: text) else { continue }
      units.append(String(text[start..<gap.upperBound])); start = gap.upperBound
    }
    units.append(String(text[start...]))
    var result: [String] = [], current = ""
    for unit in units where !unit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      guard estimatedTokens(unit) <= chunkBytes else { throw LocalAIError.inputLimit }
      if !current.isEmpty && estimatedTokens(current + unit) > chunkBytes {
        result.append(current); current = ""
      }
      current += unit
    }
    if !current.isEmpty { result.append(current) }
    guard !result.isEmpty, result.count <= 40 else { throw LocalAIError.inputLimit }
    return result
  }
}

// Model boundary: deterministic CI services never import FoundationModels.
protocol TodoExtractionServiceProtocol {
  func availability() -> String
  func extract(text: String, capturedAt: String?, timezone: String, messageDate: String?) async throws -> String
}
struct ClosureTodoExtractionService: TodoExtractionServiceProtocol {
  let status: () -> String
  let request: (String, String?, String, String?) async throws -> String
  func availability() -> String { status() }
  func extract(text: String, capturedAt: String?, timezone: String, messageDate: String?) async throws -> String {
    try await request(text, capturedAt, timezone, messageDate)
  }
}

