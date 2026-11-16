import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Read only Apple's installed runtime resources, never simulator/user data or
// binaries. This identifies Settings availability predicates; no private APIs
// or internal URLs are invoked, and no runtime files are modified.
if (process.platform !== 'darwin') throw new Error('GitHub macOS SDK inspection only.');
const output = path.resolve('artifacts/sdk-inspection'); mkdirSync(output, { recursive: true });
const runtimes = JSON.parse(execFileSync('xcrun', ['simctl', 'list', 'runtimes', '--json'], { encoding: 'utf8' })).runtimes;
const report = [];
for (const runtime of runtimes.filter(r => r.isAvailable && r.identifier.startsWith('com.apple.CoreSimulator.SimRuntime.iOS-'))) {
  const root = runtime.runtimeRoot;
  if (!root || !path.isAbsolute(root)) throw new Error('Runtime root is unavailable.');
  const item = { runtime: runtime.identifier, version: runtime.version, build: runtime.buildversion, resources: [], matches: [], errors: [] };
  const directories = ['Applications/Preferences.app', 'System/Library/PreferenceBundles'];
  for (const base of ['System/Library/PrivateFrameworks', 'System/Library/Frameworks', 'System/Library/ExtensionKit/Extensions']) {
    const directory = path.join(root, base);
    if (existsSync(directory)) for (const entry of readdirSync(directory)) {
      if (/settings|notification.*settings/i.test(entry)) directories.push(path.join(base, entry));
    }
  }
  function inspectValue(value, file, location = '$') {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((child, index) => inspectValue(child, file, `${location}[${index}]`)); return; }
    const scalars = Object.fromEntries(Object.entries(value).filter(([, child]) => child === null || typeof child !== 'object'));
    if (Object.entries(scalars).some(([key, child]) => /simulator|hidden|notification/i.test(key) || typeof child === 'string' && /simulator|notifications/i.test(child))) {
      item.matches.push({ file, location, values: scalars });
    }
    for (const [key, child] of Object.entries(value)) inspectValue(child, file, `${location}.${key}`);
  }
  function visit(directory, depth = 0) {
    if (!existsSync(directory) || depth > 8) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name.endsWith('.lproj')) continue;
      const full = path.join(directory, entry.name);
      const relative = path.relative(root, full);
      if (entry.isDirectory()) { visit(full, depth + 1); continue; }
      if (!/\.(plist|json)$/.test(entry.name) || statSync(full).size > 2 * 1024 * 1024) continue;
      item.resources.push(relative);
      try {
        const value = entry.name.endsWith('.json') ? JSON.parse(readFileSync(full, 'utf8')) : JSON.parse(execFileSync('plutil', ['-convert', 'json', '-o', '-', full], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
        inspectValue(value, relative);
      } catch (error) { item.errors.push({ file: relative, error: error.message.slice(0, 250) }); }
    }
  }
  directories.forEach(directory => visit(path.join(root, directory)));
  report.push(item);
}
writeFileSync(path.join(output, 'settings-runtime-resources.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map(item => ({ runtime: item.runtime, resources: item.resources.length, matches: item.matches.length, errors: item.errors.length }))));
