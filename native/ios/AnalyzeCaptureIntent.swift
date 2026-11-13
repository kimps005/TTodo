import AppIntents
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
    if let type = image.type, !type.conforms(to: .image) { throw OCRFailure.invalidImage }
    let outcome = try await CaptureProcessor.analyze(data: image.data, messageDate: nil, retryFailed: retryFailed, extract: OnDeviceExtraction.extract)
    await CaptureNotifications.suggest(outcome)
    if outcome.duplicate { return .result(dialog: "이미 처리한 이미지예요. 기존 분석함에서 확인해 주세요.") }
    if outcome.count == 0 { return .result(dialog: "이미지에서 할 일을 찾지 못했어요.") }
    return .result(dialog: "할 일 제안을 분석함에 저장했어요. 내용을 확인한 뒤 추가해 주세요.")
  }
}
