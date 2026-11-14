import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import resultValidation from './ui-test-result.cjs';

if (process.platform !== 'darwin') throw new Error('이 검사는 GitHub macOS CI에서만 실행합니다.');
const output = path.resolve('artifacts/ui-tests'); mkdirSync(output, { recursive: true });
const resultPath = path.join(output, 'results.xcresult');
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', timeout: 240000, maxBuffer: 16 * 1024 * 1024, ...options }).trim();
const sim = (...args) => run('xcrun', ['simctl', ...args]);
const textSize = process.env.TTODO_UI_TEXT_SIZE ?? 'large';
if (!['large', 'accessibility-extra-extra-extra-large'].includes(textSize)) throw new Error('Unsupported UI text size.');
const scenario = process.env.TTODO_UI_SCENARIO ?? 'app';
if (!['app', 'share-extension', 'photo-ocr'].includes(scenario)) throw new Error('Unsupported UI scenario.');
const flow = scenario === 'photo-ocr' ? 'testPhotoOCRAndCancelPreservesDraft' : scenario === 'share-extension' ? 'testShareExtensionRequiresConsent' : textSize === 'large' ? 'testManualTaskLifecycleAndDataReset' : 'testLargeTextInputEditingAndNavigation';
const report = { commit: process.env.GITHUB_SHA ?? null, scenario, fixture: 'synthetic-only-via-ui', physical_device: false, model_inference_tested: false, locked_input_tested: false, completed: false, phase: 'create' };
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
  report.phase = 'text-size';
  const uiHelp = spawnSync('xcrun', ['simctl', 'help', 'ui'], { encoding: 'utf8', timeout: 60000 });
  const helpText = (uiHelp.stdout ?? '') + (uiHelp.stderr ?? '');
  writeFileSync(path.join(output, 'simctl-ui-help.txt'), helpText);
  if (uiHelp.status !== 0 || !helpText.includes(textSize)) throw new Error('The installed SDK does not document the requested text size.');
  sim('ui', device, 'content_size', textSize);
  report.text_size = sim('ui', device, 'content_size');
  if (report.text_size !== textSize) throw new Error('The simulator did not confirm the requested text size.');
  if (scenario === 'photo-ocr') {
    report.phase = 'synthetic-photo';
    const mediaHelp = spawnSync('xcrun', ['simctl', 'help', 'addmedia'], { encoding: 'utf8', timeout: 60000 });
    const mediaHelpText = (mediaHelp.stdout ?? '') + (mediaHelp.stderr ?? '');
    writeFileSync(path.join(output, 'simctl-addmedia-help.txt'), mediaHelpText);
    if (mediaHelp.status !== 0 || !mediaHelpText.includes('addmedia')) throw new Error('The installed SDK does not document media import.');
    const generator = path.join(output, 'ocr-fixture-generator');
    run('swiftc', ['modules/ttodo-native/ios/VisionOCR.swift', 'native/tests/OCRSmoke.swift', '-framework', 'AppKit', '-o', generator]);
    writeFileSync(path.join(output, 'ocr-fixture-preflight.log'), run(generator, [], { env: { ...process.env, TTODO_OCR_FIXTURE_OUTPUT: output } }));
    sim('addmedia', device, path.join(output, 'synthetic-korean.png'));
    report.photo_fixture = 'generated-korean-png-only';
    report.macos_ocr_fixture_preflight = true;
  }
  report.phase = 'test'; console.log('UI tests: building and running the synthetic manual task flow');
  execFileSync('xcodebuild', ['-workspace', 'ios/TTodo.xcworkspace', '-scheme', 'TTodoUITests', '-configuration', 'Release', '-destination', `id=${device}`, '-derivedDataPath', 'build', '-resultBundlePath', resultPath, '-only-testing:TTodoUITests/TTodoUITests/' + flow, '-parallel-testing-enabled', 'NO', 'ARCHS=arm64', 'ONLY_ACTIVE_ARCH=YES', 'CODE_SIGNING_ALLOWED=YES', 'CODE_SIGN_IDENTITY=-', 'test'], { stdio: 'inherit', timeout: 30 * 60000 });
  const summary = JSON.parse(run('xcrun', ['xcresulttool', 'get', 'test-results', 'summary', '--path', resultPath]));
  const tests = JSON.parse(run('xcrun', ['xcresulttool', 'get', 'test-results', 'tests', '--path', resultPath]));
  writeFileSync(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2));
  writeFileSync(path.join(output, 'tests.json'), JSON.stringify(tests, null, 2));
  report.tests = resultValidation.validateManualUITestResult(summary, tests, flow);
  report.ios_ocr_tested = scenario === 'photo-ocr';
  report.completed = true; report.phase = 'complete';
} catch (error) {
  report.error = error instanceof Error ? error.message : String(error);
  if (device && /^[0-9a-f-]{36}$/i.test(device)) {
    try { sim('io', device, 'screenshot', path.join(output, 'failure.png')); } catch {}
  }
  process.exitCode = 1;
} finally {
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
