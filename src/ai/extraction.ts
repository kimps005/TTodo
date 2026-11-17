import { normalizeTitle, validateDue, type DuePrecision } from '../domain/todo';
import type { ExtractedTask } from '../data/repository';
export type TaskSuggestion = Omit<ExtractedTask, 'id' | 'analysis_id' | 'review_status' | 'linked_todo_id'>;
export interface ExtractionContext { text: string; captured_at: string | null; timezone: string; message_date: string | null; }
export interface TaskExtractionProvider {
  readonly version: string;
  extract(context: ExtractionContext, signal: AbortSignal): Promise<TaskSuggestion[]>;
}
const clean = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim();
function truncateText(value: string, limit: number): string {
  let end = Math.min(value.length, limit);
  const before = value.charCodeAt(end - 1), after = value.charCodeAt(end);
  // Keep the UTF-16 size cap without leaving half of a supplementary character.
  if (before >= 0xD800 && before <= 0xDBFF && after >= 0xDC00 && after <= 0xDFFF) end -= 1;
  return value.slice(0, end);
}
export function validateExtraction(raw: unknown, sourceText: string, mode: 'ai' | 'ocr' = 'ai'): TaskSuggestion[] {
  if (!Array.isArray(raw) || (mode === 'ai' && raw.length > 30)) throw new Error('INVALID_RESPONSE');
  return raw.flatMap((item: unknown): TaskSuggestion[] => {
    if (!item || typeof item !== 'object') throw new Error('INVALID_RESPONSE');
    const t = item as Record<string, unknown>;
    if (t.is_actionable === false) return [];
    if (t.is_actionable !== true) throw new Error('INVALID_RESPONSE');
    if (typeof t.title !== 'string' || typeof t.evidence_text !== 'string' || !clean(t.evidence_text) ||
      !sourceText.includes(t.evidence_text) ||
      typeof t.confidence !== 'number' || !Number.isFinite(t.confidence) || t.confidence < 0 || t.confidence > 1 ||
      !['date', 'datetime', 'unknown'].includes(String(t.due_precision)) ||
      (t.due_at !== null && typeof t.due_at !== 'string') ||
      (t.assignee !== null && typeof t.assignee !== 'string') ||
      (t.description !== null && typeof t.description !== 'string') ||
      typeof t.needs_confirmation !== 'boolean') throw new Error('INVALID_RESPONSE');
    const due = t.due_at as string | null;
    const precision = t.due_precision as DuePrecision;
    validateDue(due, precision);
    const assignee = (t.assignee as string | null)?.trim() || null;
    const description = t.description as string | null;
    if (mode === 'ai' && nonActionEvidence(t.evidence_text)) return [];
    return [{ title: normalizeTitle(t.title), description: description === null ? null : truncateText(description, 4000),
      due_at: due, due_precision: precision, assignee, confidence: t.confidence,
      evidence_text: truncateText(t.evidence_text, 4000), needs_confirmation: t.needs_confirmation || !assignee ? 1 : 0 }];
  });
}
export function nonActionEvidence(evidence: string): boolean {
  return /별도\s*조치[는가]?\s*필요하지|할\s*일[이가]?\s*없|(?:신청|접수)\s*기간[은이가 ]*종료|이용에\s*참고\s*바랍니다|(?:요청[은이가 ]*)?취소[됐되]|제출하지\s*마세요|지금\s*\d+%\s*할인/.test(clean(evidence));
}
export function containsSensitiveText(text: string): boolean {
  const normalized = text.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');
  return /(?:비밀번호|패스워드|password|인증\s*(?:번호|코드)|보안\s*코드|계좌\s*번호|주민\s*등록)/i.test(normalized) ||
    /\b\d{6}\s*[-–]\s*[1-4]\d{6}\b/.test(normalized) || /\b(?:\d[ -]?){16}\b/.test(normalized);
}
export function enforceDateContext(tasks: TaskSuggestion[], context: ExtractionContext): TaskSuggestion[] {
  if (context.message_date) return tasks;
  return tasks.map(task => {
    if (!task.due_at) return task;
    const evidence = clean(task.evidence_text);
    const relative = /오늘|내일|모레|글피|어제|그제|올해|금년|내년|내후년|작년|재작년|지난해|(?:이번|다음|지난)\s*(?:주|달|해)|일\s*뒤|일\s*후/.test(evidence);
    const explicitYear = /\b\d{4}\s*(?:년|[-./])/.test(evidence);
    return relative || !explicitYear ? { ...task, due_at: null, due_precision: 'unknown', needs_confirmation: 1 } : task;
  });
}
