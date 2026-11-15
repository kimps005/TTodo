import { test } from 'node:test';
import assert from 'node:assert/strict';
const { selectUISimulator } = require('../scripts/ui-simulator-selection.cjs');
const pro = { identifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro', name: 'iPhone 16 Pro' };
const se = { identifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation', name: 'iPhone SE (3rd generation)' };
const runtime = (version: string, extra = {}) => ({ identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-' + version.replaceAll('.', '-'), version, isAvailable: true, supportedArchitectures: ['arm64'], supportedDeviceTypes: [pro, se], ...extra });

test('설치된 iOS 버전을 숫자 순서로 선택하고 다른 기종·OS로 조용히 대체하지 않는다', () => {
  const runtimes = [runtime('26.2'), runtime('26.10'), runtime('17.5'), runtime('27.0', { isAvailable: false }), runtime('26.4.1')];
  assert.equal(selectUISimulator(runtimes, [pro, se]).runtime.version, '26.10');
  assert.equal(selectUISimulator(runtimes, [pro, se], 'iphone-16-pro', 'oldest-installed').runtime.version, '26.2');
  assert.equal(selectUISimulator(runtimes, [pro, se], 'iphone-se-3').deviceType, se);
  assert.throws(() => selectUISimulator(runtimes, [pro], 'iphone-se-3'));
  assert.throws(() => selectUISimulator([runtime('26.2')], [pro], 'iphone-16-pro', 'oldest-installed'));
  assert.throws(() => selectUISimulator(runtimes, [pro], 'unknown'));
  assert.throws(() => selectUISimulator(runtimes, [pro], 'iphone-16-pro', 'unknown'));
});

test('SDK가 선택한 기종·arm64 조합을 지원하지 않거나 iOS가 없으면 실행 전 실패한다', () => {
  for (const runtimes of [[], [runtime('17.5')], [runtime('26.5', { supportedArchitectures: ['x86_64'] })], [runtime('26.5', { supportedDeviceTypes: [se] })], [runtime('26.5', { supportedDeviceTypes: undefined })], [runtime('26.5', { identifier: 'com.apple.CoreSimulator.SimRuntime.tvOS-26-5' })]]) assert.throws(() => selectUISimulator(runtimes, [pro, se]));
  // Fail rather than silently select the older compatible runtime.
  assert.throws(() => selectUISimulator([runtime('26.2'), runtime('26.5', { supportedDeviceTypes: [se] })], [pro]));
});
