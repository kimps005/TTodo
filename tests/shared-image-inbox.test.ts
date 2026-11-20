import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { observeSharedImageInbox } from '../src/data/sharedImageInbox';

function inbox(take: () => Promise<string[]>) {
  const delivered: string[] = [];
  const discarded: string[] = [];
  let generation = 0;
  let wake: (() => void) | undefined;
  let retry: (() => void) | undefined;
  const stop = observeSharedImageInbox({
    take,
    subscribe: listener => { wake = listener; return () => { wake = undefined; }; },
    generation: () => generation,
    deliver: images => delivered.push(...images),
    discard: image => discarded.push(image),
    failed: again => { retry = again; },
  });
  return { delivered, discarded, stop, wake: () => wake?.(), purge: () => generation++, retry: () => retry?.() };
}

test('콜드 스타트 전에 전달된 사진과 읽기 중 도착한 사진을 차례로 한 번만 받는다', async () => {
  let release!: (files: string[]) => void;
  let reads = 0;
  const view = inbox(() => ++reads === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve(['second']));
  view.wake(); view.wake();
  assert.equal(reads, 1);
  release(['first']);
  await tick();
  assert.deepEqual(view.delivered, ['first', 'second']);
  assert.equal(reads, 2);
  view.stop();
});

test('철회 또는 화면 해제 후 늦게 도착한 파일은 모두 정리한다', async () => {
  for (const action of ['purge', 'stop'] as const) {
    let release!: (files: string[]) => void;
    const view = inbox(() => new Promise(resolve => { release = resolve; }));
    view[action]();
    release(['one', 'two']);
    await tick();
    assert.deepEqual(view.discarded, ['one', 'two']);
    assert.deepEqual(view.delivered, []);
    view.stop();
  }
});

test('가져오기 오류 후 사용자가 다시 시도하면 대기 파일을 가져온다', async () => {
  let reads = 0;
  const view = inbox(async () => {
    if (++reads === 1) throw new Error('unavailable');
    return ['retry'];
  });
  await tick();
  assert.equal(reads, 1);
  view.retry();
  await tick();
  assert.deepEqual(view.delivered, ['retry']);
  view.stop();
});
