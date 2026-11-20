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
  private var shareObserver: NSObjectProtocol?
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

    let input = try await CaptureImageInput.load(provider)
    defer { withExtendedLifetime(input) {} }
    let directory = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("ttodo-captures", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let image = directory.appendingPathComponent("\(UUID().uuidString).image")
    try FileManager.default.moveItem(at: input.url, to: image)
    return image.absoluteString
  }

  public func definition() -> ModuleDefinition {
    Name("TTodoNative")
    Events("sharedImagesReady")
    OnCreate {
      self.shareObserver = NotificationCenter.default.addObserver(forName: SharedImageImport.ready, object: nil, queue: nil) { [weak self] _ in
        self?.sendEvent("sharedImagesReady")
      }
    }
    OnDestroy {
      if let observer = self.shareObserver { NotificationCenter.default.removeObserver(observer) }
    }
    Function("localAIAvailability") { OnDeviceExtraction.availability() }
    Function("ocrCandidates") { (text: String) throws -> String in
      guard !ExtractionValidator.isSensitive(text) else { throw ExtractionValidationError.sensitive }
      return String(decoding: try JSONEncoder().encode(ExtractionValidator.ocrCandidates(text)), as: UTF8.self)
    }
    Function("systemVersion") { ProcessInfo.processInfo.operatingSystemVersionString }
    Function("activityStatus") { TodoActivityManager.status() }
    Function("recordStartupPhase") { (phase: String) in
      guard ProcessInfo.processInfo.environment["TTODO_CI_STARTUP_DIAGNOSTICS"] == "1",
        ["store_opening", "store_ready", "evidence_pruned", "local_snapshot_ready", "permissions_ready", "activity_started", "activity_ready", "boot_ready", "boot_failed",
         "capture_consent_failed", "capture_ocr_failed", "capture_lookup_failed", "capture_availability_failed", "capture_model_failed", "capture_store_failed", "capture_type_error"].contains(phase) else { return }
      self.startupDiagnostics.notice("TTodoStartupDiagnostic phase=\(phase, privacy: .public)")
    }
    AsyncFunction("openNotificationSettings") { () async -> String in
      await self.openNotificationSettings()
    }
    AsyncFunction("extractTasks") { (text: String, capturedAt: String?, timezone: String, messageDate: String?) async throws -> String in
      try await AppleTodoExtractionService().extract(text: text, capturedAt: capturedAt, timezone: timezone, messageDate: messageDate)
    }
    AsyncFunction("extractCaptureTask") { (text: String, timezone: String) async throws -> String in
      do {
        return try await OnDeviceExtraction.extract(text: text, capturedAt: nil, timezone: timezone, messageDate: nil, singleCaptureTask: true)
      } catch {
        if ProcessInfo.processInfo.environment["TTODO_CI_STARTUP_DIAGNOSTICS"] == "1" {
          let diagnostic = error as NSError
          let kind = error is LocalAIError ? "local_ai" : error is ExtractionValidationError ? "validation" :
            diagnostic.domain.hasPrefix("FoundationModels.") ? "foundation_models" : "other"
          self.startupDiagnostics.notice("TTodoStartupDiagnostic phase=capture_native_model_error kind=\(kind, privacy: .public) code=\(diagnostic.code, privacy: .public)")
        }
        throw error
      }
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
      do {
        guard let url = URL(string: uri), url.isFileURL else { throw OCRFailure.invalidImage }
        let info = try url.resourceValues(forKeys: [.fileSizeKey])
        guard let bytes = info.fileSize, bytes > 0, bytes <= 20 * 1024 * 1024 else { throw OCRFailure.tooLarge }
        let data = try Data(contentsOf: url, options: .mappedIfSafe)
        return ["text": try VisionOCR.recognize(data), "fingerprint": VisionOCR.fingerprint(data)]
      } catch {
        if ProcessInfo.processInfo.environment["TTODO_CI_STARTUP_DIAGNOSTICS"] == "1" {
          let diagnostic = error as NSError
          let domain = [NSCocoaErrorDomain, NSPOSIXErrorDomain, "com.apple.vis"].contains(diagnostic.domain) ? diagnostic.domain : "other"
          self.startupDiagnostics.notice("TTodoStartupDiagnostic phase=capture_native_ocr_error domain=\(domain, privacy: .public) code=\(diagnostic.code, privacy: .public)")
        }
        throw error
      }
    }
    AsyncFunction("pasteClipboardImage") { () async throws -> String? in
      try await self.pasteClipboardImage()
    }
    AsyncFunction("takeSharedImages") { () async -> [String] in
      await SharedImageImport.shared.take()
    }
    AsyncFunction("discardSharedImage") { (uri: String) async in
      await SharedImageImport.shared.discard(uri)
    }
    AsyncFunction("clearSharedImages") { (purgePending: Bool) async throws in
      try await SharedImageImport.shared.clear(purgePending: purgePending)
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
