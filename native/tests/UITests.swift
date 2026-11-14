import XCTest

final class TTodoUITests: XCTestCase {
  @MainActor private func reveal(_ element: XCUIElement, in app: XCUIApplication) {
    // Offscreen React Native children may be absent from the accessibility tree.
    // Search by scrolling before requiring existence, with a bounded attempt count.
    let scroll = app.scrollViews.firstMatch
    for searchDown in [false, true] {
      for _ in 0..<16 {
        if element.waitForExistence(timeout: 1) {
          if element.isHittable { return }
          if element.frame.midY < scroll.frame.minY { scroll.swipeDown() }
          else { scroll.swipeUp() }
        } else if searchDown { scroll.swipeDown() }
        else { scroll.swipeUp() }
      }
    }
    XCTAssertTrue(element.exists)
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
    screenshot(app, name: "05-keyboard-submit")
    let resetRow = row(app, title: resetTitle)
    XCTAssertTrue(resetRow.waitForExistence(timeout: 15))
    XCTAssertEqual(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", resetTitle + ", ")).count, 1)
    input.tap(); input.typeText("CI unsaved private draft")
    tap(control(app, label: "설정"), in: app)
    XCTAssertTrue(app.staticTexts["내 방식으로"].waitForExistence(timeout: 15), "The Settings tab must remain reachable with unsaved keyboard input.")
    screenshot(app, name: "06-settings-before-reset")
    tap(app.buttons["모든 데이터 삭제"], in: app)
    tap(app.alerts.buttons["모두 삭제"], in: app)
    tap(control(app, label: "할 일"), in: app)
    XCTAssertTrue(start.waitForExistence(timeout: 20), "Reset must also clear onboarding preferences.")
    reveal(input, in: app)
    let resetInputValue = input.value as? String ?? ""
    XCTAssertTrue(resetInputValue.isEmpty || resetInputValue == input.placeholderValue, "Reset must clear unsaved manual input as well as stored tasks.")
    assertTaskMissing(app, title: resetTitle)
    app.terminate(); app.launch()
    XCTAssertTrue(start.waitForExistence(timeout: 30))
    assertTaskMissing(app, title: resetTitle)
    screenshot(app, name: "06-reset-onboarding")
    tap(start, in: app)
    XCTAssertTrue(app.staticTexts["머릿속을 조금 비워 보세요"].waitForExistence(timeout: 15), "The empty list must be visible after reset, not just hidden behind onboarding.")
    XCTAssertFalse(row(app, title: resetTitle).exists)
    assertTaskMissing(app, title: resetTitle)
    assertTaskMissing(app, title: "CI unsaved private draft")
    screenshot(app, name: "07-reset-empty-list")
  }

  @MainActor func testLargeTextInputEditingAndNavigation() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchArguments = ["-AppleLanguages", "(ko)", "-AppleLocale", "ko_KR"]
    app.launch()
    XCTAssertTrue(app.scrollViews.firstMatch.waitForExistence(timeout: 30))
    screenshot(app, name: "large-01-onboarding-top")
    tap(app.buttons["이 설정으로 시작하기"], in: app)
    let input = app.textFields["새 할 일"]
    tap(input, in: app); input.typeText("CI large text task\n")
    let stored = row(app, title: "CI large text task")
    reveal(stored, in: app)
    screenshot(app, name: "large-02-saved-task")
    tap(stored, in: app)
    let title = app.textViews["할 일 제목"]
    reveal(title, in: app)
    XCTAssertEqual((title.value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines), "CI large text task")
    screenshot(app, name: "large-03-editor")
    tap(app.buttons["닫기"], in: app)
    tap(input, in: app); input.typeText("CI large unsaved draft")
    screenshot(app, name: "large-04-keyboard-tabs")
    tap(control(app, label: "설정"), in: app)
    reveal(control(app, label: "내 방식으로"), in: app)
    screenshot(app, name: "large-05-settings")
    tap(control(app, label: "할 일"), in: app)
    reveal(input, in: app)
    XCTAssertEqual(input.value as? String, "CI large unsaved draft")
    screenshot(app, name: "large-06-preserved-draft")
  }

  @MainActor func testPhotoOCRAndCancelPreservesDraft() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchArguments = ["-AppleLanguages", "(ko)", "-AppleLocale", "ko_KR"]
    app.launch()
    XCTAssertTrue(app.scrollViews.firstMatch.waitForExistence(timeout: 30))
    tap(app.buttons["이 설정으로 시작하기"], in: app)
    tap(control(app, label: "분석함"), in: app)
    tap(app.buttons["캡처에서 할 일 찾기"], in: app)
    tap(app.buttons["사진에서 선택"], in: app)
    // iOS 26 Photos exposes thumbnails as Images, not collection-view Cells.
    // The imported PNG is newest; the simulator also includes Apple sample photos.
    // Verify its actual OCR below rather than assuming the library has one item.
    let photo = app.images.matching(identifier: "PXGGridLayout-Info").firstMatch
    XCTAssertTrue(photo.waitForExistence(timeout: 30), "The real system picker must expose a photo thumbnail.")
    screenshot(app, name: "photo-01-system-picker")
    // Photos exposes this visible thumbnail as a non-hittable Image on iOS 26.
    // Tap its own center; subsequent real OCR verifies the selected fixture.
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    let text = app.textViews["인식된 글자"]
    XCTAssertTrue(text.waitForExistence(timeout: 30))
    let recognized = try XCTUnwrap(text.value as? String)
    let normalized = String(recognized.precomposedStringWithCompatibilityMapping.filter { $0.isLetter || $0.isNumber })
    XCTAssertTrue(normalized.contains("2026년11월20일까지보고서제출"), "Real iOS Vision OCR must recognize the generated Korean image.")
    screenshot(app, name: "photo-02-real-ocr")
    tap(text, in: app); text.typeText(" CI edited OCR")
    let editedText = try XCTUnwrap(text.value as? String)
    XCTAssertTrue(editedText.contains("CI edited OCR"))
    let date = app.textFields["원문 메시지 기준 날짜 YYYY-MM-DD"]
    tap(date, in: app); date.typeText("2026-11-14")
    tap(app.buttons["사진에서 선택"], in: app)
    let cancel = app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "취소", "Cancel")).firstMatch
    XCTAssertTrue(cancel.waitForExistence(timeout: 20)); cancel.tap()
    reveal(text, in: app)
    XCTAssertEqual(text.value as? String, editedText, "Cancelling selection must preserve the user's OCR edits.")
    reveal(date, in: app)
    XCTAssertEqual(date.value as? String, "2026-11-14")
    screenshot(app, name: "photo-03-cancel-preserves-draft")
    tap(app.buttons["닫기"], in: app)
    app.terminate(); app.launch()
    XCTAssertTrue(app.scrollViews.firstMatch.waitForExistence(timeout: 30))
    tap(control(app, label: "분석함"), in: app)
    XCTAssertTrue(app.staticTexts["아직 분석 내역이 없어요"].waitForExistence(timeout: 15))
    tap(control(app, label: "할 일"), in: app)
    XCTAssertTrue(app.staticTexts["머릿속을 조금 비워 보세요"].waitForExistence(timeout: 15))
    screenshot(app, name: "photo-04-no-unapproved-data")
  }

  @MainActor func testShareExtensionRequiresConsent() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchArguments = ["-AppleLanguages", "(ko)", "-AppleLocale", "ko_KR"]
    app.launch()
    XCTAssertTrue(app.scrollViews.firstMatch.waitForExistence(timeout: 30))
    tap(app.buttons["이 설정으로 시작하기"], in: app)
    let input = app.textFields["새 할 일"]
    tap(input, in: app); input.typeText("CI task before sharing\n")
    XCTAssertTrue(row(app, title: "CI task before sharing").waitForExistence(timeout: 15))
    // XCTest installs the dependency app by its bundle ID. The production app
    // never embeds this host or a synthetic model/OCR response.
    let host = XCUIApplication(bundleIdentifier: "com.kimps005.ttodo.cisharehost")
    host.launchArguments = app.launchArguments
    host.launch()
    XCTAssertTrue(host.buttons["ci-share-image"].waitForExistence(timeout: 30))
    host.buttons["ci-share-image"].tap()
    screenshot(host, name: "share-01-system-sheet")
    // The installed system share sheet uses the containing app's display name.
    let activity = host.cells.matching(NSPredicate(format: "label == %@ OR label == %@", "TTodo", "TTodo로 할 일 찾기")).firstMatch
    if !activity.waitForExistence(timeout: 5) {
      let more = host.descendants(matching: .any).matching(NSPredicate(format: "label == %@ OR label == %@", "더 보기", "More")).firstMatch
      XCTAssertTrue(more.waitForExistence(timeout: 15))
      more.tap()
    }
    XCTAssertTrue(activity.waitForExistence(timeout: 15))
    screenshot(host, name: "share-01-ready-system-sheet")
    activity.tap()
    XCTAssertTrue(host.staticTexts["캡처 속 할 일"].waitForExistence(timeout: 30))
    screenshot(host, name: "share-02-extension-open")
    host.buttons["기기에서 분석"].tap()
    XCTAssertTrue(host.staticTexts["먼저 TTodo 앱에서 기기 내 AI 분석에 동의해 주세요."].waitForExistence(timeout: 20))
    screenshot(host, name: "share-03-consent-required")
    host.buttons["닫기"].tap()
    app.activate()
    XCTAssertTrue(row(app, title: "CI task before sharing").waitForExistence(timeout: 20))
    XCTAssertEqual(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "CI task before sharing, ")).count, 1)
    app.terminate()
    app.launch()
    XCTAssertTrue(app.scrollViews.firstMatch.waitForExistence(timeout: 30))
    XCTAssertTrue(row(app, title: "CI task before sharing").waitForExistence(timeout: 20))
    tap(control(app, label: "분석함"), in: app)
    XCTAssertTrue(app.staticTexts["아직 분석 내역이 없어요"].waitForExistence(timeout: 15), "Consent denial must not create a pending analysis or task.")
    screenshot(app, name: "share-04-no-analysis-created")
  }
}
