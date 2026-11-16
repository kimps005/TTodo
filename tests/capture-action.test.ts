import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestCaptureAnalysis } from '../src/ui/captureAction';

// Exercise the real consent/analysis entry sequence with controlled async work.
// These callbacks do not simulate model output or measure AI accuracy.
test('실제 동의 조회 중 닫기·재선택·중복 요청을 막고 조회 실패 후 잠금을 푼다', async () => {
  for (const fail of [false, true]) {
    const working = { current: false }, consent = Promise.withResolvers<string | null>();
    let busy = false, reads = 0, analyses = 0, prompts = 0, draftChanges = 0;
    const options = {
      working,
      setBusy: (value: boolean) => { busy = value; },
      readConsent: () => { reads++; return consent.promise; },
      writeConsent: async () => { assert.fail('이미 동의한 경로는 동의를 다시 저장하지 않는다'); },
      analyze: async () => { assert.equal(working.current, true); assert.equal(busy, true); analyses++; },
      prompt: () => { prompts++; },
    };
    const request = requestCaptureAnalysis(options);
    const result = fail ? assert.rejects(request, /consent unavailable/) : request;
    assert.equal(working.current, true);
    assert.equal(busy, true);
    if (!working.current) draftChanges++; // 닫기와 사진 재선택이 사용하는 가드
    await requestCaptureAnalysis(options);
    assert.equal(reads, 1, '중복 요청은 동의를 다시 조회하거나 먼저 잠금을 풀면 안 된다');
    assert.equal(draftChanges, 0);
    assert.equal(busy, true);
    if (fail) consent.reject(new Error('consent unavailable')); else consent.resolve('yes');
    await result;
    assert.equal(analyses, fail ? 0 : 1);
    assert.equal(prompts, 0);
    assert.equal(working.current, false);
    assert.equal(busy, false);
    await requestCaptureAnalysis({ ...options, readConsent: async () => 'yes' });
    assert.equal(analyses, fail ? 1 : 2, '실패 후 새 요청을 처리해야 한다');
  }
});

test('동의하지 않으면 분석 없이 알림을 표시하고 승인 후 저장부터 분석 완료까지 잠금을 유지한다', async () => {
  const working = { current: false }, write = Promise.withResolvers<void>(), analysis = Promise.withResolvers<void>();
  let busy = false, prompts = 0, writes = 0, analyses = 0;
  const options = {
    working,
    setBusy: (value: boolean) => { busy = value; },
    readConsent: async () => 'no',
    writeConsent: () => { writes++; return write.promise; },
    analyze: () => { assert.equal(working.current, true); analyses++; return analysis.promise; },
    prompt: () => { prompts++; },
  };
  await requestCaptureAnalysis(options);
  assert.equal(prompts, 1);
  assert.equal(writes, 0);
  assert.equal(analyses, 0);
  assert.equal(working.current, false, '취소하거나 응답 없이 알림을 닫아도 잠금이 남지 않아야 한다');
  assert.equal(busy, false);
  const approved = requestCaptureAnalysis(options, true);
  assert.equal(working.current, true);
  assert.equal(writes, 1);
  assert.equal(analyses, 0, '동의 저장이 끝나기 전에 분석하면 안 된다');
  await requestCaptureAnalysis(options, true);
  assert.equal(writes, 1);
  write.resolve();
  await Promise.resolve();
  assert.equal(analyses, 1, '승인 저장 후 재진입 가드에 막히지 않고 분석해야 한다');
  assert.equal(working.current, true);
  assert.equal(busy, true);
  analysis.resolve();
  await approved;
  assert.equal(prompts, 1);
  assert.equal(working.current, false);
  assert.equal(busy, false);
});

test('동의 저장 또는 분석이 실패해도 잠금을 해제하고 원래 오류를 전달한다', async () => {
  for (const stage of ['write', 'analyze']) {
    const working = { current: false }, pending = Promise.withResolvers<void>();
    let busy = false, analyses = 0;
    const request = requestCaptureAnalysis({
      working,
      setBusy: value => { busy = value; },
      readConsent: async () => { assert.fail('승인 경로는 저장 후 예전 동의를 다시 조회하지 않는다'); },
      writeConsent: () => stage === 'write' ? pending.promise : Promise.resolve(),
      analyze: () => { analyses++; return pending.promise; },
      prompt: () => { assert.fail('승인한 뒤 동의 알림을 다시 표시하면 안 된다'); },
    }, true);
    const failure = assert.rejects(request, new RegExp(`${stage} failed`));
    assert.equal(working.current, true);
    pending.reject(new Error(`${stage} failed`));
    await failure;
    assert.equal(analyses, stage === 'write' ? 0 : 1);
    assert.equal(working.current, false);
    assert.equal(busy, false);
  }
});
