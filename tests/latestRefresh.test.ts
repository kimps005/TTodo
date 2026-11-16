import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLatestRefresh } from '../src/data/latestRefresh';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('늦게 끝난 이전 조회는 삭제된 목록이나 철회된 동의를 복원하지 않는다', async () => {
  type Snapshot = { todos: string[]; consent: boolean };
  const old = deferred<Snapshot>(), recent = deferred<Snapshot>();
  const shown: Snapshot[] = [];
  const refresh = createLatestRefresh((source: Promise<Snapshot>) => source, value => shown.push(value));
  const first = refresh(old.promise), second = refresh(recent.promise);
  recent.resolve({ todos: [], consent: false }); await second;
  old.resolve({ todos: ['deleted'], consent: true }); await first;
  assert.deepEqual(shown, [{ todos: [], consent: false }]);
});

test('최신 조회 실패를 알리고 이전 조회가 나중에 성공해도 적용하지 않으며 다음 재시도는 반영한다', async () => {
  const old = deferred<string>(), recent = deferred<string>();
  const shown: string[] = [];
  const refresh = createLatestRefresh((source: Promise<string>) => source, value => shown.push(value));
  const first = refresh(old.promise), second = refresh(recent.promise);
  const error = new Error('latest read failed');
  recent.reject(error); await assert.rejects(second, value => value === error);
  old.resolve('obsolete'); await first;
  assert.deepEqual(shown, []);
  await refresh(Promise.resolve('retried'));
  assert.deepEqual(shown, ['retried']);
});

test('더 최신 조회가 시작됐으면 이전 조회 오류를 재표시하지 않는다', async () => {
  const old = deferred<string>(), recent = deferred<string>();
  const shown: string[] = [];
  const refresh = createLatestRefresh((source: Promise<string>) => source, value => shown.push(value));
  const first = refresh(old.promise), second = refresh(recent.promise);
  old.reject(new Error('obsolete failure')); await first;
  assert.deepEqual(shown, []);
  recent.resolve('current'); await second;
  assert.deepEqual(shown, ['current']);
});
