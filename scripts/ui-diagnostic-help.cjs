function supportsDiagnosticHelp(executable, args, result, tokens) {
  if (result.error || result.signal || ![0, 64].includes(result.status)) return false;
  const simulatorLogShowHelp = executable === 'xcrun' && args.length === 6 &&
    args[0] === 'simctl' && args[1] === 'spawn' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(args[2]) &&
    args[3] === 'log' && args[4] === 'help' && args[5] === 'show';
  // This SDK's `log help show` prints complete usage and exits EX_USAGE (64).
  // No other command or nonzero status is accepted as a successful help query.
  if (result.status === 64 && !simulatorLogShowHelp) return false;
  const help = (result.stdout ?? '') + (result.stderr ?? '');
  if (simulatorLogShowHelp && !/^\s*usage:\s+log\s+show(?:\s|$)/im.test(help)) return false;
  // Apple's help uses --[no-]info to document both --info and --no-info.
  const normalized = help.replace(/--\[no-\]([A-Za-z][A-Za-z0-9-]*)/g, '--$1 --no-$1');
  const required = simulatorLogShowHelp ? [...new Set([...tokens, '--last', '--style', '--predicate', '--info'])] : tokens;
  return required.every(token => {
    if (!token.startsWith('--')) return normalized.includes(token);
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)${escaped}(?=\\s|[=<,]|$)`, 'm').test(normalized);
  });
}
module.exports = { supportsDiagnosticHelp };
