import { containsSensitiveText, type TaskSuggestion } from './extraction';
import { deadlineFields } from '../domain/deadline';
import type { ExtractedTask, Repository } from '../data/repository';
import type { OCRResult } from '../native/bridge';

export const captureModelVersion = 'apple-ondevice/single-capture-v1';
export type CaptureSnapshot = Awaited<ReturnType<Repository['reanalysisSnapshot']>>;
export type CapturePhase = 'ocr' | 'lookup' | 'availability' | 'model' | 'store';
export type CaptureResult =
  | { kind: 'candidate'; task: ExtractedTask; reanalyze?: string }
  | { kind: 'status'; message: string; retry?: boolean; reanalyze?: string };

// The model supplies the proposed deadline. Keep each part only if the
// evidence also contains that civil date or clock time.
export function captureDeadline(task: TaskSuggestion): TaskSuggestion {
  if (!task.due_at) return task;
  const { day, time } = deadlineFields(task);
  const evidence = task.evidence_text.normalize('NFKC');
  const [, year, month, date] = /^(\d{4})-0?(\d+)-0?(\d+)$/.exec(day) ?? [];
  const calendar = new RegExp(`(?<!\\d)${year}(?:\\s*년\\s*0?${month}\\s*월\\s*0?${date}\\s*일|\\s*[./-]\\s*0?${month}\\s*[./-]\\s*0?${date}(?!\\d))`);
  if (!year || !calendar.test(evidence)) return { ...task, due_at: null, due_precision: 'unknown' };
  if (!time) return task;
  const [hour, minute] = time.split(':').map(Number);
  const clock = /(?<!\d)(?:(오전|오후|AM|PM)\s*)?(\d{1,2})\s*(?::\s*([0-5]\d)(?!\d)|시(?!간)(?:\s*([0-5]?\d)\s*분|\s*(반))?)/gi;
  for (const [, period, h, colonMinutes, koreanMinutes, half] of evidence.matchAll(clock)) {
    const rawHour = Number(h);
    if (period && (rawHour < 1 || rawHour > 12)) continue;
    if (!period && !colonMinutes && rawHour >= 1 && rawHour <= 12) continue;
    const sourceHour = period ? rawHour % 12 + (/오후|PM/i.test(period) ? 12 : 0) : rawHour;
    if (sourceHour === hour && (half ? 30 : Number(colonMinutes ?? koreanMinutes ?? 0)) === minute) return task;
  }
  return { ...task, due_at: day, due_precision: 'date' };
}

type CaptureRepository = Pick<Repository, 'listAnalyses' | 'listExtracted' | 'createAnalysis' | 'retryFailedAnalysis' | 'restartUnstoredAnalysis' | 'finishAnalysis' | 'failAnalysis'>;

function checkCurrent(signal: AbortSignal) {
  if (signal.aborted) throw new Error('분석을 취소했어요.');
}

export async function analyzeCapture({ repository, recognize, extract, unavailable, clearNotification, signal, channel, replacement, onPhase }: {
  repository: CaptureRepository;
  recognize: () => Promise<OCRResult>;
  extract: (text: string, signal: AbortSignal) => Promise<TaskSuggestion[]>;
  unavailable: () => string | undefined;
  clearNotification: (id: string) => void;
  signal: AbortSignal;
  channel: 'manual' | 'share';
  replacement?: CaptureSnapshot;
  onPhase?: (phase: CapturePhase) => void;
}): Promise<CaptureResult> {
  const noTask = { kind: 'status', message: '할 일을 찾지 못했어요' } as const;
  onPhase?.('ocr');
  const { text, fingerprint } = await recognize();
  checkCurrent(signal);
  onPhase?.('lookup');
  if (containsSensitiveText(text)) return { kind: 'status', message: '민감한 정보가 있어요. 필요한 할 일은 직접 입력해 주세요.' };

  const existing = (await repository.listAnalyses()).find(a => a.image_fingerprint === fingerprint);
  checkCurrent(signal);
  if (replacement && existing?.id !== replacement.id) throw new Error('분석 기록이 변경되었어요.');
  if (existing && !replacement && existing.status !== 'failed') {
    if (existing.status === 'processing' || existing.status === 'queued') {
      return { kind: 'status', message: '이미 분석 중인 사진이에요. 잠시 후 다시 확인해 주세요.', retry: true };
    }
    const tasks = await repository.listExtracted(existing.id);
    checkCurrent(signal);
    if (existing.status === 'saved' || tasks.some(task => task.review_status === 'saved')) {
      return { kind: 'status', message: '이 사진에서 저장한 기록이 있어요. 할 일이나 분석함에서 확인해 주세요.' };
    }
    const task = tasks.find(t => t.review_status === 'pending' && t.capture_provider === captureModelVersion);
    if (task) return { kind: 'candidate', task, reanalyze: fingerprint };
    if (existing.status === 'empty') return { ...noTask, reanalyze: fingerprint };
    return { kind: 'status', message: '이 사진은 이미 분석했어요. 분석함에서 확인할 수 있어요.', reanalyze: fingerprint };
  }

  onPhase?.('availability');
  const blocked = text.trim() ? unavailable() : undefined;
  if (blocked) return { kind: 'status', message: blocked, retry: true };

  let id: string | undefined;
  let token: string | null = null;
  try {
    onPhase?.('store');
    if (existing) {
      id = existing.id;
      token = replacement ? await repository.restartUnstoredAnalysis(id, false, replacement) : await repository.retryFailedAnalysis(id);
    } else {
      const registration = await repository.createAnalysis(fingerprint, channel, null);
      id = registration.id;
      token = registration.token;
      if (!registration.created) return { kind: 'status', message: '이미 등록된 사진이에요. 다시 확인해 주세요.', retry: true };
    }
    if (!token) throw new Error('분석 상태가 변경되었어요.');
    checkCurrent(signal);
    clearNotification(id);
    onPhase?.('model');
    const tasks = text.trim() ? await extract(text, signal) : [];
    checkCurrent(signal);
    onPhase?.('store');
    await repository.finishAnalysis(id, tasks.slice(0, 1).map(captureDeadline), captureModelVersion, token);
    token = null;
    checkCurrent(signal);
    if (!tasks.length) return noTask;
    const [task] = await repository.listExtracted(id);
    checkCurrent(signal);
    return task?.review_status === 'pending' ? { kind: 'candidate', task } : { kind: 'status', message: '제안 상태가 변경되었어요. 분석함에서 확인해 주세요.' };
  } catch (error) {
    if (id && token) await repository.failAnalysis(id, signal.aborted ? 'INTERRUPTED' : 'LOCAL_AI_FAILED', token).catch(() => {});
    throw error;
  }
}
