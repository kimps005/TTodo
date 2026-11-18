import Foundation

@main
enum DebugStorageFallbackTests {
  static func main() throws {
    try testMissingAppGroupUsesMainAppApplicationSupport()
    print("PASS testMissingAppGroupUsesMainAppApplicationSupport")
  }

  private static func testMissingAppGroupUsesMainAppApplicationSupport() throws {
    let support = FileManager.default.temporaryDirectory.appendingPathComponent("Application Support", isDirectory: true)
    let location = try SharedStore.resolveLocation(appGroupURL: nil, isMainApplication: true, applicationSupportURL: { support })

    precondition(location.directory == support.appendingPathComponent("TTodo", isDirectory: true))
    precondition(location.usesLocalStorage)
  }
}
