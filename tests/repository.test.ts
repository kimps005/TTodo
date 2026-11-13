import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Repository, type Database, type SqlConnection, type SqlValue } from '../src/data/repository';
import { normalizeTitle, sortTodos, validateDue } from '../src/domain/todo';
import { createSerializedDatabase } from '../src/data/serializedDatabase';
import schema from '../src/data/schema.json';

function fixture() {
  const native = new DatabaseSync(':memory:');
  const connection: SqlConnection = {
    execAsync: async sql => { native.exec(sql); },
    runAsync: async (sql, ...params) => native.prepare(sql).run(...params),
    getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => (native.prepare(sql).get(...params) as T) ?? null,
    getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).all(...params) as T[],
  };
  const db: Database = createSerializedDatabase(connection);
  const repo = new Repository(db, randomUUID, () => '2026-11-13T02:00:00.000Z');
  return { repo, native };
}
const task = { title: '발표자료 보내기', description: null, due_at: '2026-11-20', due_precision: 'date' as const, assignee: null, confidence: .9, evidence_text: '20일까지 발표자료 보내줘', needs_confirmation: 1 };
test('빈 입력·200자 초과·유효하지 않은 날짜를 거부한다', () => {
  assert.throws(() => normalizeTitle(' \n '));
  assert.throws(() => normalizeTitle('가'.repeat(201)));
  assert.equal(normalizeTitle('  택배 보내기  '), '택배 보내기');
  assert.throws(() => validateDue('2026-02-30', 'date'));
  assert.throws(() => validateDue('2026-11-13', 'unknown'));
});
test('수동 중복 입력은 허용하고 완료·수정·삭제를 보존한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  const first = await repo.addTodo({ title: '  택배 보내기  ' });
  await repo.addTodo({ title: '택배 보내기' });
  assert.equal((await repo.listTodos()).length, 2);
  await repo.setCompleted(first, true);
  await repo.updateTodo(first, { title: "보고서 '검토'", due_at: '2026-11-14', due_precision: 'date' });
  await repo.initialize();
  const saved = (await repo.listTodos()).find(t => t.id === first)!;
  assert.equal(saved.status, 'completed'); assert.equal(saved.title, "보고서 '검토'");
  assert.equal(saved.visibility, 'private');
  await repo.removeTodo(first); assert.equal((await repo.listTodos()).length, 1); native.close();
});
test('동일 이미지 지문은 재사용하며 승인 재전송으로 중복 생성하지 않는다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  const a = await repo.createAnalysis('hash', 'manual', '2026-11-13T02:00:00Z');
  const b = await repo.createAnalysis('hash', 'manual', '2026-11-13T02:00:01Z');
  assert.equal(a.id, b.id); assert.equal(b.created, false);
  await repo.finishAnalysis(a.id, [task, { ...task, title: '회의 준비' }], 'evaluation');
  const tasks = await repo.listExtracted(a.id);
  const selected = [{ id: tasks[0].id, input: { title: '수정된 제목' } }];
  await repo.approve(a.id, selected); await repo.approve(a.id, selected);
  assert.equal((await repo.listTodos()).length, 1);
  assert.equal((await repo.listAnalyses())[0].status, 'review');
  await repo.ignoreAnalysis(a.id);
  assert.equal((await repo.listAnalyses())[0].status, 'saved');
  assert.equal((await repo.listExtracted(a.id))[1].review_status, 'ignored'); native.close();
});
test('무시한 원문은 즉시 지우고 보존 기간이 지난 대기 제안은 저장할 수 없다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  const a = await repo.createAnalysis('private', 'manual', null);
  await repo.finishAnalysis(a.id, [task], 'evaluation');
  await repo.ignoreAnalysis(a.id);
  assert.equal((await repo.listExtracted(a.id))[0].evidence_text, '');
  assert.equal((await repo.listExtracted(a.id))[0].title, '무시한 제안');
  const b = await repo.createAnalysis('expires', 'manual', null);
  await repo.finishAnalysis(b.id, [task], 'evaluation');
  native.prepare('UPDATE analyses SET expires_at=? WHERE id=?').run('2026-11-12T00:00:00Z', b.id);
  await repo.pruneEvidence();
  assert.equal((await repo.listExtracted(b.id))[0].review_status, 'ignored');
  assert.equal((await repo.listExtracted(b.id))[0].evidence_text, '');
  await assert.rejects(repo.approve(b.id, [{ id: (await repo.listExtracted(b.id))[0].id, input: { title: '만료됨' } }]));
  native.close();
});
test('여러 항목 승인 중 하나가 실패하면 전체 트랜잭션을 되돌린다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  const a = await repo.createAnalysis('rollback', 'share', '2026-11-13T02:00:00Z');
  await repo.finishAnalysis(a.id, [task, task], 'evaluation');
  const tasks = await repo.listExtracted(a.id);
  await assert.rejects(repo.approve(a.id, [{ id: tasks[0].id, input: { title: '정상' } }, { id: tasks[1].id, input: { title: ' ' } }]));
  assert.equal((await repo.listTodos()).length, 0);
  assert.ok((await repo.listExtracted(a.id)).every(t => t.review_status === 'pending')); native.close();
});
test('동시에 들어온 승인도 하나만 생성하고 오류 다음의 대기 작업은 계속 진행한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  const a = await repo.createAnalysis('concurrent', 'manual', '2026-11-13T02:00:00Z');
  await repo.finishAnalysis(a.id, [task], 'evaluation');
  const selected = [{ id: (await repo.listExtracted(a.id))[0].id, input: { title: '동시 승인' } }];
  await Promise.all([repo.approve(a.id, selected), repo.approve(a.id, selected)]);
  assert.equal((await repo.listTodos()).length, 1);
  await assert.rejects(repo.approve('missing', []));
  await repo.addTodo({ title: '오류 이후 정상 입력' });
  assert.equal((await repo.listTodos()).length, 2); native.close();
});
test('v1 데이터와 승인 연결을 보존하며 촬영 시각을 모르는 사진을 v2에서 처리한다', async () => {
  const { repo, native } = fixture();
  native.exec(schema.sql.replace('captured_at TEXT,', 'captured_at TEXT NOT NULL,').replace('PRAGMA user_version = 2', 'PRAGMA user_version = 1'));
  const todoId = await repo.addTodo({ title: '이전 버전 할 일' });
  const old = await repo.createAnalysis('old-image', 'manual', '2026-11-12T02:00:00Z');
  await repo.finishAnalysis(old.id, [task], 'old-model');
  const oldTask = (await repo.listExtracted(old.id))[0];
  await repo.approve(old.id, [{ id: oldTask.id, input: { title: task.title } }]);
  await repo.initialize();
  assert.equal(native.prepare('PRAGMA user_version').get()!.user_version, 2);
  assert.equal((await repo.listTodos()).length, 2);
  assert.ok((await repo.listTodos()).some(t => t.id === todoId));
  assert.equal((await repo.listExtracted(old.id))[0].linked_todo_id, (await repo.listTodos()).find(t => t.source_id === oldTask.id)!.id);
  await repo.createAnalysis('unknown-time', 'manual', null);
  assert.equal((await repo.listAnalyses()).find(a => a.image_fingerprint === 'unknown-time')!.captured_at, null);
  native.close();
});
test('중단된 분석은 실패로 복구하며 무시한 항목은 승인할 수 없다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  const a = await repo.createAnalysis('interrupted', 'manual', '2026-11-13T02:00:00Z');
  await repo.initialize(); assert.equal((await repo.listAnalyses())[0].status, 'processing');
  native.prepare('UPDATE analyses SET received_at=? WHERE id=?').run('2026-11-13T01:49:00.000Z', a.id);
  await repo.initialize(); assert.equal((await repo.listAnalyses())[0].error_code, 'INTERRUPTED');
  await repo.ignoreAnalysis(a.id); await assert.rejects(repo.approve(a.id, [])); native.close();
});
test('내보내기는 데이터 복사본이고 전체 삭제는 개인정보 설정까지 제거한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.addTodo({ title: '개인 정보' }); await repo.setPreference('ai_consent', 'yes');
  assert.equal(JSON.parse(await repo.exportData()).todos.length, 1);
  await repo.deleteAll(); assert.deepEqual(await repo.listTodos(), []);
  assert.equal(await repo.getPreference('ai_consent'), null); native.close();
});
test('오늘·기한 지남·마감 없음·미래·완료 순서로 정렬한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  for (const [title, due] of [['미래','2026-11-14'],['지남','2026-11-12'],['오늘','2026-11-13'],['없음',null]] as const) {
    await repo.addTodo({ title, due_at: due, due_precision: due ? 'date' : 'unknown' });
  }
  assert.deepEqual(sortTodos(await repo.listTodos(), new Date('2026-11-13T12:00:00')).map(t => t.title), ['오늘','지남','없음','미래']); native.close();
});
test('서로 다른 시간대의 마감은 문자열 대신 실제 시각으로 비교한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.addTodo({ title: '먼저', due_at: '2026-11-13T17:00:00+09:00', due_precision: 'datetime' });
  await repo.addTodo({ title: '나중', due_at: '2026-11-13T09:00:00Z', due_precision: 'datetime' });
  assert.deepEqual(sortTodos(await repo.listTodos(), new Date('2026-11-13T12:00:00')).map(t => t.title), ['먼저','나중']);
  native.close();
});
