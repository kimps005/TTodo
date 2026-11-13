import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (process.platform !== 'darwin') throw new Error('이 검사는 macOS CI에서 실행합니다. Windows에서는 노트북 UI를 조작하지 않습니다.');
const root = process.cwd();
const output = path.join(root, 'artifacts/simulator');
mkdirSync(output, { recursive: true });
const application = path.join(root, 'build/Build/Products/Release-iphonesimulator/TTodo.app');
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', timeout: 240000, maxBuffer: 16 * 1024 * 1024, ...options }).trim();
const sim = (...args) => run('xcrun', ['simctl', ...args]);
const info = (bundle, key) => run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, path.join(bundle, 'Info.plist')]);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { fixture: 'synthetic-only', physical_device: false, model_inference_tested: false, locked_input_tested: false, visual_review_required: true, database_integrity: null, extensions: [], screenshots: [] };
report.commit = process.env.GITHUB_SHA ?? null;
const launch = (id, bundle) => {
  const result = sim('launch', id, bundle);
  const pid = Number(/:\s*(\d+)\s*$/.exec(result)?.[1]);
  if (!pid) throw new Error('Simulator did not return an app process ID.');
  return pid;
};
let device;
const diagnostic = (name, operation) => {
  try { writeFileSync(path.join(output, name), operation()); }
  catch (error) { writeFileSync(path.join(output, `${name}.error.txt`), String(error)); }
};
try {
  if (!existsSync(application)) throw new Error('Release simulator app bundle is missing.');
  report.phase = 'sign';
  const bundle = info(application, 'CFBundleIdentifier');
  const group = `group.${bundle}`;
  // Keep Xcode's simulator signature intact. Xcode places simulated capabilities
  // according to ENTITLEMENTS_DESTINATION; copying the device plist into a new
  // host code signature can make taskgated reject it before app code executes.
  report.signing = 'xcode-simulator';
  const plugins = path.join(application, 'PlugIns');
  for (const name of ['TTodoWidgets', 'TTodoShare']) {
    const extension = path.join(plugins, `${name}.appex`);
    if (!existsSync(extension)) throw new Error(`Extension is missing: ${name}`);
    run('codesign', ['--verify', '--strict', extension]);
    report.extensions.push(info(extension, 'CFBundleIdentifier'));
  }
  run('codesign', ['--verify', '--deep', '--strict', application]);
  const runtimes = JSON.parse(sim('list', 'runtimes', '--json')).runtimes.filter(item => item.isAvailable && item.identifier.includes('.iOS-'));
  runtimes.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  if (!runtimes[0]) throw new Error('No available iOS simulator runtime.');
  report.runtime = runtimes[0].identifier;
  device = sim('create', 'TTodo CI Smoke', 'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro', runtimes[0].identifier);
  if (!/^[0-9a-f-]{36}$/i.test(device)) throw new Error('Unexpected simulator identifier.');
  report.phase = 'boot';
  sim('boot', device);
  // A fresh CI device must migrate its runtime data on first boot. Keep that
  // bounded wait separate from app launch; a boot timeout is not an app crash.
  const bootLog = run('xcrun', ['simctl', 'bootstatus', device, '-b'], { timeout: 600000 });
  writeFileSync(path.join(output, 'boot.log'), bootLog);
  report.phase = 'install';
  sim('install', device, application);
  report.phase = 'launch';
  const initialPid = launch(device, bundle);
  report.phase = 'database-initialization';
  let database;
  for (let attempt = 0; attempt < 30; attempt++) {
    await wait(2000);
    try {
      const container = sim('get_app_container', device, bundle, group);
      const candidate = path.join(container, 'TTodo/ttodo.sqlite');
      if (existsSync(candidate)) { database = candidate; break; }
    } catch { /* Wait for first App Group access. */ }
  }
  sim('io', device, 'screenshot', path.join(output, '01-home-empty.png')); report.screenshots.push('01-home-empty.png');
  process.kill(initialPid, 0);
  if (!database) throw new Error('Shared SQLite was not initialized after launch. Inspect the home screenshot and crash logs.');
  // Stop the app before the host SQLite tool opens the file; do not inspect raw DB bytes
  // while the app's SQLite driver holds an open connection.
  sim('terminate', device, bundle);
  report.phase = 'database-integrity';
  report.database_integrity = run('sqlite3', [database, 'PRAGMA integrity_check;']);
  if (report.database_integrity !== 'ok') throw new Error('SQLite integrity check failed.');
  report.schema_version = Number(run('sqlite3', [database, 'PRAGMA user_version;']));
  const fixture = `
    BEGIN IMMEDIATE;
    INSERT INTO todos(id,title,created_at,updated_at,sort_order) VALUES('00000000-0000-4000-8000-000000000001','CI 합성: 첫 번째 할 일','2026-11-13T00:00:00.000Z','2026-11-13T00:00:00.000Z',1);
    INSERT INTO todos(id,title,created_at,updated_at,sort_order) VALUES('00000000-0000-4000-8000-000000000002','CI 합성: 두 번째 할 일','2026-11-13T00:00:00.000Z','2026-11-13T00:00:00.000Z',2);
    INSERT INTO todos(id,title,status,created_at,updated_at,completed_at,sort_order) VALUES('00000000-0000-4000-8000-000000000003','CI 합성: 완료 항목','completed','2026-11-13T00:00:00.000Z','2026-11-13T00:00:00.000Z','2026-11-13T00:00:00.000Z',3);
    COMMIT;
  `;
  run('sqlite3', [database, fixture]);
  report.phase = 'fixture-relaunch';
  const fixturePid = launch(device, bundle); await wait(8000);
  process.kill(fixturePid, 0);
  sim('io', device, 'screenshot', path.join(output, '02-home-fixture.png')); report.screenshots.push('02-home-fixture.png');
  sim('terminate', device, bundle);
  report.persisted_todos = Number(run('sqlite3', [database, 'SELECT COUNT(*) FROM todos;']));
  if (report.persisted_todos !== 3) throw new Error('Synthetic records did not persist.');
  report.completed = true;
  report.phase = 'complete';
} catch (error) {
  report.completed = false; report.error = error instanceof Error ? error.message : String(error);
  if (device && /^[0-9a-f-]{36}$/i.test(device)) {
    diagnostic('failure-screen.txt', () => sim('io', device, 'screenshot', path.join(output, 'failure.png')));
    diagnostic('simulator-system.log', () => sim('spawn', device, 'log', 'show', '--last', '8m', '--style', 'compact', '--predicate', 'process == "SpringBoard" OR process == "runningboardd" OR process == "amfid" OR process == "TTodo" OR eventMessage CONTAINS[c] "com.kimps005.ttodo"'));
    diagnostic('host-simulator.log', () => run('log', ['show', '--last', '8m', '--style', 'compact', '--predicate', 'process == "Simulator" OR process == "SimulatorTrampoline" OR process == "CoreSimulatorService" OR process == "taskgated-helper" OR process == "amfid"']));
    const crashes = path.join(os.homedir(), 'Library/Logs/DiagnosticReports');
    if (existsSync(crashes)) for (const name of readdirSync(crashes).filter(name => /^(TTodo|SpringBoard|SimulatorTrampoline).*\.(ips|crash)$/.test(name))) {
      copyFileSync(path.join(crashes, name), path.join(output, name));
    }
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
