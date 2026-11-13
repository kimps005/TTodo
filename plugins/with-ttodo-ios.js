const fs = require('node:fs');
const path = require('node:path');
const { withEntitlementsPlist, withInfoPlist, withXcodeProject } = require('expo/config-plugins');
const schema = require('../src/data/schema.json');

function swiftConfiguration(group) {
  return `// Generated from app config and src/data/schema.json.\nimport Foundation\nenum TTodoConfiguration {\n  static let appGroup = ${JSON.stringify(group)}\n  static let schemaVersion = ${schema.version}\n  static let schemaSQL = ${JSON.stringify(schema.sql)}\n}\n`;
}
function plist(body) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>${body}</dict></plist>`;
}
function withTTodo(config) {
  const bundle = config.ios.bundleIdentifier;
  const appGroup = `group.${bundle}`;
  config = withEntitlementsPlist(config, c => {
    c.modResults['com.apple.security.application-groups'] = [appGroup]; return c;
  });
  config = withInfoPlist(config, c => {
    c.modResults.NSSupportsLiveActivities = true; return c;
  });
  config = withXcodeProject(config, c => {
    const root = c.modRequest.projectRoot;
    const ios = c.modRequest.platformProjectRoot;
    const project = c.modResults;
    const main = project.getFirstTarget().uuid;
    const generated = 'TTodoGenerated';
    const common = ['SharedStore.swift', 'TodoActivity.swift'];
    const copy = (name, source, targetDir) => {
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(path.join(source, name), path.join(targetDir, name));
    };
    const coreDir = path.join(root, 'modules/ttodo-native/ios');
    fs.writeFileSync(path.join(coreDir, 'TTodoConfiguration.swift'), swiftConfiguration(appGroup));
    const appDir = path.join(ios, generated);
    fs.mkdirSync(appDir, { recursive: true });
    for (const name of [...common, 'TTodoConfiguration.swift']) copy(name, coreDir, appDir);
    copy('AddTodoIntent.swift', path.join(root, 'native/ios'), appDir);
    let appGroupId = project.findPBXGroupKey({ name: generated });
    if (!appGroupId) {
      appGroupId = project.addPbxGroup([], generated).uuid;
      project.addToPbxGroup(appGroupId, project.getFirstProject().firstProject.mainGroup);
    }
    for (const name of [...common, 'TTodoConfiguration.swift', 'AddTodoIntent.swift']) {
      project.addSourceFile(`${generated}/${name}`, { target: main }, appGroupId);
    }
    const targetName = 'TTodoWidgets';
    const widgetDir = path.join(ios, targetName);
    fs.mkdirSync(widgetDir, { recursive: true });
    for (const name of [...common, 'TTodoConfiguration.swift']) copy(name, coreDir, widgetDir);
    copy('TTodoWidgets.swift', path.join(root, 'native/ios'), widgetDir);
    fs.writeFileSync(path.join(widgetDir, `${targetName}-Info.plist`), plist('<key>CFBundleDisplayName</key><string>TTodo</string><key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundleName</key><string>$(PRODUCT_NAME)</string><key>CFBundlePackageType</key><string>XPC!</string><key>CFBundleShortVersionString</key><string>1.0.0</string><key>CFBundleVersion</key><string>1</string><key>NSExtension</key><dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict>'));
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
      const group = project.addPbxGroup([], targetName);
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
        CURRENT_PROJECT_VERSION: '1', MARKETING_VERSION: '1.0.0', OTHER_LDFLAGS: ['"$(inherited)"', '"-lsqlite3"'],
      });
    }
    return c;
  });
  return config;
}
module.exports = withTTodo;
module.exports.swiftConfiguration = swiftConfiguration;
