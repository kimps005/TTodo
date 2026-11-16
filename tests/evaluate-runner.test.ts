import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateProvider } from '../src/ai/evaluate';
import seed from '../evaluation/ko-seed.json';
test('평가 정답은 모델에 전달하지 않고 원문과 시점만 전달한다', async () => {
  let calls = 0;
  const result = await evaluateProvider({ version: 'test-only', extract: async context => {
    assert.equal('expected' in context, false); assert.equal('title' in context, false); calls++; return [];
  } }, new AbortController().signal, () => {});
  assert.equal(calls, 24); assert.equal(result.completed, true);
  assert.equal(result.results.length, 24); assert.equal('accuracy' in result, false);
  assert.equal(result.format_version, 2);
  assert.deepEqual(result.results[0].input, { text: seed.cases[0].text, captured_at: seed.cases[0].captured_at, message_date: seed.cases[0].message_date, timezone: seed.timezone });
});

test('평가 실패 사례에도 검토할 합성 입력과 기준 시점을 남긴다', async () => {
  const abort = new AbortController();
  const result = await evaluateProvider({ version: 'test-only', extract: async context => {
    context.text = '변조된 입력';
    throw new Error('개인정보가 포함될 수 있는 원래 오류');
  } }, abort.signal, () => abort.abort());
  assert.equal(result.results[0].input.text, seed.cases[0].text);
  assert.equal(result.results[0].input.message_date, seed.cases[0].message_date);
  assert.equal(result.results[0].actual, null);
  assert.equal(result.results[0].error, 'EXTRACTION_FAILED');
  assert.equal(JSON.stringify(result).includes('개인정보가 포함될 수 있는 원래 오류'), false);
});
test('평가 취소 후 다음 사례를 실행하지 않는다', async () => {
  const abort = new AbortController();
  const result = await evaluateProvider({ version: 'test-only', extract: async () => [] }, abort.signal, () => abort.abort());
  assert.equal(result.completed, false); assert.equal(result.results.length, 1);
});
