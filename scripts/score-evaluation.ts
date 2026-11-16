import { scoreEvaluation } from '../evaluation/score';
import { readEvaluationJson } from './read-evaluation-json';

const [reportPath, verdictPath] = process.argv.slice(2);
if (!reportPath || !verdictPath || process.argv.length !== 4) {
  console.error('사용법: npx tsx scripts/score-evaluation.ts 평가결과.json 수동판정.json');
  process.exitCode = 1;
} else {
  try {
    const report = readEvaluationJson(reportPath) as Parameters<typeof scoreEvaluation>[0];
    const verdicts = readEvaluationJson(verdictPath) as Parameters<typeof scoreEvaluation>[1];
    console.log(JSON.stringify(scoreEvaluation(report, verdicts), null, 2));
  } catch {
    // Do not print raw file contents or exceptions that might contain paths or text.
    console.error('평가 결과나 수동 판정을 집계하지 못했어요. 형식과 판정 누락을 확인해 주세요.');
    process.exitCode = 1;
  }
}
