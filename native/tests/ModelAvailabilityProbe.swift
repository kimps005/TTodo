import Foundation

// A single synthetic request through the production extractor. This runs on
// the disposable CI Mac, never against a user's capture, database, or account.
@main
struct ModelAvailabilityProbe {
  static func main() async {
    let env = ProcessInfo.processInfo.environment
    guard let output = env["TTODO_MODEL_PROBE_OUTPUT"] else {
      print("Model probe requires an explicit report path.")
      exit(1)
    }
    let availability = OnDeviceExtraction.availability()
    var report: [String: Any] = [
      "format_version": 1,
      "commit": env["GITHUB_SHA"] ?? "unknown",
      "platform": "macos-ci-host",
      "operating_system": ProcessInfo.processInfo.operatingSystemVersionString,
      "fixture": "one-synthetic-korean-request",
      "availability": availability,
      "physical_device": false,
      "ios_execution_tested": false,
      "accuracy_measured": false,
      "inference_attempted": false,
      "inference_completed": false,
      "inspection_completed": true,
    ]
    var failed = false
    if availability == "available" {
      report["inference_attempted"] = true
      let started = Date()
      do {
        let raw = try await OnDeviceExtraction.extract(
          text: "민수님, 2026년 11월 20일까지 발표자료를 제출해 주세요.",
          capturedAt: nil, timezone: "Asia/Seoul", messageDate: "2026-11-16")
        let tasks = try JSONDecoder().decode([NativeSuggestion].self, from: Data(raw.utf8))
        report["inference_completed"] = true
        report["suggestion_count"] = tasks.count
        report["sample_checks"] = [
          "one_action": tasks.count == 1,
          "explicit_date": tasks.count == 1 && tasks[0].due_at == "2026-11-20" && tasks[0].due_precision == "date",
        ]
        // Do not log generated text or evidence. One request is not an accuracy
        // evaluation and does not create, approve, or persist an application task.
      } catch {
        report["error"] = "EXTRACTION_FAILED"
        failed = true
      }
      // This is host timing only, never an iPhone performance measurement.
      report["host_elapsed_ms"] = Int(Date().timeIntervalSince(started) * 1000)
    }
    do {
      let data = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
      try data.write(to: URL(fileURLWithPath: output), options: .atomic)
      print("Host model inspection recorded. Inference completed: \(report["inference_completed"] as? Bool == true).")
    } catch {
      print("Model probe report could not be written.")
      exit(1)
    }
    if failed { exit(1) }
  }
}
