import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settingsInstructions, settingsMessage } from '../src/ui/notificationSettings';

test('알림 설정 열기 실패는 수동 복구 경로를 포함한 오류로 전달한다', () => {
  assert.throws(() => settingsMessage('failed'), /설정을 열지 못했어요.*TTodo → 알림/);
});
test('시뮬레이터 안내는 알림 메뉴 부재와 앱 설정 fallback을 명시한다', () => {
  assert.match(settingsMessage('simulator'), /시뮬레이터.*앱 설정 열기를 요청/);
  assert.ok(settingsMessage('simulator').includes(settingsInstructions));
});
test('공개 URL 수락을 화면 도착이나 권한 허용으로 표시하지 않는다', () => {
  for (const destination of ['notifications', 'application'] as const) {
    assert.match(settingsMessage(destination), /열기를 요청/);
    assert.ok(settingsMessage(destination).includes(settingsInstructions));
    assert.doesNotMatch(settingsMessage(destination), /이동했어요|허용됐어요/);
  }
});
