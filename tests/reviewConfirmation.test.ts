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
