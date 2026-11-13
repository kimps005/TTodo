import seed from '../../evaluation/ko-seed.json';
import type { TaskExtractionProvider } from './extraction';
export async function evaluateProvider(provider: TaskExtractionProvider, signal: AbortSignal, progress: (done: number, total: number) => void) {
  const results = [];
  for (const sample of seed.cases) {
    if (signal.aborted) break;
    const started = Date.now();
    try {
      const actual = await provider.extract({ text: sample.text, captured_at: sample.captured_at, message_date: sample.message_date, timezone: seed.timezone }, signal);
      results.push({ id: sample.id, category: sample.category, expected: sample.expected, actual, elapsed_ms: Date.now() - started, error: null });
    } catch {
      results.push({ id: sample.id, category: sample.category, expected: sample.expected, actual: null, elapsed_ms: Date.now() - started, error: signal.aborted ? 'CANCELLED' : 'EXTRACTION_FAILED' });
    }
    progress(results.length, seed.cases.length);
  }
  return {
    format_version: 1, provider: provider.version, dataset_version: seed.version,
    generated_at: new Date().toISOString(), completed: results.length === seed.cases.length && !signal.aborted,
    note: '합성 OCR 텍스트 후보 평가. 제목·담당·날짜 의미를 사람이 검토하기 전 정확도 점수가 아님. 이미지 OCR 성능과 별개.',
    results,
  };
}
