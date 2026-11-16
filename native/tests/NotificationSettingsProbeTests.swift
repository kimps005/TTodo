import XCTest

final class NotificationSettingsProbeTests: XCTestCase {
  @MainActor private func capture(_ app: XCUIApplication, name: String) {
    let tree = XCTAttachment(string: app.debugDescription)
    tree.name = name + "-tree"; tree.lifetime = .keepAlways; add(tree)
    let screen = XCTAttachment(screenshot: app.screenshot())
    screen.name = name + "-screen"; screen.lifetime = .keepAlways; add(screen)
  }
  @MainActor func testSettingsListBeforeAndAfterDenial() throws {
    continueAfterFailure = false
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    func scan(_ phase: String) throws -> Bool {
      let list = settings.collectionViews.firstMatch
      XCTAssertTrue(list.waitForExistence(timeout: 20))
      // The second scan reuses Settings without resetting its process. Return
      // its real root list to the top before examining the visible rows.
      for _ in 0..<3 { list.swipeDown() }
      var previous: [String] = []
      var screens: [[String]] = []
      var found = false
      for index in 0..<5 {
        let buttons = settings.buttons.allElementsBoundByIndex
        let labels = buttons.map { $0.identifier + "|" + $0.label }
        screens.append(labels)
        capture(settings, name: "settings-list-\(phase)-\(index)")
        let notifications = settings.buttons.matching(NSPredicate(format: "identifier == %@ OR label == %@ OR label == %@", "com.apple.settings.notifications", "Notifications", "알림")).firstMatch
        if notifications.exists && notifications.isHittable {
          found = true
          notifications.tap()
          capture(settings, name: "settings-list-\(phase)-notifications")
          let back = settings.navigationBars.buttons.firstMatch
          if back.exists && back.isHittable { back.tap() }
          break
        }
        if index > 0 && previous == labels { break }
        previous = labels
        settings.swipeUp()
      }
      let data = try JSONSerialization.data(withJSONObject: ["phase": phase, "notifications_visible": found, "screens": screens], options: [.prettyPrinted, .sortedKeys])
      let result = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
      result.name = "settings-list-\(phase)-result"; result.lifetime = .keepAlways; add(result)
      return found
    }
    // Launch Settings directly through XCTest, with no app-generated URL.
    settings.activate()
    XCTAssertTrue(settings.wait(for: .runningForeground, timeout: 30))
    let before = try scan("before-permission")
    let app = XCUIApplication(); app.launch()
    XCTAssertTrue(app.buttons["probe-request"].waitForExistence(timeout: 20))
    app.buttons["probe-request"].tap()
    let alert = XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts.firstMatch
    XCTAssertTrue(alert.waitForExistence(timeout: 20))
    let deny = alert.buttons.matching(NSPredicate(format: "label == %@ OR label == %@ OR label == %@", "허용 안 함", "Don't Allow", "Don’t Allow")).firstMatch
    XCTAssertTrue(deny.exists); deny.tap()
    expectation(for: NSPredicate(format: "label == %@", "authorization=1 opened=unset"), evaluatedWith: app.staticTexts["probe-status"])
    waitForExpectations(timeout: 15)
    capture(app, name: "settings-list-denied-without-url")
    settings.activate()
    XCTAssertTrue(settings.wait(for: .runningForeground, timeout: 30))
    let after = try scan("after-denial")
    XCTAssertTrue(before && after, "The system Notifications entry must be manually reachable before and after denial; absence is an environment failure, not a successful deep link.")
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
