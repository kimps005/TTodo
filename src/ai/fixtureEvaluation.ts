import fixtures from '../../evaluation/EvalFixtures.json';
import type { TaskExtractionProvider, TaskSuggestion } from './extraction';

export const evalFixtures = fixtures;
type Expected = typeof fixtures.cases[number]['expected'][number];
type Prediction = Pick<TaskSuggestion, 'title' | 'evidence_text' | 'due_at' | 'due_precision'>;
const normalized = (text: string) => text.normalize('NFKC').replace(/[\s\p{P}]/gu, '').toLowerCase();
function matches(expected: Expected, actual: Prediction, source: string) {
  const evidence = normalized(actual.evidence_text), reference = normalized(expected.evidence_text);
  return !!evidence && source.includes(actual.evidence_text) &&
    (evidence.includes(reference) || reference.includes(evidence)) &&
    expected.title_terms.every(group => group.some(term => normalized(actual.title).includes(normalized(term))));
}
function sameDeadline(expected: Expected, actual: Prediction | undefined) {
  if (!actual || expected.due_precision !== actual.due_precision) return false;
  if (expected.due_precision !== 'datetime') return expected.due_at === actual.due_at;
  return !!expected.due_at && !!actual.due_at && Number.isFinite(Date.parse(expected.due_at)) && Date.parse(expected.due_at) === Date.parse(actual.due_at);
}
// Maximum one-to-one matching: output order and duplicate predictions cannot inflate TP.
export function scoreFixture(sample: { text: string; expected: Expected[] }, actual: Prediction[]) {
  const owner = new Map<number, number>();
  function assign(expectedIndex: number, seen: Set<number>): boolean {
    for (let i = 0; i < actual.length; i++) {
      if (seen.has(i) || !matches(sample.expected[expectedIndex], actual[i], sample.text)) continue;
      seen.add(i);
      const previous = owner.get(i);
      if (previous === undefined || assign(previous, seen)) { owner.set(i, expectedIndex); return true; }
    }
    return false;
  }
  sample.expected.forEach((_, i) => assign(i, new Set()));
  const byExpected = new Map([...owner].map(([actual, expected]) => [expected, actual]));
  const missed = sample.expected.flatMap((_, i) => byExpected.has(i) ? [] : [i]);
  const falsePositives = actual.flatMap((_, i) => owner.has(i) ? [] : [i]);
  const deadlineErrors = sample.expected.flatMap((task, i) => task.due_at && !sameDeadline(task, actual[byExpected.get(i) ?? -1]) ? [i] : []);
  const unexpectedDeadlines = [...byExpected].flatMap(([e, a]) => !sample.expected[e].due_at && actual[a].due_at ? [a] : []);
  const deadlines = sample.expected.filter(t => t.due_at !== null).length;
  return { tp: owner.size, fp: falsePositives.length, fn: missed.length, deadlines, correctDeadlines: deadlines - deadlineErrors.length,
    matches: [...byExpected].map(([expected, actual]) => ({ expected, actual })), falsePositives, missed, deadlineErrors, unexpectedDeadlines };
}
const percentage = (n: number, d: number) => d ? n / d * 100 : null;
export async function runFixtureEvaluation(provider: TaskExtractionProvider, signal: AbortSignal, progress: (done: number, total: number) => void) {
  const results = [];
  for (const sample of fixtures.cases) {
    if (signal.aborted) break;
    const input = { text: sample.text, captured_at: sample.captured_at, message_date: sample.message_date, timezone: fixtures.timezone };
    const started = Date.now();
    try {
      const actual = await provider.extract({ ...input }, signal);
      if (signal.aborted) break;
      results.push({ id: sample.id, category: sample.category, expected: sample.expected, actual, score: scoreFixture(sample, actual), error: null, elapsed_ms: Date.now() - started });
    } catch {
      if (signal.aborted) break;
      // Errors count as missing expected tasks, but invalidate the complete-run target verdict.
      results.push({ id: sample.id, category: sample.category, expected: sample.expected, actual: [], score: scoreFixture(sample, []), error: 'EXTRACTION_FAILED', elapsed_ms: Date.now() - started });
    }
    progress(results.length, fixtures.cases.length);
  }
  const total = results.reduce((sum, row) => ({ tp: sum.tp + row.score.tp, fp: sum.fp + row.score.fp, fn: sum.fn + row.score.fn,
    deadlines: sum.deadlines + row.score.deadlines, correctDeadlines: sum.correctDeadlines + row.score.correctDeadlines }), { tp: 0, fp: 0, fn: 0, deadlines: 0, correctDeadlines: 0 });
  const completed = results.length === fixtures.cases.length && !signal.aborted && results.every(r => r.error === null);
  const metrics = { ...total, precision: percentage(total.tp, total.tp + total.fp), recall: percentage(total.tp, total.tp + total.fn), deadlineAccuracy: percentage(total.correctDeadlines, total.deadlines) };
  return { format_version: 3, dataset_version: fixtures.version, provider: provider.version, generated_at: new Date().toISOString(), completed,
    attempted_all: results.length === fixtures.cases.length && !signal.aborted, metrics,
    meetsAutomaticTargets: completed && metrics.precision !== null && metrics.precision >= 90 && metrics.deadlineAccuracy !== null && metrics.deadlineAccuracy >= 95,
    note: '고정 어휘·원문 범위 일대일 자동 판정. 오류/취소는 목표 판정 불가. 의미 검토·실제 이미지 OCR·실기기 VoiceOver와 별도.', results };
}
// Console reports contain only case IDs, counts and indices; never OCR/model text.
export function evaluationConsoleSummary(report: Awaited<ReturnType<typeof runFixtureEvaluation>>) {
  return { dataset_version: report.dataset_version, provider: report.provider, completed: report.completed, metrics: report.metrics,
    meetsAutomaticTargets: report.meetsAutomaticTargets,
    discrepancies: report.results.filter(r => r.error || r.score.fp || r.score.fn || r.score.deadlineErrors.length || r.score.unexpectedDeadlines.length)
      .map(r => ({ id: r.id, error: r.error, ...r.score })) };
}
