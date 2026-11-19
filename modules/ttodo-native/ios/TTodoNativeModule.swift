import ExpoModulesCore
import Foundation
import WidgetKit
import UIKit
import UserNotifications
import OSLog

public class TTodoNativeModule: Module {
  private let settingsDiagnostics = Logger(subsystem: "app.ttodo.ci", category: "notification-settings")
  private let startupDiagnostics = Logger(subsystem: "app.ttodo.ci", category: "startup")
  @MainActor private func openNotificationSettings() async -> String {
    // Only the isolated synthetic UI test opts in. Never record task content.
    let diagnostics = ProcessInfo.processInfo.environment["TTODO_CI_NOTIFICATION_DIAGNOSTICS"] == "1"
    if diagnostics {
      let settings = await UNUserNotificationCenter.current().notificationSettings()
      settingsDiagnostics.notice("TTodoNotificationSettingsDiagnostic before authorization=\(settings.authorizationStatus.rawValue) appState=\(UIApplication.shared.applicationState.rawValue)")
    }
    #if targetEnvironment(simulator)
    let simulator = true
    #else
    let simulator = false
    #endif
    let destination = await NotificationSettingsRouter.open(simulator: simulator, openNotifications: {
      guard let url = URL(string: UIApplication.openNotificationSettingsURLString) else { return false }
      return await UIApplication.shared.open(url)
    }, openApplication: {
      guard let url = URL(string: UIApplication.openSettingsURLString) else { return false }
      return await UIApplication.shared.open(url)
    })
    if diagnostics { settingsDiagnostics.notice("TTodoNotificationSettingsDiagnostic destination=\(destination.rawValue, privacy: .public)") }
    return destination.rawValue
  }
  private let storageQueue = DispatchQueue(label: "app.ttodo.sqlite")
  private var sqlStore: SharedStore?
  private func storage() throws -> SharedStore {
    if let sqlStore { return sqlStore }
    let store = try SharedStore(); sqlStore = store; return store
  }
  @MainActor
  private func pasteClipboardImage() async throws -> String? {
    let clipboard = UIPasteboard.general
    guard clipboard.hasImages,
      let provider = clipboard.itemProviders.first(where: { CaptureImageInput.imageType(in: $0) != nil }) else { return nil }

    return try await CaptureImageInput.withImageFile(provider) { url in
      try VisionOCR.validateFile(url)
      let directory = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        .appendingPathComponent("ttodo-captures", isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      let image = directory.appendingPathComponent("\(UUID().uuidString).image")
      do {
        try FileManager.default.copyItem(at: url, to: image)
        return image.absoluteString
      } catch {
        try? FileManager.default.removeItem(at: image)
        throw CaptureImageInput.Failure.unreadable
      }
    }
  }

  public func definition() -> ModuleDefinition {
    Name("TTodoNative")
    Function("localAIAvailability") { OnDeviceExtraction.availability() }
    Function("ocrCandidates") { (text: String) throws -> String in
      guard !ExtractionValidator.isSensitive(text) else { throw ExtractionValidationError.sensitive }
      return String(decoding: try JSONEncoder().encode(ExtractionValidator.ocrCandidates(text)), as: UTF8.self)
    }
    Function("systemVersion") { ProcessInfo.processInfo.operatingSystemVersionString }
    Function("activityStatus") { TodoActivityManager.status() }
    Function("recordStartupPhase") { (phase: String) in
      guard ProcessInfo.processInfo.environment["TTODO_CI_STARTUP_DIAGNOSTICS"] == "1",
        ["store_opening", "store_ready", "evidence_pruned", "local_snapshot_ready", "permissions_ready", "activity_started", "activity_ready", "boot_ready", "boot_failed"].contains(phase) else { return }
      self.startupDiagnostics.notice("TTodoStartupDiagnostic phase=\(phase, privacy: .public)")
    }
    AsyncFunction("openNotificationSettings") { () async -> String in
      await self.openNotificationSettings()
    }
    AsyncFunction("extractTasks") { (text: String, capturedAt: String?, timezone: String, messageDate: String?) async throws -> String in
      try await AppleTodoExtractionService().extract(text: text, capturedAt: capturedAt, timezone: timezone, messageDate: messageDate)
    }
    Function("databaseDirectory") { () throws -> String in
      // Initialize/protect the actual shared DB before expo-sqlite opens its connection.
      return try SharedStore().directory.absoluteString
    }
    AsyncFunction("isUsingLocalStorage") { self.sqlStore?.usesLocalStorage ?? false }.runOnQueue(storageQueue)
    AsyncFunction("execSQL") { (sql: String) throws in
      try self.storage().execSQL(sql)
    }.runOnQueue(storageQueue)
    AsyncFunction("runSQL") { (sql: String, params: [String?]) throws in
      try self.storage().runSQL(sql, params: params)
    }.runOnQueue(storageQueue)
    AsyncFunction("querySQL") { (sql: String, params: [String?]) throws -> [[String: Any]] in
      try self.storage().querySQL(sql, params: params)
    }.runOnQueue(storageQueue)
    AsyncFunction("recognizeText") { (uri: String) throws -> [String: String] in
      guard let url = URL(string: uri), url.isFileURL else { throw OCRFailure.invalidImage }
      let info = try url.resourceValues(forKeys: [.fileSizeKey])
      guard let bytes = info.fileSize, bytes > 0, bytes <= 20 * 1024 * 1024 else { throw OCRFailure.tooLarge }
      let data = try Data(contentsOf: url, options: .mappedIfSafe)
      return ["text": try VisionOCR.recognize(data), "fingerprint": VisionOCR.fingerprint(data)]
    }
    AsyncFunction("pasteClipboardImage") { () async throws -> String? in
      try await self.pasteClipboardImage()
    }
    Function("signalCapturePurge") {
      CapturePurgeObserver.post()
    }
    Function("reloadWidgets") {
      TodoActivityManager.publishLockChange()
      Task { _ = try? await CaptureNotifications.refreshReminders() }
    }
    AsyncFunction("refreshReminders") { () async throws -> Bool in try await CaptureNotifications.refreshReminders() }
    AsyncFunction("clearCaptureNotifications") { () async in await CaptureNotifications.clearAll() }
    Function("clearCaptureNotification") { (id: String) in CaptureNotifications.clearAnalysis(id) }
    AsyncFunction("recoverActivity") { () async throws in try await TodoActivityManager.perform(.foreground) }
    AsyncFunction("startActivity") { () async throws in try await TodoActivityManager.perform(.start) }
    AsyncFunction("endActivities") { () async throws in try await TodoActivityManager.perform(.stop) }
  }
}
