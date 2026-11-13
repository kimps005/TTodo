import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeDeadline, deadlineFields } from '../src/domain/deadline';
test('마감 없음과 날짜만 있는 마감을 구분하고 시각을 추정하지 않는다', () => {
  assert.deepEqual(composeDeadline('', ''), { due_at: null, due_precision: 'unknown' });
  assert.deepEqual(composeDeadline('2026-11-20', ''), { due_at: '2026-11-20', due_precision: 'date' });
  assert.throws(() => composeDeadline('', '17:00'));
  assert.throws(() => composeDeadline('2026-02-30', '17:00'));
  assert.throws(() => composeDeadline('2026-11-20', '24:00'));
});
test('수정한 시각을 기기 시간대의 정확한 시점으로 저장하고 다시 편집할 수 있다', () => {
  const due = composeDeadline('2026-11-20', '9:30');
  assert.equal(due.due_at, new Date('2026-11-20T09:30:00').toISOString());
  assert.equal(due.due_precision, 'datetime');
  assert.deepEqual(deadlineFields(due), { day: '2026-11-20', time: '09:30' });
});
