import UIKit
import UniformTypeIdentifiers

enum CaptureImageInput {
  enum Failure: LocalizedError {
    case unreadable

    var errorDescription: String? { "이미지를 읽지 못했어요. 선명한 사진을 다시 선택하거나 복사해 주세요." }
  }

  static func imageType(in provider: NSItemProvider) -> String? {
    provider.registeredTypeIdentifiers.first { UTType($0)?.conforms(to: .image) == true }
  }

  // The provider's temporary URL expires as soon as its callback returns.
  static func withImageFile<Value: Sendable>(_ provider: NSItemProvider, use: @escaping @Sendable (URL) throws -> Value) async throws -> Value {
    guard let type = imageType(in: provider) else { throw Failure.unreadable }
    return try await withCheckedThrowingContinuation { continuation in
      provider.loadFileRepresentation(forTypeIdentifier: type) { url, _ in
        guard let url else { continuation.resume(throwing: Failure.unreadable); return }
        continuation.resume(with: Result { try use(url) })
      }
    }
  }

  #if DEBUG
  static func compressedImage(at url: URL) throws -> Data {
    try autoreleasepool {
      let thumbnail = try VisionOCR.thumbnail(fileURL: url, maximumDimension: VisionOCR.maximumOCRDimension)
      guard let jpeg = UIImage(cgImage: thumbnail).jpegData(compressionQuality: 0.9) else { throw Failure.unreadable }
      return jpeg
    }
  }
  #endif
}
