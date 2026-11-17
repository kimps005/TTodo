import { Text } from 'react-native';
import type { runFixtureEvaluation } from '../ai/fixtureEvaluation';
import { ui } from '../ui/theme';
type Report = Awaited<ReturnType<typeof runFixtureEvaluation>>;
const percent = (value: number | null) => value === null ? '측정 불가' : `${value.toFixed(1)}%`;
export function EvaluationReport({ report }: { report: Report }) {
  const m = report.metrics;
  return <>
    <Text accessibilityRole="header" style={ui.section}>{report.completed ? '자동 평가 결과' : '부분 결과 · 목표 판정 불가'}</Text>
    <Text selectable style={ui.subtitle}>{`정밀도 (Precision): ${percent(m.precision)} · 목표 90%\n재현율 (Recall): ${percent(m.recall)}\n명시 마감일 정확도: ${percent(m.deadlineAccuracy)} · 목표 95%\nTP ${m.tp} / FP ${m.fp} / FN ${m.fn}\n마감 정답 ${m.correctDeadlines} / ${m.deadlines}\n${report.meetsAutomaticTargets ? '자동 판정 목표 도달 · 의미 검토 필요' : '목표 미도달 또는 평가 미완료'}`}</Text>
    {report.results.map(row => <Text selectable key={row.id} style={ui.small}>{row.id} · 오탐 {row.score.fp} · 누락 {row.score.fn} · 마감 오류 {row.score.deadlineErrors.length} · 불필요 마감 {row.score.unexpectedDeadlines.length}{row.error ? ' · 모델 오류' : ''}{row.score.falsePositives.map(i => '\n오탐: ' + row.actual[i].title).join('')}{row.score.missed.map(i => '\n누락: ' + row.expected[i].title).join('')}{row.score.deadlineErrors.map(i => {
      const pair = row.score.matches.find(pair => pair.expected === i);
      const actual = pair === undefined ? undefined : row.actual[pair.actual];
      return '\n마감 불일치: ' + row.expected[i].title + ' / 정답 ' + row.expected[i].due_at + ' / 출력 ' + (actual?.due_at ?? '없음');
    }).join('')}</Text>)}
  </>;
}
