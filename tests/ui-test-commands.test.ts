import { test } from 'node:test';
import assert from 'node:assert/strict';
const { runUICommands } = require('../scripts/ui-test-commands.cjs');

test('긴 Intel 빌드 후에도 지정 UI 테스트에는 별도의 15분 실행 예산을 제공한다', () => {
  for (const architecture of ['arm64', 'x86_64']) {
    const calls: any[] = [], phases: any[] = [];
    runUICommands((command: string, args: string[], options: any) => calls.push({ command, args, options }), {
      device: 'synthetic-device', resultPath: '/synthetic/results.xcresult', flow: 'testManualTaskLifecycleAndDataReset',
      architecture, onPhase: (phase: string, timeout: number) => phases.push({ phase, timeout }),
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].args.at(-1), 'build-for-testing');
    assert.equal(calls[0].options.timeout, (architecture === 'x86_64' ? 45 : 30) * 60000);
    assert.equal(calls[1].args.at(-1), 'test-without-building');
    assert.equal(calls[1].options.timeout, 15 * 60000);
    assert.ok(calls[1].args.includes('-only-testing:TTodoUITests/TTodoUITests/testManualTaskLifecycleAndDataReset'));
    for (const call of calls) {
      assert.ok(call.args.includes('ARCHS=' + architecture));
      assert.ok(call.args.includes('id=synthetic-device'));
      assert.ok(call.args.includes('CODE_SIGN_IDENTITY=-'));
    }
    assert.deepEqual(phases.map(x => x.phase), ['build-for-testing', 'test-without-building']);
  }
});
test('빌드 실패는 원래 오류를 보존하고 UI 테스트를 실행하거나 통과로 표시하지 않는다', () => {
  const failure = new Error('synthetic compiler failure');
  const phases: string[] = [];
  let count = 0;
  assert.throws(() => runUICommands(() => { count++; throw failure; }, {
    device: 'synthetic-device', resultPath: '/synthetic/results.xcresult', flow: 'expected-test', architecture: 'x86_64',
    onPhase: (phase: string) => phases.push(phase),
  }), error => error === failure);
  assert.equal(count, 1);
  assert.deepEqual(phases, ['build-for-testing']);
});

test('사진은 빌드 뒤에 가져오고 가져오기 오류가 나면 UI 테스트를 실행하지 않는다', () => {
  const timeline: string[] = [];
  const run = (_: string, args: string[]) => timeline.push(args.at(-1)!);
  const options = { device: 'synthetic-device', resultPath: '/synthetic/results.xcresult', flow: 'expected-test',
    architecture: 'arm64', onPhase: () => {} };
  runUICommands(run, { ...options, beforeTest: () => timeline.push('photo-import') });
  assert.deepEqual(timeline, ['build-for-testing', 'photo-import', 'test-without-building']);

  timeline.length = 0;
  const failure = new Error('synthetic photo import failure');
  assert.throws(() => runUICommands(run, { ...options, beforeTest: () => { throw failure; } }), error => error === failure);
  assert.deepEqual(timeline, ['build-for-testing']);
});
