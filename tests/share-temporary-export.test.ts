import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shareTemporaryExport } from '../src/data/shareTemporaryExport';

test('쓰기 완료 뒤 공유하고 공유창이 닫힐 때까지 임시 파일을 유지한다', async () => {
  const written = Promise.withResolvers<void>();
  const shared = Promise.withResolvers<void>();
  const sharing = Promise.withResolvers<void>();
  const events: string[] = [];
  const operation = shareTemporaryExport({
    write: () => written.promise,
    share: async () => { events.push('share'); sharing.resolve(); await shared.promise; },
    remove: () => { events.push('remove'); },
  });
  assert.deepEqual(events, []);
  written.resolve(); await sharing.promise;
  assert.deepEqual(events, ['share']);
  shared.resolve();
  assert.deepEqual(await operation, { cleaned: true });
  assert.deepEqual(events, ['share', 'remove']);
});

test('쓰기·공유 실패 후에도 정리하며 삭제 실패가 원래 오류를 가리지 않는다', async () => {
  for (const failure of ['write', 'share']) {
    for (const cleanupFails of [false, true]) {
      const error = new Error(failure);
      const events: string[] = [];
      await assert.rejects(shareTemporaryExport({
        write: async () => { if (failure === 'write') throw error; },
        share: async () => { events.push('share'); throw error; },
        remove: () => { events.push('remove'); if (cleanupFails) throw new Error('cleanup'); },
      }), candidate => candidate === error);
      assert.deepEqual(events, failure === 'write' ? ['remove'] : ['share', 'remove']);
    }
  }
});

test('공유가 정상 종료된 뒤 정리만 실패하면 별도 안내할 수 있다', async () => {
  assert.deepEqual(await shareTemporaryExport({
    write: async () => {}, share: async () => {}, remove: () => { throw new Error('cleanup'); },
  }), { cleaned: false });
});
