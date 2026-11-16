import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewConfirmation } from '../src/ui/reviewConfirmation';

test('제안 변경이나 새 확인 후 오래된 저장 확인은 실행되지 않는다', () => {
  const confirmation = createReviewConfirmation();
  const stale = confirmation.capture();
  confirmation.invalidate();
  assert.equal(stale(), false);
  const previous = confirmation.capture();
  const current = confirmation.capture();
  assert.equal(previous(), false);
  assert.equal(current(), true);
  assert.equal(current(), false);
});

test('취소는 해당 확인만 끝내고 늦게 도착한 취소는 새 확인을 방해하지 않는다', () => {
  const confirmation = createReviewConfirmation();
  const cancelled = confirmation.capture();
  assert.equal(cancelled(), true);
  assert.equal(cancelled(), false, '취소한 확인으로 저장하거나 삭제하지 않는다');
  const old = confirmation.capture();
  const latest = confirmation.capture();
  assert.equal(old(), false, '이전 확인의 취소는 무시한다');
  assert.equal(latest(), true, '새 확인은 계속 유효하다');
  assert.equal(latest(), false);
});
