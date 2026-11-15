import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import selection from './ui-simulator-selection.cjs';
import helpValidation from './ui-diagnostic-help.cjs';
import configure from './configure-notification-probe.cjs';

if (process.platform !== 'darwin') throw new Error('GitHub macOS CI only.');
const output = path.resolve('artifacts/notification-probe');
mkdirSync(output, { recursive: true });
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024, ...options }).trim();
const sim = (...args) => run('xcrun', ['simctl', ...args]);
const report = { commit: process.env.GITHUB_SHA, physical_device: false, product_app_modified: false, completed: false };
let device;
const result = path.join(output, 'results.xcresult');
try {
  report.xcode = run('xcodebuild', ['-version']);
  report.sdk = run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-version']);
  const runtimes = JSON.parse(sim('list', 'runtimes', '--json'));
  const types = JSON.parse(sim('list', 'devicetypes', '--json'));
  writeFileSync(path.join(output, 'runtimes.json'), JSON.stringify(runtimes, null, 2));
  const { runtime, deviceType } = selection.selectUISimulator(runtimes.runtimes, types.devicetypes, 'iphone-16-pro', process.env.TTODO_PROBE_RUNTIME ?? 'latest');
  report.runtime = runtime; report.device_type = deviceType;
  device = sim('create', 'TTodo native notification probe', deviceType.identifier, runtime.identifier);
  if (!/^[0-9a-f-]{36}$/i.test(device)) throw new Error('Invalid simulator UUID.');
  sim('boot', device);
  writeFileSync(path.join(output, 'boot.log'), run('xcrun', ['simctl', 'bootstatus', device, '-b'], { timeout: 600000 }));
  // Preserve the current SDK declaration; use no hardcoded settings URL.
  const sdkPath = run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path']);
  const header = readFileSync(path.join(sdkPath, 'System/Library/Frameworks/UIKit.framework/Headers/UIApplication.h'), 'utf8');
  writeFileSync(path.join(output, 'sdk-notification-settings-api.txt'), header.split('\n').filter(line => /OpenNotificationSettingsURLString|openURL:.*options:/.test(line)).join('\n'));
  configure.configureNotificationProbe(path.join(output, 'project'));
  execFileSync('xcodebuild', ['-project', path.join(output, 'project/Probe.xcodeproj'), '-scheme', 'ProbeTests', '-configuration', 'Release', '-destination', `id=${device}`, '-derivedDataPath', path.join(output, 'build'), '-resultBundlePath', result, '-parallel-testing-enabled', 'NO', 'ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES', 'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-', 'test'], { stdio: 'inherit', timeout: 12 * 60000 });
  const summary = JSON.parse(run('xcrun', ['xcresulttool', 'get', 'test-results', 'summary', '--path', result]));
  if (summary.result !== 'Passed' || summary.totalTestCount !== 1 || summary.passedTests !== 1 || summary.failedTests !== 0 || summary.skippedTests !== 0 || summary.expectedFailures !== 0) throw new Error('The native comparison must run exactly one test without skips or failures.');
  report.completed = true;
} catch (error) { report.error = error.message; process.exitCode = 1; }
finally {
  if (device && /^[0-9a-f-]{36}$/i.test(device)) {
    try {
      const args = ['simctl', 'spawn', device, 'log', 'help', 'show'];
      const help = spawnSync('xcrun', args, { encoding: 'utf8', timeout: 60000 });
      writeFileSync(path.join(output, 'log-show-help.txt'), (help.stdout ?? '') + (help.stderr ?? ''));
      if (!helpValidation.supportsDiagnosticHelp('xcrun', args, help, ['--last', '--style', '--info', '--predicate'])) throw new Error('SDK log options unavailable.');
      const predicate = 'process == "Preferences" OR process == "lsd" OR process == "SpringBoard" OR process == "usernotificationsd" OR (subsystem == "app.ttodo.ci" AND eventMessage BEGINSWITH "TTodoNotificationSettingsDiagnostic")';
      writeFileSync(path.join(output, 'system.log'), sim('spawn', device, 'log', 'show', '--last', '12m', '--style', 'compact', '--info', '--predicate', predicate));
      writeFileSync(path.join(output, 'appinfo.txt'), sim('appinfo', device, 'com.kimps005.ttodo.notificationprobe'));
      report.diagnostics_completed = true;
    } catch (error) { report.diagnostic_error = error.message; }
    if (existsSync(result)) {
      for (const name of ['summary', 'tests']) {
        try { writeFileSync(path.join(output, `${name}.json`), run('xcrun', ['xcresulttool', 'get', 'test-results', name, '--path', result])); } catch (error) { report[`${name}_error`] = error.message; }
      }
      try { run('xcrun', ['xcresulttool', 'export', 'attachments', '--path', result, '--output-path', path.join(output, 'attachments')]); } catch (error) { report.attachment_error = error.message; }
    }
    try { sim('shutdown', device); sim('delete', device); } catch {}
  }
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
