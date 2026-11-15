import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const { supportsDiagnosticHelp } = require('../scripts/ui-diagnostic-help.cjs');

// Actual SDK output from ea4b024's iOS 26.2 / 23C54 isolated CI simulator.
// That `log help show` printed complete usage and exited 64 (EX_USAGE).
const help = readFileSync(path.resolve('tests/fixtures/simulator-log-show-help-ios-26.2.txt'), 'utf8');
const args = ['simctl', 'spawn', 'C5110912-C621-4C6B-B22F-BC73AB3889D9', 'log', 'help', 'show'];
const tokens = ['--last', '--style', '--predicate', '--info'];
const result = (status: number | null, stdout = help, extra = {}) => ({ status, stdout, stderr: '', signal: null, ...extra });

test('실제 log show 도움말의 EX_USAGE와 양방향 옵션 표기를 제한적으로 인정한다', () => {
  for (const status of [0, 64]) {
    assert.equal(supportsDiagnosticHelp('xcrun', args, result(status), tokens), true);
    assert.equal(supportsDiagnosticHelp('xcrun', args, result(status, '', { stderr: help }), tokens), true);
    assert.equal(supportsDiagnosticHelp('xcrun', args, result(status), ['--no-info']), true);
  }
  const normalArgs = ['simctl', 'help', 'appinfo'];
  assert.equal(supportsDiagnosticHelp('xcrun', normalArgs, result(0, 'Usage: simctl appinfo <device> <app bundle identifier>'), ['appinfo']), true);
});

test('도움말 실패·중단·요청 옵션 누락·다른 명령의 EX_USAGE는 거부한다', () => {
  for (const status of [1, 2, 65, null]) assert.equal(supportsDiagnosticHelp('xcrun', args, result(status), tokens), false);
  for (const extra of [{ error: new Error('spawn failed') }, { signal: 'SIGTERM' }]) {
    assert.equal(supportsDiagnosticHelp('xcrun', args, result(64, help, extra), tokens), false);
  }
  for (const text of ['', help.replace('usage: log show', 'usage: log stream'), help.replaceAll('--predicate', '--filter'), help.replaceAll('--info', '--information').replaceAll('--[no-]info', '--[no-]information')]) {
    assert.equal(supportsDiagnosticHelp('xcrun', args, result(64, text), tokens), false);
  }
  for (const otherArgs of [
    ['simctl', 'help', 'appinfo'],
    ['simctl', 'spawn', args[2], 'log', 'show'],
    ['simctl', 'spawn', args[2], 'log', 'help', 'stream'],
    ['simctl', 'spawn', 'booted', 'log', 'help', 'show'],
    [...args, '--extra'],
  ]) assert.equal(supportsDiagnosticHelp('xcrun', otherArgs, result(64), tokens), false);
  assert.equal(supportsDiagnosticHelp('other-command', args, result(64), tokens), false);
});
