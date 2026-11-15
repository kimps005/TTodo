import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const xcode = require('xcode');
const { configureNotificationProbe } = require('../scripts/configure-notification-probe.cjs');

test('알림 비교 앱은 제품 의존성·엔타이틀먼트 없이 독립 실행하며 테스트만 앱을 참조한다', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ttodo-notification-probe-'));
  try {
    configureNotificationProbe(root);
    const file = path.join(root, 'Probe.xcodeproj/project.pbxproj');
    const project = xcode.project(file); project.parseSync();
    const objects = project.hash.project.objects;
    const values = Object.values(objects) as any[];
    const app = values.find(o => o.isa === 'PBXNativeTarget' && o.name === 'Probe');
    const ui = values.find(o => o.isa === 'PBXNativeTarget' && o.name === 'ProbeTests');
    assert.equal(app.productType, '"com.apple.product-type.application"');
    assert.equal(ui.productType, '"com.apple.product-type.bundle.ui-testing"');
    assert.deepEqual(app.dependencies, []);
    assert.equal(ui.dependencies.length, 1);
    const dependency = objects[ui.dependencies[0]];
    assert.equal(objects[dependency.target], app);
    for (const target of [app, ui]) {
      const list = objects[target.buildConfigurationList];
      const config = objects[list.buildConfigurations[0]].buildSettings;
      assert.equal(config.GENERATE_INFOPLIST_FILE, 'YES');
      assert.equal(config.CODE_SIGN_ENTITLEMENTS, undefined);
      assert.ok(config.PRODUCT_BUNDLE_IDENTIFIER.includes('notificationprobe'));
      for (const phase of target.buildPhases) for (const ref of objects[phase].files) {
        assert.equal(objects[objects[ref].fileRef].lastKnownFileType, 'sourcecode.swift');
      }
    }
    for (const source of ['NotificationSettingsProbe.swift', 'NotificationSettingsProbeTests.swift']) {
      assert.equal(readFileSync(path.join(root, source), 'utf8'), readFileSync(path.resolve('native/tests', source), 'utf8'));
    }
    const before = readFileSync(file, 'utf8');
    configureNotificationProbe(root);
    assert.equal(readFileSync(file, 'utf8'), before);
    const scheme = readFileSync(path.join(root, 'Probe.xcodeproj/xcshareddata/xcschemes/ProbeTests.xcscheme'), 'utf8');
    assert.ok(scheme.includes('BlueprintName="ProbeTests"'));
    assert.ok(scheme.includes('BlueprintName="Probe"'));
    assert.ok(!before.includes('Pods') && !before.includes('TTodo.app'));
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(root, { recursive: true, force: true });
  }
});
