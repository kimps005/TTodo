import UIKit
import UniformTypeIdentifiers
import OSLog

enum CaptureImageInput {
  private static let inputLog = Logger(subsystem: "app.ttodo.share", category: "image-input")
  enum Failure: LocalizedError {
    case singleImage, unreadable, timedOut

    var errorDescription: String? {
      switch self {
      case .singleImage: return "이미지를 한 장씩 공유해 주세요."
      case .unreadable: return "이미지를 읽지 못했어요. 사진을 다시 선택해 주세요."
      case .timedOut: return "사진을 가져오는 시간이 길어지고 있어요. 사진 앱에서 다운로드 상태를 확인한 뒤 다시 시도해 주세요."
      }
    }
  }

  static func imageType(in provider: NSItemProvider) -> String? {
    provider.registeredTypeIdentifiers.first { UTType($0)?.conforms(to: .image) == true }
  }

  static func loadSingle(from context: NSExtensionContext?) async throws -> TemporaryImage {
    try await loadSelected {
      let items = context?.inputItems as? [NSExtensionItem] ?? []
      let images = items.flatMap { $0.attachments ?? [] }.filter { imageType(in: $0) != nil }
      guard images.count == 1 else { throw Failure.singleImage }
      return images[0]
    }
  }

  final class TemporaryImage: Sendable {
    let url: URL

    fileprivate init(providerFile: URL) throws {
      try VisionOCR.validateFile(providerFile)
      url = FileManager.default.temporaryDirectory.appendingPathComponent("ttodo-share-\(UUID().uuidString).image")
      let bytes = try Data(contentsOf: providerFile, options: .mappedIfSafe)
      guard bytes.count <= VisionOCR.maximumBytes else { throw OCRFailure.tooLarge }
      try bytes.write(to: url, options: [.atomic, .completeFileProtection])
    }

    deinit { try? FileManager.default.removeItem(at: url) }
  }

  static func load(_ provider: NSItemProvider) async throws -> TemporaryImage {
    try await loadSelected { provider }
  }

  private static func loadSelected(_ select: @escaping () throws -> NSItemProvider) async throws -> TemporaryImage {
    try Task.checkCancellation()
    inputLog.notice("Image requested")
    let (files, stream) = AsyncThrowingStream<TemporaryImage, Error>.makeStream()
    let progress = Progress(totalUnitCount: 1)
    let timeout = Task {
      try await Task.sleep(nanoseconds: 30_000_000_000)
      inputLog.notice("Image request timed out")
      stream.finish(throwing: Failure.timedOut)
    }
    stream.onTermination = { reason in
      timeout.cancel()
      if case .finished(nil) = reason { return }
      progress.cancel()
    }
    // Photos can take time even to resolve its attachments or register the load.
    // Start waiting independently so those synchronous calls cannot hold the UI or deadline.
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        guard !progress.isCancelled else { return }
        let provider = try select()
        guard let type = imageType(in: provider) else { throw Failure.unreadable }
        guard !progress.isCancelled else { return }
        let request = provider.loadFileRepresentation(forTypeIdentifier: type) { url, _ in
          do {
            guard !progress.isCancelled else { return }
            guard let url else { throw Failure.unreadable }
            // The provider URL expires on return. A late yield releases its own copy.
            stream.yield(try TemporaryImage(providerFile: url))
            stream.finish()
            inputLog.debug("Image provider callback finished")
          } catch { stream.finish(throwing: error) }
        }
        progress.addChild(request, withPendingUnitCount: 1)
        if progress.isCancelled { request.cancel() }
      } catch { stream.finish(throwing: error) }
    }
    var iterator = files.makeAsyncIterator()
    guard let file = try await iterator.next() else { throw CancellationError() }
    try Task.checkCancellation()
    return file
  }

  #if DEBUG
  static func compressedImage(from context: NSExtensionContext?) async throws -> Data {
    let file = try await loadSingle(from: context)
    defer { withExtendedLifetime(file) {} }
    return try autoreleasepool {
      let thumbnail = try VisionOCR.thumbnail(fileURL: file.url, maximumDimension: 2048)
      guard let jpeg = UIImage(cgImage: thumbnail).jpegData(compressionQuality: 0.85),
        jpeg.count <= VisionOCR.maximumBytes else { throw Failure.unreadable }
      return jpeg
    }
  }
  #endif
}
