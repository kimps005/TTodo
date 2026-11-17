import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ExtractedTask } from '../src/data/repository';
import { reconcileReviewDrafts, reviewDraft, reviewDeadlineLabel, reviewInput } from '../src/domain/reviewDraft';
import { dueLabel } from '../src/domain/todo';

const task: ExtractedTask = { id: 'old', analysis_id: 'capture', title: '원래 제목', description: '설명', due_at: '2026-11-20', due_precision: 'date', assignee: '담당', confidence: .9, evidence_text: '원문 근거', needs_confirmation: 1, review_status: 'pending', linked_todo_id: null };

test('OCR 반자동 항목은 탭 전 선택하지 않고 알림 편집은 같은 대기 항목에만 보존한다', () => {
  const ocr = { ...task, confidence: 0, capture_provider: 'vision-ocr/manual-v1' };
  assert.equal(reviewDraft(ocr).selected, false);
  assert.equal(reviewDraft({ ...ocr, capture_provider: 'apple-ondevice/prompt-v2' }).selected, true, '모델 신뢰도 0을 OCR 처리 유형으로 오인하지 않는다');
  const draft = { ...reviewDraft(ocr), selected: true, reminder: true };
  const [same] = reconcileReviewDrafts([draft], [ocr]);
  assert.equal(same.selected, true); assert.equal(same.reminder, true);
  assert.equal(reviewInput(same).reminder, true);
  for (const fresh of [{ ...ocr, id: 'new' }, { ...ocr, review_status: 'saved' as const }]) {
    const [changed] = reconcileReviewDrafts([draft], [fresh]);
    assert.equal(changed.selected, false); assert.equal(changed.reminder, false);
  }
});

test('마감 편집과 해제는 검토 표시와 승인 입력에 함께 반영한다', () => {
  const edited = { ...reviewDraft(task), day: '2027-01-02', time: '09:30', dateEdited: true };
  const input = reviewInput(edited);
  assert.equal(input.due_at, new Date('2027-01-02T09:30:00').toISOString());
  assert.equal(input.due_precision, 'datetime');
  assert.equal(reviewDeadlineLabel(edited), dueLabel({ due_at: input.due_at!, due_precision: 'datetime' }));
  assert.notEqual(reviewDeadlineLabel(edited), reviewDeadlineLabel(reviewDraft(task)));
  const cleared = { ...edited, day: '', time: '' };
  assert.equal(reviewInput(cleared).due_at, null);
  assert.equal(reviewInput(cleared).due_precision, 'unknown');
  assert.equal(reviewDeadlineLabel(cleared), '마감 없음');
});

test('미완성·잘못된 마감은 이전 AI 날짜로 표시하지 않고 승인도 거부한다', () => {
  for (const [day, time] of [['2027-01-', ''], ['2027-02-30', ''], ['', '09:30'], ['2027-01-02', '24:00']]) {
    const edited = { ...reviewDraft(task), day, time, dateEdited: true };
    assert.equal(reviewDeadlineLabel(edited), '입력한 날짜·시각을 확인해 주세요.');
    assert.throws(() => reviewInput(edited));
  }
});

test('마감을 편집하지 않으면 원래 시간대·초·밀리초를 승인 입력에 보존한다', () => {
  const original = { ...task, due_at: '2026-11-20T09:30:25.123+09:00', due_precision: 'datetime' as const };
  const draft = { ...reviewDraft(original), title: '제목만 수정' };
  assert.equal(reviewInput(draft).due_at, original.due_at);
  assert.equal(reviewInput(draft).due_precision, original.due_precision);
  assert.equal(reviewDeadlineLabel(draft), dueLabel(original));
});

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
