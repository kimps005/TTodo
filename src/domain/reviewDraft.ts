import type { ExtractedTask } from '../data/repository';
import { composeDeadline, deadlineFields } from './deadline';
import { dueLabel, type TodoInput } from './todo';

export type ReviewDraft = ExtractedTask & { selected: boolean; dateEdited: boolean; day: string; time: string; reminder: boolean };

export function reviewDraft(task: ExtractedTask, selected = task.review_status === 'pending' && task.confidence > 0): ReviewDraft {
  return { ...task, ...deadlineFields(task), selected, dateEdited: false, reminder: false };
}

export function reviewInput(draft: ReviewDraft): TodoInput {
  return {
    title: draft.title, description: draft.description,
    reminder: draft.reminder,
    ...(draft.dateEdited ? composeDeadline(draft.day, draft.time) : { due_at: draft.due_at, due_precision: draft.due_precision }),
  };
}

export function reviewDeadlineLabel(draft: ReviewDraft): string {
  try {
    const input = reviewInput(draft);
    return dueLabel({ due_at: input.due_at ?? null, due_precision: input.due_precision ?? 'unknown' });
  } catch {
    // An incomplete edit must not keep displaying the model's original deadline.
    // Approval still runs the same validation and reports its specific error.
    return '입력한 날짜·시각을 확인해 주세요.';
  }
}

export function reconcileReviewDrafts(current: ReviewDraft[], stored: ExtractedTask[]): ReviewDraft[] {
  const previous = new Map(current.map(item => [item.id, item]));
  return stored.map(task => {
    const old = previous.get(task.id);
    // IDs survive ordinary refreshes, but are replaced by reanalysis. Newly
    // discovered proposals require a new selection instead of inheriting approval.
    if (task.review_status !== 'pending' || old?.review_status !== 'pending') return reviewDraft(task, false);
    // Only keep editable fields. Evidence, status and deleted content always
    // come from storage so refreshing cannot restore a scrubbed private body.
    return { ...task, title: old.title, selected: old.selected, dateEdited: old.dateEdited, day: old.day, time: old.time, reminder: old.reminder };
  });
}
