import { test } from 'node:test';
import assert from 'node:assert/strict';
import seed from '../evaluation/ko-seed.json';
import { validateDue, normalizeTitle, type DuePrecision } from '../src/domain/todo';
test('초기 한국어 정답셋은 고유 ID, 실제 원문 근거, 유효한 마감 및 PRD 분류를 갖는다', () => {
  assert.equal(new Set(seed.cases.map(c => c.id)).size, seed.cases.length);
  assert.equal(new Set(seed.cases.map(c => c.category)).size, 9);
  for (const input of seed.cases) {
    assert.ok(Number.isFinite(Date.parse(input.captured_at)));
    for (const expected of input.expected) {
      assert.ok(input.text.includes(expected.evidence_text), input.id);
      normalizeTitle(expected.title);
      validateDue(expected.due_at, expected.due_precision as DuePrecision);
    }
  }
});
