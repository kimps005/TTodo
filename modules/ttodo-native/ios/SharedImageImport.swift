#if DEBUG
import UIKit
import UniformTypeIdentifiers

@MainActor
enum SharedImageImport {
  private static var pending: ShareImageHandoff.Request?
  private static var consumed: UUID?

  static func receive(_ url: URL) -> Bool {
    guard let request = ShareImageHandoff.request(from: url) else { return false }
    if case let .token(token) = request, token == consumed { return true }
    pending = request
    return true
  }

  static func take() throws -> String? {
    guard UIApplication.shared.applicationState == .active, let request = pending else { return nil }
    pending = nil
    let board = UIPasteboard.general
    let changeCount = board.changeCount
    guard board.types.contains(ShareImageHandoff.marker) else {
      if request == .latest { return nil }
      throw CaptureImageInput.Failure.unreadable
    }
    let first = IndexSet(integer: 0)
    guard let marker = board.data(forPasteboardType: ShareImageHandoff.marker, inItemSet: first)?.first,
      let token = UUID(uuidString: String(decoding: marker, as: UTF8.self)) else {
      throw CaptureImageInput.Failure.unreadable
    }
    guard token != consumed, request == .latest || request == .token(token) else { return nil }
    guard let jpeg = board.data(forPasteboardType: UTType.jpeg.identifier, inItemSet: first)?.first,
      !jpeg.isEmpty, jpeg.count <= ShareImageHandoff.maximumBytes, board.changeCount == changeCount else {
      throw CaptureImageInput.Failure.unreadable
    }

    var folder = try directory()
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    var resources = URLResourceValues()
    resources.isExcludedFromBackup = true
    try folder.setResourceValues(resources)
    let image = folder.appendingPathComponent("\(token.uuidString).jpg")
    try jpeg.write(to: image, options: [.atomic, .completeFileProtection])
    consumed = token
    if board.changeCount == changeCount { board.items = [] }
    return image.absoluteString
  }

  static func discard(_ uri: String) {
    guard let folder = try? directory(), let url = URL(string: uri), url.isFileURL,
      url.deletingLastPathComponent().standardizedFileURL.path == folder.standardizedFileURL.path,
      url.pathExtension == "jpg", UUID(uuidString: url.deletingPathExtension().lastPathComponent) != nil else { return }
    try? FileManager.default.removeItem(at: url)
  }

  static func clear(purgePending: Bool) throws {
    if purgePending { pending = nil }
    do { try FileManager.default.removeItem(at: directory()) }
    catch let error as CocoaError where error.code == .fileNoSuchFile { }
  }

  private static func directory() throws -> URL {
    try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: false)
      .appendingPathComponent("TTodo-share-imports", isDirectory: true)
  }
}
#endif
