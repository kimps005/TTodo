import SwiftUI
import UIKit

// Built only by the explicit CI host generator. Never part of the product app.
@main
struct TTodoCIShareHost: App {
  var body: some Scene { WindowGroup { ShareHostView() } }
}

private struct SharePayload: Identifiable {
  let id = UUID()
  let url: URL
}

private struct ShareHostView: View {
  @State private var payload: SharePayload?
  @State private var failure: String?
  var body: some View {
    VStack(spacing: 24) {
      Text("CI 합성 이미지 공유").font(.title2)
      Text("개인 사진이나 저장된 할 일을 읽지 않아요.")
      Button("합성 이미지 공유") {
        do {
          let image = UIGraphicsImageRenderer(size: CGSize(width: 1024, height: 360)).image { context in
            UIColor.white.setFill(); context.fill(CGRect(x: 0, y: 0, width: 1024, height: 360))
            ("공유 확장 합성 이미지 검사" as NSString).draw(at: CGPoint(x: 32, y: 132), withAttributes: [.font: UIFont.systemFont(ofSize: 36), .foregroundColor: UIColor.black])
          }
          guard let data = image.pngData() else { throw CocoaError(.fileWriteUnknown) }
          let url = FileManager.default.temporaryDirectory.appendingPathComponent("ttodo-ci-synthetic.png")
          try data.write(to: url, options: .atomic)
          payload = SharePayload(url: url)
        } catch { failure = "합성 이미지를 만들지 못했어요." }
      }.accessibilityIdentifier("ci-share-image")
      if let failure { Text(failure) }
    }.padding().sheet(item: $payload) { item in
      ShareController(url: item.url)
    }
  }
}

private struct ShareController: UIViewControllerRepresentable {
  let url: URL
  func makeUIViewController(context: Context) -> UIActivityViewController {
    UIActivityViewController(activityItems: [url], applicationActivities: nil)
  }
  func updateUIViewController(_ controller: UIActivityViewController, context: Context) { }
}
