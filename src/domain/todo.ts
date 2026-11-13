export type DuePrecision = 'date' | 'datetime' | 'unknown';
export type SourceType = 'manual' | 'screenshot' | 'share';
export interface Todo {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  status: 'pending' | 'completed';
  due_at: string | null;
  due_precision: DuePrecision;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  source_type: SourceType;
  source_id: string | null;
  sort_order: number;
  visibility: 'private' | 'shared';
  sync_state: 'local' | 'pending' | 'synced';
}
export interface TodoInput {
  title: string;
  description?: string | null;
  due_at?: string | null;
  due_precision?: DuePrecision;
}
export const TITLE_LIMIT = 200;
export function normalizeTitle(value: string): string {
  const title = value.trim();
  if (!title) throw new Error('할 일을 입력해 주세요.');
  if (Array.from(title).length > TITLE_LIMIT) throw new Error(`제목은 ${TITLE_LIMIT}자까지 입력할 수 있어요.`);
  return title;
}
export function validateDue(due: string | null, precision: DuePrecision): void {
  if (!['date', 'datetime', 'unknown'].includes(precision) || due === '') throw new Error('마감 날짜를 확인해 주세요.');
  if (!due && precision !== 'unknown') throw new Error('마감 날짜를 지정해 주세요.');
  if (due && (precision === 'unknown' || !Number.isFinite(Date.parse(due)))) throw new Error('마감 날짜를 확인해 주세요.');
  if (due && precision === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || new Date(`${due}T12:00:00Z`).toISOString().slice(0, 10) !== due) {
      throw new Error('날짜는 YYYY-MM-DD 형식으로 입력해 주세요.');
    }
  }
  if (due && precision === 'datetime') {
    const datePart = due.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(due) ||
      new Date(`${datePart}T12:00:00Z`).toISOString().slice(0, 10) !== datePart) throw new Error('시간대가 포함된 정확한 마감 시각을 지정해 주세요.');
  }
}
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function dueDay(todo: Pick<Todo, 'due_at' | 'due_precision'>): string | null {
  if (!todo.due_at) return null;
  return todo.due_precision === 'date' ? todo.due_at : localDay(new Date(todo.due_at));
}
export function sortTodos(todos: Todo[], now = new Date()): Todo[] {
  const today = localDay(now);
  const rank = (todo: Todo) => {
    if (todo.status === 'completed') return 4;
    const day = dueDay(todo);
    if (day === today) return 0;
    if (day && day < today) return 1;
    return day ? 3 : 2;
  };
  const dueOrder = (a: Todo, b: Todo) => {
    const day = (dueDay(a) ?? '').localeCompare(dueDay(b) ?? '');
    if (day || !a.due_at || !b.due_at) return day;
    if (a.due_precision !== b.due_precision) return a.due_precision === 'date' ? -1 : 1;
    return a.due_precision === 'datetime' ? Date.parse(a.due_at) - Date.parse(b.due_at) : 0;
  };
  return [...todos].sort((a, b) => rank(a) - rank(b) || dueOrder(a, b) || a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}
export function dueLabel(todo: Pick<Todo, 'due_at' | 'due_precision'>): string {
  if (!todo.due_at) return '마감 없음';
  const date = new Date(todo.due_precision === 'date' ? `${todo.due_at}T12:00:00` : todo.due_at);
  return date.toLocaleString('ko-KR', {
    month: 'long', day: 'numeric', ...(todo.due_precision === 'datetime' ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}
