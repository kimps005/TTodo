import { readFileSync } from 'node:fs';
import { createVerdictTemplate } from '../evaluation/score';

const [reportPath] = process.argv.slice(2);
if (!reportPath || process.argv.length !== 3) {
  console.error('사용법: npx tsx scripts/prepare-evaluation-verdict.ts 평가결과.json');
  process.exitCode = 1;
} else {
  try {
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    console.log(JSON.stringify(createVerdictTemplate(report), null, 2));
  } catch {
    console.error('평가 결과가 완전하지 않거나 정답셋과 일치하지 않아요.');
    process.exitCode = 1;
  }
}
