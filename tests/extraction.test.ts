import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containsSensitiveText, validateExtraction } from '../src/ai/extraction';
const task = { is_actionable: true, title: '발표자료 보내기', description: null, due_at: null, due_precision: 'unknown', assignee: null, confidence: .8, evidence_text: '발표자료 보내줘', needs_confirmation: true };
test('근거 없는 응답·잘못된 날짜·신뢰도 범위를 거부한다', () => {
  assert.throws(() => validateExtraction([task], '안녕'));
  assert.throws(() => validateExtraction([{ ...task, confidence: 1.1 }], task.evidence_text));
  assert.throws(() => validateExtraction([{ ...task, due_at: '2026-02-30', due_precision: 'date' }], task.evidence_text));
  assert.throws(() => validateExtraction([{ ...task, due_at: '2026-02-30T17:00:00+09:00', due_precision: 'datetime' }], task.evidence_text));
  assert.throws(() => validateExtraction([{ ...task, due_at: '2026-11-20T17:00:00', due_precision: 'datetime' }], task.evidence_text));
  assert.throws(() => validateExtraction([{ ...task, needs_confirmation: 'false' }], task.evidence_text));
  assert.equal(validateExtraction([task], task.evidence_text)[0].needs_confirmation, 1);
  assert.deepEqual(validateExtraction([], '일반 대화'), []);
  assert.deepEqual(validateExtraction([{ is_actionable: false }], '일반 대화'), []);
});
test('인증코드·비밀번호·주민번호·카드번호 의심 텍스트를 제한한다', () => {
  for (const text of ['인증번호 123456', 'password: test', '900101-1234567', '1234 5678 9012 3456']) assert.equal(containsSensitiveText(text), true);
  assert.equal(containsSensitiveText('내일 5시까지 자료 보내줘'), false);
});
