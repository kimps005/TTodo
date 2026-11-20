#if DEBUG
import UIKit
import UniformTypeIdentifiers

enum ShareImageHandoff {
  @MainActor static func copy(_ jpeg: Data) {
    UIPasteboard.general.setItems([[UTType.jpeg.identifier: jpeg]], options: [
      .localOnly: true,
      .expirationDate: Date().addingTimeInterval(5 * 60),
    ])
  }
}
#endif
