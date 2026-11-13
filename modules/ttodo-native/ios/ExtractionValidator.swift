import Foundation

struct NativeSuggestion: Codable {
  var is_actionable = true
  var title: String
  var description: String?
  var due_at: String?
  var due_precision: String
  var assignee: String?
  var confidence: Double
  var evidence_text: String
  var needs_confirmation: Bool
}
private struct RawSuggestion: Decodable {
  let is_actionable: Bool
  let title: String?
  let description: String?
  let due_at: String?
  let due_precision: String?
  let assignee: String?
  let confidence: Double?
  let evidence_text: String?
  let needs_confirmation: Bool?
}
enum ExtractionValidationError: LocalizedError {
  case invalid, sensitive
  var errorDescription: String? {
    self == .sensitive ? "민감한 정보가 있는 글자는 분석하지 않아요. 필요한 할 일을 직접 입력해 주세요." : "AI 결과의 날짜나 원문 근거를 확인하지 못했어요. 자동 저장하지 않았으니 다시 확인해 주세요."
  }
}
enum ExtractionValidator {
  static func matches(_ value: String, _ pattern: String) -> Bool { value.range(of: pattern, options: .regularExpression) != nil }
  static func clean(_ value: String) -> String { value.precomposedStringWithCompatibilityMapping.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines) }
  static func isSensitive(_ text: String) -> Bool {
    matches(text, "(?i)(비밀번호|패스워드|password|인증\\s*(번호|코드)|보안\\s*코드|계좌\\s*번호|주민\\s*등록)") ||
      matches(text, "\\b\\d{6}\\s*[-–]\\s*[1-4]\\d{6}\\b") || matches(text, "\\b(?:\\d[ -]?){16}\\b")
  }
  static func validDate(_ value: String) -> Bool {
    guard matches(value, "^\\d{4}-\\d{2}-\\d{2}$") else { return false }
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian); formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"; formatter.isLenient = false
    guard let date = formatter.date(from: value) else { return false }
    return formatter.string(from: date) == value
  }
  static func timestamp(_ value: String) -> Date? {
    let normalized = value.replacingOccurrences(of: "T([0-2]\\d:[0-5]\\d)(Z|[+-])", with: "T$1:00$2", options: .regularExpression)
    let formatter = ISO8601DateFormatter()
    if let date = formatter.date(from: normalized) { return date }
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: normalized)
  }
  static func validDue(_ due: String?, precision: String) -> Bool {
    guard let due else { return precision == "unknown" }
    if precision == "date" { return validDate(due) }
    guard precision == "datetime", validDate(String(due.prefix(10))),
      matches(due, "^\\d{4}-\\d{2}-\\d{2}T(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d{1,3})?)?(?:Z|[+-](?:0\\d|1[0-4]):[0-5]\\d)$") else { return false }
    return timestamp(due) != nil
  }
  static func validate(_ json: String, sourceText: String, messageDate: String?) throws -> [NativeSuggestion] {
    guard !isSensitive(sourceText) else { throw ExtractionValidationError.sensitive }
    guard let data = json.data(using: .utf8), let raw = try? JSONDecoder().decode([RawSuggestion].self, from: data), raw.count <= 30 else { throw ExtractionValidationError.invalid }
    return try raw.compactMap { value in
      if !value.is_actionable { return nil }
      guard let title = value.title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty, title.unicodeScalars.count <= 200,
        let evidence = value.evidence_text, !clean(evidence).isEmpty, clean(sourceText).contains(clean(evidence)),
        let precision = value.due_precision, validDue(value.due_at, precision: precision),
        let confidence = value.confidence, confidence.isFinite, (0...1).contains(confidence),
        let confirmation = value.needs_confirmation else { throw ExtractionValidationError.invalid }
      var task = NativeSuggestion(title: title, description: value.description.map { String($0.prefix(4000)) }, due_at: value.due_at, due_precision: precision, assignee: value.assignee, confidence: confidence, evidence_text: evidence, needs_confirmation: confirmation || value.assignee == nil)
      if messageDate == nil && task.due_at != nil {
        let relative = matches(evidence, "오늘|내일|모레|글피|이번\\s*주|다음\\s*주|다음\\s*달|이번\\s*달|일\\s*뒤|일\\s*후")
        let explicitYear = matches(evidence, "\\b\\d{4}\\s*(?:년|[-./])")
        if relative || !explicitYear { task.due_at = nil; task.due_precision = "unknown"; task.needs_confirmation = true }
      }
      return task
    }
  }
}
