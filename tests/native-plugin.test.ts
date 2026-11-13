import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
// Xcode project edits can be validated on Windows; Swift compilation still requires macOS.
const xcode = require('xcode');
const withTTodo = require('../plugins/with-ttodo-ios');
test('앱과 확장에 공통 Swift 파일·공유 스키마를 연결하며 재적용 시 타깃을 중복하지 않는다', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ttodo-plugin-'));
  try {
    execFileSync('tar', ['-xzf', path.resolve('node_modules/expo/template.tgz'), '-C', root]);
    const projectPath = path.join(root, 'package/ios/HelloWorld.xcodeproj/project.pbxproj');
    const project = xcode.project(projectPath); project.parseSync();
    cpSync(path.resolve('modules'), path.join(root, 'modules'), { recursive: true });
    cpSync(path.resolve('native'), path.join(root, 'native'), { recursive: true });
    const ios = path.join(root, 'ios'); mkdirSync(ios);
    const config = withTTodo({ name: 'TTodo', slug: 'ttodo', ios: { bundleIdentifier: 'com.kimps005.ttodo' } });
    const apply = () => config.mods.ios.xcodeproj({ ...config, modResults: project, modRequest: { projectRoot: root, platformProjectRoot: ios, platform: 'ios', modName: 'xcodeproj' } });
    await apply();
    const first = project.writeSync(); await apply(); assert.equal(project.writeSync(), first);
    const targets = Object.values(project.pbxNativeTargetSection()).filter((value: any) => value.name === '"TTodoWidgets"') as any[];
    assert.equal(targets.length, 1);
    const phases = targets[0].buildPhases.filter((phase: any) => phase.comment === 'Sources');
    assert.equal(phases.length, 1);
    assert.equal(project.hash.project.objects.PBXSourcesBuildPhase[phases[0].value].files.length, 4);
    assert.ok(first.includes('TTodoGenerated/SharedStore.swift'));
    assert.ok(first.includes('TTodoWidgets/SharedStore.swift'));
    const generated = readFileSync(path.join(root, 'modules/ttodo-native/ios/TTodoConfiguration.swift'), 'utf8');
    assert.ok(generated.includes('group.com.kimps005.ttodo')); assert.ok(generated.includes('PRAGMA user_version = 1;'));
    const entitlements = await config.mods.ios.entitlements({ ...config, modResults: {}, modRequest: {} });
    assert.deepEqual(entitlements.modResults['com.apple.security.application-groups'], ['group.com.kimps005.ttodo']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
