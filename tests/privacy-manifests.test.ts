import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
// Tests inject JSON fixtures; production parses built XML/binary plists with macOS plutil.
import { inventoryPrivacyManifests, validatePrivacyManifest } from '../scripts/privacy-manifests.mjs';

test('실제 번들 위치의 선언을 구분하며 누락된 키를 수집 없음으로 바꾸지 않는다', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ttodo-privacy-'));
  const app = path.join(root, 'TTodo.app');
  const save = (name: string, value: unknown) => { const file = path.join(app, name); mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value)); };
  try {
    save('Info.plist', { CFBundleIdentifier: 'test.ttodo', CFBundleVersion: '1', CFBundleSupportedPlatforms: ['iPhoneSimulator'] });
    save('PrivacyInfo.xcprivacy', { NSPrivacyTracking: false, NSPrivacyCollectedDataTypes: [] });
    const sdk = { NSPrivacyAccessedAPITypes: [{ NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] }] };
    save('Frameworks/Test.framework/PrivacyInfo.xcprivacy', sdk);
    save('PlugIns/TTodoShare.appex/Resource.bundle/PrivacyInfo.xcprivacy', {});
    save('other.json', { NSPrivacyTracking: true }); // Non-manifest files are not declarations.
    const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
    const report = inventoryPrivacyManifests(app, read);
    assert.equal(report.manifests.length, 3);
    assert.equal(report.root_manifest_present, true);
    assert.deepEqual(report.supported_platforms, ['iPhoneSimulator']);
    assert.equal(inventoryPrivacyManifests(app, read, 'debug_simulator').build_context, 'debug_simulator');
    assert.throws(() => inventoryPrivacyManifests(app, read, 'unsigned_release_archive'), /Expected iPhoneOS/);
    save('Info.plist', { CFBundleIdentifier: 'test.ttodo', CFBundleSupportedPlatforms: ['iPhoneOS'] });
    assert.equal(inventoryPrivacyManifests(app, read, 'unsigned_release_archive').build_context, 'unsigned_release_archive');
    assert.throws(() => inventoryPrivacyManifests(app, read, 'debug_simulator'), /Expected simulator/);
    assert.throws(() => inventoryPrivacyManifests(app, read, 'release-approved'), /Unknown build context/);
    assert.deepEqual(report.manifests.find((item: { path: string }) => item.path.startsWith('Frameworks/')).declarations, sdk);
    assert.deepEqual(report.manifests.find((item: { path: string }) => item.path.startsWith('PlugIns/')).declarations, {});
    assert.ok(report.not_verified.includes('missing_SDK_manifests'));
    rmSync(path.join(app, 'PrivacyInfo.xcprivacy'));
    assert.equal(inventoryPrivacyManifests(app, read).root_manifest_present, false);
    rmSync(path.join(app, 'Frameworks'), { recursive: true });
    rmSync(path.join(app, 'PlugIns'), { recursive: true });
    assert.throws(() => inventoryPrivacyManifests(app, read), /No bundled/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('잘못된 개인정보 선언 형식은 성공 보고서로 기록하지 않고 미확인 선언 값은 그대로 보존한다', () => {
  for (const value of [null, [], { NSPrivacyTracking: 'false' }, { NSPrivacyTrackingDomains: [42] },
    { NSPrivacyAccessedAPITypes: [{}] }, { NSPrivacyAccessedAPITypes: [{ NSPrivacyAccessedAPIType: 'category', NSPrivacyAccessedAPITypeReasons: [] }] },
    { NSPrivacyCollectedDataTypes: [{}] }]) assert.throws(() => validatePrivacyManifest(value, 'test'), /invalid/);
  const declaration = { NSPrivacyTracking: true, NSPrivacyTrackingDomains: ['tracking.example'], NSPrivacyCollectedDataTypes: [{ NSPrivacyCollectedDataType: 'unreviewed-type', NSPrivacyCollectedDataTypeLinked: false, NSPrivacyCollectedDataTypeTracking: true, NSPrivacyCollectedDataTypePurposes: ['unreviewed-purpose'] }] };
  assert.equal(validatePrivacyManifest(declaration, 'test'), declaration);
});
