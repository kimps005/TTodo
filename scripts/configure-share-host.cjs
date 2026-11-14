const fs = require('node:fs');
const path = require('node:path');

function configureShareHost(project, ios, root, uiTargetId) {
  const app = project.getFirstTarget();
  const targets = project.pbxNativeTargetSection();
  if (!targets[uiTargetId]) throw new Error('Configure the UI test target first.');
  const objects = project.hash.project.objects;
  const name = 'TTodoCIShareHost';
  let id = Object.keys(targets).find(key => targets[key]?.name?.replaceAll('"', '') === name);
  if (!id) {
    const dependencies = [...app.firstTarget.dependencies];
    id = project.addTarget(name, 'application', name, 'com.kimps005.ttodo.cisharehost').uuid;
    // xcode.addTarget implicitly adds every new target to the product app.
    // Keep the host solely on the UI test dependency side.
    for (const item of app.firstTarget.dependencies.slice(dependencies.length)) {
      const proxy = objects.PBXTargetDependency[item.value]?.targetProxy;
      delete objects.PBXTargetDependency[item.value]; delete objects.PBXTargetDependency[`${item.value}_comment`];
      if (proxy) { delete objects.PBXContainerItemProxy[proxy]; delete objects.PBXContainerItemProxy[`${proxy}_comment`]; }
    }
    app.firstTarget.dependencies = dependencies;
    for (const [type, label] of [['PBXSourcesBuildPhase', 'Sources'], ['PBXFrameworksBuildPhase', 'Frameworks'], ['PBXResourcesBuildPhase', 'Resources']]) project.addBuildPhase([], type, label, id);
  }
  const uiTarget = targets[uiTargetId];
  if (!uiTarget.dependencies.some(item => objects.PBXTargetDependency[item.value]?.target === id)) project.addTargetDependency(uiTargetId, [id]);
  const target = targets[id];
  const product = project.pbxFileReferenceSection()[target.productReference];
  product.path = `${name}.app`; product.name = `"${name}.app"`; product.explicitFileType = '"wrapper.application"';
  target.productReference_comment = `${name}.app`;
  project.pbxFileReferenceSection()[`${target.productReference}_comment`] = `${name}.app`;
  for (const group of Object.values(objects.PBXGroup)) {
    if (Array.isArray(group?.children)) for (const child of group.children) if (child.value === target.productReference) child.comment = `${name}.app`;
  }
  let group = project.findPBXGroupKey({ name });
  if (!group) {
    group = project.addPbxGroup([], name, '.').uuid;
    project.addToPbxGroup(group, project.getFirstProject().firstProject.mainGroup);
  }
  fs.mkdirSync(path.join(ios, name), { recursive: true });
  fs.copyFileSync(path.join(root, 'native/tests/ShareHost.swift'), path.join(ios, name, 'ShareHost.swift'));
  project.addSourceFile(`${name}/ShareHost.swift`, { target: id }, group);
  const list = project.pbxXCConfigurationList()[target.buildConfigurationList];
  for (const ref of list.buildConfigurations) {
    const settings = project.pbxXCBuildConfigurationSection()[ref.value].buildSettings;
    delete settings.INFOPLIST_FILE;
    Object.assign(settings, {
      IPHONEOS_DEPLOYMENT_TARGET: '18.0', SWIFT_VERSION: '5.9', TARGETED_DEVICE_FAMILY: '1', SDKROOT: 'iphoneos',
      GENERATE_INFOPLIST_FILE: 'YES', CODE_SIGN_STYLE: 'Automatic', SKIP_INSTALL: 'YES',
      PRODUCT_BUNDLE_IDENTIFIER: 'com.kimps005.ttodo.cisharehost',
      INFOPLIST_KEY_CFBundleDisplayName: '"TTodo CI Share Host"',
      INFOPLIST_KEY_UILaunchScreen_Generation: 'YES', INFOPLIST_KEY_UIApplicationSceneManifest_Generation: 'YES',
      MARKETING_VERSION: '1.0', CURRENT_PROJECT_VERSION: '1',
    });
  }
  return id;
}
module.exports = { configureShareHost };
