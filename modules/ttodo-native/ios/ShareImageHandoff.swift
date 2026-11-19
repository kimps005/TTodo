#if DEBUG
import UIKit
import UniformTypeIdentifiers

enum ShareImageHandoff {
  enum Request: Equatable {
    case latest, token(UUID)
  }

  static let maximumDimension = 2048
  static let maximumBytes = 20 * 1024 * 1024
  static let marker = "com.kimps005.ttodo.share-image-token"
  private static let route = "ttodo://share-import?fallback=pasteboard"

  static func url(for token: UUID) -> URL {
    URL(string: "\(route)&token=\(token.uuidString)")!
  }

  static func request(from url: URL) -> Request? {
    let prefix = "\(route)&token="
    let value = url.absoluteString
    if value == route { return .latest }
    guard value.hasPrefix(prefix), let token = UUID(uuidString: String(value.dropFirst(prefix.count))) else { return nil }
    return .token(token)
  }

  @MainActor static func copy(_ jpeg: Data, token: UUID? = nil) {
    var item: [String: Data] = [UTType.jpeg.identifier: jpeg]
    if let token { item[marker] = Data(token.uuidString.utf8) }
    UIPasteboard.general.setItems([item], options: [
      .localOnly: true,
      .expirationDate: Date().addingTimeInterval(5 * 60),
    ])
  }
}
#endif
