import XCTest

final class TTodoUITests: XCTestCase {
  @MainActor private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
    XCTAssertTrue(element.waitForExistence(timeout: 20))
    for _ in 0..<5 where !element.isHittable { app.scrollViews.firstMatch.swipeUp() }
    XCTAssertTrue(element.isHittable)
  }
  @MainActor private func tap(_ element: XCUIElement, in app: XCUIApplication) { reveal(element, in: app); element.tap() }
  @MainActor private func row(_ app: XCUIApplication, title: String) -> XCUIElement {
    app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title + ", ")).firstMatch
  }
  @MainActor private func control(_ app: XCUIApplication, label: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
  }
  @MainActor private func assertTaskMissing(_ app: XCUIApplication, title: String) {
    XCTAssertFalse(control(app, label: title + " 완료하기").exists)
    XCTAssertFalse(control(app, label: title + " 미완료로 되돌리기").exists)
  }
  @MainActor private func screenshot(_ app: XCUIApplication, name: String) {
    let attachment = XCTAttachment(screenshot: app.screenshot())
    attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
  }
  @MainActor func testManualTaskLifecycleAndDataReset() throws {
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
    // Tapping a multiline field does not promise an insertion point at the end.
    // Compare what the user actually entered with what the app later stores.
    let editedTitle = try XCTUnwrap(title.value as? String).trimmingCharacters(in: .whitespacesAndNewlines)
    XCTAssertNotEqual(editedTitle, "CI manual task")
    XCTAssertTrue(editedTitle.contains("updated"))
    let day = app.textFields["마감 날짜 YYYY-MM-DD"]
    tap(day, in: app); day.typeText("2026-12-01")
    screenshot(app, name: "02-title-input")
    tap(app.buttons["변경 저장"], in: app)
    let edited = row(app, title: editedTitle)
    XCTAssertTrue(edited.waitForExistence(timeout: 15))
    screenshot(app, name: "03-edited-task")
    tap(control(app, label: editedTitle + " 완료하기"), in: app)
    let restore = control(app, label: editedTitle + " 미완료로 되돌리기")
    XCTAssertTrue(restore.waitForExistence(timeout: 15))
    app.terminate(); app.launch()
    reveal(restore, in: app)
    screenshot(app, name: "04-completed-task")
    tap(restore, in: app)
    XCTAssertTrue(edited.waitForExistence(timeout: 15))
    app.terminate(); app.launch()
    XCTAssertTrue(edited.waitForExistence(timeout: 30))
    tap(edited, in: app)
    XCTAssertEqual(app.textFields["마감 날짜 YYYY-MM-DD"].value as? String, "2026-12-01")
    let clock = app.textFields["마감 시각 시와 분"]
    let clockValue = clock.value as? String ?? ""
    XCTAssertTrue(clockValue.isEmpty || clockValue == clock.placeholderValue, "A date-only deadline must not acquire a time.")
    tap(app.buttons["할 일 삭제"], in: app)
    tap(app.alerts.buttons["취소"], in: app)
    XCTAssertTrue(app.textViews["할 일 제목"].exists, "Cancelling deletion must preserve the editor.")
    let afterCancel = try XCTUnwrap(app.textViews["할 일 제목"].value as? String).trimmingCharacters(in: .whitespacesAndNewlines)
    XCTAssertEqual(afterCancel, editedTitle)
    tap(app.buttons["닫기"], in: app)
    app.terminate(); app.launch()
    XCTAssertTrue(edited.waitForExistence(timeout: 30), "Cancelling deletion must preserve the stored task.")
    tap(edited, in: app)
    tap(app.buttons["할 일 삭제"], in: app)
    tap(app.alerts.buttons["삭제"], in: app)
    XCTAssertTrue(app.staticTexts["머릿속을 조금 비워 보세요"].waitForExistence(timeout: 15))
    XCTAssertFalse(edited.exists)
    assertTaskMissing(app, title: editedTitle)
    app.terminate(); app.launch()
    XCTAssertTrue(app.staticTexts["머릿속을 조금 비워 보세요"].waitForExistence(timeout: 30))
    XCTAssertFalse(edited.exists, "Deletion must survive a real process relaunch.")
    assertTaskMissing(app, title: editedTitle)
    screenshot(app, name: "05-deleted-task")
    // Exercise keyboard Done as well as the Add button, then the real Settings
    // reset path. Everything belongs to this fresh, synthetic-only simulator.
    let resetTitle = "CI reset task"
    input.tap(); input.typeText(resetTitle + "\n")
    let resetRow = row(app, title: resetTitle)
    XCTAssertTrue(resetRow.waitForExistence(timeout: 15))
    XCTAssertEqual(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", resetTitle + ", ")).count, 1)
    tap(control(app, label: "설정"), in: app)
    tap(app.buttons["모든 데이터 삭제"], in: app)
    tap(app.alerts.buttons["모두 삭제"], in: app)
    tap(control(app, label: "할 일"), in: app)
    XCTAssertTrue(start.waitForExistence(timeout: 20), "Reset must also clear onboarding preferences.")
    assertTaskMissing(app, title: resetTitle)
    app.terminate(); app.launch()
    XCTAssertTrue(start.waitForExistence(timeout: 30))
    assertTaskMissing(app, title: resetTitle)
    screenshot(app, name: "06-reset-onboarding")
  }
}
