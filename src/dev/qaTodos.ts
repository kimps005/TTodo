import { localDay, type TodoInput } from '../domain/todo';

export function sampleTodos(now = new Date()): (TodoInput & { completed?: boolean })[] {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const soon = new Date(now.getTime() + 30 * 60 * 1000);

  return [
    {
      title: '[QA] 이번 주에 전달받은 회의 메모와 팀별 피드백을 확인한 뒤 발표 자료의 일정표와 이미지 설명을 고쳐 최종본을 공유하기',
      description: '첫 줄은 수정할 내용을 확인해요.\n둘째 줄은 큰 글자에서 줄바꿈을 확인해요.',
    },
    { title: '[QA] 발표 자료 제출', due_at: soon.toISOString(), due_precision: 'datetime' },
    { title: '[QA] 오늘 회의 준비', due_at: localDay(now), due_precision: 'date' },
    { title: '[QA] 지난 마감 항목', due_at: localDay(yesterday), due_precision: 'date' },
    { title: '[QA] 준비물 확인', completed: true },
  ];
}
