import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evalFixtures, scoreFixture, runFixtureEvaluation, evaluationConsoleSummary } from '../src/ai/fixtureEvaluation';
import type { TaskSuggestion } from '../src/ai/extraction';
const sample = evalFixtures.cases.find(c => c.id === 'multi-01')!;
const prediction = (task: typeof sample.expected[number]): TaskSuggestion => ({ title: task.title, evidence_text: task.evidence_text, due_at: task.due_at, due_precision: task.due_precision as TaskSuggestion['due_precision'], description: null, assignee: null, confidence: .9, needs_confirmation: 1 });
test('평가 정답셋은 36개이며 원문 근거·유일 ID·명시 마감·핵심 어휘를 가진다', () => {
  assert.equal(evalFixtures.cases.length, 36);
  assert.equal(new Set(evalFixtures.cases.map(c => c.id)).size, 36);
  for (const c of evalFixtures.cases) for (const t of c.expected) {
    assert.ok(c.text.includes(t.evidence_text));
    assert.ok(t.title_terms.length && t.title_terms.every(g => g.length && g.some(term => t.title.replace(/\s/g, '').includes(term.replace(/\s/g, '')))));
    if (t.due_at) assert.ok(Number.isFinite(Date.parse(t.due_at)));
  }
  for (const category of ['카카오톡 요청과 약속', '날짜', '다중 할 일', '영수증', '잡담', '풍경']) assert.ok(evalFixtures.cases.some(c => c.category === category));
});
test('순서가 달라도 다중 할 일을 매칭하고 중복 출력은 오탐으로 센다', () => {
  const actual = sample.expected.map(prediction).reverse();
  const score = scoreFixture(sample, [...actual, actual[0]]);
  assert.equal(score.tp, 3); assert.equal(score.fp, 1); assert.equal(score.fn, 0);
  assert.equal(score.correctDeadlines, 3);
});
test('누락된 명시 마감은 분모에 포함하고 날짜 precision과 동일 순간을 구분한다', () => {
  const s = evalFixtures.cases.find(c => c.id === 'date-01')!;
  const a = prediction(s.expected[0]);
  assert.equal(scoreFixture(s, []).deadlines, 1);
  assert.equal(scoreFixture(s, []).correctDeadlines, 0);
  assert.equal(scoreFixture(s, [{ ...a, due_at: '2026-11-13T08:00:00Z' }]).correctDeadlines, 1);
  assert.equal(scoreFixture(s, [{ ...a, due_at: '2026-11-13', due_precision: 'date' }]).correctDeadlines, 0);
  assert.equal(scoreFixture(s, [{ ...a, due_at: '2026-11-13T07:00:00Z' }]).correctDeadlines, 0);
});
test('틀린 행동·없는 원문·잡담 오탐·불필요 마감을 드러낸다', () => {
  const task = prediction(sample.expected[0]);
  assert.equal(scoreFixture(sample, [{ ...task, title: '신청서 삭제' }]).tp, 0);
  assert.equal(scoreFixture(sample, [{ ...task, evidence_text: '원문에 없는 근거' }]).tp, 0);
  assert.equal(scoreFixture(evalFixtures.cases.find(c => c.id === 'noise-01')!, [task]).fp, 1);
  const undated = evalFixtures.cases.find(c => c.id === 'request-01')!;
  assert.deepEqual(scoreFixture(undated, [{ ...prediction(undated.expected[0]), due_at: '2026-11-20', due_precision: 'date' }]).unexpectedDeadlines, [0]);
});
test('최대 일대일 매칭은 탐욕 매칭 때문에 정답을 잃지 않는다', () => {
  const custom = { ...sample, text: '자료 검토', expected: [
    { ...sample.expected[0], evidence_text: '자료 검토', title_terms: [['자료']] },
    { ...sample.expected[0], evidence_text: '자료 검토', title_terms: [['검토']] },
  ] };
  const a = { ...prediction(sample.expected[0]), title: '자료 검토', evidence_text: '자료 검토' };
  assert.equal(scoreFixture(custom, [a, { ...a, title: '자료 정리' }]).tp, 2);
});
test('평가 러너는 정답을 모델에 유출하지 않고 전체·음성 정답의 분모를 집계한다', async () => {
  let calls = 0;
  const report = await runFixtureEvaluation({ version: 'test-only', extract: async input => {
    assert.deepEqual(Object.keys(input).sort(), ['captured_at', 'message_date', 'text', 'timezone']);
    calls++;
    return evalFixtures.cases.find(c => c.text === input.text)!.expected.map(prediction);
  } }, new AbortController().signal, () => {});
  assert.equal(calls, 36); assert.equal(report.completed, true);
  assert.equal(report.metrics.precision, 100); assert.equal(report.metrics.recall, 100); assert.equal(report.metrics.deadlineAccuracy, 100);
  assert.equal(report.meetsAutomaticTargets, true);
});
test('빈 결과·오류·취소는 허위 목표 통과로 보고하지 않는다', async () => {
  const empty = await runFixtureEvaluation({ version: 'test-only', extract: async () => [] }, new AbortController().signal, () => {});
  assert.equal(empty.metrics.precision, null); assert.equal(empty.metrics.recall, 0); assert.equal(empty.metrics.deadlineAccuracy, 0); assert.equal(empty.meetsAutomaticTargets, false);
  const failed = await runFixtureEvaluation({ version: 'test-only', extract: async () => { throw new Error('비공개 오류'); } }, new AbortController().signal, () => {});
  assert.equal(failed.completed, false); assert.equal(failed.results.length, 36); assert.equal(JSON.stringify(failed).includes('비공개 오류'), false);
  const abort = new AbortController(); abort.abort();
  const cancelled = await runFixtureEvaluation({ version: 'test-only', extract: async () => { throw new Error('호출하면 안 됨'); } }, abort.signal, () => {});
  assert.equal(cancelled.results.length, 0); assert.equal(cancelled.metrics.precision, null); assert.equal(cancelled.meetsAutomaticTargets, false);
});
test('진행 중 취소는 결과에 포함하지 않고 콘솔은 생성 문장을 기록하지 않는다', async () => {
  const abort = new AbortController();
  const cancelled = await runFixtureEvaluation({ version: 'test-only', extract: async () => { abort.abort(); return []; } }, abort.signal, () => {});
  assert.equal(cancelled.results.length, 0); assert.equal(cancelled.completed, false);
  const report = await runFixtureEvaluation({ version: 'test-only', extract: async () => [{ ...prediction(sample.expected[0]), title: '콘솔 금지 생성 문장' }] }, new AbortController().signal, () => {});
  const consoleReport = JSON.stringify(evaluationConsoleSummary(report));
  assert.equal(consoleReport.includes('콘솔 금지'), false); assert.equal(consoleReport.includes('evidence_text'), false);
  assert.ok(consoleReport.includes('falsePositives'));
});
