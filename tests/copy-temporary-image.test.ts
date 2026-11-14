import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyTemporaryImage } from '../src/data/copyTemporaryImage';

test('비동기 복사가 끝나기 전 원본을 삭제하지 않고 복사 실패도 전달한다', async () => {
  for (const fail of [false, true]) {
    const pending = Promise.withResolvers<void>();
    let removed = false;
    let incompleteRemoved = false;
    const operation = copyTemporaryImage(() => pending.promise, () => { removed = true; }, () => { incompleteRemoved = true; });
    const result = fail ? assert.rejects(operation, /copy failed/) : operation;
    assert.equal(removed, false);
    if (fail) pending.reject(new Error('copy failed')); else pending.resolve();
    await result;
    assert.equal(removed, true);
    assert.equal(incompleteRemoved, fail);
  }
});

test('복사와 원본 삭제가 함께 실패해도 복사 오류를 유지하고 부분 파일 정리를 시도한다', async () => {
  const error = new Error('copy failed');
  let cleaned = false;
  await assert.rejects(copyTemporaryImage(async () => { throw error; }, () => { throw new Error('remove failed'); }, () => { cleaned = true; }), candidate => candidate === error);
  assert.equal(cleaned, true);
});

test('원본 삭제 실패로 반환할 수 없는 복사본을 정리하고 정리 오류로 원인을 덮지 않는다', async () => {
  const error = new Error('original removal failed');
  let attempted = false;
  await assert.rejects(copyTemporaryImage(async () => {}, () => { throw error; }, () => { attempted = true; throw new Error('target removal failed'); }), candidate => candidate === error);
  assert.equal(attempted, true);
});
