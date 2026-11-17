import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDayClock } from '../src/domain/dayClock';
import { localDay, sortTodos, type Todo } from '../src/domain/todo';

function clock(initial: string) {
  let date = new Date(initial);
  let pending: { callback: () => void; delay: number } | undefined;
  const emitted: Date[] = [];
  const stop = startDayClock(value => emitted.push(value), () => new Date(date), (callback, delay) => {
    const request = { callback, delay };
    pending = request;
    return () => { if (pending === request) pending = undefined; };
  });
  return {
    emitted, stop,
    get pending() { return pending; },
    advance(value: string) { date = new Date(value); const next = pending!; pending = undefined; next.callback(); },
  };
}

test('자정에 날짜와 오늘 마감 우선순위를 함께 갱신한다', () => {
  const timer = clock('2026-11-17T23:59:59.500');
  const tasks = ['2026-11-17', '2026-11-18'].map((due_at, index) => ({
    id: String(index), status: 'pending', due_at, due_precision: 'date', sort_order: index, created_at: '',
  } as Todo));
  assert.equal(timer.pending?.delay, 500);
  assert.deepEqual(sortTodos(tasks, timer.emitted[0]).map(t => t.id), ['0', '1']);
  timer.advance('2026-11-18T00:00:00');
  assert.equal(localDay(timer.emitted[1]), '2026-11-18');
  assert.deepEqual(sortTodos(tasks, timer.emitted[1]).map(t => t.id), ['1', '0']);
  assert.equal(timer.pending?.delay, 60_000);
  timer.stop();
});

test('같은 날에는 재표시하지 않고 시계가 앞뒤로 바뀌면 다음 점검에 반영한다', () => {
  const timer = clock('2026-11-17T12:00:00');
  timer.advance('2026-11-17T12:01:00');
  assert.equal(timer.emitted.length, 1);
  timer.advance('2026-11-20T09:00:00');
  timer.advance('2026-11-16T09:00:00');
  assert.deepEqual(timer.emitted.map(localDay), ['2026-11-17', '2026-11-20', '2026-11-16']);
  timer.stop();
});

test('중지 뒤 늦게 도착한 타이머는 갱신하거나 재예약하지 않고 재시작은 즉시 동기화한다', () => {
  const timer = clock('2026-11-17T23:59:59');
  const delayed = timer.pending!.callback;
  timer.stop();
  delayed();
  assert.equal(timer.emitted.length, 1);
  assert.equal(timer.pending, undefined);
  const resumed = clock('2026-11-18T10:00:00');
  assert.equal(localDay(resumed.emitted[0]), '2026-11-18');
  resumed.stop();
});

test('같은 날짜 안에서 시간대 오프셋이 바뀌어도 시각 마감을 다시 계산한다', () => {
  let offset = -540;
  let tick!: () => void;
  const dates: Date[] = [];
  const stop = startDayClock(date => dates.push(date), () => {
    const date = new Date('2026-11-17T12:00:00');
    date.getTimezoneOffset = () => offset;
    return date;
  }, callback => { tick = callback; return () => {}; });
  offset = -480;
  tick();
  assert.equal(dates.length, 2);
  assert.equal(dates[1].getTimezoneOffset(), -480);
  tick();
  assert.equal(dates.length, 2);
  stop();
});
