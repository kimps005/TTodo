import AppIntents
import WidgetKit

struct AddTodoIntent: AppIntent {
  static var title: LocalizedStringResource = "TTodo에 할 일 추가"
  static var description = IntentDescription("입력한 할 일을 기기에 저장해요. 단축어의 ‘입력 요청’ 동작 뒤에 연결하세요.")
  static var openAppWhenRun = false
  static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
  @Parameter(title: "할 일") var title: String
  static var parameterSummary: some ParameterSummary { Summary("\(\.$title)을 할 일에 추가") }
  func perform() async throws -> some IntentResult & ProvidesDialog {
    try SharedStore().add(title: title)
    WidgetCenter.shared.reloadAllTimelines()
    try? await TodoActivityManager.refresh()
    return .result(dialog: "할 일을 저장했어요.")
  }
}
struct TTodoShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: AddTodoIntent(), phrases: ["\(.applicationName)에 할 일 추가"], shortTitle: "할 일 추가", systemImageName: "plus.circle")
  }
}
