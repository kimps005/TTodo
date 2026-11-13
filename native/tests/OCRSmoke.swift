import AppKit
import Foundation
import CoreGraphics
import ImageIO

@main
struct OCRSmoke {
  static func image(text: String?) throws -> Data {
    let width = 1440, height = 320
    guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { fatalError("Synthetic image context unavailable") }
    context.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    if let text {
      NSGraphicsContext.saveGraphicsState()
      NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
      (text as NSString).draw(in: NSRect(x: 40, y: 40, width: CGFloat(width - 80), height: CGFloat(height - 80)), withAttributes: [.font: NSFont.systemFont(ofSize: 56), .foregroundColor: NSColor.black])
      NSGraphicsContext.restoreGraphicsState()
    }
    guard let bitmap = context.makeImage(), let buffer = CFDataCreateMutable(nil, 0),
      let destination = CGImageDestinationCreateWithData(buffer, "public.png" as CFString, 1, nil) else { fatalError("Synthetic PNG destination unavailable") }
    CGImageDestinationAddImage(destination, bitmap, nil)
    guard CGImageDestinationFinalize(destination), let bytes = CFDataGetBytePtr(buffer) else { fatalError("Synthetic PNG encoding failed") }
    return Data(bytes: bytes, count: CFDataGetLength(buffer))
  }
  static func normalized(_ text: String) -> String {
    String(text.precomposedStringWithCompatibilityMapping.filter { $0.isLetter || $0.isNumber })
  }
  static func main() throws {
    // No user capture or stored task is read. The production OCR runs directly;
    // the expected text is never injected as a recognizer response.
    let expected = "2026년 11월 20일까지 보고서 제출"
    let data = try image(text: "기기 내 글자 인식 검증\n" + expected)
    if let output = ProcessInfo.processInfo.environment["TTODO_OCR_FIXTURE_OUTPUT"] {
      let directory = URL(fileURLWithPath: output, isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      try data.write(to: directory.appendingPathComponent("synthetic-korean.png"))
    }
    let recognized = try VisionOCR.recognize(data)
    precondition(normalized(recognized).contains(normalized(expected)), "Actual Vision OCR did not match the clear synthetic Korean fixture")
    let blank = try image(text: nil)
    let blankText = try VisionOCR.recognize(blank)
    precondition(blankText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, "Blank synthetic image produced text")
    do { _ = try VisionOCR.recognize(Data([0, 1, 2])); fatalError("Invalid image accepted") }
    catch OCRFailure.invalidImage { }
    print("실제 Vision OCR 합성 한국어·빈 이미지·잘못된 이미지 검사 통과 (macOS SDK, 실제 iPhone/AI 추출 정확도 미검증, OCR 원문 미출력)")
  }
}
