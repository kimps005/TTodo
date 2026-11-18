import Foundation

private enum ExpectedFailure: Error { case sample }
private actor Barrier {
  var entered = false
  var continuation: CheckedContinuation<Void, Never>?
  func wait() async { entered = true; await withCheckedContinuation { continuation = $0 } }
  func isEntered() -> Bool { entered }
  func resume() { continuation?.resume(); continuation = nil }
}
private actor Calls {
  var values: [Int] = []
  func append(_ value: Int) { values.append(value) }
  func snapshot() -> [Int] { values }
}
@main struct NativeSafetySmoke {
  static func main() async throws {
    var notifications = 0, applications = 0
    let simulator = await NotificationSettingsRouter.open(simulator: true,
      openNotifications: { notifications += 1; return true }, openApplication: { applications += 1; return true })
    precondition(simulator == .simulator && notifications == 0 && applications == 1)
    let direct = await NotificationSettingsRouter.open(simulator: false,
      openNotifications: { notifications += 1; return true }, openApplication: { applications += 1; return true })
    precondition(direct == .notifications && notifications == 1 && applications == 1)
    let fallback = await NotificationSettingsRouter.open(simulator: false,
      openNotifications: { false }, openApplication: { true })
    precondition(fallback == .application)
    for isSimulator in [false, true] {
      let failure = await NotificationSettingsRouter.open(simulator: isSimulator,
        openNotifications: { false }, openApplication: { false })
      precondition(failure == .failed)
    }
    let lines = (0..<150).map { "\($0)번 요청: 2026년 11월 20일까지 자료를 제출해 주세요." }
    let chunks = try ModelContextBudget.chunks(lines.joined(separator: "\n"))
    precondition(chunks.count > 1)
    precondition(chunks.joined() == lines.joined(separator: "\n"))
    precondition(chunks.allSatisfy { lines.joined(separator: "\n").contains($0) })
    let sentences = "요청을 확인해 주세요. 다음 기한은 내일입니다!  취소하지 마세요."
    let sentenceChunks = try ModelContextBudget.chunks(sentences)
    precondition(sentenceChunks.joined() == sentences)
    precondition(chunks.allSatisfy { $0.utf8.count <= ModelContextBudget.chunkBytes })
    let emoji = String(repeating: "👨‍👩‍👧‍👦", count: 15)
    precondition(ModelContextBudget.estimatedTokens(emoji) > emoji.count * 4)
    let emojiChunks = try ModelContextBudget.chunks(emoji)
    precondition(emojiChunks == [emoji])
    precondition(ModelContextBudget.processingOrder(["그날의 기록", "내일까지 제출", "별도 메모", "앞선 요청 취소"]) == [1, 3, 0, 2])
    for invalid in [" ", String(repeating: "가", count: 201), String(repeating: "a\n", count: 10_001)] {
      do { _ = try ModelContextBudget.chunks(invalid); fatalError("Oversized input accepted") }
      catch LocalAIError.inputLimit { }
    }
    precondition(ModelContextBudget.fits(instructions: "a", prompt: String(repeating: "b", count: 1815)))
    precondition(!ModelContextBudget.fits(instructions: "a", prompt: String(repeating: "b", count: 1816)))
    let gate = Barrier(), calls = Calls(), queue = ModelRequestQueue()
    let first = Task<Void, Error> {
      try await queue.run { await calls.append(1); await gate.wait(); throw ExpectedFailure.sample }
    }
    while !(await gate.isEntered()) { await Task.yield() }
    let cancelled = Task {
      // Cancelled work must not enter a model session, and must release its permit.
      try await queue.run { await calls.append(2) }
    }
    cancelled.cancel()
    let third = Task { try await queue.run { await calls.append(3) } }
    for _ in 0..<100 { await Task.yield() }
    let before = await calls.snapshot()
    precondition(before == [1], "Actor reentrancy allowed concurrent model calls")
    await gate.resume()
    do { _ = try await first.value; fatalError("Expected failure missing") } catch ExpectedFailure.sample { }
    do { try await cancelled.value; fatalError("Cancelled work entered") } catch is CancellationError { }
    try await third.value
    let after = await calls.snapshot()
    precondition(after == [1, 3])
    print("Public settings fallback, UTF-8 context guards and serial model entry/failure/cancellation passed; no real model inference")
  }
}
