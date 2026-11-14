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

test('최대 글자 흐름과 기본 전체 흐름의 실행 결과를 서로 대신 인정하지 않는다', () => {
  const flow = 'testLargeTextInputEditingAndNavigation';
  const large = { testNodes: [{ ...passedCase, nodeIdentifier: `TTodoUITests/${flow}()`, name: `${flow}()` }] };
  assert.equal(validateManualUITestResult(summary, large, flow).flow, flow);
  assert.throws(() => validateManualUITestResult(summary, large));
  assert.throws(() => validateManualUITestResult(summary, tests, flow));
  assert.throws(() => validateManualUITestResult(summary, large, 'arbitraryTest'));
});

test('공유 확장 흐름은 앱 조작 결과로 대체하지 않고 정확한 공유 테스트만 인정한다', () => {
  const flow = 'testShareExtensionRequiresConsent';
  const share = { testNodes: [{ ...passedCase, nodeIdentifier: `TTodoUITests/${flow}()`, name: `${flow}()` }] };
  assert.equal(validateManualUITestResult(summary, share, flow).flow, flow);
  assert.throws(() => validateManualUITestResult(summary, share));
  assert.throws(() => validateManualUITestResult(summary, tests, flow));
});

test('사진 OCR 흐름은 실제 지정 검사가 통과해야 하며 기본 앱 결과를 대신 인정하지 않는다', () => {
  const flow = 'testPhotoOCRAndCancelPreservesDraft';
  const photo = { testNodes: [{ ...passedCase, nodeIdentifier: `TTodoUITests/${flow}()`, name: `${flow}()` }] };
  assert.equal(validateManualUITestResult(summary, photo, flow).flow, flow);
  assert.throws(() => validateManualUITestResult(summary, photo));
  assert.throws(() => validateManualUITestResult(summary, tests, flow));
});
