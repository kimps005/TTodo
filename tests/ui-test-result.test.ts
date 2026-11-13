import { test } from 'node:test';
import assert from 'node:assert/strict';
const { validateManualUITestResult } = require('../scripts/ui-test-result.cjs');
const summary = { result: 'Passed', totalTestCount: 1, passedTests: 1, failedTests: 0, skippedTests: 0 };
const tests = { testNodes: [{ name: 'testManualTaskSurvivesRelaunchEditAndDelete()' }] };

test('UI 검사 명령이 성공해도 0개·건너뜀·실패·다른 테스트 결과는 완료로 표시하지 않는다', () => {
  assert.equal(validateManualUITestResult(summary, tests).passed, 1);
  for (const invalid of [null, {}, { ...summary, totalTestCount: 0, passedTests: 0 }, { ...summary, result: 'Failed' }, { ...summary, skippedTests: 1 }, { ...summary, failedTests: 1 }, { ...summary, passedTests: 0 }, { ...summary, totalTestCount: 2 }]) assert.throws(() => validateManualUITestResult(invalid, tests));
  assert.throws(() => validateManualUITestResult(summary, {}));
  assert.throws(() => validateManualUITestResult(summary, { testNodes: [{ name: 'someOtherTest()' }] }));
});
