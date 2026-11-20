import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
// Xcode project edits can be validated on Windows; Swift compilation still requires macOS.
const xcode = require('xcode');
const plist = require('@expo/plist').default;
const withTTodo = require('../plugins/with-ttodo-ios');

test('단독 Debug 프로젝트는 Expo 앱 진입점에서 내장 번들을 열고 런처를 링크하지 않는다', async () => {
  const readTemplate = (filename: string) =>
    execFileSync('tar', ['-xOf', path.resolve('node_modules/expo/template.tgz'), `package/ios/${filename}`], { encoding: 'utf8' });
  const appDelegate = readTemplate('HelloWorld/AppDelegate.swift');
  const podfile = readTemplate('Podfile');
  const env = process.env.TTODO_STANDALONE_DEBUG;
  const baseConfig = () => ({ name: 'TTodo', slug: 'ttodo', ios: { bundleIdentifier: 'com.kimps005.ttodo' } });
  try {
    delete process.env.TTODO_STANDALONE_DEBUG;
    const normal = withTTodo(baseConfig());
    assert.equal(normal.mods.ios.appDelegate, undefined);
    assert.equal(normal.mods.ios.podfile, undefined);

    process.env.TTODO_STANDALONE_DEBUG = '1';
    const config = withTTodo(baseConfig());
    const apply = async (mod: 'appDelegate' | 'podfile', contents: string, language: 'swift' | 'rb') =>
      (await config.mods.ios[mod]({ ...config, modResults: { contents, language }, modRequest: {} })).modResults.contents;
    const delegate = await apply('appDelegate', appDelegate, 'swift');
    assert.match(delegate, /override func bundleURL\(\) -> URL\? \{\n    return Bundle\.main\.url\(forResource: "main", withExtension: "jsbundle"\)\n  \}/);
    assert.match(delegate, /RCTBundleURLProviderAllowPackagerServerAccess\(false\)\n    let delegate = ReactNativeDelegate\(\)/);
    assert.match(delegate, /override func sourceURL\(for bridge: RCTBridge\) -> URL\? \{\n    bundleURL\(\)\n  \}/);
    assert.doesNotMatch(delegate, /RCTBundleURLProvider\.sharedSettings|bridge\.bundleURL/);
    assert.equal(await apply('appDelegate', delegate, 'swift'), delegate);
    const pods = await apply('podfile', podfile, 'rb');
    assert.match(pods, /^  use_expo_modules!\(exclude: \['expo-dev-client', 'expo-dev-launcher', 'expo-dev-menu'\]\)$/m);
    assert.equal(await apply('podfile', pods, 'rb'), pods);
  } finally {
    if (env === undefined) delete process.env.TTODO_STANDALONE_DEBUG;
    else process.env.TTODO_STANDALONE_DEBUG = env;
  }
});

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
    assert.equal(project.getFirstProject().firstProject.developmentRegion, 'ko');
    assert.equal(project.getFirstProject().firstProject.knownRegions.filter((region: string) => region.replaceAll('"', '') === 'ko').length, 1);
    const appInfo = await config.mods.ios.infoPlist({ ...config, modResults: { CFBundleDevelopmentRegion: 'en', CFBundleLocalizations: ['en'], NSCustomPreservedKey: 'preserve' }, modRequest: {} });
    assert.equal(appInfo.modResults.CFBundleDevelopmentRegion, 'ko');
    assert.deepEqual(appInfo.modResults.CFBundleLocalizations, ['ko']);
    assert.equal(appInfo.modResults.NSCustomPreservedKey, 'preserve');
    for (const target of ['TTodoWidgets', 'TTodoShare']) {
      const info = plist.parse(readFileSync(path.join(ios, target, `${target}-Info.plist`), 'utf8'));
      assert.equal(info.CFBundleDevelopmentRegion, 'ko');
      assert.deepEqual(info.CFBundleLocalizations, ['ko']);
      const entitlement = plist.parse(readFileSync(path.join(ios, target, `${target}.entitlements`), 'utf8'));
      assert.deepEqual({ ...entitlement }, { 'com.apple.security.application-groups': ['group.com.kimps005.ttodo'] });
    }
    assert.ok(!first.includes('TTodoUITests'), '일반 앱 생성에 CI UI 테스트 타깃을 포함하면 안 된다');
    const targets = Object.values(project.pbxNativeTargetSection()).filter((value: any) => value.name === '"TTodoWidgets"') as any[];
    assert.equal(targets.length, 1);
    const shareTargets = Object.values(project.pbxNativeTargetSection()).filter((value: any) => value.name === '"TTodoShare"') as any[];
    assert.equal(shareTargets.length, 1);
    assert.ok(first.includes('TTodoShare/ShareViewController.swift'));
    assert.ok(first.includes('TTodoShare/CaptureImageInput.swift'));
    assert.ok(first.includes('TTodoShare/ShareImageHandoff.swift'));
    const controller = readFileSync(path.join(ios, 'TTodoShare/ShareViewController.swift'), 'utf8');
    assert.doesNotMatch(controller, /NSSelectorFromString|unsafeBitCast|openURL|extensionContext\?\.open\(/);
    const reviewIntent = readFileSync(path.join(ios, 'TTodoGenerated/AnalyzeCaptureIntent.swift'), 'utf8');
    assert.match(reviewIntent, /struct ReviewSharedImageIntent: ProgressReportingIntent/);
    assert.match(reviewIntent, /\.foreground\(\.immediate\)/);
    assert.doesNotMatch(first, /TTodoShare\/AnalyzeCaptureIntent.swift/);
    assert.ok(first.includes('TTodoShare/CaptureNotifications.swift'), '공유창의 재분석 알림 정리에 필요한 Swift 소스를 포함해야 한다');
    const sharePlist = readFileSync(path.join(ios, 'TTodoShare/TTodoShare-Info.plist'), 'utf8');
    const { NSExtension: extension } = plist.parse(sharePlist);
    assert.equal(extension.NSExtensionPointIdentifier, 'com.apple.share-services');
    assert.deepEqual({ ...extension.NSExtensionAttributes.NSExtensionActivationRule }, { NSExtensionActivationSupportsImageWithMaxCount: 1 });
    assert.ok(sharePlist.includes('$(CURRENT_PROJECT_VERSION)'));
    const shareConfigs = project.pbxXCConfigurationList()[shareTargets[0].buildConfigurationList].buildConfigurations;
    for (const ref of shareConfigs) {
      const { name, buildSettings } = project.pbxXCBuildConfigurationSection()[ref.value];
      assert.equal(buildSettings.SWIFT_ACTIVE_COMPILATION_CONDITIONS, name === 'Debug' ? '"$(inherited) DEBUG"' : '"$(inherited)"');
      assert.equal(buildSettings.APPLICATION_EXTENSION_API_ONLY, 'YES');
    }
    const phases = targets[0].buildPhases.filter((phase: any) => phase.comment === 'Sources');
    assert.equal(phases.length, 1);
    assert.equal(project.hash.project.objects.PBXSourcesBuildPhase[phases[0].value].files.length, 4);
    assert.ok(first.includes('TTodoGenerated/SharedStore.swift'));
    assert.ok(first.includes('TTodoWidgets/SharedStore.swift'));
    assert.ok(first.includes('TTodoGenerated/AnalyzeCaptureIntent.swift'));
    assert.ok(!first.includes('TTodoGenerated/CaptureProcessor.swift'));
    assert.ok(first.includes('TTodoShare/CaptureProcessor.swift'));
    assert.ok(first.includes('FoundationModels.framework'));
    assert.ok(!first.includes('path = undefined'), 'Xcode 소스 그룹 경로가 undefined이면 실제 빌드에서 파일을 찾지 못한다');
    const generated = readFileSync(path.join(root, 'modules/ttodo-native/ios/TTodoConfiguration.swift'), 'utf8');
    assert.ok(generated.includes('group.com.kimps005.ttodo')); assert.ok(generated.includes('PRAGMA user_version = 3;'));
    const entitlements = await config.mods.ios.entitlements({ ...config, modResults: {}, modRequest: {} });
    assert.deepEqual(entitlements.modResults['com.apple.security.application-groups'], ['group.com.kimps005.ttodo']);
    const shareId = Object.entries(project.pbxNativeTargetSection()).find(([, value]: any) => value.name === '"TTodoShare"')![0];
    const shareGroup = project.findPBXGroupKey({ name: 'TTodoShare' });
    project.removeSourceFile('TTodoShare/CaptureNotifications.swift', { target: shareId }, shareGroup);
    await apply();
    assert.ok(project.writeSync().includes('TTodoShare/CaptureNotifications.swift'), '과거 생성 타깃에서도 새로 필요한 소스를 복구해야 한다');

    const phase = project.buildPhaseObject('PBXShellScriptBuildPhase', 'Bundle React Native code and images', project.getFirstTarget().uuid);
    const script = () => JSON.parse(phase.shellScript) as string;
    assert.doesNotMatch(script(), /FORCE_BUNDLING|SKIP_BUNDLING_METRO_IP/);
    const env = process.env.TTODO_STANDALONE_DEBUG;
    try {
      process.env.TTODO_STANDALONE_DEBUG = '1';
      const standalone = withTTodo({ name: 'TTodo', slug: 'ttodo', ios: { bundleIdentifier: 'com.kimps005.ttodo' } });
      const applyStandalone = () => standalone.mods.ios.xcodeproj({ ...standalone, modResults: project, modRequest: { projectRoot: root, platformProjectRoot: ios, platform: 'ios', modName: 'xcodeproj' } });
      await applyStandalone();
      assert.match(script(), /source "\$SRCROOT\/\.xcode\.env\.local"\nfi\n\nunset SKIP_BUNDLING\nexport FORCE_BUNDLING=1\nexport SKIP_BUNDLING_METRO_IP=1\n\n[^\n]*react-native-xcode\.sh/);
      assert.match(script(), /export BUNDLE_COMMAND="export:embed"/);
      const firstStandalone = project.writeSync();
      await applyStandalone();
      assert.equal(project.writeSync(), firstStandalone);
    } finally {
      if (env === undefined) delete process.env.TTODO_STANDALONE_DEBUG;
      else process.env.TTODO_STANDALONE_DEBUG = env;
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
