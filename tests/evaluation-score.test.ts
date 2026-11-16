import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVerdictTemplate, scoreEvaluation } from '../evaluation/score';
import seed from '../evaluation/ko-seed.json';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture() {
  const results = seed.cases.map((sample, index) => ({ id: sample.id, category: sample.category,
    input: { text: sample.text, captured_at: sample.captured_at, message_date: sample.message_date, timezone: seed.timezone },
    expected: sample.expected, actual: sample.id === 'school-02' ? [{ due_at: '2026-11-16', due_precision: 'date' }, {}] : sample.id === 'negative-01' ? [{}] : [], elapsed_ms: sample.id === 'negative-03' ? 99999 : 100 + index, error: null as string | null }));
  const verdicts = seed.cases.map(sample => ({ id: sample.id,
    matches: sample.id === 'school-02' ? [{ expected: 0, actual: 0 }] : [],
    deadlines: sample.expected.map((_, index) => sample.id === 'school-02' && index === 0 ? 'correct' as const : 'not_explicit' as const) as ('not_explicit' | 'correct' | 'incorrect')[] }));
  return { report: { format_version: 2, dataset_version: seed.version, provider: 'test-only', generated_at: '2026-11-17T00:00:00Z', completed: true, results }, verdicts };
}
test('수동 일대일 판정으로 작업·마감·빈 입력과 일반 오탐을 분리해 집계한다', () => {
  const { report, verdicts } = fixture();
  const result = scoreEvaluation(report, verdicts);
  assert.equal(result.total.tp, 1); assert.equal(result.total.fp, 2);
  assert.equal(result.total.fn, seed.cases.reduce((n, c) => n + c.expected.length, 0) - 1);
  assert.equal(result.total.precision, 1 / 3);
  assert.equal(result.total.explicit_deadline_accuracy, 1);
  assert.equal(result.categories['할 일 없음'].nonblank_negative_false_positive_rate, 1 / 2);
  assert.equal(result.categories['할 일 없음'].blank_negative_false_positive_rate, 0);
  assert.equal(result.categories['할 일 없음'].recall, null);
  assert.equal(result.total.nonblank_duration_count, seed.cases.length - 1);
  assert.equal(result.total.nonblank_duration_p50_ms, 111);
  assert.equal(result.total.nonblank_duration_p90_ms, 121);
  assert.equal(result.provider, 'test-only');
});

test('판정 양식은 모든 판단을 비워 두고 완전한 평가에 대해서만 만든다', () => {
  const { report } = fixture();
  const template = createVerdictTemplate(report);
  assert.equal(template.length, seed.cases.length);
  assert.ok(template.every(row => row.matches === null && row.deadlines.every(value => value === null)));
  assert.throws(() => scoreEvaluation(report, template as never));
  report.results.pop(); assert.throws(() => createVerdictTemplate(report));
});
test('마감 시각은 시간대 표기가 달라도 같은 순간이어야 정답으로 센다', () => {
  const { report, verdicts } = fixture();
  const row = report.results.find(item => item.id === 'chat-01')!;
  const verdict = verdicts.find(item => item.id === 'chat-01')!;
  row.actual = [{ due_at: '2026-11-20T08:00:00Z', due_precision: 'datetime' }];
  verdict.matches = [{ expected: 0, actual: 0 }]; verdict.deadlines = ['correct'];
  assert.equal(scoreEvaluation(report, verdicts).total.deadline_correct, 2);
  row.actual = [{ due_at: '2026-11-20T09:00:00Z', due_precision: 'datetime' }];
  assert.throws(() => scoreEvaluation(report, verdicts));
});
test('오류·누락·중복 연결과 미검출 작업의 정답 마감 판정을 거부한다', () => {
  const a = fixture(); a.report.completed = false; assert.throws(() => scoreEvaluation(a.report, a.verdicts));
  const b = fixture(); b.verdicts.pop(); assert.throws(() => scoreEvaluation(b.report, b.verdicts));
  const c = fixture(); c.verdicts.find(v => v.id === 'school-02')!.matches.push({ expected: 0, actual: 1 }); assert.throws(() => scoreEvaluation(c.report, c.verdicts));
  const d = fixture(); d.verdicts.find(v => v.id === 'school-02')!.matches = []; assert.throws(() => scoreEvaluation(d.report, d.verdicts));
  const e = fixture(); e.report.results[0].error = 'EXTRACTION_FAILED'; assert.throws(() => scoreEvaluation(e.report, e.verdicts));
  const f = fixture(); f.report.results.pop(); assert.throws(() => scoreEvaluation(f.report, f.verdicts));
  const g = fixture(); g.report.results[0].input.message_date = null; assert.throws(() => scoreEvaluation(g.report, g.verdicts));
  const h = fixture(); h.report.results[0].elapsed_ms = -1; assert.throws(() => scoreEvaluation(h.report, h.verdicts));
  const i = fixture(); i.report.results.find(row => row.id === 'school-02')!.actual[0] = { due_at: '2026-11-17', due_precision: 'date' }; assert.throws(() => scoreEvaluation(i.report, i.verdicts));
});

test('집계 명령이 합성 파일을 읽어 결과만 출력하고 잘못된 판정은 실패한다', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ttodo-score-'));
  try {
    const { report, verdicts } = fixture();
    const reportPath = join(directory, 'report.json'), verdictPath = join(directory, 'verdict.json');
    writeFileSync(reportPath, JSON.stringify(report)); writeFileSync(verdictPath, JSON.stringify(verdicts));
    const run = () => spawnSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/score-evaluation.ts', reportPath, verdictPath], { encoding: 'utf8' });
    const good = run(); assert.equal(good.status, 0); assert.equal(JSON.parse(good.stdout).total.tp, 1);
    assert.equal(good.stdout.includes(seed.cases[0].text), false);
    writeFileSync(reportPath, '\uFEFF' + JSON.stringify(report)); writeFileSync(verdictPath, '\uFEFF' + JSON.stringify(verdicts));
    assert.equal(run().status, 0, 'UTF-8 BOM이 있어도 평가 결과와 판정을 읽는다');
    const prepared = spawnSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/prepare-evaluation-verdict.ts', reportPath], { encoding: 'utf8' });
    assert.equal(prepared.status, 0); assert.equal(JSON.parse(prepared.stdout)[0].matches, null);
    writeFileSync(verdictPath, prepared.stdout); assert.notEqual(run().status, 0);
    const newPath = join(directory, 'new-verdict.json');
    const prepareFile = () => spawnSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/prepare-evaluation-verdict.ts', reportPath, newPath], { encoding: 'utf8' });
    assert.equal(prepareFile().status, 0); const saved = readFileSync(newPath, 'utf8');
    assert.equal(JSON.parse(saved)[0].matches, null);
    assert.notEqual(prepareFile().status, 0); assert.equal(readFileSync(newPath, 'utf8'), saved);
    verdicts.pop(); writeFileSync(verdictPath, JSON.stringify(verdicts));
    const bad = run(); assert.notEqual(bad.status, 0); assert.equal(bad.stdout, '');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
