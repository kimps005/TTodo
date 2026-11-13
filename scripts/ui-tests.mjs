import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

if (process.platform !== 'darwin') throw new Error('이 검사는 GitHub macOS CI에서만 실행합니다.');
const output = path.resolve('artifacts/ui-tests'); mkdirSync(output, { recursive: true });
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', timeout: 240000, maxBuffer: 16 * 1024 * 1024, ...options }).trim();
const sim = (...args) => run('xcrun', ['simctl', ...args]);
const report = { commit: process.env.GITHUB_SHA ?? null, fixture: 'synthetic-only-via-ui', physical_device: false, model_inference_tested: false, locked_input_tested: false, completed: false, phase: 'create' };
let device;
try {
  const runtimes = JSON.parse(sim('list', 'runtimes', '--json')).runtimes.filter(item => item.isAvailable && item.identifier.includes('.iOS-'));
  runtimes.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  if (!runtimes[0]) throw new Error('No available iOS simulator runtime.');
  report.runtime = runtimes[0].identifier;
  device = sim('create', 'TTodo CI UI Tests', 'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro', runtimes[0].identifier);
  if (!/^[0-9a-f-]{36}$/i.test(device)) throw new Error('Unexpected simulator identifier.');
  report.phase = 'boot'; console.log('UI tests: booting the isolated CI simulator');
  sim('boot', device);
  writeFileSync(path.join(output, 'boot.log'), run('xcrun', ['simctl', 'bootstatus', device, '-b'], { timeout: 600000 }));
  report.phase = 'test'; console.log('UI tests: building and running the synthetic manual task flow');
  execFileSync('xcodebuild', ['-workspace', 'ios/TTodo.xcworkspace', '-scheme', 'TTodoUITests', '-configuration', 'Release', '-destination', `id=${device}`, '-derivedDataPath', 'build', '-resultBundlePath', path.join(output, 'results.xcresult'), '-parallel-testing-enabled', 'NO', 'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-', 'test'], { stdio: 'inherit', timeout: 30 * 60000 });
  report.completed = true; report.phase = 'complete';
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  if (device && /^[0-9a-f-]{36}$/i.test(device)) {
    try { sim('io', device, 'screenshot', path.join(output, 'failure.png')); } catch {}
  }
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  if (device && /^[0-9a-f-]{36}$/i.test(device)) {
    try { sim('shutdown', device); } catch {}
    try { sim('delete', device); } catch {}
  }
  console.log(JSON.stringify(report));
}
