const fs = require('node:fs');
const path = require('node:path');
const xcode = require('xcode');

// CI-only generated target. Production prebuilds never invoke this script.
function configureUITests(project, ios, root) {
  const app = project.getFirstTarget();
  const appName = app.firstTarget.name.replaceAll('"', '');
  const targets = project.pbxNativeTargetSection();
  const objects = project.hash.project.objects;
  objects.PBXTargetDependency ??= {};
  objects.PBXContainerItemProxy ??= {};
  const name = 'TTodoUITests';
  let id = Object.keys(targets).find(key => targets[key]?.name?.replaceAll('"', '') === name);
  if (!id) {
    const dependencies = [...app.firstTarget.dependencies];
    // The installed xcode library scaffolds test bundles but predates the UI
    // product type. Set the actual UI type and dependency direction explicitly.
    id = project.addTarget(name, 'unit_test_bundle', name, 'com.kimps005.ttodo.uitests').uuid;
    for (const item of app.firstTarget.dependencies.slice(dependencies.length)) {
      const proxy = objects.PBXTargetDependency[item.value]?.targetProxy;
      delete objects.PBXTargetDependency[item.value]; delete objects.PBXTargetDependency[`${item.value}_comment`];
      if (proxy) { delete objects.PBXContainerItemProxy[proxy]; delete objects.PBXContainerItemProxy[`${proxy}_comment`]; }
    }
    app.firstTarget.dependencies = dependencies;
    targets[id].productType = '"com.apple.product-type.bundle.ui-testing"';
    project.addTargetDependency(id, [app.uuid]);
    for (const [type, label] of [['PBXSourcesBuildPhase', 'Sources'], ['PBXFrameworksBuildPhase', 'Frameworks'], ['PBXResourcesBuildPhase', 'Resources']]) project.addBuildPhase([], type, label, id);
  }
  const target = targets[id];
  const product = project.pbxFileReferenceSection()[target.productReference];
  product.path = `${name}.xctest`;
  product.explicitFileType = '"wrapper.cfbundle"';
  let group = project.findPBXGroupKey({ name });
  if (!group) {
    group = project.addPbxGroup([], name, '.').uuid;
    project.addToPbxGroup(group, project.getFirstProject().firstProject.mainGroup);
  }
  fs.mkdirSync(path.join(ios, name), { recursive: true });
  fs.copyFileSync(path.join(root, 'native/tests/UITests.swift'), path.join(ios, name, 'UITests.swift'));
  project.addSourceFile(`${name}/UITests.swift`, { target: id }, group);
  const list = project.pbxXCConfigurationList()[target.buildConfigurationList];
  for (const ref of list.buildConfigurations) {
    const settings = project.pbxXCBuildConfigurationSection()[ref.value].buildSettings;
    delete settings.INFOPLIST_FILE;
    Object.assign(settings, {
      IPHONEOS_DEPLOYMENT_TARGET: '18.0', SWIFT_VERSION: '5.9', TARGETED_DEVICE_FAMILY: '1', SDKROOT: 'iphoneos',
      GENERATE_INFOPLIST_FILE: 'YES', CODE_SIGN_STYLE: 'Automatic', TEST_TARGET_NAME: appName,
      PRODUCT_BUNDLE_IDENTIFIER: 'com.kimps005.ttodo.uitests', SKIP_INSTALL: 'YES',
      LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @loader_path/Frameworks"',
    });
  }
  project.addTargetAttribute('TestTargetID', app.uuid, { uuid: id });
  const reference = (uuid, buildable, targetName) => `<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${uuid}" BuildableName="${buildable}" BlueprintName="${targetName}" ReferencedContainer="container:${appName}.xcodeproj"/>`;
  const appReference = reference(app.uuid, `${appName}.app`, appName);
  const testReference = reference(id, `${name}.xctest`, name);
  const schemeDir = path.join(ios, `${appName}.xcodeproj/xcshareddata/xcschemes`);
  fs.mkdirSync(schemeDir, { recursive: true });
  fs.writeFileSync(path.join(schemeDir, `${name}.xcscheme`), `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.7">
  <BuildAction parallelizeBuildables="NO" buildImplicitDependencies="YES"><BuildActionEntries>
    <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">${appReference}</BuildActionEntry>
    <BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">${testReference}</BuildActionEntry>
  </BuildActionEntries></BuildAction>
  <TestAction buildConfiguration="Release" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES">
    <Testables><TestableReference skipped="NO" parallelizable="NO">${testReference}</TestableReference></Testables><MacroExpansion>${appReference}</MacroExpansion>
  </TestAction>
  <LaunchAction buildConfiguration="Release" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">${appReference}</BuildableProductRunnable></LaunchAction>
  <AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="NO"/>
</Scheme>
`);
  return id;
}

if (require.main === module) {
  const projectPath = path.resolve('ios/TTodo.xcodeproj/project.pbxproj');
  const project = xcode.project(projectPath); project.parseSync();
  configureUITests(project, path.resolve('ios'), process.cwd());
  fs.writeFileSync(projectPath, project.writeSync());
}
module.exports = { configureUITests };
