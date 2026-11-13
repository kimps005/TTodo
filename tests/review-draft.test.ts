import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ExtractedTask } from '../src/data/repository';
import { reconcileReviewDrafts, reviewDraft } from '../src/domain/reviewDraft';

const task: ExtractedTask = { id: 'old', analysis_id: 'capture', title: '원래 제목', description: '설명', due_at: '2026-11-20', due_precision: 'date', assignee: '담당', confidence: .9, evidence_text: '원문 근거', needs_confirmation: 1, review_status: 'pending', linked_todo_id: null };

test('같은 대기 제안의 제목·날짜 편집과 선택은 보존하고 철회한 원문은 되살리지 않는다', () => {
  const edited = { ...reviewDraft(task), title: '수정 제목', day: '2026-11-21', time: '09:30', dateEdited: true, selected: false };
  const [result] = reconcileReviewDrafts([edited], [{ ...task, evidence_text: '' }]);
  assert.equal(result.title, edited.title); assert.equal(result.day, edited.day); assert.equal(result.time, edited.time);
  assert.equal(result.dateEdited, true); assert.equal(result.selected, false); assert.equal(result.evidence_text, '');
  assert.equal(edited.evidence_text, '원문 근거');
});

test('만료·삭제·외부 승인된 제안에는 예전 편집 본문과 선택을 덮어씌우지 않는다', () => {
  const edited = { ...reviewDraft(task), title: '캐시된 민감 제목', day: '2026-12-01', time: '17:00', dateEdited: true };
  for (const status of ['ignored', 'saved'] as const) {
    const scrubbed: ExtractedTask = { ...task, title: '삭제한 내용', description: null, due_at: null, due_precision: 'unknown', assignee: null, evidence_text: '', review_status: status };
    const [result] = reconcileReviewDrafts([edited], [scrubbed]);
    assert.equal(result.title, scrubbed.title); assert.equal(result.description, null); assert.equal(result.assignee, null);
    assert.equal(result.evidence_text, ''); assert.equal(result.day, ''); assert.equal(result.time, '');
    assert.equal(result.selected, false); assert.equal(result.dateEdited, false);
  }
});

test('재분석으로 교체된 제안은 예전 편집과 선택을 상속하지 않으며 제거된 본문은 버린다', () => {
  const next = { ...task, id: 'new', title: '새로 검토할 제안' };
  const result = reconcileReviewDrafts([reviewDraft(task)], [next]);
  assert.equal(result.length, 1); assert.equal(result[0].id, next.id); assert.equal(result[0].title, next.title);
  assert.equal(result[0].selected, false);
  assert.deepEqual(reconcileReviewDrafts([reviewDraft(task)], []), []);
});
