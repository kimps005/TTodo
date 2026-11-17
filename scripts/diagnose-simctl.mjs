import { spawn, spawnSync } from 'node:child_process';
import { accessSync, constants, mkdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import simulatorSelection from './ui-simulator-selection.cjs';

const order = process.argv[2];
if (!['xcrun-first', 'direct-first', 'post-boot-first-help', 'verify-preparation'].includes(order)) throw new Error('Invalid diagnostic order');
const baseline = order === 'post-boot-first-help';
const verify = order === 'verify-preparation';
const output = path.resolve('artifacts/simctl-diagnostic');
const sampler = fileURLToPath(new URL('./sample-simctl-wait.sh', import.meta.url));
mkdirSync(output, { recursive: true });
const report = {
  order, commit: process.env.GITHUB_SHA, runnerImage: process.env.ImageVersion,
  developerDir: process.env.DEVELOPER_DIR ?? null, node: process.version,
  commands: [], failures: [], skipped: [],
};
const save = () => writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
function fail(message) {
  report.failures.push(message);
  save();
}

function measure(label, exe, args, { timeout = 60000, sample = false } = {}) {
  const prefix = String(report.commands.length + 1).padStart(2, '0') + '-' + label;
  const record = { label, exe, args, timeout, started: new Date().toISOString(),
    stdout: prefix + '.stdout', stderr: prefix + '.stderr' };
  report.commands.push(record);
  save();
  const observer = sample && spawn('/bin/bash', [sampler, String(process.pid), path.join(output, prefix)], {
    stdio: ['pipe', 'ignore', 'inherit'],
  });
  // A long probe's observer can already have closed its input by this point.
  if (observer) observer.stdin.on('error', error => { if (error.code !== 'EPIPE') console.error(error.message); });
  const start = performance.now();
  const result = spawnSync(exe, args, { encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024 });
  record.elapsedMs = Math.round(performance.now() - start);
  if (observer) observer.stdin.end('\n');
  record.status = result.status;
  record.signal = result.signal;
  record.error = result.error ? { code: result.error.code, message: result.error.message } : null;
  record.stdoutBytes = Buffer.byteLength(result.stdout ?? '');
  record.stderrBytes = Buffer.byteLength(result.stderr ?? '');
  writeFileSync(path.join(output, record.stdout), result.stdout ?? '');
  writeFileSync(path.join(output, record.stderr), result.stderr ?? '');
  record.ok = result.status === 0 && !result.error && !result.signal;
  if (!record.ok) fail(label + ': command failed');
  console.log(JSON.stringify(record));
  save();
  return { ok: record.ok, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

let direct;
function findTool(label) {
  const found = measure(label, 'xcrun', ['--find', 'simctl'], { sample: true });
  if (!found.ok) return;
  try {
    const candidate = found.stdout.trim();
    if (!path.isAbsolute(candidate) || path.basename(candidate) !== 'simctl') throw new Error('Unexpected simctl path');
    const resolved = realpathSync(candidate);
    accessSync(resolved, constants.X_OK);
    if (!statSync(resolved).isFile() || (direct && direct !== resolved)) throw new Error('Invalid or changed simctl executable');
    report.simctl = direct = resolved;
    save();
  } catch (error) { fail(label + ': ' + error.message); }
}
function help(phase, route) {
  const label = phase + '-' + route;
  if (route === 'direct' && !direct) {
    report.skipped.push(label + ': no verified executable');
    return;
  }
  const args = route === 'direct' ? ['help', 'ui'] : ['simctl', 'help', 'ui'];
  const result = measure(label, route === 'direct' ? direct : 'xcrun', args, { sample: true });
  const usage = result.stdout + result.stderr;
  if (result.ok && (!usage.includes('content_size') || !/(?:^|[^\w-])large(?:$|[^\w-])/.test(usage))) {
    fail(label + ': requested UI usage missing');
  }
}
const routes = order === 'direct-first' ? ['direct', 'xcrun'] : ['xcrun', 'direct'];
const sim = (label, args, timeout) => measure(label, 'xcrun', ['simctl', ...args], { timeout });
let device;
try {
  if (!baseline && !verify) findTool('initial-find');
  const runtimes = sim('runtimes', ['list', 'runtimes', '--json'], 240000);
  const types = sim('device-types', ['list', 'devicetypes', '--json'], 240000);
  if (!runtimes.ok || !types.ok) throw new Error('Inventory unavailable');
  const { runtime, deviceType } = simulatorSelection.selectUISimulator(
    JSON.parse(runtimes.stdout).runtimes, JSON.parse(types.stdout).devicetypes, 'iphone-16-pro', 'oldest-installed');
  report.target = { runtime: runtime.identifier, version: runtime.version, build: runtime.buildversion, type: deviceType.identifier };
  if (runtime.version !== '26.2' || runtime.buildversion !== '23C54') throw new Error('Original runtime/build unavailable');
  if (verify) {
    help('before-create', 'xcrun');
    if (report.failures.length) throw new Error('SDK help not confirmed');
  }
  const created = sim('create', ['create', 'TTodo SDK diagnostic', deviceType.identifier, runtime.identifier], 240000);
  if (!created.ok || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(created.stdout.trim())) throw new Error('Invalid create result');
  report.device = device = created.stdout.trim();
  if (!baseline && !verify) for (const route of routes) help('before-boot', route);
  if (!sim('boot', ['boot', device], 240000).ok || !sim('bootstatus', ['bootstatus', device, '-b'], 600000).ok) {
    throw new Error('Boot not confirmed');
  }
  if (verify) {
    if (!sim('set-text-size', ['ui', device, 'content_size', 'large'], 240000).ok) throw new Error('Text size setting failed');
    const actual = sim('read-text-size', ['ui', device, 'content_size'], 240000);
    report.textSize = actual.stdout.trim();
    if (!actual.ok || report.textSize !== 'large') throw new Error('Text size not confirmed');
  } else if (baseline) {
    help('after-boot', 'xcrun');
    findTool('after-boot-find');
    help('after-boot', 'direct');
  } else {
    for (const route of routes) help('after-boot', route);
    findTool('after-boot-find');
  }
} catch (error) { fail(error.message); }
finally {
  if (device) sim('delete', ['delete', device], 240000);
  // Query versions last so they do not warm the tool lookup before the probes.
  measure('macos', 'sw_vers', []);
  measure('architecture', 'uname', ['-m']);
  measure('developer-directory', 'xcode-select', ['-p']);
  measure('xcode', 'xcodebuild', ['-version']);
  measure('sdk', 'xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-version']);
  save();
  if (report.failures.length || report.skipped.length) process.exitCode = 1;
}
