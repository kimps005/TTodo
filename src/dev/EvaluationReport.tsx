import { Text } from 'react-native';
import type { FixtureEvaluationReport } from '../ai/fixtureEvaluation';
import { ui } from '../ui/theme';

const percent = (value: number | null) => value === null ? '측정 불가' : `${value.toFixed(1)}%`;
const statusLabels: Record<FixtureEvaluationReport['status'], string> = {
  PASS: '자동 목표 달성 · 사람 검수 대기',
  FAIL: '자동 목표 미달성',
  INCOMPLETE: '평가 미완료 · 목표 판정 보류',
  SKIPPED_UNAVAILABLE: '모델 사용 불가 · 평가 건너뜀',
};
export function EvaluationReport({ report }: { report: FixtureEvaluationReport }) {
  const m = report.metrics;
  const { precision, deadlineAccuracy } = report.targets;
  return <>
    <Text accessibilityRole="header" style={ui.section}>{statusLabels[report.status]} ({report.status})</Text>
    <Text selectable style={ui.subtitle}>{`정밀도 (Precision): ${percent(m.precision)} · 목표 ${precision.minimum_percent}%\n재현율 (Recall): ${percent(m.recall)}\n명시 마감일 정확도: ${percent(m.deadlineAccuracy)} · 목표 ${deadlineAccuracy.minimum_percent}%\nTP ${m.tp} / FP ${m.fp} / FN ${m.fn}\n마감 정답 ${m.correctDeadlines} / ${m.deadlines}`}</Text>
    {report.results.map(row => <Text selectable key={row.id} style={ui.small}>{row.id} · 오탐 {row.score.fp} · 누락 {row.score.fn} · 마감 오류 {row.score.deadlineErrors.length} · 불필요 마감 {row.score.unexpectedDeadlines.length}{row.error ? ' · 모델 오류' : ''}{row.actual && row.score.falsePositives.map(i => '\n오탐: ' + row.actual?.[i].title).join('')}{row.score.missed.map(i => '\n누락: ' + row.expected[i].title).join('')}{row.score.deadlineErrors.map(i => {
      const pair = row.score.matches.find(pair => pair.expected === i);
      const actual = pair === undefined ? undefined : row.actual?.[pair.actual];
      return '\n마감 불일치: ' + row.expected[i].title + ' / 정답 ' + row.expected[i].due_at + ' / 출력 ' + (actual?.due_at ?? '없음');
    }).join('')}</Text>)}
  </>;
}
