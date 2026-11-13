import { normalizeTitle, validateDue, type DuePrecision } from '../domain/todo';
import type { ExtractedTask } from '../data/repository';
export type TaskSuggestion = Omit<ExtractedTask, 'id' | 'analysis_id' | 'review_status' | 'linked_todo_id'>;
export interface ExtractionContext { text: string; captured_at: string | null; timezone: string; message_date: string | null; }
export interface TaskExtractionProvider {
  readonly version: string;
  extract(context: ExtractionContext, signal: AbortSignal): Promise<TaskSuggestion[]>;
}
const clean = (value: string) => value.normalize('NFKC').replace(/\s+/g, ' ').trim();
export function validateExtraction(raw: unknown, sourceText: string): TaskSuggestion[] {
  if (!Array.isArray(raw) || raw.length > 30) throw new Error('INVALID_RESPONSE');
  return raw.flatMap((item: unknown): TaskSuggestion[] => {
    if (!item || typeof item !== 'object') throw new Error('INVALID_RESPONSE');
    const t = item as Record<string, unknown>;
    if (t.is_actionable === false) return [];
    if (t.is_actionable !== true) throw new Error('INVALID_RESPONSE');
    if (typeof t.title !== 'string' || typeof t.evidence_text !== 'string' || !clean(t.evidence_text) ||
      !clean(sourceText).includes(clean(t.evidence_text)) ||
      typeof t.confidence !== 'number' || !Number.isFinite(t.confidence) || t.confidence < 0 || t.confidence > 1 ||
      !['date', 'datetime', 'unknown'].includes(String(t.due_precision)) ||
      (t.due_at !== null && typeof t.due_at !== 'string') ||
      (t.assignee !== null && typeof t.assignee !== 'string') ||
      (t.description !== null && typeof t.description !== 'string') ||
      typeof t.needs_confirmation !== 'boolean') throw new Error('INVALID_RESPONSE');
    const due = t.due_at as string | null;
    const precision = t.due_precision as DuePrecision;
    validateDue(due, precision);
    return [{ title: normalizeTitle(t.title), description: (t.description as string | null)?.slice(0, 4000) ?? null,
      due_at: due, due_precision: precision, assignee: t.assignee as string | null, confidence: t.confidence,
      evidence_text: t.evidence_text.slice(0, 4000), needs_confirmation: t.needs_confirmation || !t.assignee ? 1 : 0 }];
  });
}
export function containsSensitiveText(text: string): boolean {
  return /(?:비밀번호|패스워드|password|인증\s*(?:번호|코드)|보안\s*코드|계좌\s*번호|주민\s*등록)/i.test(text) ||
    /\b\d{6}\s*[-–]\s*[1-4]\d{6}\b/.test(text) || /\b(?:\d[ -]?){16}\b/.test(text);
}
export function enforceDateContext(tasks: TaskSuggestion[], context: ExtractionContext): TaskSuggestion[] {
  if (context.message_date) return tasks;
  return tasks.map(task => {
    if (!task.due_at) return task;
    const relative = /오늘|내일|모레|글피|이번\s*주|다음\s*주|다음\s*달|이번\s*달|일\s*뒤|일\s*후/.test(task.evidence_text);
    const explicitYear = /\b\d{4}\s*(?:년|[-./])/.test(task.evidence_text);
    return relative || !explicitYear ? { ...task, due_at: null, due_precision: 'unknown', needs_confirmation: 1 } : task;
  });
}
