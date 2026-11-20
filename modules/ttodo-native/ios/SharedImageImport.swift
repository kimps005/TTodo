import AppIntents
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Runs in the app process. The event only wakes JS; the queue also covers cold launch.
public actor SharedImageImport {
  public static let shared = SharedImageImport()
  static let ready = Notification.Name("TTodoSharedImageReady")
  private var pending: [URL] = []

  public func receive(_ image: IntentFile) throws {
    try Task.checkCancellation()
    if let type = image.type, !type.conforms(to: .image) { throw OCRFailure.invalidImage }
    let bytes: Data
    if let url = image.fileURL {
      let scoped = url.startAccessingSecurityScopedResource()
      defer { if scoped { url.stopAccessingSecurityScopedResource() } }
      try VisionOCR.validateFile(url)
      bytes = try Data(contentsOf: url)
    } else {
      bytes = image.data
    }
    guard !bytes.isEmpty, bytes.count <= VisionOCR.maximumBytes else { throw OCRFailure.tooLarge }
    guard let source = CGImageSourceCreateWithData(bytes as CFData, nil),
      CGImageSourceGetCount(source) > 0,
      let identifier = CGImageSourceGetType(source),
      UTType(identifier as String)?.conforms(to: .image) == true else { throw OCRFailure.invalidImage }

    var folder = try directory()
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    var resources = URLResourceValues()
    resources.isExcludedFromBackup = true
    try folder.setResourceValues(resources)
    let file = folder.appendingPathComponent("\(UUID().uuidString).image")
    try Task.checkCancellation()
    try bytes.write(to: file, options: [.atomic, .completeFileProtection])
    pending.append(file)
    NotificationCenter.default.post(name: Self.ready, object: nil)
  }

  func take() -> [String] {
    defer { pending.removeAll() }
    return pending.map(\.absoluteString)
  }

  func discard(_ uri: String) {
    guard let folder = try? directory(), let url = URL(string: uri), url.isFileURL,
      url.deletingLastPathComponent().standardizedFileURL.path == folder.standardizedFileURL.path,
      url.pathExtension == "image", UUID(uuidString: url.deletingPathExtension().lastPathComponent) != nil else { return }
    try? FileManager.default.removeItem(at: url)
  }

  func clear(purgePending: Bool) throws {
    if purgePending { pending.removeAll() }
    let folder = try directory()
    let files: [URL]
    do { files = try FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil) }
    catch let error as CocoaError where error.code == .fileReadNoSuchFile || error.code == .fileNoSuchFile { return }
    // Keep newly received inputs during JS startup; remove orphaned files from prior launches.
    let keep = Set(pending.map(\.lastPathComponent))
    for file in files where !keep.contains(file.lastPathComponent) {
      try FileManager.default.removeItem(at: file)
    }
  }

  private func directory() throws -> URL {
    try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
      .appendingPathComponent("TTodo-share-imports", isDirectory: true)
  }
}
