import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeDeadline, deadlineFields } from '../src/domain/deadline';
import { dueDay, dueLabel, validateDue } from '../src/domain/todo';

test('다른 해의 같은 날짜를 마감 표시에서 구별한다', () => {
  const date = { due_at: '2026-12-01', due_precision: 'date' as const };
  assert.match(dueLabel(date), /2026/);
  assert.match(dueLabel({ ...date, due_at: '2027-12-01' }), /2027/);
  assert.notEqual(dueLabel(date), dueLabel({ ...date, due_at: '2027-12-01' }));
  assert.equal(dueLabel({ due_at: null, due_precision: 'unknown' }), '마감 없음');
});

test('시각 마감은 기기 시간대의 연도와 시각을 함께 표시한다', () => {
  const due = composeDeadline('2027-01-01', '09:30');
  const label = dueLabel(due);
  assert.match(label, /2027/);
  assert.match(label, /9:30/);
  assert.notEqual(label, dueLabel({ due_at: '2027-01-01', due_precision: 'date' }));
});
test('공유 네이티브 저장소와 같은 서기 날짜만 저장한다', () => {
  for (const due of ['0000-01-01', '0000-01-01T09:00:00+09:00']) {
    assert.throws(() => validateDue(due, due.includes('T') ? 'datetime' : 'date'));
  }
  assert.throws(() => composeDeadline('0000-01-01', ''));
  assert.doesNotThrow(() => validateDue('0001-01-01', 'date'));
  assert.doesNotThrow(() => validateDue('2026-11-20T09:00:00+09:00', 'datetime'));
});
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
test('네 자리보다 짧은 연도의 시각도 날짜 형식을 유지하며 다시 편집한다', () => {
  const due = composeDeadline('0500-06-15', '09:30');
  assert.deepEqual(deadlineFields(due), { day: '0500-06-15', time: '09:30' });
  assert.equal(dueDay(due), '0500-06-15');
  assert.ok(dueDay(due)! < '2026-11-16');
});
