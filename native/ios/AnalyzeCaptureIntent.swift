import AppIntents
import TTodoNative
import UniformTypeIdentifiers
import Foundation

struct AnalyzeCaptureIntent: AppIntent {
  static var title: LocalizedStringResource = "TTodo에서 캡처 분석"
  static var description = IntentDescription("직접 전달한 이미지에서 기기 내 AI로 할 일을 제안해요. 먼저 앱에서 분석 동의와 알림 권한을 설정하세요.")
  static var openAppWhenRun = false
  static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
  @Parameter(title: "분석할 이미지", supportedContentTypes: [.image]) var image: IntentFile
  @Parameter(title: "실패한 이미지 다시 분석", default: false) var retryFailed: Bool
  func perform() async throws -> some IntentResult & ProvidesDialog {
    let outcome = try await ShortcutCapture.analyze(image, retryFailed: retryFailed)
    if outcome.duplicate { return .result(dialog: "이미 처리한 이미지예요. 기존 분석함에서 확인해 주세요.") }
    if outcome.count == 0 { return .result(dialog: "이미지에서 할 일을 찾지 못했어요.") }
    if outcome.semiAutomatic { return .result(dialog: "기기 내 AI를 사용할 수 없어 글자만 읽었어요. 앱 분석함에서 원하는 글자를 탭하고 제목을 확인한 뒤 저장하세요.") }
    return .result(dialog: "할 일 제안을 분석함에 저장했어요. 내용을 확인한 뒤 추가해 주세요.")
  }
}
