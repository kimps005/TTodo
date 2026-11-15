import XCTest

final class NotificationSettingsProbeTests: XCTestCase {
  @MainActor private func capture(_ app: XCUIApplication, name: String) {
    let tree = XCTAttachment(string: app.debugDescription)
    tree.name = name + "-tree"; tree.lifetime = .keepAlways; add(tree)
    let screen = XCTAttachment(screenshot: app.screenshot())
    screen.name = name + "-screen"; screen.lifetime = .keepAlways; add(screen)
  }
  @MainActor func testDeniedNotificationSettingsColdAndWarm() throws {
    continueAfterFailure = false
    let app = XCUIApplication()
    app.launch()
    XCTAssertTrue(app.staticTexts["probe-status"].waitForExistence(timeout: 20))
    XCTAssertEqual(app.staticTexts["probe-status"].label, "authorization=0 opened=unset")
    app.buttons["probe-request"].tap()
    let alert = XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts.firstMatch
    XCTAssertTrue(alert.waitForExistence(timeout: 20))
    capture(XCUIApplication(bundleIdentifier: "com.apple.springboard"), name: "probe-permission")
    let deny = alert.buttons.matching(NSPredicate(format: "label == %@ OR label == %@ OR label == %@", "허용 안 함", "Don't Allow", "Don’t Allow")).firstMatch
    XCTAssertTrue(deny.exists); deny.tap()
    let denied = NSPredicate(format: "label == %@", "authorization=1 opened=unset")
    expectation(for: denied, evaluatedWith: app.staticTexts["probe-status"])
    waitForExpectations(timeout: 15)
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    var arrivals: [Bool] = []
    // Capture both attempts before asserting: a cold Settings launch and an
    // already-running Settings process isolate initialization from integration.
    for phase in ["cold", "warm"] {
      app.buttons["probe-open"].tap()
      XCTAssertTrue(settings.wait(for: .runningForeground, timeout: 30))
      let toggle = settings.switches.matching(NSPredicate(format: "label == %@ OR label == %@", "Allow Notifications", "알림 허용")).firstMatch
      let arrived = toggle.waitForExistence(timeout: 30)
        && settings.navigationBars["TTodo Probe"].exists && toggle.value as? String == "0"
      arrivals.append(arrived)
      capture(settings, name: "probe-settings-" + phase)
      app.activate()
      let returned = NSPredicate(format: "label == %@", "authorization=1 opened=true")
      expectation(for: returned, evaluatedWith: app.staticTexts["probe-status"])
      waitForExpectations(timeout: 15)
      capture(app, name: "probe-return-" + phase)
    }
    XCTAssertEqual(arrivals, [true, true], "Both public API attempts must reach this native app's denied notification controls. Root Settings is a failure.")
  }
}
