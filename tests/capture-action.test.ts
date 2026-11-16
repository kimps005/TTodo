import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestCaptureAnalysis } from '../src/ui/captureAction';
import { createReviewConfirmation } from '../src/ui/reviewConfirmation';

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


test('확인 또는 동의 대기 중 사진이나 입력이 바뀌면 이전 요청은 동의 저장과 분석을 하지 않는다', async () => {
  let current = true, writes = 0, analyses = 0, prompts = 0;
  const options = { working: { current: false }, setBusy: (_: boolean) => {},
    readConsent: async () => 'no', writeConsent: async () => { writes++; },
    analyze: async () => { analyses++; }, prompt: () => { prompts++; },
    isCurrent: () => current };
  await requestCaptureAnalysis(options);
  assert.equal(prompts, 1);
  current = false;
  await requestCaptureAnalysis(options, true);
  assert.equal(writes, 0);
  assert.equal(analyses, 0);
});


test('동의 조회가 끝나기 전에 요청이 무효화되면 알림과 분석을 생략한다', async () => {
  let current = true, prompts = 0, analyses = 0;
  const pending = Promise.withResolvers<string | null>();
  const request = requestCaptureAnalysis({ working: { current: false }, setBusy: () => {},
    readConsent: () => pending.promise, writeConsent: async () => {},
    analyze: async () => { analyses++; }, prompt: () => { prompts++; }, isCurrent: () => current });
  current = false; pending.resolve('yes');
  await request;
  assert.equal(prompts, 0); assert.equal(analyses, 0);
});

test('동의 저장 중 요청이 무효화되면 저장 완료 후 분석을 시작하지 않고 잠금을 푼다', async () => {
  let current = true, busy = false, analyses = 0, prompts = 0;
  const working = { current: false }, pending = Promise.withResolvers<void>();
  const request = requestCaptureAnalysis({ working, setBusy: value => { busy = value; },
    readConsent: async () => 'no', writeConsent: () => pending.promise,
    analyze: async () => { analyses++; }, prompt: () => { prompts++; }, isCurrent: () => current }, true);
  assert.equal(working.current, true);
  assert.equal(busy, true);
  current = false;
  pending.resolve();
  await request;
  assert.equal(analyses, 0);
  assert.equal(prompts, 0);
  assert.equal(working.current, false);
  assert.equal(busy, false);
});

test('새 캡처 확인은 이전 응답과 취소를 무효화하고 동의 저장을 한 번만 시작한다', async () => {
  const confirmation = createReviewConfirmation();
  const working = { current: false }, pending = Promise.withResolvers<void>();
  let writes = 0, analyses = 0;
  const options = {
    working, setBusy: (_: boolean) => {}, readConsent: async () => 'no',
    writeConsent: () => { writes++; return pending.promise; },
    analyze: async () => { analyses++; }, prompt: () => {},
  };
  const previous = confirmation.capture();
  const current = confirmation.capture();
  const approve = (take: () => boolean) => take() ? requestCaptureAnalysis(options, true) : Promise.resolve();
  await approve(previous);
  assert.equal(previous(), false, '오래된 취소도 새 확인을 무효화하면 안 된다');
  const accepted = approve(current);
  await approve(current);
  assert.equal(writes, 1);
  assert.equal(analyses, 0);
  pending.resolve();
  await accepted;
  assert.equal(analyses, 1);
  await approve(current);
  assert.equal(writes, 1, '완료 후 중복 응답으로 다시 동의를 저장하면 안 된다');
  assert.equal(analyses, 1);
});
