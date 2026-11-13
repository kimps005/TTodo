import ExpoModulesCore
import Foundation
import WidgetKit

public class TTodoNativeModule: Module {
  private let storageQueue = DispatchQueue(label: "app.ttodo.sqlite")
  private var sqlStore: SharedStore?
  private func storage() throws -> SharedStore {
    if let sqlStore { return sqlStore }
    let store = try SharedStore(); sqlStore = store; return store
  }
  public func definition() -> ModuleDefinition {
    Name("TTodoNative")
    Function("localAIAvailability") { OnDeviceExtraction.availability() }
    Function("systemVersion") { ProcessInfo.processInfo.operatingSystemVersionString }
    AsyncFunction("extractTasks") { (text: String, capturedAt: String?, timezone: String, messageDate: String?) async throws -> String in
      try await OnDeviceExtraction.extract(text: text, capturedAt: capturedAt, timezone: timezone, messageDate: messageDate)
    }
    Function("databaseDirectory") { () throws -> String in
      // Initialize/protect the actual shared DB before expo-sqlite opens its connection.
      _ = try SharedStore()
      return try SharedStore.directory().absoluteString
    }
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
    Function("reloadWidgets") {
      WidgetCenter.shared.reloadAllTimelines()
      Task { try? await TodoActivityManager.refresh() }
    }
    AsyncFunction("startActivity") { () async throws in try await TodoActivityManager.start() }
    AsyncFunction("endActivities") { () async in await TodoActivityManager.end() }
  }
}
