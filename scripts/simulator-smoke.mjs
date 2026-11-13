import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

if (process.platform !== 'darwin') throw new Error('이 검사는 macOS CI에서 실행합니다. Windows에서는 노트북 UI를 조작하지 않습니다.');
const root = process.cwd();
const output = path.join(root, 'artifacts/simulator');
mkdirSync(output, { recursive: true });
const application = path.join(root, 'build/Build/Products/Release-iphonesimulator/TTodo.app');
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', timeout: 240000, ...options }).trim();
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
try {
  if (!existsSync(application)) throw new Error('Release simulator app bundle is missing.');
  const bundle = info(application, 'CFBundleIdentifier');
  const group = `group.${bundle}`;
  // Ad-hoc signing is for the disposable simulator only, with the app's real App Group
  // entitlements. It does not create an iPhone provisioning profile or use an Apple account.
  const frameworks = path.join(application, 'Frameworks');
  if (existsSync(frameworks)) {
    for (const name of readdirSync(frameworks)) if (name.endsWith('.framework') || name.endsWith('.dylib')) {
      run('codesign', ['--force', '--sign', '-', path.join(frameworks, name)]);
    }
  }
  const plugins = path.join(application, 'PlugIns');
  for (const name of ['TTodoWidgets', 'TTodoShare']) {
    const extension = path.join(plugins, `${name}.appex`);
    if (!existsSync(extension)) throw new Error(`Extension is missing: ${name}`);
    run('codesign', ['--force', '--sign', '-', '--entitlements', path.join(root, 'ios', name, `${name}.entitlements`), '--generate-entitlement-der', extension]);
    report.extensions.push(info(extension, 'CFBundleIdentifier'));
  }
  run('codesign', ['--force', '--sign', '-', '--entitlements', path.join(root, 'ios/TTodo/TTodo.entitlements'), '--generate-entitlement-der', application]);
  const runtimes = JSON.parse(sim('list', 'runtimes', '--json')).runtimes.filter(item => item.isAvailable && item.identifier.includes('.iOS-'));
  runtimes.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  if (!runtimes[0]) throw new Error('No available iOS simulator runtime.');
  report.runtime = runtimes[0].identifier;
  device = sim('create', 'TTodo CI Smoke', 'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro', runtimes[0].identifier);
  if (!/^[0-9a-f-]{36}$/i.test(device)) throw new Error('Unexpected simulator identifier.');
  sim('boot', device); sim('bootstatus', device, '-b');
  sim('install', device, application); const initialPid = launch(device, bundle);
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
  const fixturePid = launch(device, bundle); await wait(8000);
  process.kill(fixturePid, 0);
  sim('io', device, 'screenshot', path.join(output, '02-home-fixture.png')); report.screenshots.push('02-home-fixture.png');
  sim('terminate', device, bundle);
  report.persisted_todos = Number(run('sqlite3', [database, 'SELECT COUNT(*) FROM todos;']));
  if (report.persisted_todos !== 3) throw new Error('Synthetic records did not persist.');
  report.completed = true;
} catch (error) {
  report.completed = false; report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  if (device && /^[0-9a-f-]{36}$/i.test(device)) {
    try { sim('shutdown', device); } catch {}
    try { sim('delete', device); } catch {}
  }
  console.log(JSON.stringify(report));
}
