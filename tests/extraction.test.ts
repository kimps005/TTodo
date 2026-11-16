import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containsSensitiveText, enforceDateContext, validateExtraction } from '../src/ai/extraction';
import sensitiveSeed from '../evaluation/sensitive-seed.json';
import dateContextSeed from '../evaluation/date-context-seed.json';
const task = { is_actionable: true, title: '발표자료 보내기', description: null, due_at: null, due_precision: 'unknown', assignee: null, confidence: .8, evidence_text: '발표자료 보내줘', needs_confirmation: true };
const textLimits = [
  { text: '가' + '🚀'.repeat(2000), expected: '가' + '🚀'.repeat(1999) },
  { text: '가'.repeat(3999) + '🚀', expected: '가'.repeat(3999) },
  { text: '가'.repeat(3998) + '🚀나', expected: '가'.repeat(3998) + '🚀' },
  { text: '가'.repeat(4001), expected: '가'.repeat(4000) },
  { text: '가'.repeat(3998) + '🚀', expected: '가'.repeat(3998) + '🚀' },
  { text: '한글 👨‍👩‍👧‍👦', expected: '한글 👨‍👩‍👧‍👦' },
];
test('설명은 4000 UTF-16 단위 안에서 이모지를 나누지 않고 제한한다', () => {
  for (const { text, expected } of [...textLimits, { text: '', expected: '' }]) {
    const [result] = validateExtraction([{ ...task, description: text }], task.evidence_text);
    assert.equal(result.description, expected);
    assert.ok(result.description!.length <= 4000);
    assert.equal(Buffer.from(result.description!, 'utf8').toString('utf8'), result.description);
  }
  assert.equal(validateExtraction([task], task.evidence_text)[0].description, null);
});
test('긴 원문 근거는 정상 Unicode와 실제 원문의 부분 문자열을 유지한다', () => {
  for (const { text, expected } of textLimits) {
    const source = `공지 시작: ${text} 공지 끝`;
    const [result] = validateExtraction([{ ...task, evidence_text: text }], source);
    assert.equal(result.evidence_text, expected);
    assert.ok(result.evidence_text.length <= 4000);
    assert.ok(source.includes(result.evidence_text));
    assert.equal(Buffer.from(result.evidence_text, 'utf8').toString('utf8'), result.evidence_text);
  }
});

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
test('정규화하면 같아도 원문에 없는 문장을 원문 근거로 저장하지 않는다', () => {
  for (const [source, evidence] of [['자료　보내줘', '자료 보내줘'], ['자료  보내줘', '자료 보내줘'], ['가 보내줘', '가 보내줘']]) {
    assert.throws(() => validateExtraction([{ ...task, evidence_text: evidence }], source));
    assert.equal(validateExtraction([{ ...task, evidence_text: source }], source)[0].evidence_text, source);
  }
});
test('메시지 기준일 없는 상대 날짜와 연도 추정은 모델 응답에 있어도 제거한다', () => {
  const context = { text: '내일 보내줘', captured_at: '2026-11-13T00:00:00Z', message_date: null, timezone: 'Asia/Seoul' };
  const suggestion = { ...validateExtraction([task], task.evidence_text)[0], due_at: '2026-11-14', due_precision: 'date' as const, evidence_text: '내일 보내줘' };
  assert.equal(enforceDateContext([suggestion], context)[0].due_at, null);
  assert.equal(enforceDateContext([{ ...suggestion, evidence_text: '11월 14일까지 보내줘' }], context)[0].due_at, null);
  assert.equal(enforceDateContext([{ ...suggestion, evidence_text: '2026년 11월 14일까지 보내줘' }], context)[0].due_at, '2026-11-14');
  assert.equal(enforceDateContext([suggestion], { ...context, message_date: '2026-11-13' })[0].due_at, '2026-11-14');
});
test('다른 연도가 함께 있어도 기준일 없는 연·월·주 상대 표현의 마감은 확정하지 않는다', () => {
  for (const item of dateContextSeed) {
    const [suggestion] = validateExtraction([{ ...task, evidence_text: item.evidence, due_at: '2026-11-20', due_precision: 'date', assignee: '사용자', needs_confirmation: false }], item.evidence);
    const [result] = enforceDateContext([suggestion], { text: item.evidence, captured_at: '2026-11-13T00:00:00Z', message_date: item.message_date, timezone: 'Asia/Seoul' });
    assert.equal(result.due_at, item.keeps_due ? '2026-11-20' : null, item.evidence);
    assert.equal(result.due_precision, item.keeps_due ? 'date' : 'unknown', item.evidence);
    assert.equal(result.needs_confirmation, item.keeps_due ? 0 : 1, item.evidence);
    assert.equal(result.evidence_text, item.evidence);
  }
});

test('인증코드·비밀번호·주민번호·카드번호 의심 텍스트를 제한한다', () => {
  for (const text of ['인증번호 123456', 'password: test', '900101-1234567', '1234 5678 9012 3456']) assert.equal(containsSensitiveText(text), true);
  assert.equal(containsSensitiveText('내일 5시까지 자료 보내줘'), false);
});

test('Swift와 같은 전각·분해 한글·보이지 않는 문자 사례에 민감정보 제한을 적용한다', () => {
  for (const item of sensitiveSeed) assert.equal(containsSensitiveText(item.text), item.expected, JSON.stringify(item));
});

test('빈 담당자는 미지정과 확인 필요로 통일하고 명시한 담당자는 공백만 정리한다', () => {
  for (const assignee of [null, '', ' \n\t', '\u00a0']) {
    const [result] = validateExtraction([{ ...task, assignee, needs_confirmation: false }], task.evidence_text);
    assert.equal(result.assignee, null); assert.equal(result.needs_confirmation, 1);
  }
  const [result] = validateExtraction([{ ...task, assignee: '  사용자  ', needs_confirmation: false }], task.evidence_text);
  assert.equal(result.assignee, '사용자'); assert.equal(result.needs_confirmation, 0);
});
