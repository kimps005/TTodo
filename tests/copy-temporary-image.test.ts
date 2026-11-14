import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyTemporaryImage } from '../src/data/copyTemporaryImage';

test('비동기 복사가 끝나기 전 원본을 삭제하지 않고 복사 실패도 전달한다', async () => {
  for (const fail of [false, true]) {
    const pending = Promise.withResolvers<void>();
    let removed = false;
    const operation = copyTemporaryImage(() => pending.promise, () => { removed = true; });
    const result = fail ? assert.rejects(operation, /copy failed/) : operation;
    assert.equal(removed, false);
    if (fail) pending.reject(new Error('copy failed')); else pending.resolve();
    await result;
    assert.equal(removed, true);
  }
});
