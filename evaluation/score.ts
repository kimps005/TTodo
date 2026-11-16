type Task = { due_at: string | null };
type Result = { id: string; category: string; input: { text: string; captured_at: string; message_date: string | null; timezone: string }; expected: Task[]; actual: unknown[] | null; error: string | null };
type Report = { format_version: number; dataset_version: number; completed: boolean; results: Result[] };
type Match = { expected: number; actual: number };
type Verdict = { id: string; matches: Match[]; deadlines: ('not_explicit' | 'correct' | 'incorrect')[] };
type Counts = { cases: number; tp: number; fp: number; fn: number; deadline_total: number; deadline_correct: number; negative_cases: number; negative_false_positive: number; blank_negative_cases: number; blank_negative_false_positive: number };

function emptyCounts(): Counts {
  return { cases: 0, tp: 0, fp: 0, fn: 0, deadline_total: 0, deadline_correct: 0, negative_cases: 0, negative_false_positive: 0, blank_negative_cases: 0, blank_negative_false_positive: 0 };
}
function indexIn(value: unknown, size: number): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < size;
}
function ratio(numerator: number, denominator: number): number | null { return denominator ? numerator / denominator : null; }
function summarize(counts: Counts) {
  return { ...counts, precision: ratio(counts.tp, counts.tp + counts.fp), recall: ratio(counts.tp, counts.tp + counts.fn),
    explicit_deadline_accuracy: ratio(counts.deadline_correct, counts.deadline_total),
    nonblank_negative_false_positive_rate: ratio(counts.negative_false_positive, counts.negative_cases),
    blank_negative_false_positive_rate: ratio(counts.blank_negative_false_positive, counts.blank_negative_cases) };
}

// These metrics aggregate explicit human judgments; they do not infer semantic matches.
export function scoreEvaluation(report: Report, verdicts: Verdict[]) {
  if (report.format_version !== 2 || report.dataset_version !== seed.version || report.completed !== true || !Array.isArray(report.results) || report.results.length !== seed.cases.length || !Array.isArray(verdicts)) throw new Error('오류 없이 완료된 형식 2 평가와 판정이 필요해요.');
  const seedById = new Map(seed.cases.map(sample => [sample.id, sample]));
  const byId = new Map<string, Verdict>();
  for (const verdict of verdicts) {
    if (!verdict || typeof verdict.id !== 'string' || byId.has(verdict.id)) throw new Error('판정 ID가 없거나 중복되었어요.');
    byId.set(verdict.id, verdict);
  }
  const seen = new Set<string>(), total = emptyCounts(), categories = new Map<string, Counts>();
  for (const row of report.results) {
    if (!row || typeof row.id !== 'string' || seen.has(row.id) || typeof row.category !== 'string' || typeof row.input?.text !== 'string' || row.error !== null || !Array.isArray(row.expected) || !Array.isArray(row.actual)) throw new Error('평가 사례가 중복되었거나 불완전해요.');
    const sample = seedById.get(row.id);
    if (!sample || sample.category !== row.category || sample.text !== row.input.text || sample.captured_at !== row.input.captured_at || sample.message_date !== row.input.message_date || seed.timezone !== row.input.timezone || JSON.stringify(sample.expected) !== JSON.stringify(row.expected)) throw new Error('평가 결과가 정답셋과 일치하지 않아요.');
    seen.add(row.id);
    const verdict = byId.get(row.id);
    if (!verdict || !Array.isArray(verdict.matches) || !Array.isArray(verdict.deadlines) || verdict.deadlines.length !== row.expected.length) throw new Error(`${row.id}: 모든 정답의 판정이 필요해요.`);
    const expected = new Set<number>(), actual = new Set<number>();
    for (const pair of verdict.matches) {
      if (!pair || !indexIn(pair.expected, row.expected.length) || !indexIn(pair.actual, row.actual.length) || expected.has(pair.expected) || actual.has(pair.actual)) throw new Error(`${row.id}: 일대일 작업 연결을 확인해 주세요.`);
      expected.add(pair.expected); actual.add(pair.actual);
    }
    let deadlineTotal = 0, deadlineCorrect = 0;
    verdict.deadlines.forEach((decision, index) => {
      if (!['not_explicit', 'correct', 'incorrect'].includes(decision)) throw new Error(`${row.id}: 마감 판정을 확인해 주세요.`);
      if (decision !== 'not_explicit') {
        if (!row.expected[index] || typeof row.expected[index].due_at !== 'string') throw new Error(`${row.id}: 명시 마감 정답이 없어요.`);
        if (decision === 'correct' && !expected.has(index)) throw new Error(`${row.id}: 누락된 작업의 마감은 정답이 아니에요.`);
        deadlineTotal++; if (decision === 'correct') deadlineCorrect++;
      }
    });
    const counts = categories.get(row.category) ?? emptyCounts(); categories.set(row.category, counts);
    for (const target of [total, counts]) {
      target.cases++; target.tp += expected.size; target.fp += row.actual.length - actual.size; target.fn += row.expected.length - expected.size;
      target.deadline_total += deadlineTotal; target.deadline_correct += deadlineCorrect;
      if (!row.expected.length) {
        if (row.input.text.trim()) { target.negative_cases++; if (row.actual.length) target.negative_false_positive++; }
        else { target.blank_negative_cases++; if (row.actual.length) target.blank_negative_false_positive++; }
      }
    }
  }
  if (seen.size !== byId.size) throw new Error('평가 결과에 없는 판정이 있어요.');
  return { total: summarize(total), categories: Object.fromEntries([...categories].map(([category, counts]) => [category, summarize(counts)])) };
}
import seed from './ko-seed.json';

