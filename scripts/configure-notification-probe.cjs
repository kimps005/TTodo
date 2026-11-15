const fs = require('node:fs');
const path = require('node:path');

// A standalone, dependency-free Xcode project. Never modifies the product project.
function configureNotificationProbe(destination) {
  fs.mkdirSync(path.join(destination, 'Probe.xcodeproj/xcshareddata/xcschemes'), { recursive: true });
  for (const file of ['NotificationSettingsProbe.swift', 'NotificationSettingsProbeTests.swift']) {
    fs.copyFileSync(path.resolve('native/tests', file), path.join(destination, file));
  }
  const config = (id, settings) => `${id} = {isa = XCBuildConfiguration; buildSettings = {${settings}}; name = Release; };`;
  const reference = (id, name, product) => `<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${id}" BuildableName="${product}" BlueprintName="${name}" ReferencedContainer="container:Probe.xcodeproj"/>`;
  const app = 'A00000000000000000000001', test = 'A00000000000000000000002';
  const appRef = reference(app, 'Probe', 'Probe.app'), testRef = reference(test, 'ProbeTests', 'ProbeTests.xctest');
  fs.writeFileSync(path.join(destination, 'Probe.xcodeproj/project.pbxproj'), `// !$*UTF8*$!
{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {
A00000000000000000000000 = {isa = PBXProject; buildConfigurationList = C00000000000000000000000; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; knownRegions = (en, Base,); mainGroup = B00000000000000000000000; productRefGroup = B00000000000000000000001; projectDirPath = ""; projectRoot = ""; targets = (${app}, ${test},); attributes = {TargetAttributes = {${test} = {TestTargetID = ${app}; }; }; }; };
B00000000000000000000000 = {isa = PBXGroup; children = (B00000000000000000000002, B00000000000000000000003, B00000000000000000000001,); sourceTree = "<group>"; };
B00000000000000000000001 = {isa = PBXGroup; name = Products; children = (B00000000000000000000004, B00000000000000000000005,); sourceTree = "<group>"; };
B00000000000000000000002 = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = NotificationSettingsProbe.swift; sourceTree = "<group>"; };
B00000000000000000000003 = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = NotificationSettingsProbeTests.swift; sourceTree = "<group>"; };
B00000000000000000000004 = {isa = PBXFileReference; explicitFileType = wrapper.application; path = Probe.app; sourceTree = BUILT_PRODUCTS_DIR; };
B00000000000000000000005 = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; path = ProbeTests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
${app} = {isa = PBXNativeTarget; buildConfigurationList = C00000000000000000000001; buildPhases = (D00000000000000000000001, D00000000000000000000003,); buildRules = (); dependencies = (); name = Probe; productName = Probe; productReference = B00000000000000000000004; productType = "com.apple.product-type.application"; };
${test} = {isa = PBXNativeTarget; buildConfigurationList = C00000000000000000000002; buildPhases = (D00000000000000000000002, D00000000000000000000004,); buildRules = (); dependencies = (E00000000000000000000001,); name = ProbeTests; productName = ProbeTests; productReference = B00000000000000000000005; productType = "com.apple.product-type.bundle.ui-testing"; };
D00000000000000000000001 = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (F00000000000000000000001,); runOnlyForDeploymentPostprocessing = 0; };
D00000000000000000000002 = {isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (F00000000000000000000002,); runOnlyForDeploymentPostprocessing = 0; };
D00000000000000000000003 = {isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; };
D00000000000000000000004 = {isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0; };
F00000000000000000000001 = {isa = PBXBuildFile; fileRef = B00000000000000000000002; };
F00000000000000000000002 = {isa = PBXBuildFile; fileRef = B00000000000000000000003; };
E00000000000000000000001 = {isa = PBXTargetDependency; target = ${app}; targetProxy = E00000000000000000000002; };
E00000000000000000000002 = {isa = PBXContainerItemProxy; containerPortal = A00000000000000000000000; proxyType = 1; remoteGlobalIDString = ${app}; remoteInfo = Probe; };
C00000000000000000000000 = {isa = XCConfigurationList; buildConfigurations = (C10000000000000000000000,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; };
C00000000000000000000001 = {isa = XCConfigurationList; buildConfigurations = (C10000000000000000000001,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; };
C00000000000000000000002 = {isa = XCConfigurationList; buildConfigurations = (C10000000000000000000002,); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release; };
${config('C10000000000000000000000', 'SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 18.0; SWIFT_VERSION = 5.9; CLANG_ENABLE_MODULES = YES; SWIFT_OPTIMIZATION_LEVEL = "-O";')}
${config('C10000000000000000000001', 'PRODUCT_NAME = "$(TARGET_NAME)"; PRODUCT_BUNDLE_IDENTIFIER = com.kimps005.ttodo.notificationprobe; TARGETED_DEVICE_FAMILY = 1; GENERATE_INFOPLIST_FILE = YES; INFOPLIST_KEY_CFBundleDisplayName = "TTodo Probe"; INFOPLIST_KEY_UILaunchScreen_Generation = YES; CODE_SIGN_STYLE = Automatic; MARKETING_VERSION = 1.0; CURRENT_PROJECT_VERSION = 1;')}
${config('C10000000000000000000002', 'PRODUCT_NAME = "$(TARGET_NAME)"; PRODUCT_BUNDLE_IDENTIFIER = com.kimps005.ttodo.notificationprobe.tests; TARGETED_DEVICE_FAMILY = 1; GENERATE_INFOPLIST_FILE = YES; TEST_TARGET_NAME = Probe; CODE_SIGN_STYLE = Automatic; SKIP_INSTALL = YES; LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";')}
}; rootObject = A00000000000000000000000; }
`);
  fs.writeFileSync(path.join(destination, 'Probe.xcodeproj/xcshareddata/xcschemes/ProbeTests.xcscheme'), `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.7">
<BuildAction parallelizeBuildables="NO" buildImplicitDependencies="YES"><BuildActionEntries>
<BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">${appRef}</BuildActionEntry>
<BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">${testRef}</BuildActionEntry>
</BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Release" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO" parallelizable="NO">${testRef}</TestableReference></Testables><MacroExpansion>${appRef}</MacroExpansion></TestAction>
</Scheme>`);
}
if (require.main === module) configureNotificationProbe(path.resolve('artifacts/notification-probe/project'));
module.exports = { configureNotificationProbe };
