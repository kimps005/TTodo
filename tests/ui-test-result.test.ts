import { test } from 'node:test';
import assert from 'node:assert/strict';
const { validateManualUITestResult } = require('../scripts/ui-test-result.cjs');
const summary = { result: 'Passed', totalTestCount: 1, passedTests: 1, failedTests: 0, skippedTests: 0, expectedFailures: 0 };
// Shape taken from the actual xcresulttool test-results output. Suites and
// failure messages can mention a method without proving that it passed.
const passedCase = { name: 'testManualTaskLifecycleAndDataReset()', nodeIdentifier: 'TTodoUITests/testManualTaskLifecycleAndDataReset()', nodeType: 'Test Case', result: 'Passed' };
const tests = { testNodes: [{ nodeType: 'Test Plan', children: [{ nodeType: 'UI test bundle', children: [{ nodeType: 'Test Suite', children: [passedCase] }] }] }] };

test('UI 검사 명령이 성공해도 0개·건너뜀·실패·다른 테스트 결과는 완료로 표시하지 않는다', () => {
  assert.equal(validateManualUITestResult(summary, tests).passed, 1);
  for (const invalid of [null, {}, { ...summary, totalTestCount: 0, passedTests: 0 }, { ...summary, result: 'Failed' }, { ...summary, skippedTests: 1 }, { ...summary, failedTests: 1 }, { ...summary, passedTests: 0 }, { ...summary, totalTestCount: 2 }]) assert.throws(() => validateManualUITestResult(invalid, tests));
  assert.throws(() => validateManualUITestResult(summary, {}));
  assert.throws(() => validateManualUITestResult(summary, { testNodes: [{ name: 'someOtherTest()' }] }));
  assert.throws(() => validateManualUITestResult(summary, { testNodes: [{ name: 'testManualTaskSurvivesRelaunchEditAndDelete()' }] }));
});

test('집계와 개별 테스트 ID·통과 상태가 일치해야 하며 이름만 포함한 다른 결과는 거부한다', () => {
  for (const nodes of [
    [{ ...passedCase, nodeType: 'Test Suite' }],
    [{ ...passedCase, nodeIdentifier: 'OtherSuite/testManualTaskLifecycleAndDataReset()' }],
    [{ ...passedCase, nodeIdentifier: passedCase.nodeIdentifier + 'Extra' }],
    [{ ...passedCase, result: 'Failed' }],
    [{ ...passedCase, result: 'Skipped' }],
    [{ ...passedCase, result: undefined }],
    [passedCase, passedCase],
    [{ ...passedCase, nodeIdentifier: 'OtherSuite/otherTest()', children: [{ nodeType: 'Failure Message', name: passedCase.name }] }],
  ]) assert.throws(() => validateManualUITestResult(summary, { testNodes: nodes }));
  assert.throws(() => validateManualUITestResult({ ...summary, expectedFailures: 1 }, tests));
  assert.throws(() => validateManualUITestResult({ ...summary, expectedFailures: undefined }, tests));
  assert.throws(() => validateManualUITestResult(summary, { note: passedCase.name }));
  assert.equal(validateManualUITestResult(summary, tests).total, 1);
});
