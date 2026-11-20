// Compilation must not consume the UI test's execution budget. The Intel CI
// measurement took ~29 minutes to build before XCTest could start.
function runUICommands(run, { device, resultPath, flow, architecture, onPhase, beforeTest }) {
  if (!['arm64', 'x86_64'].includes(architecture)) throw new Error('Unsupported simulator architecture.');
  const common = ['-workspace', 'ios/TTodo.xcworkspace', '-scheme', 'TTodoUITests',
    '-configuration', 'Release', '-destination', `id=${device}`, '-derivedDataPath', 'build',
    '-parallel-testing-enabled', 'NO', `ARCHS=${architecture}`, 'ONLY_ACTIVE_ARCH=YES',
    'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-'];
  const buildTimeout = (architecture === 'x86_64' ? 45 : 30) * 60000;
  onPhase('build-for-testing', buildTimeout);
  run('xcodebuild', [...common, 'build-for-testing'], { stdio: 'inherit', timeout: buildTimeout });
  beforeTest?.();
  const testTimeout = 15 * 60000;
  onPhase('test-without-building', testTimeout);
  run('xcodebuild', [...common, '-resultBundlePath', resultPath,
    '-only-testing:TTodoUITests/TTodoUITests/' + flow, 'test-without-building'],
    { stdio: 'inherit', timeout: testTimeout });
}
module.exports = { runUICommands };
