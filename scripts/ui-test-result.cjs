const manualFlow = 'testManualTaskLifecycleAndDataReset';
const largeTextFlow = 'testLargeTextInputEditingAndNavigation';
const shareFlow = 'testShareExtensionRequiresConsent';
const photoFlow = 'testPhotoOCRAndCancelPreservesDraft';

function validateManualUITestResult(summary, tests, flow = manualFlow) {
  if (![manualFlow, largeTextFlow, shareFlow, photoFlow].includes(flow)) throw new Error('Unknown UI flow.');
  const cases = [];
  function visit(nodes) {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      if (node.nodeType === 'Test Case') cases.push(node);
      visit(node.children);
    }
  }
  visit(tests?.testNodes);
  const test = cases[0];
  if (summary?.result !== 'Passed' || summary.totalTestCount !== 1 || summary.passedTests !== 1 || summary.failedTests !== 0 || summary.skippedTests !== 0 || summary.expectedFailures !== 0 ||
    cases.length !== 1 || test.nodeIdentifier !== `TTodoUITests/${flow}()` || test.result !== 'Passed') {
    throw new Error('The specified UI flow must run once and pass without skipped or failed tests.');
  }
  return { flow, total: summary.totalTestCount, passed: summary.passedTests, failed: summary.failedTests, skipped: summary.skippedTests };
}
module.exports = { validateManualUITestResult };
