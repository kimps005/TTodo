import { readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dictionary = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0);
const keys = ['NSPrivacyTracking', 'NSPrivacyTrackingDomains', 'NSPrivacyCollectedDataTypes', 'NSPrivacyAccessedAPITypes'];

// Validate shapes, not whether a reason is approved or matches actual API use.
export function validatePrivacyManifest(value, name) {
  const require = (condition, key) => { if (!condition) throw new Error(`${name}: invalid ${key}`); };
  require(dictionary(value), 'manifest dictionary');
  if ('NSPrivacyTracking' in value) require(typeof value.NSPrivacyTracking === 'boolean', 'NSPrivacyTracking');
  if ('NSPrivacyTrackingDomains' in value) require(strings(value.NSPrivacyTrackingDomains), 'NSPrivacyTrackingDomains');
  if ('NSPrivacyAccessedAPITypes' in value) {
    require(Array.isArray(value.NSPrivacyAccessedAPITypes), 'NSPrivacyAccessedAPITypes');
    for (const api of value.NSPrivacyAccessedAPITypes) {
      require(dictionary(api) && typeof api.NSPrivacyAccessedAPIType === 'string' && api.NSPrivacyAccessedAPIType.length > 0 &&
        strings(api.NSPrivacyAccessedAPITypeReasons) && api.NSPrivacyAccessedAPITypeReasons.length > 0, 'API category/reasons');
    }
  }
  if ('NSPrivacyCollectedDataTypes' in value) {
    require(Array.isArray(value.NSPrivacyCollectedDataTypes), 'NSPrivacyCollectedDataTypes');
    for (const data of value.NSPrivacyCollectedDataTypes) {
      require(dictionary(data) && typeof data.NSPrivacyCollectedDataType === 'string' && data.NSPrivacyCollectedDataType.length > 0 &&
        typeof data.NSPrivacyCollectedDataTypeLinked === 'boolean' && typeof data.NSPrivacyCollectedDataTypeTracking === 'boolean' &&
        strings(data.NSPrivacyCollectedDataTypePurposes) && data.NSPrivacyCollectedDataTypePurposes.length > 0, 'collected data declaration');
    }
  }
  return value;
}

function readPlist(file) {
  return JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', file], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
}

export function inventoryPrivacyManifests(appPath, read = readPlist, context = 'unspecified') {
  if (!['unspecified', 'debug_simulator', 'unsigned_release_archive'].includes(context)) throw new Error('Unknown build context');
  const app = path.resolve(appPath);
  if (!app.endsWith('.app') || !statSync(app).isDirectory()) throw new Error('A built .app directory is required');
  const info = read(path.join(app, 'Info.plist'));
  if (!dictionary(info) || typeof info.CFBundleIdentifier !== 'string') throw new Error('Missing bundle identifier');
  const platforms = info.CFBundleSupportedPlatforms ?? [];
  if (!strings(platforms)) throw new Error('Invalid bundle platforms');
  if (context === 'debug_simulator' && !platforms.includes('iPhoneSimulator')) throw new Error('Expected simulator bundle');
  if (context === 'unsigned_release_archive' && !platforms.includes('iPhoneOS')) throw new Error('Expected iPhoneOS bundle');
  const manifests = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      // Never silently follow files outside the inspected bundle or omit them.
      if (entry.isSymbolicLink()) throw new Error(`Symbolic link requires separate inspection: ${path.relative(app, file)}`);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && entry.name === 'PrivacyInfo.xcprivacy') {
        const relative = path.relative(app, file).split(path.sep).join('/');
        const value = validatePrivacyManifest(read(file), relative);
        manifests.push({ path: relative, declarations: value, unknown_keys: Object.keys(value).filter(key => !keys.includes(key)).sort() });
      }
    }
  }
  visit(app);
  if (!manifests.length) throw new Error('No bundled PrivacyInfo.xcprivacy found');
  return {
    format_version: 1,
    scope: 'built_bundle_declarations_only',
    build_context: context,
    bundle_identifier: info.CFBundleIdentifier,
    bundle_version: info.CFBundleVersion ?? null,
    supported_platforms: platforms,
    root_manifest_present: manifests.some(item => item.path === 'PrivacyInfo.xcprivacy'),
    manifests,
    not_verified: ['actual_network_behavior', 'API_use_matches_declared_reasons', 'approved_reason_and_data_type_values', 'missing_SDK_manifests', 'SDK_signatures', 'App_Store_privacy_answers', 'signed_distribution_archive'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [app, output, context] = process.argv.slice(2);
    if (!app || !output) throw new Error('Usage: node scripts/privacy-manifests.mjs <built.app> <report.json> [build_context]');
    const report = inventoryPrivacyManifests(app, undefined, context);
    mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    writeFileSync(output, JSON.stringify({ ...report, commit: process.env.GITHUB_SHA ?? null }, null, 2) + '\n');
    console.log(`Bundled privacy declarations: ${report.manifests.length}; root manifest: ${report.root_manifest_present}. Declaration inventory only.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
