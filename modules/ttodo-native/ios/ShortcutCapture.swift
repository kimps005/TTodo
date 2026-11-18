import AppIntents
import UniformTypeIdentifiers

// Use the Expo bridge's compiled capture/model queues when Shortcuts invokes the app.
public enum ShortcutCapture {
  public static func analyze(_ image: IntentFile, retryFailed: Bool) async throws -> (duplicate: Bool, count: Int, semiAutomatic: Bool) {
    if let type = image.type, !type.conforms(to: .image) { throw OCRFailure.invalidImage }
    let work = Task { try await CaptureProcessor.analyze(data: image.data, messageDate: nil, retryFailed: retryFailed, service: AppleTodoExtractionService()) }
    let observer = CapturePurgeObserver { work.cancel() }
    defer { withExtendedLifetime(observer) {} }
    let outcome = try await withTaskCancellationHandler { try await work.value } onCancel: { work.cancel() }
    await CaptureNotifications.suggest(outcome)
    return (outcome.duplicate, outcome.count, outcome.semiAutomatic)
  }
}
