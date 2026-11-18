import type { FixtureEvaluationReport } from './fixtureEvaluation';

export type EvaluationExportFormat = 'json' | 'md';

type CaseResult = FixtureEvaluationReport['results'][number];
type ReviewTask = CaseResult['expected'][number] | NonNullable<CaseResult['actual']>[number];
const escapeCell = (value: string) => value
  .replace(/[&<>|\\`*_\[\]~]/g, character => '&#' + character.charCodeAt(0) + ';')
  .replace(/\r\n?|\n/g, '<br>');

function taskCell(tasks: readonly ReviewTask[]) {
  return tasks.map((task, index) => {
    const lines = [
      (index + 1) + '. ' + task.title,
      '마감 ' + (task.due_at ?? '없음') + ' (' + task.due_precision + ')',
      '담당 ' + (task.assignee ?? '미지정'),
      '근거 ' + task.evidence_text,
    ];
    if ('description' in task) {
      if (task.description) lines.push('설명 ' + task.description);
      lines.push('신뢰도 ' + task.confidence + ' · 확인 필요 ' + (task.needs_confirmation ? '예' : '아니요'));
    }
    return escapeCell(lines.join('\n'));
  }).join('<br><br>') || '할 일 없음';
}

function markdownReport(report: FixtureEvaluationReport, operatingSystem: string | null) {
  const metrics = report.metrics;
  const targetRows = [
    { name: '할 일 정밀도', counts: metrics.tp + ' / ' + (metrics.tp + metrics.fp), ...report.targets.precision },
    { name: '명시적 마감일 정확도', counts: metrics.correctDeadlines + ' / ' + metrics.deadlines, ...report.targets.deadlineAccuracy },
  ];
  const lines = [
    '# TTodo 기기 내 AI 평가',
    '',
    '- 자동 판정 **' + report.status + '**',
    '- 모델 가용성 ' + escapeCell(report.availability),
    '- 평가 시각 ' + report.generated_at + ' · OS ' + escapeCell(operatingSystem ?? '미기록'),
    '- 제공자 ' + escapeCell(report.provider) + ' · 데이터셋 ' + report.dataset_version + ' · 리포트 형식 ' + report.format_version,
    '',
    '## PRD 목표 요약',
    '',
    '| 지표 | 목표 | 자동 측정값 (정답 / 전체) | 목표 판정 |',
    '| --- | --- | --- | --- |',
    ...targetRows.map(row => {
      const measured = row.measured_percent === null ? '측정 불가' : row.measured_percent.toFixed(1) + '% (' + row.counts + ')';
      return '| ' + row.name + ' | ' + row.minimum_percent + '% 이상 | ' + measured + ' | ' + row.status + ' |';
    }),
    '',
    '자동 채점은 고정 어휘와 원문 근거를 비교합니다. 원문, 기대값, 제품 경로를 거친 모델 출력을 대조한 뒤 체크하고 불일치는 메모에 기록하세요.',
    '',
    '## 케이스별 판정',
    '',
  ];
  if (report.results.length === 0) {
    lines.push('검토할 실행 결과가 없습니다.');
  } else {
    lines.push('| 원문 | 기대값 | 모델 출력 | 판정 체크칸 |', '| --- | --- | --- | --- |');
    for (const row of report.results) {
      const { text, captured_at, message_date, timezone } = row.input;
      const source = escapeCell([row.id + ' · ' + row.category, text || '(글자 없음)',
        '캡처 ' + (captured_at ?? '미지정'), '메시지 기준일 ' + (message_date ?? '미지정') + ' · ' + timezone].join('\n'));
      const output = row.actual === null ? '실행 오류 (EXTRACTION_FAILED)' : taskCell(row.actual);
      const review = row.actual === null ? '재실행 필요' : [
        '[ ] 할 일 일치',
        row.score.deadlines > 0 ? '[ ] 명시 마감일 일치' : '명시 마감일 해당 없음',
        '메모 ____________________',
      ].join('<br>');
      lines.push('| ' + [source, taskCell(row.expected), output, review].join(' | ') + ' |');
    }
  }
  return lines.join('\n') + '\n';
}

export function serializeEvaluationReport(
  report: FixtureEvaluationReport,
  format: EvaluationExportFormat,
  operatingSystem: string | null = null,
) {
  if (format === 'md') return markdownReport(report, operatingSystem);
  return JSON.stringify({
    ...report,
    operating_system: operatingSystem,
    results: report.results.map(row => ({
      ...row,
      review: { tasks_correct: null, explicit_deadlines_correct: null, notes: null },
    })),
  }, null, 2) + '\n';
}
