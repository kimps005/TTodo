import { execFileSync, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import resultValidation from './ui-test-result.cjs';
import simulatorSelection from './ui-simulator-selection.cjs';
import diagnosticHelp from './ui-diagnostic-help.cjs';
import uiCommands from './ui-test-commands.cjs';

if (process.platform !== 'darwin') throw new Error('이 검사는 GitHub macOS CI에서만 실행합니다.');
const output = path.resolve('artifacts/ui-tests'); mkdirSync(output, { recursive: true });
const resultPath = path.join(output, 'results.xcresult');
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', timeout: 240000, maxBuffer: 16 * 1024 * 1024, ...options }).trim();
const sim = (...args) => run('xcrun', ['simctl', ...args]);
const textSize = process.env.TTODO_UI_TEXT_SIZE ?? 'large';
if (!['large', 'accessibility-extra-extra-extra-large'].includes(textSize)) throw new Error('Unsupported UI text size.');
const scenario = process.env.TTODO_UI_SCENARIO ?? 'app';
const model = process.env.TTODO_UI_MODEL ?? 'iphone-16-pro';
const runtimePolicy = process.env.TTODO_UI_RUNTIME ?? 'latest';
const architecture = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'x86_64' : null;
if (!architecture) throw new Error('Unsupported CI host architecture.');
if (!['app', 'share-extension', 'photo-ocr', 'data-reset', 'task-lifecycle'].includes(scenario)) throw new Error('Unsupported UI scenario.');
const flow = scenario === 'task-lifecycle' ? 'testManualTaskLifecycleWithoutSettingsNavigation' : scenario === 'data-reset' ? 'testDataResetAndConsentWithoutSettingsNavigation' : scenario === 'photo-ocr' ? 'testPhotoAutoAnalysisAndConsent' : scenario === 'share-extension' ? 'testShareExtensionRequiresConsent' : textSize === 'large' ? 'testManualTaskLifecycleAndDataReset' : 'testLargeTextInputEditingAndNavigation';
const report = { requested_model: model, requested_runtime_policy: runtimePolicy, commit: process.env.GITHUB_SHA ?? null, scenario, fixture: 'synthetic-only-via-ui', physical_device: false, model_inference_tested: false, locked_input_tested: false, completed: false, phase: 'create' };
function collectPhotoImportDiagnostics(device) {
  // Only this fresh synthetic simulator is inspected, before product execution.
  // Preserve the original import timeout even if diagnostics also fail.
  const diagnostics = report.photo_import_diagnostics = { completed: false };
  const args = ['simctl', 'spawn', device, 'log', 'help', 'show'];
  const help = spawnSync('xcrun', args, { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 });
  writeFileSync(path.join(output, 'photo-import-log-help.txt'), (help.stdout ?? '') + (help.stderr ?? ''));
  if (!diagnosticHelp.supportsDiagnosticHelp('xcrun', args, help, ['--last', '--style', '--predicate', '--info'])) {
    throw new Error('SDK photo import diagnostic log help unavailable.');
  }
  const stdout = openSync(path.join(output, 'photo-import-system.log'), 'w');
  try {
    const stderr = openSync(path.join(output, 'photo-import-system-stderr.log'), 'w');
    try {
      const predicate = 'process == "assetsd" OR process == "photolibraryd" OR process == "Photos" OR process == "SpringBoard" OR subsystem BEGINSWITH "com.apple.photos"';
      // Direct file output avoids the pipe buffer limit for simulator logs.
      const result = spawnSync('xcrun', ['simctl', 'spawn', device, 'log', 'show', '--last', '8m', '--style', 'compact', '--info', '--predicate', predicate], { stdio: ['ignore', stdout, stderr], timeout: 60000 });
      diagnostics.status = result.status;
      diagnostics.signal = result.signal;
      diagnostics.code = result.error?.code ?? null;
      diagnostics.completed = !result.error && result.status === 0;
      if (!diagnostics.completed) throw new Error('Photo import system log collection failed.');
    } finally { closeSync(stderr); }
  } finally { closeSync(stdout); }
}
// These read-only diagnostics run only against this script's fresh synthetic CI
// simulator. Never collect the host's logs or app data/OCR/notification payloads.
function collectAppDiagnostics(device) {
  const diagnostics = report.app_registration_diagnostics = {};
  const attempt = (name, operation) => {
    try { diagnostics[name] = { completed: true, ...operation() }; }
    catch (error) { diagnostics[name] = { completed: false, error: error.message }; }
  };
  let commandCount = 0;
  const command = (executable, args) => {
    const name = `diagnostic-command-${++commandCount}-${path.basename(executable)}`;
    const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
    if (result.error || result.status !== 0) {
      writeFileSync(path.join(output, `${name}.json`), JSON.stringify({ executable, args, status: result.status, signal: result.signal, code: result.error?.code ?? null }, null, 2));
      for (const stream of ['stdout', 'stderr']) if (result[stream]) writeFileSync(path.join(output, `${name}-${stream}.log`), result[stream]);
      throw new Error(`Diagnostic ${path.basename(executable)} failed (status=${result.status}, signal=${result.signal}, code=${result.error?.code ?? 'none'}); see ${name}.json.`);
    }
    return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  };
  const requireHelp = (name, args, tokens) => {
    const result = spawnSync('xcrun', args, { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 });
    const help = (result.stdout ?? '') + (result.stderr ?? '');
    writeFileSync(path.join(output, `${name}-help.txt`), help);
    if (!diagnosticHelp.supportsDiagnosticHelp('xcrun', args, result, tokens)) {
      throw new Error(`SDK diagnostic help unavailable: ${name} (status=${result.status}, signal=${result.signal}, code=${result.error?.code ?? 'none'}).`);
    }
  };
  let bundle;
  attempt('built_app', () => {
    const application = path.resolve('build/Build/Products/Release-iphonesimulator/TTodo.app');
    const metadata = appMetadata(application);
    bundle = metadata.bundle_identifier;
    writeFileSync(path.join(output, 'built-app-registration.json'), JSON.stringify(metadata, null, 2));
    return metadata;
  });
  // Do not let unavailable appinfo support prevent the independent installed
  // bundle comparison or log collection. Diagnostic errors never replace XCTest.
  if (bundle) {
    attempt('installed_app', () => {
      requireHelp('simctl-get-app-container', ['simctl', 'help', 'get_app_container'], ['get_app_container', 'app']);
      const application = command('xcrun', ['simctl', 'get_app_container', device, bundle, 'app']).stdout.trim();
      if (!path.isAbsolute(application) || !application.endsWith('.app')) throw new Error('SDK did not return an absolute installed app bundle path.');
      const metadata = appMetadata(application);
      const built = diagnostics.built_app;
      const matches_built_app = metadata.bundle_identifier === built.bundle_identifier && metadata.executable === built.executable && metadata.executable_sha256 === built.executable_sha256 && metadata.signing.identifier === built.signing.identifier && metadata.signing.team_identifier === built.signing.team_identifier && metadata.signing.cdhash === built.signing.cdhash;
      writeFileSync(path.join(output, 'installed-app-registration.json'), JSON.stringify({ ...metadata, matches_built_app }, null, 2));
      return { ...metadata, matches_built_app };
    });
    attempt('registration', () => {
      requireHelp('simctl-appinfo', ['simctl', 'help', 'appinfo'], ['appinfo']);
      const result = command('xcrun', ['simctl', 'appinfo', device, bundle]);
      writeFileSync(path.join(output, 'simctl-appinfo.txt'), result.stdout + result.stderr);
      return {};
    });
  }
  if (!report.completed) attempt('system_logs', () => {
    requireHelp('simctl-spawn', ['simctl', 'help', 'spawn'], ['spawn']);
    requireHelp('simulator-log-show', ['simctl', 'spawn', device, 'log', 'help', 'show'], ['--last', '--style', '--predicate', '--info']);
    const predicate = 'process == "Preferences" OR process == "lsd" OR process == "SpringBoard" OR process == "usernotificationsd" OR (process == "TTodo" AND eventMessage BEGINSWITH "TTodoNotificationSettingsDiagnostic")';
    const result = command('xcrun', ['simctl', 'spawn', device, 'log', 'show', '--last', '8m', '--style', 'compact', '--info', '--predicate', predicate]);
    writeFileSync(path.join(output, 'notification-settings-system.log'), result.stdout);
    if (result.stderr) writeFileSync(path.join(output, 'notification-settings-system-stderr.log'), result.stderr);
    return {};
  });
  function appMetadata(application) {
    const info = key => command('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, path.join(application, 'Info.plist')]).stdout.trim();
    const bundle_identifier = info('CFBundleIdentifier');
    const executable = info('CFBundleExecutable');
    if (!/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(bundle_identifier) || !/^[A-Za-z0-9_-]+$/.test(executable)) throw new Error('Unexpected built/installed app identifier or executable.');
    const signature = command('codesign', ['--display', '--verbose=4', application]);
    const signatureText = signature.stdout + signature.stderr;
    // Keep only non-content signing metadata, including simulator ad-hoc state.
    const signing = {
      identifier: /^Identifier=(.+)$/m.exec(signatureText)?.[1] ?? null,
      team_identifier: /^TeamIdentifier=(.+)$/m.exec(signatureText)?.[1] ?? null,
      cdhash: /^CDHash=(.+)$/m.exec(signatureText)?.[1] ?? null,
      code_directory: /^CodeDirectory (.+)$/m.exec(signatureText)?.[1] ?? null,
      signature: /^Signature=(.+)$/m.exec(signatureText)?.[1] ?? null,
    };
    if (!signing.identifier || !signing.cdhash) throw new Error('Code signing display did not include the app Identifier/CDHash.');
    return { bundle_identifier, executable, executable_sha256: createHash('sha256').update(readFileSync(path.join(application, executable))).digest('hex'), signing };
  }
}
let device;
function collectStartupDiagnostics(device) {
  const args = ['simctl', 'spawn', device, 'log', 'help', 'show'];
  const help = spawnSync('xcrun', args, { encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024 });
  writeFileSync(path.join(output, 'startup-log-help.txt'), (help.stdout ?? '') + (help.stderr ?? ''));
  if (!diagnosticHelp.supportsDiagnosticHelp('xcrun', args, help, ['--last', '--style', '--predicate', '--info'])) throw new Error('SDK startup diagnostic log help unavailable.');
  const predicate = 'subsystem == "app.ttodo.ci" AND category == "startup" AND eventMessage BEGINSWITH "TTodoStartupDiagnostic"';
  writeFileSync(path.join(output, 'startup-system.log'), run('xcrun', ['simctl', 'spawn', device, 'log', 'show', '--last', '8m', '--style', 'compact', '--info', '--predicate', predicate], { timeout: 60000 }));
}
try {
  const runtimeInventory = JSON.parse(sim('list', 'runtimes', '--json'));
  const deviceInventory = JSON.parse(sim('list', 'devicetypes', '--json'));
  writeFileSync(path.join(output, 'runtimes.json'), JSON.stringify(runtimeInventory, null, 2));
  writeFileSync(path.join(output, 'device-types.json'), JSON.stringify(deviceInventory, null, 2));
  const { runtime, deviceType } = simulatorSelection.selectUISimulator(runtimeInventory.runtimes, deviceInventory.devicetypes, model, runtimePolicy, architecture);
  report.host_architecture = process.arch; report.simulator_architecture = architecture;
  report.runtime = runtime.identifier; report.runtime_version = runtime.version; report.runtime_build = runtime.buildversion;
  report.runtime_policy = runtimePolicy; report.device_type = deviceType.identifier; report.device_name = deviceType.name;
  report.phase = 'text-size-help';
  const uiHelp = spawnSync('xcrun', ['simctl', 'help', 'ui'], { encoding: 'utf8', timeout: 60000 });
  const helpText = (uiHelp.stdout ?? '') + (uiHelp.stderr ?? '');
  writeFileSync(path.join(output, 'simctl-ui-help.txt'), helpText);
  if (uiHelp.error || uiHelp.status !== 0) throw new Error(`simctl ui help failed (status=${uiHelp.status}, signal=${uiHelp.signal}, error=${uiHelp.error?.message ?? 'none'}).`);
  if (!helpText.includes(textSize)) throw new Error('The installed SDK does not document the requested text size.');
  report.phase = 'create';
  device = sim('create', 'TTodo CI UI Tests', deviceType.identifier, runtime.identifier);
  if (!/^[0-9a-f-]{36}$/i.test(device)) throw new Error('Unexpected simulator identifier.');
  report.phase = 'boot'; console.log('UI tests: booting the isolated CI simulator');
  sim('boot', device);
  writeFileSync(path.join(output, 'boot.log'), run('xcrun', ['simctl', 'bootstatus', device, '-b'], { timeout: 600000 }));
  report.phase = 'text-size';
  sim('ui', device, 'content_size', textSize);
  report.text_size = sim('ui', device, 'content_size');
  if (report.text_size !== textSize) throw new Error('The simulator did not confirm the requested text size.');
  if (scenario === 'photo-ocr') {
    report.phase = 'photo-import-help';
    const mediaHelp = spawnSync('xcrun', ['simctl', 'help', 'addmedia'], { encoding: 'utf8', timeout: 60000 });
    const mediaHelpText = (mediaHelp.stdout ?? '') + (mediaHelp.stderr ?? '');
    writeFileSync(path.join(output, 'simctl-addmedia-help.txt'), mediaHelpText);
    if (mediaHelp.status !== 0 || !mediaHelpText.includes('addmedia')) throw new Error('The installed SDK does not document media import.');
    report.phase = 'ocr-fixture-compile';
    const generator = path.join(output, 'ocr-fixture-generator');
    run('swiftc', ['modules/ttodo-native/ios/VisionOCR.swift', 'native/tests/OCRSmoke.swift', '-framework', 'AppKit', '-o', generator]);
    report.phase = 'ocr-fixture-preflight';
    writeFileSync(path.join(output, 'ocr-fixture-preflight.log'), run(generator, [], { env: { ...process.env, TTODO_OCR_FIXTURE_OUTPUT: output } }));
    report.macos_ocr_fixture_preflight = true;
  }
  if (scenario === 'task-lifecycle') {
    report.phase = 'lock-presentation';
    const executable = path.join(process.env.RUNNER_TEMP, 'ttodo-lock-smoke');
    const sdk = run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path']);
    run('xcrun', ['--sdk', 'iphonesimulator', 'swiftc', '-sdk', sdk, '-target', architecture + '-apple-ios18.0-simulator',
      '-D', 'TTODO_LOCK_TEST', 'modules/ttodo-native/ios/TTodoConfiguration.swift',
      'modules/ttodo-native/ios/SharedStore.swift', 'modules/ttodo-native/ios/TodoActivity.swift',
      'native/ios/TTodoWidgets.swift', 'native/tests/LockPresentationSmoke.swift', '-o', executable]);
    sim('spawn', device, executable);
    report.lock_content_and_recovery_policy_tested = true;
  }
  report.command_phases = [];
  uiCommands.runUICommands(execFileSync, { device, resultPath, flow, architecture,
    beforeTest() {
      if (scenario !== 'photo-ocr') return;
      // bootstatus can finish while assetsd is still rebuilding the photo library.
      // Let initialization run during the build before importing the real fixture.
      report.phase = 'photo-import';
      console.log('UI tests: importing the synthetic photo after the build');
      sim('addmedia', device, path.join(output, 'synthetic-korean.png'));
      report.photo_fixture = 'generated-korean-png-only';
    },
    onPhase(phase, timeout) {
      report.phase = phase;
      report.command_phases.push({ phase, timeout_ms: timeout, started_at: new Date().toISOString() });
      // Preserve the last confirmed phase even if a host-level timeout kills Node.
      writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
      console.log(`UI tests: ${phase} (timeout=${timeout}ms)`);
    },
  });
  const summary = JSON.parse(run('xcrun', ['xcresulttool', 'get', 'test-results', 'summary', '--path', resultPath]));
  const tests = JSON.parse(run('xcrun', ['xcresulttool', 'get', 'test-results', 'tests', '--path', resultPath]));
  writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(path.join(output, 'tests.json'), JSON.stringify(tests, null, 2));
  report.tests = resultValidation.validateManualUITestResult(summary, tests, flow);
  report.task_lifecycle_tested = flow === 'testManualTaskLifecycleAndDataReset' || scenario === 'task-lifecycle';
  report.data_reset_tested = flow === 'testManualTaskLifecycleAndDataReset' || scenario === 'data-reset';
  report.ai_consent_reset_tested = scenario === 'data-reset';
  report.ios_ocr_tested = scenario === 'photo-ocr';
  report.notification_denial_tested = flow === 'testManualTaskLifecycleAndDataReset';
  report.system_app_settings_tested = flow === 'testManualTaskLifecycleAndDataReset';
  if (scenario === 'task-lifecycle') {
    report.phase = 'export-file';
    const bundle = process.env.TTODO_BUNDLE_ID ?? 'com.kimps005.ttodo';
    const container = sim('get_app_container', device, bundle, 'data');
    const file = path.join(container, 'Library/Caches/TTodo-export.json');
    const exported = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(file)));
    if (exported.format_version !== 1 || !Number.isFinite(Date.parse(exported.exported_at)) ||
        exported.todos?.length !== 1 || exported.todos[0].title !== 'CI independent keyboard task' ||
        !Array.isArray(exported.analyses) || !Array.isArray(exported.extracted_tasks)) {
      throw new Error('Unexpected simulator export payload.');
    }
    sim('launch', device, bundle);
    for (let i = 0; i < 60 && existsSync(file); i++) await new Promise(resolve => setTimeout(resolve, 500));
    if (existsSync(file)) throw new Error('Relaunch did not clean up the interrupted share.');
    report.export_file_and_cleanup_tested = true;
  }
  report.completed = true; report.phase = 'complete';
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  // Preserve process diagnostics for SDK/runner failures without assuming the
  // app or XCTest ran. Commands here only process the CI synthetic fixture.
  if (error && typeof error === 'object' && 'path' in error) {
    report.command_failure = { command: error.path, args: error.spawnargs, code: error.code, status: error.status, signal: error.signal };
    for (const stream of ['stdout', 'stderr']) if (error[stream] != null) {
      writeFileSync(path.join(output, `command-failure-${stream}.log`), String(error[stream]));
    }
  }
  if (device && /^[0-9a-f-]{36}$/i.test(device)) {
    try { sim('io', device, 'screenshot', path.join(output, 'failure.png')); } catch {}
  }
  process.exitCode = 1;
} finally {
  if (device && /^[0-9a-f-]{36}$/i.test(device) && (scenario === 'task-lifecycle' || flow === 'testLargeTextInputEditingAndNavigation')) {
    try { collectStartupDiagnostics(device); }
    catch (error) { report.startup_diagnostic_error = error.message; }
  }
  if (scenario === 'photo-ocr' && report.phase === 'photo-import' && device && /^[0-9a-f-]{36}$/i.test(device)) {
    try { collectPhotoImportDiagnostics(device); }
    catch (error) { report.photo_import_diagnostic_error = error.message; }
  }
  if (scenario === 'app' && device && /^[0-9a-f-]{36}$/i.test(device)) {
    try { collectAppDiagnostics(device); }
    catch (error) { report.app_diagnostic_error = error.message; }
  }
  if (existsSync(resultPath)) {
    try { run('xcrun', ['xcresulttool', 'export', 'attachments', '--path', resultPath, '--output-path', path.join(output, 'attachments')]); }
    catch (error) { report.attachment_export_error = error.message; }
    // Failed test runs also need machine-readable diagnostics on Windows.
    for (const name of ['summary', 'tests']) if (!existsSync(path.join(output, `${name}.json`))) {
      try { writeFileSync(path.join(output, `${name}.json`), run('xcrun', ['xcresulttool', 'get', 'test-results', name, '--path', resultPath])); } catch {}
    }
  }
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  if (device && /^[0-9a-f-]{36}$/i.test(device)) {
    try { sim('shutdown', device); } catch {}
    try { sim('delete', device); } catch {}
  }
  console.log(JSON.stringify(report));
}
