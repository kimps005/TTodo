import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVerdictTemplate, scoreEvaluation } from '../evaluation/score';
import seed from '../evaluation/ko-seed.json';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture() {
  const results = seed.cases.map(sample => ({ id: sample.id, category: sample.category,
    input: { text: sample.text, captured_at: sample.captured_at, message_date: sample.message_date, timezone: seed.timezone },
    expected: sample.expected, actual: sample.id === 'school-02' ? [{}, {}] : sample.id === 'negative-01' ? [{}] : [], error: null as string | null }));
  const verdicts = seed.cases.map(sample => ({ id: sample.id,
    matches: sample.id === 'school-02' ? [{ expected: 0, actual: 0 }] : [],
    deadlines: sample.expected.map((_, index) => sample.id === 'school-02' && index === 0 ? 'correct' as const : 'not_explicit' as const) as ('not_explicit' | 'correct' | 'incorrect')[] }));
  return { report: { format_version: 2, dataset_version: seed.version, completed: true, results }, verdicts };
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
});

test('판정 양식은 모든 판단을 비워 두고 완전한 평가에 대해서만 만든다', () => {
  const { report } = fixture();
  const template = createVerdictTemplate(report);
  assert.equal(template.length, seed.cases.length);
  assert.ok(template.every(row => row.matches === null && row.deadlines.every(value => value === null)));
  assert.throws(() => scoreEvaluation(report, template as never));
  report.results.pop(); assert.throws(() => createVerdictTemplate(report));
});
test('오류·누락·중복 연결과 미검출 작업의 정답 마감 판정을 거부한다', () => {
  const a = fixture(); a.report.completed = false; assert.throws(() => scoreEvaluation(a.report, a.verdicts));
  const b = fixture(); b.verdicts.pop(); assert.throws(() => scoreEvaluation(b.report, b.verdicts));
  const c = fixture(); c.verdicts.find(v => v.id === 'school-02')!.matches.push({ expected: 0, actual: 1 }); assert.throws(() => scoreEvaluation(c.report, c.verdicts));
  const d = fixture(); d.verdicts.find(v => v.id === 'school-02')!.matches = []; assert.throws(() => scoreEvaluation(d.report, d.verdicts));
  const e = fixture(); e.report.results[0].error = 'EXTRACTION_FAILED'; assert.throws(() => scoreEvaluation(e.report, e.verdicts));
  const f = fixture(); f.report.results.pop(); assert.throws(() => scoreEvaluation(f.report, f.verdicts));
  const g = fixture(); g.report.results[0].input.message_date = null; assert.throws(() => scoreEvaluation(g.report, g.verdicts));
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
    const prepared = spawnSync(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/prepare-evaluation-verdict.ts', reportPath], { encoding: 'utf8' });
    assert.equal(prepared.status, 0); assert.equal(JSON.parse(prepared.stdout)[0].matches, null);
    writeFileSync(verdictPath, prepared.stdout); assert.notEqual(run().status, 0);
    verdicts.pop(); writeFileSync(verdictPath, JSON.stringify(verdicts));
    const bad = run(); assert.notEqual(bad.status, 0); assert.equal(bad.stdout, '');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
