import Foundation
import Vision
import ImageIO
import CoreGraphics
import CryptoKit

enum VisionOCR {
  static let maximumBytes = 20 * 1024 * 1024
  static func fingerprint(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }
  static func recognize(_ data: Data) throws -> String {
    let image = try thumbnail(data, maximumDimension: 2400)
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["ko-KR", "en-US"]
    request.usesLanguageCorrection = true
    try VNImageRequestHandler(cgImage: image).perform([request])
    // Quantized rows give a deterministic total order, unlike a pairwise Y tolerance.
    let observations = (request.results ?? []).sorted { a, b in
      let rowA = Int((a.boundingBox.midY * 100).rounded())
      let rowB = Int((b.boundingBox.midY * 100).rounded())
      return rowA != rowB ? rowA > rowB : a.boundingBox.minX < b.boundingBox.minX
    }
    return observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
  }
  static func thumbnail(_ data: Data, maximumDimension: Int) throws -> CGImage {
    guard !data.isEmpty, data.count <= maximumBytes else { throw OCRFailure.tooLarge }
    guard let source = CGImageSourceCreateWithData(data as CFData, nil),
      let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maximumDimension
      ] as CFDictionary) else { throw OCRFailure.invalidImage }
    return image
  }
}
enum OCRFailure: LocalizedError {
  case invalidImage, tooLarge
  var errorDescription: String? { self == .tooLarge ? "20MB 이하 이미지를 선택해 주세요." : "이미지를 읽을 수 없어요. 다른 이미지를 선택해 주세요." }
}
