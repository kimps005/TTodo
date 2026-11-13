import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containsSensitiveText, enforceDateContext, validateExtraction } from '../src/ai/extraction';
import sensitiveSeed from '../evaluation/sensitive-seed.json';
const task = { is_actionable: true, title: '발표자료 보내기', description: null, due_at: null, due_precision: 'unknown', assignee: null, confidence: .8, evidence_text: '발표자료 보내줘', needs_confirmation: true };
test('근거 없는 응답·잘못된 날짜·신뢰도 범위를 거부한다', () => {
  assert.throws(() => validateExtraction([task], '안녕'));
  assert.throws(() => validateExtraction([{ ...task, confidence: 1.1 }], task.evidence_text));
  assert.throws(() => validateExtraction([{ ...task, due_at: '2026-02-30', due_precision: 'date' }], task.evidence_text));
  assert.throws(() => validateExtraction([{ ...task, due_at: '2026-02-30T17:00:00+09:00', due_precision: 'datetime' }], task.evidence_text));
  assert.throws(() => validateExtraction([{ ...task, due_at: '2026-11-20T17:00:00', due_precision: 'datetime' }], task.evidence_text));
  assert.throws(() => validateExtraction([{ ...task, due_at: '' }], task.evidence_text));
  assert.throws(() => validateExtraction([{ ...task, needs_confirmation: 'false' }], task.evidence_text));
  assert.equal(validateExtraction([task], task.evidence_text)[0].needs_confirmation, 1);
  assert.deepEqual(validateExtraction([], '일반 대화'), []);
  assert.deepEqual(validateExtraction([{ is_actionable: false }], '일반 대화'), []);
});
test('메시지 기준일 없는 상대 날짜와 연도 추정은 모델 응답에 있어도 제거한다', () => {
  const context = { text: '내일 보내줘', captured_at: '2026-11-13T00:00:00Z', message_date: null, timezone: 'Asia/Seoul' };
  const suggestion = { ...validateExtraction([task], task.evidence_text)[0], due_at: '2026-11-14', due_precision: 'date' as const, evidence_text: '내일 보내줘' };
  assert.equal(enforceDateContext([suggestion], context)[0].due_at, null);
  assert.equal(enforceDateContext([{ ...suggestion, evidence_text: '11월 14일까지 보내줘' }], context)[0].due_at, null);
  assert.equal(enforceDateContext([{ ...suggestion, evidence_text: '2026년 11월 14일까지 보내줘' }], context)[0].due_at, '2026-11-14');
  assert.equal(enforceDateContext([suggestion], { ...context, message_date: '2026-11-13' })[0].due_at, '2026-11-14');
});
test('인증코드·비밀번호·주민번호·카드번호 의심 텍스트를 제한한다', () => {
  for (const text of ['인증번호 123456', 'password: test', '900101-1234567', '1234 5678 9012 3456']) assert.equal(containsSensitiveText(text), true);
  assert.equal(containsSensitiveText('내일 5시까지 자료 보내줘'), false);
});

test('Swift와 같은 전각·분해 한글·보이지 않는 문자 사례에 민감정보 제한을 적용한다', () => {
  for (const item of sensitiveSeed) assert.equal(containsSensitiveText(item.text), item.expected, JSON.stringify(item));
});
