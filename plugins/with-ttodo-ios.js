const fs = require('node:fs');
const path = require('node:path');
const { withAppDelegate, withEntitlementsPlist, withInfoPlist, withPodfile, withXcodeProject } = require('expo/config-plugins');
const schema = require('../src/data/schema.json');

function swiftConfiguration(group) {
  return `// Generated from app config and src/data/schema.json.\nimport Foundation\nenum TTodoConfiguration {\n  static let appGroup = ${JSON.stringify(group)}\n  static let schemaVersion = ${schema.version}\n  static let schemaSQL = ${JSON.stringify(schema.sql)}\n  static let migrationFromOneSQL = ${JSON.stringify(schema.migration_from_1_before + schema.sql + schema.migration_from_1_after)}\n  static let migrationFromTwoSQL = ${JSON.stringify(schema.migration_from_2)}\n}\n`;
}
function plist(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>${body}</dict></plist>`;
}
function koreanInfoPlist(body) {
  return plist('<key>CFBundleDevelopmentRegion</key><string>ko</string><key>CFBundleLocalizations</key><array><string>ko</string></array>' + body);
}
function withStandaloneDebug(config) {
  config = withPodfile(config, c => {
    const autolink = "  use_expo_modules!(exclude: ['expo-dev-launcher', 'expo-dev-menu'])";
    if (c.modResults.contents.includes(autolink)) return c;
    const expoModules = /^  use_expo_modules![ \t]*$/m;
    if (!expoModules.test(c.modResults.contents)) {
      throw new Error('Cannot configure the standalone Debug Podfile: missing use_expo_modules!.');
    }
    c.modResults.contents = c.modResults.contents.replace(expoModules, autolink);
    return c;
  });
  return withAppDelegate(config, c => {
    // Expo's Debug launcher supplies its own root view before the bundle URL is used.
    // With the launcher excluded, use the same local URL as Release.
    const localBundle = '    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")';
    const standaloneMethod = `  override func bundleURL() -> URL? {\n${localBundle}\n  }`;
    if (c.modResults.contents.includes(standaloneMethod)) return c;
    const expoBundleURL = /  override func bundleURL\(\) -> URL\? \{\r?\n#if DEBUG\r?\n    return RCTBundleURLProvider[^\r\n]*\r?\n#else\r?\n    return Bundle\.main\.url\(forResource: "main", withExtension: "jsbundle"\)\r?\n#endif\r?\n  \}/;
    if (c.modResults.language !== 'swift' || !expoBundleURL.test(c.modResults.contents)) {
      throw new Error('Cannot configure the standalone Debug AppDelegate: unexpected Expo bundleURL implementation.');
    }
    c.modResults.contents = c.modResults.contents.replace(expoBundleURL, standaloneMethod);
    return c;
  });
}
function withTTodo(config) {
  if (process.env.TTODO_STANDALONE_DEBUG === '1') config = withStandaloneDebug(config);
  const bundle = config.ios.bundleIdentifier;
  const appGroup = `group.${bundle}`;
  config = withEntitlementsPlist(config, c => {
    c.modResults['com.apple.security.application-groups'] = [appGroup]; return c;
  });
  config = withInfoPlist(config, c => {
    c.modResults.NSSupportsLiveActivities = true;
    c.modResults.CFBundleDevelopmentRegion = 'ko';
    c.modResults.CFBundleLocalizations = ['ko'];
    return c;
  });
  config = withXcodeProject(config, c => {
    const root = c.modRequest.projectRoot;
    const ios = c.modRequest.platformProjectRoot;
    const project = c.modResults;
    const projectInfo = project.getFirstProject().firstProject;
    projectInfo.developmentRegion = 'ko';
    projectInfo.knownRegions = [...(projectInfo.knownRegions ?? []).filter(region => region.replaceAll('"', '') !== 'ko'), 'ko'];
    const main = project.getFirstTarget().uuid;
    const generated = 'TTodoGenerated';
    const common = ['SharedStore.swift', 'TodoActivity.swift'];
    const captureSources = ['TodoExtractionService.swift', 'VisionOCR.swift', 'ExtractionValidator.swift', 'OnDeviceExtraction.swift', 'CaptureStore.swift', 'CaptureProcessor.swift', 'CaptureNotifications.swift'];
    const intentSources = ['AddTodoIntent.swift', 'AnalyzeCaptureIntent.swift'];
    const copy = (name, source, targetDir) => {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(path.join(source, name), path.join(targetDir, name));
    };
    const coreDir = path.join(root, 'modules/ttodo-native/ios');
    fs.writeFileSync(path.join(coreDir, 'TTodoConfiguration.swift'), swiftConfiguration(appGroup));
    const appDir = path.join(ios, generated);
    fs.mkdirSync(appDir, { recursive: true });
    for (const name of [...common, 'TTodoConfiguration.swift']) copy(name, coreDir, appDir);
    for (const name of intentSources) copy(name, path.join(root, 'native/ios'), appDir);
    let appGroupId = project.findPBXGroupKey({ name: generated });
    if (!appGroupId) {
      appGroupId = project.addPbxGroup([], generated, '.').uuid;
      project.addToPbxGroup(appGroupId, project.getFirstProject().firstProject.mainGroup);
    }
    for (const name of captureSources) {
      const obsolete = `${generated}/${name}`;
      if (project.hasFile(obsolete)) project.removeSourceFile(obsolete, { target: main }, appGroupId);
    }
    for (const name of [...common, 'TTodoConfiguration.swift', ...intentSources]) {
      project.addSourceFile(`${generated}/${name}`, { target: main }, appGroupId);
    }
    project.addFramework('FoundationModels.framework', { target: main, weak: true });
    const targetName = 'TTodoWidgets';
    const widgetDir = path.join(ios, targetName);
    fs.mkdirSync(widgetDir, { recursive: true });
    for (const name of [...common, 'TTodoConfiguration.swift']) copy(name, coreDir, widgetDir);
    copy('TTodoWidgets.swift', path.join(root, 'native/ios'), widgetDir);
    fs.writeFileSync(path.join(widgetDir, `${targetName}-Info.plist`), koreanInfoPlist('<key>CFBundleDisplayName</key><string>TTodo</string><key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundleName</key><string>$(PRODUCT_NAME)</string><key>CFBundlePackageType</key><string>XPC!</string><key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string><key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string><key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict>'));
    fs.writeFileSync(path.join(widgetDir, `${targetName}.entitlements`), plist(`<key>com.apple.security.application-groups</key><array><string>${appGroup}</string></array>`));
    const nativeTargets = project.pbxNativeTargetSection();
    let targetId = Object.keys(nativeTargets).find(key => nativeTargets[key]?.name?.replaceAll('"', '') === targetName);
    const isNew = !targetId;
    if (isNew) targetId = project.addTarget(targetName, 'app_extension', targetName, `${bundle}.widgets`).uuid;
    const target = nativeTargets[targetId];
    if (isNew) {
      project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', targetId);
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', targetId);
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetId);
      const group = project.addPbxGroup([], targetName, '.');
      project.addToPbxGroup(group.uuid, project.getFirstProject().firstProject.mainGroup);
      for (const name of [...common, 'TTodoConfiguration.swift', 'TTodoWidgets.swift']) project.addSourceFile(`${targetName}/${name}`, { target: targetId }, group.uuid);
    }
    const list = project.pbxXCConfigurationList()[target.buildConfigurationList];
    for (const ref of list.buildConfigurations) {
      const settings = project.pbxXCBuildConfigurationSection()[ref.value].buildSettings;
      Object.assign(settings, {
        IPHONEOS_DEPLOYMENT_TARGET: '18.0', SWIFT_VERSION: '5.9', TARGETED_DEVICE_FAMILY: '1',
        CODE_SIGN_ENTITLEMENTS: `${targetName}/${targetName}.entitlements`, CODE_SIGN_STYLE: 'Automatic',
        APPLICATION_EXTENSION_API_ONLY: 'YES', GENERATE_INFOPLIST_FILE: 'NO',
        CURRENT_PROJECT_VERSION: c.ios.buildNumber ?? '1', MARKETING_VERSION: c.version ?? '1.0.0', OTHER_LDFLAGS: ['"$(inherited)"', '"-lsqlite3"'],
      });
    }
    const shareName = 'TTodoShare';
    const shareDir = path.join(ios, shareName);
    const shareSources = [...common, ...captureSources, 'TTodoConfiguration.swift'];
    fs.mkdirSync(shareDir, { recursive: true });
    for (const name of shareSources) copy(name, coreDir, shareDir);
    copy('ShareViewController.swift', path.join(root, 'native/ios'), shareDir);
    fs.writeFileSync(path.join(shareDir, `${shareName}-Info.plist`), koreanInfoPlist('<key>CFBundleDisplayName</key><string>TTodo로 할 일 찾기</string><key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundleName</key><string>$(PRODUCT_NAME)</string><key>CFBundlePackageType</key><string>XPC!</string><key>CFBundleShortVersionString</key><string>$(MARKETING_VERSION)</string><key>CFBundleVersion</key><string>$(CURRENT_PROJECT_VERSION)</string><key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.share-services</string><key>NSExtensionPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).ShareViewController</string><key>NSExtensionAttributes</key><dict><key>NSExtensionActivationRule</key><dict><key>NSExtensionActivationSupportsImageWithMaxCount</key><integer>1</integer></dict></dict></dict>'));
    fs.writeFileSync(path.join(shareDir, `${shareName}.entitlements`), plist(`<key>com.apple.security.application-groups</key><array><string>${appGroup}</string></array>`));
    let shareId = Object.keys(nativeTargets).find(key => nativeTargets[key]?.name?.replaceAll('"', '') === shareName);
    if (!shareId) {
      shareId = project.addTarget(shareName, 'app_extension', shareName, `${bundle}.share`).uuid;
      project.addBuildPhase([], 'PBXSourcesBuildPhase', 'Sources', shareId);
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', shareId);
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', shareId);
    }
    let shareGroup = project.findPBXGroupKey({ name: shareName });
    if (!shareGroup) {
      shareGroup = project.addPbxGroup([], shareName, '.').uuid;
      project.addToPbxGroup(shareGroup, project.getFirstProject().firstProject.mainGroup);
    }
    // Also repair an existing generated target after a plugin source list changes.
    for (const name of [...shareSources, 'ShareViewController.swift']) project.addSourceFile(`${shareName}/${name}`, { target: shareId }, shareGroup);
    const shareList = project.pbxXCConfigurationList()[nativeTargets[shareId].buildConfigurationList];
    for (const ref of shareList.buildConfigurations) {
      Object.assign(project.pbxXCBuildConfigurationSection()[ref.value].buildSettings, {
        IPHONEOS_DEPLOYMENT_TARGET: '18.0', SWIFT_VERSION: '5.9', TARGETED_DEVICE_FAMILY: '1',
        CODE_SIGN_ENTITLEMENTS: `${shareName}/${shareName}.entitlements`, CODE_SIGN_STYLE: 'Automatic',
        APPLICATION_EXTENSION_API_ONLY: 'YES', GENERATE_INFOPLIST_FILE: 'NO',
        CURRENT_PROJECT_VERSION: c.ios.buildNumber ?? '1', MARKETING_VERSION: c.version ?? '1.0.0',
        OTHER_LDFLAGS: ['"$(inherited)"', '"-lsqlite3"', '"-weak_framework"', '"FoundationModels"'],
      });
    }
    return c;
  });
  return config;
}
module.exports = withTTodo;
module.exports.swiftConfiguration = swiftConfiguration;
