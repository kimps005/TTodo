import XCTest

final class TTodoUITests: XCTestCase {
  @MainActor private func tap(_ element: XCUIElement, in app: XCUIApplication) {
    XCTAssertTrue(element.waitForExistence(timeout: 20))
    for _ in 0..<5 where !element.isHittable { app.scrollViews.firstMatch.swipeUp() }
    XCTAssertTrue(element.isHittable)
    element.tap()
  }
  @MainActor private func screenshot(_ app: XCUIApplication, name: String) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
  @MainActor func testManualTaskSurvivesRelaunchEditAndDelete() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchArguments = ["-AppleLanguages", "(ko)", "-AppleLocale", "ko_KR"]
    app.launch()
    let start = app.buttons["이 설정으로 시작하기"]
    XCTAssertTrue(start.waitForExistence(timeout: 30), "A fresh CI simulator must show onboarding.")
    screenshot(app, name: "01-onboarding")
    tap(start, in: app)
    let input = app.textFields["새 할 일"]
    XCTAssertTrue(input.waitForExistence(timeout: 15))
    input.tap(); input.typeText("CI manual task")
    tap(app.buttons["할 일 추가"], in: app)
    let original = app.buttons["CI manual task, 마감 없음, 상세 편집"]
    XCTAssertTrue(original.waitForExistence(timeout: 15))
    app.terminate(); app.launch()
    XCTAssertTrue(original.waitForExistence(timeout: 30), "The task must survive a real process relaunch.")
    tap(original, in: app)
    let title = app.textViews["할 일 제목"]
    XCTAssertTrue(title.waitForExistence(timeout: 15))
    title.tap(); title.typeText(" updated")
    tap(app.buttons["변경 저장"], in: app)
    let edited = app.buttons["CI manual task updated, 마감 없음, 상세 편집"]
    XCTAssertTrue(edited.waitForExistence(timeout: 15))
    screenshot(app, name: "02-edited-task")
    tap(edited, in: app)
    tap(app.buttons["할 일 삭제"], in: app)
    tap(app.alerts.buttons["취소"], in: app)
    XCTAssertTrue(app.textViews["할 일 제목"].exists, "Cancelling deletion must preserve the editor.")
    tap(app.buttons["할 일 삭제"], in: app)
    tap(app.alerts.buttons["삭제"], in: app)
    XCTAssertTrue(app.staticTexts["머릿속을 조금 비워 보세요"].waitForExistence(timeout: 15))
    XCTAssertFalse(edited.exists)
    app.terminate(); app.launch()
    XCTAssertTrue(app.staticTexts["머릿속을 조금 비워 보세요"].waitForExistence(timeout: 30))
    XCTAssertFalse(edited.exists, "Deletion must survive a real process relaunch.")
    screenshot(app, name: "03-deleted-task")
  }
}
