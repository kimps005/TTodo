import ExpoModulesCore
import Foundation
import Vision
import ImageIO
import CryptoKit
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
      guard let source = CGImageSourceCreateWithData(data as CFData, nil),
        let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
          kCGImageSourceCreateThumbnailFromImageAlways: true,
          kCGImageSourceCreateThumbnailWithTransform: true,
          kCGImageSourceThumbnailMaxPixelSize: 2400
        ] as CFDictionary) else { throw OCRFailure.invalidImage }
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["ko-KR", "en-US"]
      request.usesLanguageCorrection = true
      try VNImageRequestHandler(cgImage: image).perform([request])
      let observations = (request.results ?? []).sorted { a, b in
        let dy = a.boundingBox.midY - b.boundingBox.midY
        return abs(dy) > 0.015 ? dy > 0 : a.boundingBox.minX < b.boundingBox.minX
      }
      let text = observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
      let fingerprint = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
      return ["text": text, "fingerprint": fingerprint]
    }
    Function("reloadWidgets") {
      WidgetCenter.shared.reloadAllTimelines()
      Task { try? await TodoActivityManager.refresh() }
    }
    AsyncFunction("startActivity") { () async throws in try await TodoActivityManager.start() }
    AsyncFunction("endActivities") { () async in await TodoActivityManager.end() }
  }
}
enum OCRFailure: LocalizedError {
  case invalidImage, tooLarge
  var errorDescription: String? { self == .tooLarge ? "20MB 이하 이미지를 선택해 주세요." : "이미지를 읽을 수 없어요. 다른 이미지를 선택해 주세요." }
}
