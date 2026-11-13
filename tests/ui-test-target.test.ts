import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const xcode = require('xcode');
const { configureUITests } = require('../scripts/configure-ui-tests.cjs');

test('CI UI 테스트 타깃은 앱에 포함되지 않으며 의존 방향·제품·스킴을 재적용해도 보존한다', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ttodo-ui-target-'));
  try {
    execFileSync('tar', ['-xzf', path.resolve('node_modules/expo/template.tgz'), '-C', root]);
    const ios = path.join(root, 'package/ios');
    const projectPath = path.join(ios, 'HelloWorld.xcodeproj/project.pbxproj');
    const project = xcode.project(projectPath); project.parseSync();
    const app = project.getFirstTarget();
    const originalDependencies = JSON.stringify(app.firstTarget.dependencies);
    const id = configureUITests(project, ios, process.cwd());
    const targets = project.pbxNativeTargetSection();
    const target = targets[id];
    assert.equal(target.productType, '"com.apple.product-type.bundle.ui-testing"');
    assert.equal(JSON.stringify(app.firstTarget.dependencies), originalDependencies, '앱이 UI 테스트 타깃을 빌드/포함하면 안 된다');
    const dependencies = project.hash.project.objects.PBXTargetDependency;
    assert.ok(target.dependencies.some((item: { value: string }) => dependencies[item.value].target === app.uuid));
    assert.equal(project.pbxFileReferenceSection()[target.productReference].path, 'TTodoUITests.xctest');
    const configurations = project.pbxXCConfigurationList()[target.buildConfigurationList].buildConfigurations;
    for (const ref of configurations) {
      const settings = project.pbxXCBuildConfigurationSection()[ref.value].buildSettings;
      assert.equal(settings.TEST_TARGET_NAME, 'HelloWorld'); assert.equal(settings.SKIP_INSTALL, 'YES');
      assert.equal(settings.GENERATE_INFOPLIST_FILE, 'YES'); assert.equal(settings.INFOPLIST_FILE, undefined);
    }
    const schemePath = path.join(ios, 'HelloWorld.xcodeproj/xcshareddata/xcschemes/TTodoUITests.xcscheme');
    const scheme = readFileSync(schemePath, 'utf8');
    assert.ok(scheme.includes('buildConfiguration="Release"')); assert.ok(scheme.includes('parallelizable="NO"'));
    assert.ok(scheme.includes(`BlueprintIdentifier="${app.uuid}"`)); assert.ok(scheme.includes(`BlueprintIdentifier="${id}"`));
    const first = project.writeSync(); configureUITests(project, ios, process.cwd());
    assert.equal(project.writeSync(), first); assert.equal(readFileSync(schemePath, 'utf8'), scheme);
    writeFileSync(projectPath, first);
    const reparsed = xcode.project(projectPath); reparsed.parseSync();
    assert.equal(reparsed.pbxNativeTargetSection()[id].productType, target.productType);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
