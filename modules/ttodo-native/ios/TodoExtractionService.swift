import Foundation

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

