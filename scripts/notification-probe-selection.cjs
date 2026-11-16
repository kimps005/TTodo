const { selectUISimulator } = require('./ui-simulator-selection.cjs');

function selectNotificationProbeSimulator(runtimes, deviceTypes, policy = 'latest') {
  if (['latest', 'oldest-installed'].includes(policy)) return selectUISimulator(runtimes, deviceTypes, 'iphone-16-pro', policy);
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(policy) || !Array.isArray(runtimes)) throw new Error('Unsupported notification probe runtime.');
  const matching = runtimes.filter(runtime => runtime.version === policy);
  // The shared selector still verifies availability, platform, minimum iOS,
  // architecture and device support. An absent exact version never falls back.
  return selectUISimulator(matching, deviceTypes, 'iphone-16-pro', 'latest');
}
module.exports = { selectNotificationProbeSimulator };
