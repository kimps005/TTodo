import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateProvider } from '../src/ai/evaluate';
test('평가 정답은 모델에 전달하지 않고 원문과 시점만 전달한다', async () => {
  let calls = 0;
  const result = await evaluateProvider({ version: 'test-only', extract: async context => {
    assert.equal('expected' in context, false); assert.equal('title' in context, false); calls++; return [];
  } }, new AbortController().signal, () => {});
  assert.equal(calls, 24); assert.equal(result.completed, true);
  assert.equal(result.results.length, 24); assert.equal('accuracy' in result, false);
});
test('평가 취소 후 다음 사례를 실행하지 않는다', async () => {
  const abort = new AbortController();
  const result = await evaluateProvider({ version: 'test-only', extract: async () => [] }, abort.signal, () => abort.abort());
  assert.equal(result.completed, false); assert.equal(result.results.length, 1);
});
