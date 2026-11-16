import { test } from 'node:test';
import assert from 'node:assert/strict';
const { selectNotificationProbeSimulator } = require('../scripts/notification-probe-selection.cjs');
const pro = { identifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro' };
const runtime = (version: string, extra = {}) => ({ identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-' + version.replaceAll('.', '-'), version, isAvailable: true, supportedArchitectures: ['arm64'], supportedDeviceTypes: [pro], ...extra });

test('독립 비교의 명시적 OS는 설치·가용·arm64 조건을 지키며 다른 OS로 대체하지 않는다', () => {
  const runtimes = [runtime('26.2'), runtime('26.4.1'), runtime('26.5')];
  assert.equal(selectNotificationProbeSimulator(runtimes, [pro], '26.4.1').runtime.version, '26.4.1');
  assert.equal(selectNotificationProbeSimulator(runtimes, [pro], 'latest').runtime.version, '26.5');
  assert.equal(selectNotificationProbeSimulator(runtimes, [pro], 'oldest-installed').runtime.version, '26.2');
  for (const policy of ['26.4', '26.3', '17.5', '', 'unknown']) assert.throws(() => selectNotificationProbeSimulator(runtimes, [pro], policy));
  for (const extra of [{ isAvailable: false }, { supportedArchitectures: ['x86_64'] }, { supportedDeviceTypes: [] }, { identifier: 'com.apple.CoreSimulator.SimRuntime.tvOS-26-4-1' }]) {
    assert.throws(() => selectNotificationProbeSimulator([runtime('26.4.1', extra), runtime('26.5')], [pro], '26.4.1'));
  }
});
