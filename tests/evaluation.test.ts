import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../evaluation/ko-seed.json';
import { validateDue, normalizeTitle, type DuePrecision } from '../src/domain/todo';
test('초기 한국어 정답셋은 고유 ID, 실제 원문 근거, 유효한 마감 및 PRD 분류를 갖는다', () => {
  assert.equal(new Set(seed.cases.map(c => c.id)).size, seed.cases.length);
  assert.deepEqual(new Set(seed.cases.map(c => c.category)), new Set(['대화', '학교 공지', '업무 공지', '이메일', '일정표', '업무 요청', '할 일 없음', '모호함', '날짜']));
  assert.ok(seed.cases.some(c => c.expected.length === 0), '할 일 없는 사례가 필요하다');
  assert.ok(seed.cases.some(c => c.expected.length > 1), '여러 작업을 구분하는 사례가 필요하다');
  for (const input of seed.cases) {
    assert.ok(Number.isFinite(Date.parse(input.captured_at)));
    if (input.message_date !== null) validateDue(input.message_date, 'date');
    for (const expected of input.expected) {
      assert.ok(input.text.includes(expected.evidence_text), input.id);
      normalizeTitle(expected.title);
      validateDue(expected.due_at, expected.due_precision as DuePrecision);
    }
  }
});
