const manualFlow = 'testManualTaskSurvivesRelaunchEditAndDelete';

function validateManualUITestResult(summary, tests) {
  if (summary?.result !== 'Passed' || summary.totalTestCount !== 1 || summary.passedTests !== 1 || summary.failedTests !== 0 || summary.skippedTests !== 0 || !JSON.stringify(tests ?? {}).includes(manualFlow)) {
    throw new Error('The specified manual UI flow must run once and pass without skipped or failed tests.');
  }
  return { flow: manualFlow, total: summary.totalTestCount, passed: summary.passedTests, failed: summary.failedTests, skipped: summary.skippedTests };
}
module.exports = { validateManualUITestResult };
