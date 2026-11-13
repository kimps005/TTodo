import type { ExtractedTask } from '../data/repository';
import { deadlineFields } from './deadline';

export type ReviewDraft = ExtractedTask & { selected: boolean; dateEdited: boolean; day: string; time: string };

export function reviewDraft(task: ExtractedTask, selected = task.review_status === 'pending'): ReviewDraft {
  return { ...task, ...deadlineFields(task), selected, dateEdited: false };
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
    return { ...task, title: old.title, selected: old.selected, dateEdited: old.dateEdited, day: old.day, time: old.time };
  });
}
