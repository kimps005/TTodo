import Foundation
import Vision
import ImageIO
import CoreGraphics
import CryptoKit

enum VisionOCR {
  struct Block {
    let text: String
    let box: CGRect
  }
  // Vision coordinates originate at the lower left. Keep only content centers
  // outside the status bar (top 6%) and home indicator (bottom 3%).
  static func preprocess(_ input: [Block]) -> String {
    let blocks = input.enumerated().filter {
      let box = $0.element.box
      return !box.isNull && !box.isEmpty && box.midY.isFinite && box.midX.isFinite &&
        box.midY >= 0.03 && box.midY <= 0.94 && !$0.element.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }.sorted { a, b in
      let rowA = Int((a.element.box.midY * 100).rounded())
      let rowB = Int((b.element.box.midY * 100).rounded())
      if rowA != rowB { return rowA > rowB }
      if a.element.box.minX != b.element.box.minX { return a.element.box.minX < b.element.box.minX }
      return a.offset < b.offset
    }.map(\.element)
    func side(_ box: CGRect) -> Int {
      guard box.width <= 0.65 else { return 0 }
      if box.minX <= 0.25 && box.maxX < 0.75 { return -1 }
      if box.minX >= 0.35 && box.maxX >= 0.75 { return 1 }
      return 0
    }
    let aligned = blocks.filter { side($0.box) != 0 }
    let left = aligned.filter { side($0.box) == -1 }, right = aligned.filter { side($0.box) == 1 }
    func spread(_ values: [CGFloat]) -> CGFloat { (values.max() ?? 0) - (values.min() ?? 0) }
    let pairs = Array(zip(aligned, aligned.dropFirst()))
    let changes = pairs.filter { side($0.0.box) != side($0.1.box) && abs($0.0.box.midY - $0.1.box.midY) > 0.025 }.count
    let table = pairs.contains { side($0.0.box) != side($0.1.box) && abs($0.0.box.midY - $0.1.box.midY) <= 0.025 }
    // Require two stable X alignments and alternating vertical turns. Columns,
    // wide paragraphs and isolated labels must not be treated as a conversation.
    let chat = left.count >= 2 && right.count >= 2 && changes >= 2 && !table &&
      spread(left.map { $0.box.minX }) <= 0.10 && spread(right.map { $0.box.maxX }) <= 0.10
    return blocks.map { block in
      let hint = chat ? (side(block.box) == -1 ? "[상대방] " : side(block.box) == 1 ? "[나] " : "") : ""
      return hint + block.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }.joined(separator: "\n")
  }
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
    return preprocess((request.results ?? []).compactMap { observation in
      observation.topCandidates(1).first.map { Block(text: $0.string, box: observation.boundingBox) }
    })
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
