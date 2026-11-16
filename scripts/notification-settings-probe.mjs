import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync, openSync, closeSync } from 'node:fs';
import path from 'node:path';
import selection from './notification-probe-selection.cjs';
import helpValidation from './ui-diagnostic-help.cjs';
import configure from './configure-notification-probe.cjs';

if (process.platform !== 'darwin') throw new Error('GitHub macOS CI only.');
const output = path.resolve('artifacts/notification-probe');
mkdirSync(output, { recursive: true });
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024, ...options }).trim();
const sim = (...args) => run('xcrun', ['simctl', ...args]);
const flow = process.env.TTODO_PROBE_FLOW ?? 'deep-link';
if (!['deep-link', 'settings-list'].includes(flow)) throw new Error('Unsupported native probe flow.');
const method = flow === 'settings-list' ? 'testSettingsListBeforeAndAfterDenial' : 'testDeniedNotificationSettingsColdAndWarm';
const report = { commit: process.env.GITHUB_SHA, flow, physical_device: false, product_app_modified: false, completed: false };
let device;
const result = path.join(output, 'results.xcresult');
try {
  report.xcode = run('xcodebuild', ['-version']);
  report.sdk = run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-version']);
  const runtimes = JSON.parse(sim('list', 'runtimes', '--json'));
  const types = JSON.parse(sim('list', 'devicetypes', '--json'));
  writeFileSync(path.join(output, 'runtimes.json'), JSON.stringify(runtimes, null, 2));
  report.requested_runtime = process.env.TTODO_PROBE_RUNTIME ?? 'latest';
  const { runtime, deviceType } = selection.selectNotificationProbeSimulator(runtimes.runtimes, types.devicetypes, report.requested_runtime);
  report.runtime = { identifier: runtime.identifier, version: runtime.version, build: runtime.buildversion };
  report.device_type = { identifier: deviceType.identifier, name: deviceType.name };
  device = sim('create', 'TTodo native notification probe', deviceType.identifier, runtime.identifier);
  if (!/^[0-9a-f-]{36}$/i.test(device)) throw new Error('Invalid simulator UUID.');
  sim('boot', device);
  writeFileSync(path.join(output, 'boot.log'), run('xcrun', ['simctl', 'bootstatus', device, '-b'], { timeout: 600000 }));
  if (flow === 'settings-list') {
    const args = ['simctl', 'help', 'launch'];
    const help = spawnSync('xcrun', args, { encoding: 'utf8', timeout: 60000 });
    writeFileSync(path.join(output, 'simctl-launch-help.txt'), (help.stdout ?? '') + (help.stderr ?? ''));
    if (!helpValidation.supportsDiagnosticHelp('xcrun', args, help, ['launch', '<app bundle identifier>'])) throw new Error('SDK simulator app launch help unavailable.');
    // The first Settings launch in 43786035354 completed only after XCTest's
    // launch handshake timed out. Start that OS app before building the probe;
    // XCTest activates the same instance and still validates actual UI state.
    report.settings_prelaunch = sim('launch', device, 'com.apple.Preferences');
    // Observe the OS before generating, building or installing any app/test
    // target. This distinguishes simulator Settings from XCTest/app context.
    const logArgs = ['simctl', 'spawn', device, 'log', 'help', 'show'];
    const logHelp = spawnSync('xcrun', logArgs, { encoding: 'utf8', timeout: 60000 });
    writeFileSync(path.join(output, 'pretest-log-show-help.txt'), (logHelp.stdout ?? '') + (logHelp.stderr ?? ''));
    if (!helpValidation.supportsDiagnosticHelp('xcrun', logArgs, logHelp, ['--last', '--style', '--info', '--predicate'])) throw new Error('SDK pretest log support unavailable.');
    const predicate = 'process == "Preferences" AND (category == "Primary List Data Model" OR eventMessage CONTAINS "setLaunchHasCompleted")';
    let pretestLog = '';
    const deadline = Date.now() + 120000;
    do {
      pretestLog = sim('spawn', device, 'log', 'show', '--last', '3m', '--style', 'compact', '--info', '--predicate', predicate);
      if (pretestLog.includes('setLaunchHasCompleted')) break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    } while (Date.now() < deadline);
    writeFileSync(path.join(output, 'pretest-settings.log'), pretestLog);
    report.pretest_settings = { app_installed: false, test_runner_installed: false, app_settings_url_called: false, launch_completed: pretestLog.includes('setLaunchHasCompleted'), notifications_hidden: pretestLog.includes('Not including notifications due to being hidden.') };
    if (!report.pretest_settings.launch_completed) throw new Error('Settings did not report launch completion before the bounded pretest deadline.');
    sim('io', device, 'screenshot', path.join(output, 'pretest-settings.png'));
  }
  // Preserve the current SDK declaration; use no hardcoded settings URL.
  const sdkPath = run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path']);
  const header = readFileSync(path.join(sdkPath, 'System/Library/Frameworks/UIKit.framework/Headers/UIApplication.h'), 'utf8');
  writeFileSync(path.join(output, 'sdk-notification-settings-api.txt'), header.split('\n').filter(line => /OpenNotificationSettingsURLString|openURL:.*options:/.test(line)).join('\n'));
  configure.configureNotificationProbe(path.join(output, 'project'));
  execFileSync('xcodebuild', ['-project', path.join(output, 'project/Probe.xcodeproj'), '-scheme', 'ProbeTests', '-configuration', 'Release', '-destination', `id=${device}`, '-derivedDataPath', path.join(output, 'build'), '-resultBundlePath', result, '-only-testing:ProbeTests/NotificationSettingsProbeTests/' + method, '-parallel-testing-enabled', 'NO', 'ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES', 'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-', 'test'], { stdio: 'inherit', timeout: 12 * 60000 });
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
      // A fresh boot plus two Settings attempts exceeded the 16 MiB pipe buffer
      // in 43748991228. Stream to files so neither truncation nor ENOBUFS loses
      // the actual API/Settings evidence. Do not change or retry the UI test.
      const stdout = openSync(path.join(output, 'system.log'), 'w');
      const stderr = openSync(path.join(output, 'system-stderr.log'), 'w');
      try { execFileSync('xcrun', ['simctl', 'spawn', device, 'log', 'show', '--last', '12m', '--style', 'compact', '--info', '--predicate', predicate], { stdio: ['ignore', stdout, stderr], timeout: 60000 }); }
      finally { closeSync(stdout); closeSync(stderr); }
      report.diagnostics_completed = true;
    } catch (error) { report.diagnostic_error = error.message; }
    try { writeFileSync(path.join(output, 'appinfo.txt'), sim('appinfo', device, 'com.kimps005.ttodo.notificationprobe')); }
    catch (error) { report.appinfo_error = error.message; }
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
