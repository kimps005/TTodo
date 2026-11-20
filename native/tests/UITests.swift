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
        }
        // React Native AX frames can retain their unscrolled positions. Sweep
        // both directions instead of using those frames to choose a direction.
        if searchDown { scroll.swipeDown() }
        else { scroll.swipeUp() }
      }
    }
    let screen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    screen.name = "unreachable-control-screen"; screen.lifetime = .keepAlways; add(screen)
    let tree = XCTAttachment(string: "App state: \(app.state.rawValue)\nTarget: \(element.debugDescription)\n\(app.debugDescription)")
    tree.name = "unreachable-control-tree"; tree.lifetime = .keepAlways; add(tree)
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
  @MainActor func testDataResetAndConsentWithoutSettingsNavigation() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchArguments = ["-AppleLanguages", "(ko)", "-AppleLocale", "ko_KR"]
    app.launch()
    let start = app.buttons["이 설정으로 시작하기"]
    XCTAssertTrue(start.waitForExistence(timeout: 30))
    tap(start, in: app)
    let input = app.textViews["quick-todo-input"]
    XCTAssertTrue(input.waitForExistence(timeout: 15))
    let taskTitle = "CI independent reset task"
    input.tap(); input.typeText(taskTitle + "\n")
    let saved = row(app, title: taskTitle)
    XCTAssertTrue(saved.waitForExistence(timeout: 15))
    tap(control(app, label: "설정"), in: app)
    tap(app.buttons["기기 내 AI 분석 켜기"], in: app)
    tap(app.alerts.buttons["취소"], in: app)
    XCTAssertTrue(app.buttons["기기 내 AI 분석 켜기"].exists, "Cancelling consent must not enable analysis.")
    tap(app.buttons["기기 내 AI 분석 켜기"], in: app)
    tap(app.alerts.buttons["동의하고 켜기"], in: app)
    let stopAI = app.buttons["AI 중지 및 원문 근거 삭제"]
    expectation(for: NSPredicate(format: "enabled == true"), evaluatedWith: stopAI)
    waitForExpectations(timeout: 15)
    app.terminate(); app.launch()
    tap(control(app, label: "설정"), in: app)
    reveal(stopAI, in: app)
    XCTAssertTrue(stopAI.isEnabled, "Consent must survive relaunch until reset.")
    tap(app.buttons["모든 데이터 삭제"], in: app)
    tap(app.alerts.buttons["취소"], in: app)
    tap(control(app, label: "할 일"), in: app)
    reveal(saved, in: app)
    XCTAssertFalse(start.exists, "Cancelling reset must preserve onboarding.")
    app.terminate(); app.launch()
    XCTAssertTrue(saved.waitForExistence(timeout: 30), "Cancelling reset must preserve the stored task after relaunch.")
    input.tap(); input.typeText("CI unsaved reset draft")
    tap(control(app, label: "설정"), in: app)
    reveal(stopAI, in: app)
    XCTAssertTrue(stopAI.isEnabled, "Cancelling reset must preserve consent.")
    tap(app.buttons["모든 데이터 삭제"], in: app)
    tap(app.alerts.buttons["모두 삭제"], in: app)
    tap(control(app, label: "할 일"), in: app)
    XCTAssertTrue(start.waitForExistence(timeout: 20))
    reveal(input, in: app)
    let value = input.value as? String ?? ""
    XCTAssertTrue(value.isEmpty || value == input.placeholderValue, "Reset must clear the unsaved draft.")
    assertTaskMissing(app, title: taskTitle)
    screenshot(app, name: "reset-independent-cleared")
    app.terminate(); app.launch()
    XCTAssertTrue(start.waitForExistence(timeout: 30))
    assertTaskMissing(app, title: taskTitle)
    tap(start, in: app)
    XCTAssertTrue(app.staticTexts["머릿속을 조금 비워 보세요"].waitForExistence(timeout: 15))
    tap(control(app, label: "분석함"), in: app)
    XCTAssertTrue(app.staticTexts["아직 분석 내역이 없어요"].waitForExistence(timeout: 15))
    tap(control(app, label: "설정"), in: app)
    reveal(stopAI, in: app)
    XCTAssertFalse(stopAI.isEnabled, "Reset must revoke persisted AI consent.")
    XCTAssertTrue(app.buttons["기기 내 AI 분석 켜기"].exists)
    screenshot(app, name: "reset-independent-consent-off")
  }
  // Both tests share the same CRUD assertions; the helper never opens Settings.
  @MainActor private func verifyManualTaskLifecycle(_ app: XCUIApplication) throws {
    let input = app.textViews["quick-todo-input"]
    XCTAssertTrue(input.waitForExistence(timeout: 15))
    input.tap(); input.typeText("CI manual task")
    tap(app.buttons["할 일 추가"], in: app)
    let original = app.buttons["CI manual task, 마감 없음, 상세 편집"]
    XCTAssertTrue(original.waitForExistence(timeout: 15))
    app.terminate(); app.launch()
    let survived = original.waitForExistence(timeout: 30)
    if !survived {
      screenshot(app, name: "relaunch-missing-task-screen")
      let tree = XCTAttachment(string: "App state: \(app.state.rawValue)\n\(app.debugDescription)")
      tree.name = "relaunch-missing-task-tree"; tree.lifetime = .keepAlways; add(tree)
    }
    XCTAssertTrue(survived, "The task must survive a real process relaunch.")
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
    XCTAssertTrue(edited.label.contains("2026년 12월 1일"), "The list must identify the deadline year.")
    tap(control(app, label: editedTitle + " 완료하기"), in: app)
    let restore = control(app, label: editedTitle + " 미완료로 되돌리기")
    XCTAssertTrue(restore.waitForExistence(timeout: 15))
    app.terminate(); app.launch()
    reveal(restore, in: app)
    reveal(edited, in: app)
    XCTAssertTrue(edited.label.contains("완료됨"))
    XCTAssertTrue(edited.label.contains("2026년 12월 1일"), "Completing a task must preserve its deadline in the list.")
    screenshot(app, name: "04-completed-task")
    tap(edited, in: app)
    XCTAssertTrue(control(app, label: "할 일 상태: 완료").waitForExistence(timeout: 15))
    screenshot(app, name: "04-completed-task-detail")
    tap(app.buttons["닫기"], in: app)
    tap(restore, in: app)
    XCTAssertTrue(edited.waitForExistence(timeout: 15))
    app.terminate(); app.launch()
    XCTAssertTrue(edited.waitForExistence(timeout: 30))
    tap(edited, in: app)
    XCTAssertTrue(control(app, label: "할 일 상태: 미완료").waitForExistence(timeout: 15))
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
  }

  @MainActor func testManualTaskLifecycleWithoutSettingsNavigation() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchEnvironment["TTODO_CI_STARTUP_DIAGNOSTICS"] = "1"
    app.launchArguments = ["-AppleLanguages", "(ko)", "-AppleLocale", "ko_KR"]
    app.launch()
    let start = app.buttons["이 설정으로 시작하기"]
    XCTAssertTrue(start.waitForExistence(timeout: 30))
    tap(start, in: app)
    try verifyManualTaskLifecycle(app)
    // The Add button is covered above; also check Done and persistence.
    let input = app.textViews["quick-todo-input"]
    input.tap(); input.typeText("CI independent keyboard task\n")
    let saved = row(app, title: "CI independent keyboard task")
    XCTAssertTrue(saved.waitForExistence(timeout: 15))
    XCTAssertEqual(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "CI independent keyboard task, ")).count, 1)
    app.terminate(); app.launch()
    XCTAssertTrue(saved.waitForExistence(timeout: 30))
    XCTAssertEqual(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "CI independent keyboard task, ")).count, 1)
    screenshot(app, name: "crud-independent-keyboard-persisted")
    tap(control(app, label: "설정"), in: app)
    tap(app.buttons["내 데이터 내보내기"], in: app)
    let sheet = app.otherElements["ActivityListView"]
    let filename = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", "TTodo-export")).firstMatch
    XCTAssertTrue(sheet.waitForExistence(timeout: 5) || filename.waitForExistence(timeout: 15))
    // Interrupt sharing before cleanup so the host can inspect the actual Expo file.
    app.terminate()
  }

  @MainActor func testManualTaskLifecycleAndDataReset() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchArguments = ["-AppleLanguages", "(ko)", "-AppleLocale", "ko_KR"]
    app.launchEnvironment["TTODO_CI_NOTIFICATION_DIAGNOSTICS"] = "1"
    app.launch()
    let start = app.buttons["이 설정으로 시작하기"]
    XCTAssertTrue(start.waitForExistence(timeout: 30), "A fresh CI simulator must show onboarding.")
    screenshot(app, name: "01-onboarding")
    tap(start, in: app)
    try verifyManualTaskLifecycle(app)
    let input = app.textViews["quick-todo-input"]
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
    // Exercise the real OS permission prompt in this fresh CI simulator.
    // No consent/permission values are injected into the app or its database.
    let notRequested = control(app, label: "권한: 아직 요청하지 않음")
    reveal(notRequested, in: app)
    tap(app.buttons["알림 권한 요청"], in: app)
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let permissionAlert = springboard.alerts.firstMatch
    let permissionAppeared = permissionAlert.waitForExistence(timeout: 20)
    let permissionScreen = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    permissionScreen.name = "06-notification-request"; permissionScreen.lifetime = .keepAlways; add(permissionScreen)
    let permissionTree = XCTAttachment(string: springboard.debugDescription)
    permissionTree.name = "notification-permission-tree"; permissionTree.lifetime = .keepAlways; add(permissionTree)
    XCTAssertTrue(permissionAppeared, "The real system notification authorization prompt must appear.")
    XCTAssertTrue(permissionAlert.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "TTodo")).firstMatch.exists)
    let deny = permissionAlert.buttons.matching(NSPredicate(format: "label == %@ OR label == %@ OR label == %@", "허용 안 함", "Don't Allow", "Don’t Allow")).firstMatch
    XCTAssertTrue(deny.waitForExistence(timeout: 10)); deny.tap()
    app.activate()
    let denied = control(app, label: "권한: 허용되지 않음")
    reveal(denied, in: app)
    XCTAssertFalse(app.buttons["알림 권한 요청"].exists, "Denied notification permission must lead to system settings, not another prompt.")
    screenshot(app, name: "06-notification-denied")
    tap(app.buttons["알림 설정 열기"], in: app)
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    XCTAssertTrue(settings.wait(for: .runningForeground, timeout: 20))
    let notificationToggle = settings.switches.matching(NSPredicate(format: "label == %@ OR label == %@", "Allow Notifications", "알림 허용")).firstMatch
    let notificationPageOpened = notificationToggle.waitForExistence(timeout: 20)
    screenshot(settings, name: "06-notification-settings-result")
    let settingsTree = XCTAttachment(string: settings.debugDescription)
    settingsTree.name = "notification-settings-tree"; settingsTree.lifetime = .keepAlways; add(settingsTree)
    #if targetEnvironment(simulator)
    // This CI environment hides Notifications. Verify the explicit fallback and
    // recovery guidance; this is not evidence of reaching notification controls.
    let fallbackPageOpened = settings.navigationBars["TTodo"].exists
    let destination = XCTAttachment(string: "application_page=\(fallbackPageOpened) notification_controls=\(notificationPageOpened)")
    destination.name = "settings-fallback-destination"; destination.lifetime = .keepAlways; add(destination)
    #else
    XCTAssertTrue(settings.navigationBars["TTodo"].exists)
    XCTAssertTrue(notificationPageOpened, "The device must reach notification controls.")
    XCTAssertEqual(notificationToggle.value as? String, "0")
    #endif
    screenshot(settings, name: "06-system-app-settings")
    app.activate()
    reveal(denied, in: app)
    #if targetEnvironment(simulator)
    reveal(control(app, label: "시뮬레이터에서는 알림 설정이 표시되지 않을 수 있어 앱 설정 열기를 요청했어요. 설정 앱에서 앱 → TTodo → 알림을 선택해 주세요. 알림 항목이 없으면 이 환경에서는 변경할 수 없어요."), in: app)
    #endif
    tap(control(app, label: "할 일"), in: app)
    reveal(input, in: app)
    XCTAssertEqual(input.value as? String, "CI unsaved private draft", "Permission denial and settings navigation must preserve the unsaved draft.")
    XCTAssertTrue(resetRow.exists, "Stored tasks must remain available without notification permission.")
    tap(control(app, label: "설정"), in: app)
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
    tap(control(app, label: "설정"), in: app)
    reveal(control(app, label: "권한: 허용되지 않음"), in: app)
    XCTAssertFalse(app.buttons["알림 권한 요청"].exists, "Deleting app data must not pretend the OS permission was reset.")
    screenshot(app, name: "08-denied-permission-after-reset")
  }

  @MainActor func testLargeTextInputEditingAndNavigation() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchEnvironment["TTODO_CI_STARTUP_DIAGNOSTICS"] = "1"
    app.launchArguments = ["-AppleLanguages", "(ko)", "-AppleLocale", "ko_KR"]
    app.launch()
    XCTAssertTrue(app.scrollViews.firstMatch.waitForExistence(timeout: 30))
    screenshot(app, name: "large-01-onboarding-top")
    tap(app.buttons["이 설정으로 시작하기"], in: app)
    let input = app.textViews["quick-todo-input"]
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
    let settingsTitle = control(app, label: "내 방식으로")
    XCTAssertTrue(settingsTitle.waitForExistence(timeout: 15))
    XCTAssertTrue(settingsTitle.isHittable, "Switching tabs must open the new screen at the top instead of inheriting another tab's scroll position.")
    screenshot(app, name: "large-05-settings")
    tap(app.buttons["큰 목록 카드 상태 다시 확인"], in: app)
    let cardStatus = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "카드 상태:")).firstMatch
    reveal(cardStatus, in: app)
    XCTAssertTrue(cardStatus.label.contains("진행 중인 큰 목록 카드가 없어요") || cardStatus.label.contains("iOS에서 실시간 현황이 허용되지 않았어요"), "A fresh install must report the real ActivityKit state, not an unavailable bridge or a fabricated active card.")
    screenshot(app, name: "large-05-card-status")
    tap(control(app, label: "할 일"), in: app)
    screenshot(app, name: "large-06-returned-home")
    reveal(input, in: app)
    XCTAssertEqual(input.value as? String, "CI large unsaved draft")
    screenshot(app, name: "large-06-preserved-draft")
  }

  @MainActor func testPhotoAutoAnalysisAndConsent() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launchEnvironment["TTODO_CI_STARTUP_DIAGNOSTICS"] = "1"
    app.launchArguments = ["-AppleLanguages", "(ko)", "-AppleLocale", "ko_KR"]
    app.launch()
    XCTAssertTrue(app.scrollViews.firstMatch.waitForExistence(timeout: 30))
    tap(app.buttons["이 설정으로 시작하기"], in: app)
    tap(control(app, label: "분석함"), in: app)
    tap(app.buttons["캡처에서 할 일 찾기"], in: app)
    tap(app.buttons["사진에서 선택"], in: app)
    // iOS 26 Photos exposes thumbnails as Images, not collection-view Cells.
    // The imported PNG is newest; the simulator also includes Apple sample photos.
    // The automatic flow reports model availability for a photo with OCR text.
    let photo = app.images.matching(identifier: "PXGGridLayout-Info").firstMatch
    XCTAssertTrue(photo.waitForExistence(timeout: 30), "The real system picker must expose a photo thumbnail.")
    screenshot(app, name: "photo-01-system-picker")
    // Photos exposes this visible thumbnail as a non-hittable Image on iOS 26.
    // Tap its own center to drive the real picker and Vision OCR.
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    let consent = app.buttons["동의하고 분석"]
    XCTAssertTrue(consent.waitForExistence(timeout: 30))
    let status = app.staticTexts["capture-analysis-status"]
    XCTAssertFalse(status.exists, "The analysis must wait for first-time consent.")
    tap(consent, in: app)
    let availabilityMessages = ["기기 내 AI에는 iOS 26 이상이 필요해요.", "Apple Intelligence를 지원하는 iPhone이 필요해요.",
      "설정에서 Apple Intelligence를 켜 주세요.", "기기 내 AI 모델을 준비 중이에요. 다운로드 후 다시 시도해 주세요.",
      "현재 기기 모델이 한국어를 지원하지 않아요.", "현재 기기 내 AI를 사용할 수 없어요."]
    let unavailable = NSPredicate(format: "exists == true AND label IN %@", availabilityMessages as NSArray)
    let firstResult = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: unavailable, object: status)], timeout: 30)
    let message = status.exists ? status.label : "(no status)"
    screenshot(app, name: "photo-02-analysis-status")
    XCTAssertEqual(firstResult, .completed, "OCR and the availability check must start after consent alone. Observed: \(message)")
    XCTAssertFalse(app.textViews["인식된 글자"].exists)
    XCTAssertFalse(app.textFields["원문 메시지 기준 날짜 YYYY-MM-DD"].exists)
    XCTAssertFalse(app.buttons["인식한 글자에서 직접 선택"].exists)
    XCTAssertFalse(app.buttons["기기 내 AI로 할 일 찾기"].exists)
    XCTAssertFalse(app.buttons["저장"].exists)
    tap(app.buttons["사진에서 선택"], in: app)
    let cancel = app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "취소", "Cancel")).firstMatch
    XCTAssertTrue(cancel.waitForExistence(timeout: 20)); cancel.tap()
    XCTAssertTrue(status.waitForExistence(timeout: 15))
    XCTAssertEqual(status.label, message)
    tap(app.buttons["사진에서 선택"], in: app)
    XCTAssertTrue(photo.waitForExistence(timeout: 30))
    photo.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    let repeatResult = XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: unavailable, object: status)], timeout: 30)
    XCTAssertEqual(repeatResult, .completed, "Previously granted consent should start analysis on photo selection alone.")
    XCTAssertEqual(status.label, message)
    XCTAssertFalse(consent.exists)
    screenshot(app, name: "photo-03-no-repeat-consent")
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
    let input = app.textViews["quick-todo-input"]
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
    XCTAssertTrue(host.staticTexts["ttodo-share-review-entry"].waitForExistence(timeout: 15))
    XCTAssertTrue(host.buttons["닫기"].isHittable, "The share sheet must be visible and dismissible before reading the image.")
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
