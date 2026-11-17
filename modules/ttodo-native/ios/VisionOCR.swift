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
  // 2400^2 * 4 is at most ~22 MiB of decoded pixels, rather than a full
  // high-resolution photo. Device OCR quality and total RSS still need QA.
  static let maximumOCRDimension = 2400
  static func fingerprint(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }
  static func recognize(_ data: Data) throws -> String {
    try autoreleasepool { try recognize(image: thumbnail(data, maximumDimension: maximumOCRDimension)) }
  }
  static func recognize(fileURL: URL) throws -> String {
    try autoreleasepool { try recognize(image: thumbnail(fileURL: fileURL, maximumDimension: maximumOCRDimension)) }
  }
  private static func recognize(image: CGImage) throws -> String {
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
    guard let source = CGImageSourceCreateWithData(data as CFData, [kCGImageSourceShouldCache: false] as CFDictionary) else { throw OCRFailure.invalidImage }
    return try thumbnail(source: source, maximumDimension: maximumDimension)
  }
  static func validateFile(_ url: URL) throws {
    guard url.isFileURL else { throw OCRFailure.invalidImage }
    let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
    guard size > 0, size <= maximumBytes else { throw OCRFailure.tooLarge }
  }
  static func fingerprint(fileURL: URL) throws -> String {
    try validateFile(fileURL)
    let file = try FileHandle(forReadingFrom: fileURL)
    defer { try? file.close() }
    var hash = SHA256()
    var total = 0
    while true {
      let hasBytes = try autoreleasepool {
        let bytes = try file.read(upToCount: 64 * 1024) ?? Data()
        if bytes.isEmpty { return false }
        total += bytes.count
        guard total <= maximumBytes else { throw OCRFailure.tooLarge }
        hash.update(data: bytes); return true
      }
      if !hasBytes { break }
    }
    return hash.finalize().map { String(format: "%02x", $0) }.joined()
  }
  static func thumbnail(fileURL: URL, maximumDimension: Int) throws -> CGImage {
    try validateFile(fileURL)
    guard let source = CGImageSourceCreateWithURL(fileURL as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary) else { throw OCRFailure.invalidImage }
    return try thumbnail(source: source, maximumDimension: maximumDimension)
  }
  private static func thumbnail(source: CGImageSource, maximumDimension: Int) throws -> CGImage {
    guard maximumDimension > 0, maximumDimension <= maximumOCRDimension,
      let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maximumDimension,
        kCGImageSourceShouldAllowFloat: false,
        kCGImageSourceShouldCacheImmediately: true
      ] as CFDictionary) else { throw OCRFailure.invalidImage }
    return image
  }
}
enum OCRFailure: LocalizedError {
  case invalidImage, tooLarge
  var errorDescription: String? { self == .tooLarge ? "20MB 이하 이미지를 선택해 주세요." : "이미지를 읽을 수 없어요. 다른 이미지를 선택해 주세요." }
}
