import { writeFileSync } from 'node:fs';
import { createVerdictTemplate } from '../evaluation/score';
import { readEvaluationJson } from './read-evaluation-json';

const [reportPath, outputPath] = process.argv.slice(2);
if (!reportPath || process.argv.length > 4) {
  console.error('사용법: npx tsx scripts/prepare-evaluation-verdict.ts 평가결과.json [새-판정파일.json]');
  process.exitCode = 1;
} else {
  try {
    const report = readEvaluationJson(reportPath) as Parameters<typeof createVerdictTemplate>[0];
    const output = JSON.stringify(createVerdictTemplate(report), null, 2) + '\n';
    if (outputPath) writeFileSync(outputPath, output, { encoding: 'utf8', flag: 'wx' });
    else process.stdout.write(output);
  } catch {
    console.error('평가 결과가 불완전하거나 출력 파일을 새로 만들 수 없어요.');
    process.exitCode = 1;
  }
}
