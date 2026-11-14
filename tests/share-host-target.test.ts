import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const xcode = require('xcode');
const { configureUITests } = require('../scripts/configure-ui-tests.cjs');
const { configureShareHost } = require('../scripts/configure-share-host.cjs');

test('합성 공유 호스트는 기존 앱 의존성과 배포를 바꾸지 않고 UI 테스트에서만 빌드한다', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ttodo-share-host-'));
  try {
    execFileSync('tar', ['-xzf', path.resolve('node_modules/expo/template.tgz'), '-C', root]);
    const ios = path.join(root, 'package/ios');
    const projectPath = path.join(ios, 'HelloWorld.xcodeproj/project.pbxproj');
    const project = xcode.project(projectPath); project.parseSync();
    project.hash.project.objects.PBXTargetDependency ??= {};
    project.hash.project.objects.PBXContainerItemProxy ??= {};
    project.addTarget('ExistingExtension', 'app_extension', 'ExistingExtension', 'test.existing');
    const app = project.getFirstTarget();
    const originalDependencies = JSON.stringify(app.firstTarget.dependencies);
    const ui = configureUITests(project, ios, process.cwd());
    const id = configureShareHost(project, ios, process.cwd(), ui);
    const objects = project.hash.project.objects, targets = project.pbxNativeTargetSection(), target = targets[id];
    assert.equal(JSON.stringify(app.firstTarget.dependencies), originalDependencies);
    assert.ok(targets[ui].dependencies.some((item: { value: string }) => objects.PBXTargetDependency[item.value].target === id));
    assert.equal(target.productType, '"com.apple.product-type.application"');
    assert.equal(project.pbxFileReferenceSection()[target.productReference].path, 'TTodoCIShareHost.app');
    for (const ref of project.pbxXCConfigurationList()[target.buildConfigurationList].buildConfigurations) {
      const settings = project.pbxXCBuildConfigurationSection()[ref.value].buildSettings;
      assert.equal(settings.SKIP_INSTALL, 'YES'); assert.equal(settings.GENERATE_INFOPLIST_FILE, 'YES');
      assert.equal(settings.CODE_SIGN_ENTITLEMENTS, undefined); assert.equal(settings.INFOPLIST_FILE, undefined);
    }
    for (const phase of app.firstTarget.buildPhases) {
      for (const section of ['PBXCopyFilesBuildPhase', 'PBXResourcesBuildPhase', 'PBXSourcesBuildPhase', 'PBXFrameworksBuildPhase']) {
        for (const file of objects[section]?.[phase.value]?.files ?? []) assert.notEqual(objects.PBXBuildFile[file.value]?.fileRef, target.productReference);
      }
    }
    assert.ok(readFileSync(path.join(ios, 'TTodoCIShareHost/ShareHost.swift'), 'utf8').includes('UIActivityViewController'));
    const first = project.writeSync(); configureShareHost(project, ios, process.cwd(), ui);
    assert.equal(project.writeSync(), first);
    writeFileSync(projectPath, first);
    const parsed = xcode.project(projectPath); parsed.parseSync();
    assert.equal(parsed.pbxNativeTargetSection()[id].productType, target.productType);
  } finally {
    const target = path.resolve(root);
    assert.ok(target.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(target).startsWith('ttodo-share-host-'));
    rmSync(target, { recursive: true, force: true });
  }
});
