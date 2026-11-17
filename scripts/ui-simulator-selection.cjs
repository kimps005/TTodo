// Select only installed, available SDK inventory. Never download or silently
// substitute a different model/runtime when a requested profile is unavailable.
const models = {
  'iphone-16-pro': 'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro',
  'iphone-se-3': 'com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation',
};
function selectUISimulator(runtimes, deviceTypes, model = 'iphone-16-pro', policy = 'latest', architecture = 'arm64') {
  if (!['arm64', 'x86_64'].includes(architecture)) throw new Error('Unsupported simulator architecture.');
  if (!Object.hasOwn(models, model) || !['latest', 'oldest-installed'].includes(policy)) throw new Error('Unsupported UI simulator profile.');
  if (!Array.isArray(runtimes) || !Array.isArray(deviceTypes)) throw new Error('Invalid simulator SDK inventory.');
  const deviceType = deviceTypes.find(item => item.identifier === models[model]);
  if (!deviceType) throw new Error('Requested iPhone profile is not installed.');
  const available = runtimes.filter(item => item.isAvailable === true && item.identifier?.startsWith('com.apple.CoreSimulator.SimRuntime.iOS-') && /^\d+(\.\d+){1,2}$/.test(item.version) && Number(item.version.split('.')[0]) >= 18);
  available.sort((a, b) => a.version.localeCompare(b.version, 'en', { numeric: true }));
  if (!available.length) throw new Error('No available supported iOS simulator runtime.');
  if (policy === 'oldest-installed' && new Set(available.map(item => item.version)).size < 2) throw new Error('An older installed iOS runtime is required for this coverage profile.');
  const runtime = policy === 'latest' ? available.at(-1) : available[0];
  if (!runtime.supportedArchitectures?.includes(architecture) || !runtime.supportedDeviceTypes?.some(item => item.identifier === deviceType.identifier)) throw new Error(`Requested iPhone/${architecture} combination is not supported by the selected runtime.`);
  return { deviceType, runtime };
}
module.exports = { selectUISimulator };
