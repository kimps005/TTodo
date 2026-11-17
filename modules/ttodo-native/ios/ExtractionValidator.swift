import Foundation

enum LocalAIError: LocalizedError {
  case unavailable, inputLimit
  var errorDescription: String? {
    self == .unavailable ? "기기 내 AI를 사용할 수 없어 인식한 글자를 직접 선택할 수 있어요." : "기기 내 AI는 3,500자 이하의 글자를 분석할 수 있어요. 필요한 부분만 남겨 주세요."
  }
}

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
  private enum CodingKeys: String, CodingKey {
    case is_actionable, title, description, due_at, due_precision, assignee, confidence, evidence_text, needs_confirmation
  }
  func encode(to encoder: Encoder) throws {
    var values = encoder.container(keyedBy: CodingKeys.self)
    try values.encode(is_actionable, forKey: .is_actionable)
    try values.encode(title, forKey: .title)
    // The JS boundary requires explicit nulls. Synthesized Optional encoding
    // omits these keys and causes a valid native result to be rejected.
    try values.encode(description, forKey: .description)
    try values.encode(due_at, forKey: .due_at)
    try values.encode(due_precision, forKey: .due_precision)
    try values.encode(assignee, forKey: .assignee)
    try values.encode(confidence, forKey: .confidence)
    try values.encode(evidence_text, forKey: .evidence_text)
    try values.encode(needs_confirmation, forKey: .needs_confirmation)
  }
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
struct NativeDeadline { let dueAt: String?; let precision: String }
enum DeadlineInputError: LocalizedError {
  case invalid
  var errorDescription: String? { "날짜는 2026-11-20, 시각은 17:30처럼 입력해 주세요. 해당 기기 시간대에서 사용할 수 있는 시각인지도 확인해 주세요." }
}
enum ExtractionValidator {
  static func referenceContext(now: Date = Date(), timezone: String, messageDate: String?) -> [String: String] {
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "ko_KR")
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.timeZone = TimeZone(identifier: timezone) ?? .current
    formatter.dateFormat = "yyyy-MM-dd EEEE HH:mm"
    var context = ["current_datetime": formatter.string(from: now)]
    if let messageDate, validDate(messageDate) {
      let parser = DateFormatter(); parser.locale = Locale(identifier: "en_US_POSIX")
      parser.calendar = Calendar(identifier: .gregorian); parser.timeZone = formatter.timeZone
      parser.dateFormat = "yyyy-MM-dd"
      if let date = parser.date(from: messageDate) {
        formatter.dateFormat = "yyyy-MM-dd EEEE"
        context["message_date_with_weekday"] = formatter.string(from: date)
      }
    }
    return context
  }
  // This is a user-driven OCR draft, never an AI claim of actionability.
  // Both review UIs use the explicit OCR provider to leave drafts unselected.
  static func ocrCandidates(_ text: String) -> [NativeSuggestion] {
    text.components(separatedBy: .newlines).compactMap { line in
      let evidence = line.trimmingCharacters(in: .whitespacesAndNewlines)
      let title = evidence.replacingOccurrences(of: "^\\[(?:상대방|나)\\]\\s*", with: "", options: .regularExpression)
      guard !title.isEmpty else { return nil }
      return NativeSuggestion(title: title.unicodeScalars.prefix(200).map(String.init).joined(), description: nil, due_at: nil, due_precision: "unknown", assignee: nil, confidence: 0, evidence_text: String(evidence.prefix(4000)), needs_confirmation: true)
    }
  }
  static func nonActionEvidence(_ evidence: String) -> Bool {
    // Deliberately narrow exclusions: semantic precision still requires device evaluation.
    let source = clean(evidence)
    let affirmative = matches(source, "해\\s*(?:주세요|줘)|하세요|보내\\s*(?:주세요|줘)|회신\\s*부탁|제출\\s*부탁")
    return !affirmative && matches(source, "별도\\s*조치[는가]?\\s*필요하지|할\\s*일[이가]?\\s*없|(?:신청|접수)\\s*기간[은이가 ]*종료|이용에\\s*참고\\s*바랍니다|(?:요청[은이가 ]*)?취소[됐되]|제출하지\\s*마세요|지금\\s*\\d+%\\s*할인")
  }
  static func detectedDates(_ text: String) -> [Date] {
    guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue) else { return [] }
    return detector.matches(in: text, range: NSRange(text.startIndex..., in: text)).compactMap(\.date)
  }
  static func dateDisagrees(due: String, precision: String, evidence: String, messageDate: String?, timezone: String) -> Bool {
    let zone = TimeZone(identifier: timezone) ?? .current
    var calendar = Calendar(identifier: .gregorian); calendar.timeZone = zone; calendar.firstWeekday = 2
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = calendar; formatter.timeZone = zone; formatter.dateFormat = "yyyy-MM-dd"
    let proposed = precision == "date" ? formatter.date(from: due) : timestamp(due)
    guard let proposed else { return true }
    let source = clean(evidence)
    // NSDataDetector chooses its own reference date for relative expressions.
    // Only full-year absolute detections can act as independent corroboration.
    let regex = try! NSRegularExpression(pattern: "[0-9]{4}\\s*(?:년\\s*|-|[./])\\s*[0-9]{1,2}\\s*(?:월\\s*|-|[./])\\s*[0-9]{1,2}(?:일)?")
    let absolute = regex.matches(in: source, range: NSRange(source.startIndex..., in: source)).compactMap { match -> String? in
      guard let range = Range(match.range, in: source) else { return nil }; return String(source[range])
    }
    let dates = absolute.flatMap { detectedDates($0) }
    // Date-only detections have the detector's host timezone, not the requested
    // extraction timezone. Compare their civil days rather than their instants.
    let detectedDay = DateFormatter(); detectedDay.locale = Locale(identifier: "en_US_POSIX")
    detectedDay.calendar = Calendar(identifier: .gregorian); detectedDay.timeZone = .current; detectedDay.dateFormat = "yyyy-MM-dd"
    if !dates.isEmpty && !dates.contains(where: { detectedDay.string(from: $0) == formatter.string(from: proposed) }) { return true }
    guard let messageDate, validDate(messageDate), let base = formatter.date(from: messageDate) else { return false }
    let offsets = [("그제", -2), ("어제", -1), ("오늘", 0), ("내일", 1), ("모레", 2), ("글피", 3)]
    let relative = offsets.filter { source.contains($0.0) }
    if relative.count == 1, absolute.isEmpty,
      let expected = calendar.date(byAdding: .day, value: relative[0].1, to: base) {
      return !calendar.isDate(expected, inSameDayAs: proposed)
    }
    let weekdayRegex = try! NSRegularExpression(pattern: "(이번|다음|지난)\\s*주\\s*([월화수목금토일])요일")
    let weekdays = weekdayRegex.matches(in: source, range: NSRange(source.startIndex..., in: source))
    if weekdays.count == 1, absolute.isEmpty, let week = Range(weekdays[0].range(at: 1), in: source), let day = Range(weekdays[0].range(at: 2), in: source),
      let index = ["월", "화", "수", "목", "금", "토", "일"].firstIndex(of: String(source[day])) {
      let mondayOffset = (calendar.component(.weekday, from: base) + 5) % 7
      let weekOffset = source[week] == "다음" ? 7 : source[week] == "지난" ? -7 : 0
      if let expected = calendar.date(byAdding: .day, value: weekOffset + index - mondayOffset, to: base) { return !calendar.isDate(expected, inSameDayAs: proposed) }
    }
    return false
  }
  static func matches(_ value: String, _ pattern: String) -> Bool { value.range(of: pattern, options: .regularExpression) != nil }
  static func clean(_ value: String) -> String { value.precomposedStringWithCompatibilityMapping.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines) }
  static func isSensitive(_ text: String) -> Bool {
    let normalized = text.precomposedStringWithCompatibilityMapping.replacingOccurrences(of: "[\u{200B}-\u{200D}\u{FEFF}]", with: "", options: .regularExpression)
    return matches(normalized, "(?i)(비밀번호|패스워드|password|인증\\s*(번호|코드)|보안\\s*코드|계좌\\s*번호|주민\\s*등록)") ||
      matches(normalized, "\\b\\d{6}\\s*[-–]\\s*[1-4]\\d{6}\\b") || matches(normalized, "\\b(?:\\d[ -]?){16}\\b")
  }
  static func validDate(_ value: String) -> Bool {
    guard matches(value, "^\\d{4}-\\d{2}-\\d{2}$"), !value.hasPrefix("0000-") else { return false }
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
  static func deadlineFields(due: String?, precision: String, timezone: TimeZone = .current) -> (day: String, time: String) {
    guard let due else { return ("", "") }
    if precision == "date" { return (due, "") }
    guard let date = timestamp(due) else { return ("", "") }
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian); formatter.timeZone = timezone
    formatter.dateFormat = "yyyy-MM-dd"; let day = formatter.string(from: date)
    formatter.dateFormat = "HH:mm"; return (day, formatter.string(from: date))
  }
  static func localDeadline(day inputDay: String, time inputTime: String, timezone: TimeZone = .current) throws -> NativeDeadline {
    let day = inputDay.trimmingCharacters(in: .whitespacesAndNewlines)
    let time = inputTime.trimmingCharacters(in: .whitespacesAndNewlines)
    if day.isEmpty && time.isEmpty { return NativeDeadline(dueAt: nil, precision: "unknown") }
    guard validDate(day) else { throw DeadlineInputError.invalid }
    if time.isEmpty { return NativeDeadline(dueAt: day, precision: "date") }
    guard matches(time, "^([01]?\\d|2[0-3]):[0-5]\\d$") else { throw DeadlineInputError.invalid }
    let parts = time.split(separator: ":")
    guard let hour = Int(parts[0]), let minute = Int(parts[1]) else { throw DeadlineInputError.invalid }
    let normalized = String(format: "%02d:%02d", hour, minute)
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian); formatter.timeZone = timezone
    formatter.dateFormat = "yyyy-MM-dd'T'HH:mm"; formatter.isLenient = false
    let input = day + "T" + normalized
    guard let date = formatter.date(from: input), formatter.string(from: date) == input else { throw DeadlineInputError.invalid }
    let iso = ISO8601DateFormatter(); iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return NativeDeadline(dueAt: iso.string(from: date), precision: "datetime")
  }
  static func validate(_ json: String, sourceText: String, messageDate: String?, timezone: String = TimeZone.current.identifier) throws -> [NativeSuggestion] {
    guard !isSensitive(sourceText) else { throw ExtractionValidationError.sensitive }
    guard let data = json.data(using: .utf8), let raw = try? JSONDecoder().decode([RawSuggestion].self, from: data), raw.count <= 30 else { throw ExtractionValidationError.invalid }
    return try raw.compactMap { value in
      if !value.is_actionable { return nil }
      guard let title = value.title?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty, title.unicodeScalars.count <= 200,
        let evidence = value.evidence_text, !clean(evidence).isEmpty, Data(sourceText.utf8).range(of: Data(evidence.utf8)) != nil,
        let precision = value.due_precision, validDue(value.due_at, precision: precision),
        let confidence = value.confidence, confidence.isFinite, (0...1).contains(confidence),
        let confirmation = value.needs_confirmation else { throw ExtractionValidationError.invalid }
      let trimmedAssignee = value.assignee?.trimmingCharacters(in: .whitespacesAndNewlines)
      let assignee = trimmedAssignee?.isEmpty == false ? trimmedAssignee : nil
      let layoutHints = sourceText.contains("[상대방]") || sourceText.contains("[나]")
      var task = NativeSuggestion(title: title, description: value.description.map { String($0.prefix(4000)) }, due_at: value.due_at, due_precision: precision, assignee: assignee, confidence: confidence, evidence_text: evidence, needs_confirmation: confirmation || assignee == nil || layoutHints)
      if nonActionEvidence(evidence) { return nil }
      if messageDate == nil && task.due_at != nil {
        let normalized = clean(evidence)
        let relative = matches(normalized, "오늘|내일|모레|글피|어제|그제|올해|금년|내년|내후년|작년|재작년|지난해|(?:이번|다음|지난)\\s*(?:주|달|해)|일\\s*뒤|일\\s*후")
        let explicitYear = matches(normalized, "\\b\\d{4}\\s*(?:년|[-./])")
        if relative || !explicitYear { task.due_at = nil; task.due_precision = "unknown"; task.needs_confirmation = true }
      }
      if let due = task.due_at, dateDisagrees(due: due, precision: task.due_precision, evidence: evidence, messageDate: messageDate, timezone: timezone) {
        task.due_at = nil; task.due_precision = "unknown"; task.needs_confirmation = true
      }
      return task
    }
  }
}
