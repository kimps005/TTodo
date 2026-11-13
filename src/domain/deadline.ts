import { localDay, validateDue, type DuePrecision } from './todo';
export function deadlineFields(input: { due_at: string | null; due_precision: DuePrecision }) {
  if (!input.due_at) return { day: '', time: '' };
  if (input.due_precision === 'date') return { day: input.due_at, time: '' };
  const date = new Date(input.due_at);
  return { day: localDay(date), time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` };
}
export function composeDeadline(dayInput: string, timeInput: string): { due_at: string | null; due_precision: DuePrecision } {
  const day = dayInput.trim(); const time = timeInput.trim();
  if (!day && !time) return { due_at: null, due_precision: 'unknown' };
  validateDue(day || null, 'date');
  if (!time) return { due_at: day, due_precision: 'date' };
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) throw new Error('시각은 09:00 또는 17:30처럼 입력해 주세요.');
  const clock = `${match[1].padStart(2, '0')}:${match[2]}`;
  const date = new Date(`${day}T${clock}:00`);
  if (!Number.isFinite(date.getTime()) || localDay(date) !== day || date.getHours() !== Number(match[1]) || date.getMinutes() !== Number(match[2])) {
    throw new Error('현재 기기 시간대에서 사용할 수 없는 날짜나 시각이에요. 다시 확인해 주세요.');
  }
  return { due_at: date.toISOString(), due_precision: 'datetime' };
}
