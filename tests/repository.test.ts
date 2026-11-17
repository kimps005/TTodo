import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Repository, type Database, type SqlConnection, type SqlValue } from '../src/data/repository';
import { normalizeTitle, sortTodos, validateDue } from '../src/domain/todo';
import { createSerializedDatabase } from '../src/data/serializedDatabase';
import schema from '../src/data/schema.json';

function fixture(now = () => '2026-11-13T02:00:00.000Z', path = ':memory:') {
  const native = new DatabaseSync(path);
  const connection: SqlConnection = {
    execAsync: async sql => { native.exec(sql); },
    runAsync: async (sql, ...params) => native.prepare(sql).run(...params),
    getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => (native.prepare(sql).get(...params) as T) ?? null,
    getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => native.prepare(sql).all(...params) as T[],
  };
  const db: Database = createSerializedDatabase(connection);
  const repo = new Repository(db, randomUUID, now);
  return { repo, native };
}
const task = { title: '발표자료 보내기', description: null, due_at: '2026-11-20', due_precision: 'date' as const, assignee: null, confidence: .9, evidence_text: '20일까지 발표자료 보내줘', needs_confirmation: 1 };

test('저장 확인 뒤 유사 분석이 생기거나 바뀌면 승인 없이 할 일을 만들지 않는다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  try {
    await repo.setPreference('ai_local_consent', 'yes');
    const current = await repo.createAnalysis('similar-confirm-current', 'manual', null);
    await repo.finishAnalysis(current.id, [task], 'test', current.token!);
    const [proposal] = await repo.listExtracted(current.id);
    const edits = [{ id: proposal.id, input: { title: proposal.title } }];
    const before = await repo.findSimilarAnalyses(current.id, task.evidence_text);
    assert.deepEqual(before, []);
    const other = await repo.createAnalysis('similar-confirm-other', 'share', null);
    await repo.finishAnalysis(other.id, [task], 'test', other.token!);
    await assert.rejects(repo.approve(current.id, edits, before), /비슷한 분석/);
    assert.equal((await repo.listTodos()).length, 0);
    assert.equal((await repo.listExtracted(current.id))[0].review_status, 'pending');
    const shown = await repo.findSimilarAnalyses(current.id, task.evidence_text);
    const [otherTask] = await repo.listExtracted(other.id);
    await repo.approve(other.id, [{ id: otherTask.id, input: { title: '다른 경로에서 저장한 제목' } }]);
    await assert.rejects(repo.approve(current.id, edits, shown), /비슷한 분석/);
    assert.equal((await repo.listTodos()).length, 1);
    const confirmed = await repo.findSimilarAnalyses(current.id, task.evidence_text);
    await repo.approve(current.id, edits, confirmed);
    await repo.approve(current.id, edits, confirmed);
    assert.equal((await repo.listTodos()).length, 2);
  } finally { native.close(); }
});
test('재분석 확인 후 제안이 교체되면 새 제안을 보존하고 다시 확인하도록 한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  try {
    await repo.setPreference('ai_local_consent', 'yes');
    const analysis = await repo.createAnalysis('reanalysis-confirmation', 'manual', null);
    await repo.finishAnalysis(analysis.id, [task], 'first', analysis.token!);
    const old = await repo.listExtracted(analysis.id);
    const confirmed = await repo.reanalysisSnapshot('reanalysis-confirmation');
    assert.deepEqual(confirmed, { id: analysis.id, status: 'review', taskIds: old.map(t => t.id) });
    const otherToken = await repo.restartUnstoredAnalysis(analysis.id, false, confirmed);
    await repo.finishAnalysis(analysis.id, [{ ...task, title: '새 제안' }], 'second', otherToken);
    const fresh = await repo.listExtracted(analysis.id);
    await assert.rejects(repo.restartUnstoredAnalysis(analysis.id, false, confirmed), /변경/);
    assert.deepEqual(await repo.listExtracted(analysis.id), fresh);
    assert.equal((await repo.listAnalyses())[0].status, 'review');
    assert.deepEqual(await repo.listTodos(), []);
    const token = await repo.restartUnstoredAnalysis(analysis.id, false, { status: 'review', taskIds: fresh.map(t => t.id) });
    assert.ok(token);
    assert.deepEqual(await repo.listExtracted(analysis.id), []);
  } finally { native.close(); }
});
test('알 수 없는 새 스키마는 저널 설정과 데이터를 변경하기 전에 거부한다', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ttodo-future-schema-'));
  const { repo, native } = fixture(undefined, join(directory, 'future.sqlite'));
  try {
    await repo.initialize();
    const id = await repo.addTodo({ title: '최신 앱이 저장한 할 일' });
    native.exec(`PRAGMA journal_mode=WAL; PRAGMA user_version=${schema.version + 1}; CREATE TABLE future_data (value TEXT); INSERT INTO future_data VALUES('최신 앱 전용 데이터');`);
    await assert.rejects(repo.initialize(), /앱을 업데이트/);
    assert.equal(native.prepare('PRAGMA journal_mode').get()!.journal_mode, 'wal');
    assert.equal(native.prepare('PRAGMA user_version').get()!.user_version, schema.version + 1);
    assert.equal(native.prepare('SELECT title FROM todos WHERE id=?').get(id)!.title, '최신 앱이 저장한 할 일');
    assert.equal(native.prepare('SELECT value FROM future_data').get()!.value, '최신 앱 전용 데이터');
  } finally { native.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('보존 기한에 도착한 분석 응답은 원문과 제안을 저장하지 않고 명시적 재시도만 허용한다', async () => {
  let time = '2026-11-13T02:00:00.000Z';
  const { repo, native } = fixture(() => time); await repo.initialize();
  try {
    await repo.setPreference('ai_local_consent', 'yes');
    const before = await repo.createAnalysis('before-expiry', 'manual', null);
    const boundary = await repo.createAnalysis('at-expiry', 'shortcuts', null);
    const after = await repo.createAnalysis('after-expiry', 'share', null);
    const invalid = await repo.createAnalysis('invalid-expiry', 'manual', null);
    native.prepare('UPDATE analyses SET expires_at=? WHERE id=?').run('invalid', invalid.id);
    time = '2026-11-20T01:59:59.999Z';
    await repo.finishAnalysis(before.id, [task], 'before', before.token!);
    time = '2026-11-20T02:00:00.000Z';
    await assert.rejects(repo.finishAnalysis(boundary.id, [task], 'late', boundary.token!), /보존 기간/);
    time = '2026-11-20T02:00:00.001Z';
    await assert.rejects(repo.finishAnalysis(after.id, [task], 'late', after.token!), /보존 기간/);
    await assert.rejects(repo.finishAnalysis(invalid.id, [task], 'late', invalid.token!), /보존 기간/);
    for (const analysis of [boundary, after, invalid]) {
      assert.equal(native.prepare('SELECT COUNT(*) AS count FROM extracted_tasks WHERE analysis_id=?').get(analysis.id)!.count, 0);
      assert.equal(native.prepare('SELECT model_version FROM analyses WHERE id=?').get(analysis.id)!.model_version, null);
    }
    assert.deepEqual(await repo.listTodos(), []);
    await repo.pruneEvidence();
    const token = await repo.retryFailedAnalysis(boundary.id);
    await assert.rejects(repo.finishAnalysis(boundary.id, [task], 'old', boundary.token!), /상태/);
    await repo.finishAnalysis(boundary.id, [task], 'fresh', token);
    assert.equal((await repo.listExtracted(boundary.id)).length, 1);
    assert.deepEqual(await repo.listTodos(), []);
  } finally { native.close(); }
});
test('동의 확인 뒤 철회가 먼저 처리되면 새 분석 등록과 기존 지문 재사용을 거부한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  try {
    await assert.rejects(repo.createAnalysis('without-consent', 'manual', null), /동의/);
    await repo.setPreference('ai_local_consent', 'yes');
    const existing = await repo.createAnalysis('existing-consent', 'manual', null);
    assert.equal(await repo.getPreference('ai_local_consent'), 'yes'); // UI's earlier check.
    const revoke = repo.revokeLocalAIConsent();
    const fresh = repo.createAnalysis('after-withdrawal', 'manual', null);
    const duplicate = repo.createAnalysis('existing-consent', 'manual', null);
    await revoke;
    await assert.rejects(fresh, /동의/);
    await assert.rejects(duplicate, /동의/);
    await repo.setPreference('ai_local_consent', 'yes');
    const rows = await repo.listAnalyses();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, existing.id);
    assert.equal(rows[0].processing_token, null);
    assert.equal(rows[0].error_code, 'CONSENT_REVOKED');
    const authorized = await repo.createAnalysis('after-withdrawal', 'manual', null);
    assert.equal(authorized.created, true);
    await repo.finishAnalysis(authorized.id, [task], 'new-request', authorized.token!);
    assert.equal((await repo.listExtracted(authorized.id)).length, 1);
    assert.deepEqual(await repo.listTodos(), []);
  } finally { native.close(); }
});
test('다른 DB 연결에서 동의를 철회한 뒤 오래된 분석 등록을 거부한다', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ttodo-consent-connections-'));
  const path = join(directory, 'shared.sqlite');
  const first = fixture(undefined, path), second = fixture(undefined, path);
  try {
    await first.repo.initialize();
    await second.repo.initialize();
    await first.repo.setPreference('ai_local_consent', 'yes');
    const existing = await first.repo.createAnalysis('existing-connection', 'manual', null);
    assert.equal(await first.repo.getPreference('ai_local_consent'), 'yes');
    await second.repo.revokeLocalAIConsent();
    const afterRevocation = second.native.prepare('SELECT * FROM analyses WHERE id=?').get(existing.id);
    await assert.rejects(first.repo.createAnalysis('new-connection', 'manual', null), /동의/);
    await assert.rejects(first.repo.createAnalysis('existing-connection', 'manual', null), /동의/);
    assert.deepEqual(first.native.prepare('SELECT * FROM analyses WHERE id=?').get(existing.id), afterRevocation);
    assert.equal(first.native.prepare('SELECT COUNT(*) AS count FROM analyses').get()!.count, 1);
    assert.equal(afterRevocation!.processing_token, null);
    assert.equal(afterRevocation!.error_code, 'CONSENT_REVOKED');
    assert.deepEqual(await first.repo.listTodos(), []);
  } finally {
    first.native.close(); second.native.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
test('분석 저장 중 두 번째 제안 또는 최종 상태 쓰기가 실패하면 전체 결과를 되돌리고 재시도한다', async () => {
  for (const stage of ['proposal', 'status']) {
    const { repo, native } = fixture(); await repo.initialize();
    try {
      await repo.setPreference('ai_local_consent', 'yes');
      const analysis = await repo.createAnalysis(`finish-rollback-${stage}`, 'manual', null);
      const before = native.prepare('SELECT * FROM analyses WHERE id=?').get(analysis.id);
      const second = { ...task, title: '두 번째 제안' };
      native.exec(stage === 'proposal'
        ? "CREATE TRIGGER fail_finish BEFORE INSERT ON extracted_tasks WHEN NEW.title='두 번째 제안' BEGIN SELECT RAISE(ABORT,'test-only-finish-failure'); END;"
        : "CREATE TRIGGER fail_finish BEFORE UPDATE OF status ON analyses WHEN NEW.status='review' BEGIN SELECT RAISE(ABORT,'test-only-finish-failure'); END;");
      await assert.rejects(repo.finishAnalysis(analysis.id, [task, second], 'failed-write', analysis.token!), /test-only-finish-failure/);
      assert.deepEqual(native.prepare('SELECT * FROM analyses WHERE id=?').get(analysis.id), before);
      assert.deepEqual(await repo.listExtracted(analysis.id), []);
      assert.deepEqual(await repo.listTodos(), []);
      native.exec('DROP TRIGGER fail_finish');
      await repo.finishAnalysis(analysis.id, [task, second], 'retry', analysis.token!);
      assert.deepEqual((await repo.listExtracted(analysis.id)).map(row => row.title), [task.title, second.title]);
      assert.equal((await repo.listAnalyses())[0].status, 'review');
      assert.deepEqual(await repo.listTodos(), []);
    } finally { native.close(); }
  }
});

test('재분석 상태 쓰기가 실패하면 삭제한 기존 제안과 처리 정보를 모두 복원한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  try {
    await repo.setPreference('ai_local_consent', 'yes');
    const analysis = await repo.createAnalysis('restart-rollback', 'share', null);
    await repo.finishAnalysis(analysis.id, [task, { ...task, title: '보존할 다른 제안' }], 'original', analysis.token!);
    const before = native.prepare('SELECT * FROM analyses WHERE id=?').get(analysis.id);
    const proposals = await repo.listExtracted(analysis.id);
    native.exec("CREATE TRIGGER fail_restart BEFORE UPDATE OF status ON analyses WHEN NEW.status='processing' BEGIN SELECT RAISE(ABORT,'test-only-restart-failure'); END;");
    await assert.rejects(repo.restartUnstoredAnalysis(analysis.id), /test-only-restart-failure/);
    assert.deepEqual(native.prepare('SELECT * FROM analyses WHERE id=?').get(analysis.id), before);
    assert.deepEqual(await repo.listExtracted(analysis.id), proposals);
    native.exec('DROP TRIGGER fail_restart');
    const token = await repo.restartUnstoredAnalysis(analysis.id);
    assert.notEqual(token, analysis.token);
    assert.deepEqual(await repo.listExtracted(analysis.id), []);
    await repo.finishAnalysis(analysis.id, [task], 'replacement', token);
    const replacement = await repo.listExtracted(analysis.id);
    assert.equal(replacement.length, 1);
    assert.ok(proposals.every(old => old.id !== replacement[0].id));
    assert.deepEqual(await repo.listTodos(), []);
  } finally { native.close(); }
});

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
test('잘못된 0년 마감은 추가와 수정에서 거부하고 기존 할 일을 보존한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  try {
    const id = await repo.addTodo({ title: '기존 할 일', due_at: '2026-11-20', due_precision: 'date' });
    await assert.rejects(repo.addTodo({ title: '잘못된 할 일', due_at: '0000-01-01', due_precision: 'date' }));
    await assert.rejects(repo.updateTodo(id, { title: '변경', due_at: '0000-01-01T09:00:00+09:00', due_precision: 'datetime' }));
    const rows = await repo.listTodos();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, '기존 할 일');
    assert.equal(rows[0].due_at, '2026-11-20');
  } finally { native.close(); }
});
test('다른 연결에서 삭제한 할 일의 오래된 편집·완료·삭제 요청은 성공으로 처리하지 않는다', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ttodo-stale-edit-'));
  const path = join(directory, 'shared.sqlite');
  const { repo, native } = fixture(undefined, path);
  await repo.initialize();
  const other = new DatabaseSync(path);
  try {
    const deleted = await repo.addTodo({ title: '다른 경로에서 삭제할 항목' });
    const preserved = await repo.addTodo({ title: '유지할 항목' });
    const saved = await repo.listTodos(); // Open editor's earlier snapshot.
    assert.ok(saved.some(row => row.id === deleted));
    other.prepare('DELETE FROM todos WHERE id=?').run(deleted);
    await assert.rejects(repo.updateTodo(deleted, { title: '오래된 편집 내용', description: '되살리면 안 되는 메모' }), /삭제.*다시 확인/);
    await assert.rejects(repo.setCompleted(deleted, true), /삭제.*다시 확인/);
    await assert.rejects(repo.setCompleted(deleted, false), /삭제.*다시 확인/);
    await assert.rejects(repo.removeTodo(deleted), /삭제.*다시 확인/);
    assert.deepEqual(await repo.listTodos(), saved.filter(row => row.id !== deleted));
    await repo.updateTodo(preserved, { title: '정상 수정' });
    await repo.setCompleted(preserved, true);
    assert.equal((await repo.listTodos())[0].title, '정상 수정');
    assert.equal((await repo.listTodos())[0].status, 'completed');
  } finally { other.close(); native.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('삭제 확인 후 다른 연결에서 바뀐 항목은 보존하고 최신 확인 후 삭제한다', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ttodo-stale-delete-'));
  const path = join(directory, 'shared.sqlite');
  const { repo, native } = fixture(undefined, path);
  await repo.initialize();
  const other = new DatabaseSync(path);
  try {
    const id = await repo.addTodo({ title: '이전 제목' });
    const snapshot = (await repo.listTodos())[0];
    other.prepare('UPDATE todos SET title=?, description=? WHERE id=?').run('수정된 제목', '보존할 메모', id);
    await assert.rejects(repo.removeTodo(id, snapshot), /변경.*다시 확인/);
    const current = (await repo.listTodos())[0];
    assert.equal(current.title, '수정된 제목');
    assert.equal(current.description, '보존할 메모');
    await repo.removeTodo(id, current);
    assert.deepEqual(await repo.listTodos(), []);
  } finally { other.close(); native.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('오래된 편집은 다른 연결의 변경을 덮지 않고 최신 내용을 다시 편집할 수 있다', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ttodo-stale-update-'));
  const path = join(directory, 'shared.sqlite');
  const { repo, native } = fixture(undefined, path);
  await repo.initialize();
  const other = new DatabaseSync(path);
  try {
    const id = await repo.addTodo({ title: '기존 제목', description: '기존 메모' });
    const snapshot = (await repo.listTodos())[0];
    other.prepare('UPDATE todos SET description=? WHERE id=?').run('다른 곳에서 수정한 메모', id);
    await assert.rejects(repo.updateTodo(id, { title: '이전 화면의 제목', description: '기존 메모' }, snapshot), /변경.*다시 확인/);
    const current = (await repo.listTodos())[0];
    assert.equal(current.title, '기존 제목');
    assert.equal(current.description, '다른 곳에서 수정한 메모');
    await repo.updateTodo(id, { title: '다시 확인한 제목', description: current.description }, current);
    const updated = (await repo.listTodos())[0];
    assert.equal(updated.title, '다시 확인한 제목');
    assert.equal(updated.description, '다른 곳에서 수정한 메모');
    other.prepare("UPDATE todos SET status='completed' WHERE id=?").run(id);
    await repo.updateTodo(id, { title: '완료 상태를 유지한 편집', description: updated.description }, updated);
    assert.equal((await repo.listTodos())[0].status, 'completed');
  } finally { other.close(); native.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('오래된 완료·복원 요청은 다른 연결이 변경한 항목을 처리하지 않는다', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ttodo-stale-completion-'));
  const path = join(directory, 'shared.sqlite');
  const { repo, native } = fixture(undefined, path);
  await repo.initialize();
  const other = new DatabaseSync(path);
  try {
    const id = await repo.addTodo({ title: '기존 항목' });
    const pending = (await repo.listTodos())[0];
    other.prepare('UPDATE todos SET title=? WHERE id=?').run('변경된 항목', id);
    await assert.rejects(repo.setCompleted(id, true, pending), /변경.*다시 확인/);
    const changed = (await repo.listTodos())[0];
    assert.equal(changed.status, 'pending');
    await repo.setCompleted(id, true, changed);
    const completed = (await repo.listTodos())[0];
    other.prepare("UPDATE todos SET status='pending', completed_at=NULL WHERE id=?").run(id);
    await assert.rejects(repo.setCompleted(id, false, completed), /변경.*다시 확인/);
    assert.equal((await repo.listTodos())[0].status, 'pending');
  } finally { other.close(); native.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('동일 이미지 지문은 재사용하며 승인 재전송으로 중복 생성하지 않는다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const a = await repo.createAnalysis('hash', 'manual', '2026-11-13T02:00:00Z');
  const b = await repo.createAnalysis('hash', 'manual', '2026-11-13T02:00:01Z');
  assert.equal(a.id, b.id); assert.equal(b.created, false);
  await repo.finishAnalysis(a.id, [task, { ...task, title: '회의 준비' }], 'evaluation', a.token!);
  const tasks = await repo.listExtracted(a.id);
  const selected = [{ id: tasks[0].id, input: { title: '수정된 제목' } }];
  await repo.approve(a.id, selected); await repo.approve(a.id, selected);
  assert.equal((await repo.listTodos()).length, 1);
  assert.equal((await repo.listAnalyses())[0].status, 'review');
  await repo.ignoreAnalysis(a.id);
  assert.equal((await repo.listAnalyses())[0].status, 'saved');
  assert.equal((await repo.listExtracted(a.id))[1].review_status, 'ignored'); native.close();
});

test('다른 경로에서 무시된 제안의 오래된 승인은 저장 성공으로 처리하지 않는다', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ttodo-stale-ignored-'));
  const path = join(directory, 'shared.sqlite');
  const { repo, native } = fixture(undefined, path); await repo.initialize();
  const other = fixture(undefined, path); await other.repo.initialize();
  try {
    await repo.setPreference('ai_local_consent', 'yes');
    const analysis = await repo.createAnalysis('stale-ignored-approval', 'manual', null);
    await repo.finishAnalysis(analysis.id, [task, { ...task, title: '나중에 무시할 제안' }], 'test', analysis.token!);
    const proposals = await repo.listExtracted(analysis.id);
    await repo.approve(analysis.id, [{ id: proposals[0].id, input: { title: '먼저 저장한 할 일' } }]);
    await other.repo.ignoreAnalysis(analysis.id, [proposals[1].id]);
    await assert.rejects(repo.approve(analysis.id, [{ id: proposals[1].id, input: { title: '오래된 승인' } }]), /변경.*다시 확인/);
    // A stale batch can contain both an already saved proposal and a now ignored one.
    // The idempotent saved entry must not hide the rejected entry.
    await assert.rejects(repo.approve(analysis.id, proposals.map(p => ({ id: p.id, input: { title: '오래된 일괄 승인' } }))), /변경.*다시 확인/);
    const todos = await repo.listTodos();
    assert.equal(todos.length, 1);
    assert.equal(todos[0].title, '먼저 저장한 할 일');
    assert.equal((await repo.listExtracted(analysis.id))[1].review_status, 'ignored');
    await repo.approve(analysis.id, [{ id: proposals[0].id, input: { title: '중복 요청' } }]);
    assert.equal((await repo.listTodos()).length, 1);
  } finally { other.native.close(); native.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('할 일 삭제는 연결된 분석 본문을 지우며 나머지 제안과 중복 방지 상태를 보존한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const analysis = await repo.createAnalysis('deletion-policy', 'share', null);
  await repo.finishAnalysis(analysis.id, [{ ...task, title: '지울 원래 제목', description: '지울 원래 설명', assignee: '지울 담당', evidence_text: '지울 원문' }, { ...task, title: '남길 저장 항목' }, { ...task, title: '남길 대기 항목' }], 'test', analysis.token!);
  const proposals = await repo.listExtracted(analysis.id);
  const edits = proposals.slice(0, 2).map(p => ({ id: p.id, input: { title: p.title, description: p.description } }));
  await repo.approve(analysis.id, edits);
  const todo = (await repo.listTodos()).find(t => t.source_id === proposals[0].id)!;
  await repo.updateTodo(todo.id, { title: '지울 수정 제목', description: '지울 수정 메모' });
  assert.deepEqual(await repo.removeTodo(todo.id), [analysis.id]);
  const after = await repo.listExtracted(analysis.id);
  assert.equal(after[0].title, '삭제한 할 일'); assert.equal(after[0].description, null);
  assert.equal(after[0].evidence_text, ''); assert.equal(after[0].assignee, null);
  assert.equal(after[0].due_at, null); assert.equal(after[0].due_precision, 'unknown');
  assert.equal(after[0].linked_todo_id, null); assert.equal(after[0].review_status, 'saved');
  assert.equal(after[1].title, '남길 저장 항목'); assert.equal(after[2].review_status, 'pending');
  await repo.approve(analysis.id, edits);
  assert.equal((await repo.listTodos()).length, 1);
  assert.equal((await repo.createAnalysis('deletion-policy', 'share', null)).created, false);
  const exported = await repo.exportData();
  for (const value of ['지울 원래 제목', '지울 원래 설명', '지울 원문', '지울 담당', '지울 수정 제목', '지울 수정 메모']) assert.equal(exported.includes(value), false);
  native.close();
});

test('AI 할 일의 오래된 삭제가 거부되면 연결 원문도 보존하고 최신 삭제 시 해당 원문만 지운다', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ttodo-stale-ai-delete-'));
  const path = join(directory, 'shared.sqlite');
  const { repo, native } = fixture(undefined, path);
  await repo.initialize();
  const other = new DatabaseSync(path);
  try {
    await repo.setPreference('ai_local_consent', 'yes');
    const analysis = await repo.createAnalysis('stale-ai-delete', 'manual', null);
    await repo.finishAnalysis(analysis.id, [{ ...task, evidence_text: '삭제할 원문' }, { ...task, title: '남길 제안', evidence_text: '남길 원문' }], 'test', analysis.token!);
    const proposals = await repo.listExtracted(analysis.id);
    await repo.approve(analysis.id, [{ id: proposals[0].id, input: { title: '확인한 할 일' } }]);
    const snapshot = (await repo.listTodos())[0];
    other.prepare('UPDATE todos SET title=? WHERE id=?').run('다른 곳에서 수정한 할 일', snapshot.id);
    await assert.rejects(repo.removeTodo(snapshot.id, snapshot), /변경.*다시 확인/);
    assert.equal((await repo.listExtracted(analysis.id))[0].evidence_text, '삭제할 원문');
    const current = (await repo.listTodos())[0];
    assert.equal(current.title, '다른 곳에서 수정한 할 일');
    await repo.removeTodo(current.id, current);
    const after = await repo.listExtracted(analysis.id);
    assert.equal(after[0].evidence_text, '');
    assert.equal(after[0].title, '삭제한 할 일');
    assert.equal(after[0].review_status, 'saved');
    assert.equal(after[1].evidence_text, '남길 원문');
    assert.equal(after[1].review_status, 'pending');
    assert.equal((await repo.createAnalysis('stale-ai-delete', 'manual', null)).created, false);
  } finally { other.close(); native.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('삭제가 실패하면 연결된 분석 본문 정리도 롤백하며 과거 삭제 잔여 본문은 다음 접근 때 정리한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const a = await repo.createAnalysis('delete-rollback', 'manual', null);
  await repo.finishAnalysis(a.id, [task], 'test', a.token!);
  const proposal = (await repo.listExtracted(a.id))[0];
  await repo.approve(a.id, [{ id: proposal.id, input: { title: task.title } }]);
  const todo = (await repo.listTodos())[0];
  native.exec("CREATE TRIGGER fail_delete BEFORE DELETE ON todos BEGIN SELECT RAISE(ABORT,'test-only-delete-failure'); END;");
  await assert.rejects(repo.removeTodo(todo.id), /test-only-delete-failure/);
  assert.equal((await repo.listTodos()).length, 1);
  assert.equal((await repo.listExtracted(a.id))[0].evidence_text, task.evidence_text);
  native.exec('DROP TRIGGER fail_delete');
  native.prepare('DELETE FROM todos WHERE id=?').run(todo.id); // Old version's delete path.
  assert.equal((await repo.listExtracted(a.id))[0].linked_todo_id, null);
  await repo.initialize();
  const cleaned = (await repo.listExtracted(a.id))[0];
  assert.equal(cleaned.title, '삭제한 할 일'); assert.equal(cleaned.evidence_text, '');
  assert.equal(cleaned.review_status, 'saved');
  native.close();
});

test('무시한 원문은 즉시 지우고 보존 기간이 지난 대기 제안은 저장할 수 없다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const a = await repo.createAnalysis('private', 'manual', null);
  await repo.finishAnalysis(a.id, [task], 'evaluation', a.token!);
  await repo.ignoreAnalysis(a.id);
  assert.equal((await repo.listExtracted(a.id))[0].evidence_text, '');
  assert.equal((await repo.listExtracted(a.id))[0].title, '무시한 제안');
  const b = await repo.createAnalysis('expires', 'manual', null);
  await repo.finishAnalysis(b.id, [task], 'evaluation', b.token!);
  native.prepare('UPDATE analyses SET expires_at=? WHERE id=?').run('2026-11-12T00:00:00Z', b.id);
  await repo.pruneEvidence();
  assert.equal((await repo.listExtracted(b.id))[0].review_status, 'ignored');
  assert.equal((await repo.listExtracted(b.id))[0].evidence_text, '');
  await assert.rejects(repo.approve(b.id, [{ id: (await repo.listExtracted(b.id))[0].id, input: { title: '만료됨' } }]));
  native.close();
});
test('분석 중 동의를 철회하면 늦게 도착한 결과와 원문을 저장하지 않는다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const analysis = await repo.createAnalysis('revoked-during-extraction', 'manual', null);
  await repo.revokeLocalAIConsent();
  await assert.rejects(repo.finishAnalysis(analysis.id, [task], 'late-model', analysis.token!), /동의/);
  assert.deepEqual(await repo.listExtracted(analysis.id), []);
  assert.deepEqual(await repo.listTodos(), []);
  native.close();
});

test('동의 철회 후 다시 켜도 이전 분석 결과는 복원되지 않고 새 재시도만 저장한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const analysis = await repo.createAnalysis('consent-reenabled', 'shortcuts', null);
  const queued = await repo.createAnalysis('consent-queued', 'share', null);
  native.prepare("UPDATE analyses SET status='queued' WHERE id=?").run(queued.id);
  await repo.revokeLocalAIConsent();
  for (const id of [analysis.id, queued.id]) {
    const row = (await repo.listAnalyses()).find(item => item.id === id)!;
    assert.equal(row.status, 'failed'); assert.equal(row.error_code, 'CONSENT_REVOKED');
    assert.equal(row.processing_token, null);
  }
  await repo.setPreference('ai_local_consent', 'yes');
  await assert.rejects(repo.finishAnalysis(analysis.id, [task], 'late-model', analysis.token!), /상태/);
  await assert.rejects(repo.finishAnalysis(queued.id, [task], 'late-model', queued.token!), /상태/);
  assert.deepEqual(await repo.listExtracted(analysis.id), []);
  assert.deepEqual(await repo.listTodos(), []);
  const freshToken = await repo.retryFailedAnalysis(analysis.id);
  await repo.failAnalysis(analysis.id, 'LATE_ERROR', analysis.token!);
  await assert.rejects(repo.finishAnalysis(analysis.id, [task], 'late-model', analysis.token!), /상태/);
  await repo.finishAnalysis(analysis.id, [task], 'fresh-model', freshToken);
  assert.equal((await repo.listExtracted(analysis.id)).length, 1);
  assert.deepEqual(await repo.listTodos(), []);
  native.close();
});

test('동의 철회 정리가 실패하면 동의·분석 토큰·기존 원문을 함께 롤백한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const finished = await repo.createAnalysis('consent-rollback-finished', 'manual', null);
  await repo.finishAnalysis(finished.id, [task], 'test', finished.token!);
  const processing = await repo.createAnalysis('consent-rollback-processing', 'manual', null);
  native.exec("CREATE TRIGGER fail_revoke BEFORE UPDATE OF evidence_text ON extracted_tasks BEGIN SELECT RAISE(ABORT,'test-only-revoke-failure'); END;");
  await assert.rejects(repo.revokeLocalAIConsent(), /test-only-revoke-failure/);
  assert.equal(await repo.getPreference('ai_local_consent'), 'yes');
  const row = (await repo.listAnalyses()).find(item => item.id === processing.id)!;
  assert.equal(row.status, 'processing'); assert.equal(row.processing_token, processing.token);
  assert.equal((await repo.listExtracted(finished.id))[0].evidence_text, task.evidence_text);
  native.exec('DROP TRIGGER fail_revoke');
  await repo.revokeLocalAIConsent();
  assert.equal(await repo.getPreference('ai_local_consent'), 'no');
  assert.equal((await repo.listExtracted(finished.id))[0].evidence_text, '');
  native.close();
});

test('검토 화면을 연 채 만료되면 정리 실행 전에도 승인을 차단한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const analysis = await repo.createAnalysis('expired-open-review', 'manual', null);
  await repo.finishAnalysis(analysis.id, [task], 'evaluation', analysis.token!);
  const proposal = (await repo.listExtracted(analysis.id))[0];
  native.prepare('UPDATE analyses SET expires_at=? WHERE id=?').run('2026-11-13T01:59:59Z', analysis.id);
  await assert.rejects(repo.approve(analysis.id, [{ id: proposal.id, input: { title: '뒤늦은 승인' } }]), /보존 기간/);
  assert.deepEqual(await repo.listTodos(), []);
  assert.equal(native.prepare('SELECT review_status FROM extracted_tasks WHERE id=?').get(proposal.id)!.review_status, 'pending');
  await repo.pruneEvidence();
  assert.equal((await repo.listExtracted(analysis.id))[0].evidence_text, '');
  native.close();
});

test('여러 항목 승인 중 하나가 실패하면 전체 트랜잭션을 되돌린다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const a = await repo.createAnalysis('rollback', 'share', '2026-11-13T02:00:00Z');
  await repo.finishAnalysis(a.id, [task, task], 'evaluation', a.token!);
  const tasks = await repo.listExtracted(a.id);
  await assert.rejects(repo.approve(a.id, [{ id: tasks[0].id, input: { title: '정상' } }, { id: tasks[1].id, input: { title: ' ' } }]));
  assert.equal((await repo.listTodos()).length, 0);
  assert.ok((await repo.listExtracted(a.id)).every(t => t.review_status === 'pending')); native.close();
});
test('동시에 들어온 승인도 하나만 생성하고 오류 다음의 대기 작업은 계속 진행한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const a = await repo.createAnalysis('concurrent', 'manual', '2026-11-13T02:00:00Z');
  await repo.finishAnalysis(a.id, [task], 'evaluation', a.token!);
  const selected = [{ id: (await repo.listExtracted(a.id))[0].id, input: { title: '동시 승인' } }];
  await Promise.all([repo.approve(a.id, selected), repo.approve(a.id, selected)]);
  assert.equal((await repo.listTodos()).length, 1);
  await assert.rejects(repo.approve('missing', []));
  await repo.addTodo({ title: '오류 이후 정상 입력' });
  assert.equal((await repo.listTodos()).length, 2); native.close();
});
test('v1 데이터와 승인 연결을 보존하며 촬영 시각을 모르는 사진을 최신 스키마에서 처리한다', async () => {
  const { repo, native } = fixture();
  native.exec(schema.sql.replace('captured_at TEXT,', 'captured_at TEXT NOT NULL,').replace('processing_token TEXT, ', '').replace('PRAGMA user_version = 3', 'PRAGMA user_version = 1'));
  const todoId = await repo.addTodo({ title: '이전 버전 할 일' });
  // Seed the actual legacy shape; current capture APIs require the v3 attempt column.
  const old = { id: 'legacy-analysis' };
  native.prepare("INSERT INTO analyses(id,image_fingerprint,captured_at,received_at,status,source_channel,model_version,expires_at) VALUES(?,?,?,?,?,?,?,?)").run(old.id, 'old-image', '2026-11-12T02:00:00Z', '2026-11-13T02:00:00Z', 'review', 'manual', 'old-model', '2026-11-20T02:00:00Z');
  native.prepare("INSERT INTO extracted_tasks(id,analysis_id,title,due_precision,confidence,evidence_text) VALUES(?,?,?,?,?,?)").run('legacy-task', old.id, task.title, 'unknown', .9, task.evidence_text);
  const oldTask = { id: 'legacy-task' };
  await repo.approve(old.id, [{ id: oldTask.id, input: { title: task.title } }]);
  await repo.initialize();
  assert.equal(native.prepare('PRAGMA user_version').get()!.user_version, 3);
  assert.equal((await repo.listTodos()).length, 2);
  assert.ok((await repo.listTodos()).some(t => t.id === todoId));
  assert.equal((await repo.listExtracted(old.id))[0].linked_todo_id, (await repo.listTodos()).find(t => t.source_id === oldTask.id)!.id);
  await repo.setPreference('ai_local_consent', 'yes');
  await repo.createAnalysis('unknown-time', 'manual', null);
  assert.equal((await repo.listAnalyses()).find(a => a.image_fingerprint === 'unknown-time')!.captured_at, null);
  native.close();
});
test('중단된 분석은 실패로 복구하며 무시한 항목은 승인할 수 없다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const a = await repo.createAnalysis('interrupted', 'manual', '2026-11-13T02:00:00Z');
  await repo.initialize(); assert.equal((await repo.listAnalyses())[0].status, 'processing');
  native.prepare('UPDATE analyses SET received_at=? WHERE id=?').run('2026-11-13T01:49:00.000Z', a.id);
  await repo.initialize(); assert.equal((await repo.listAnalyses())[0].error_code, 'INTERRUPTED');
  await repo.ignoreAnalysis(a.id); await assert.rejects(repo.approve(a.id, [])); native.close();
});

test('과거에 확인 불필요로 저장된 빈 담당자도 검토 조회에서는 확인 필요로 표시한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const a = await repo.createAnalysis('legacy-empty-assignee', 'manual', null);
  await repo.finishAnalysis(a.id, [task], 'test', a.token!);
  for (const assignee of [null, '', ' \n\t', '\u00a0']) {
    native.prepare('UPDATE extracted_tasks SET assignee=?,needs_confirmation=0 WHERE analysis_id=?').run(assignee, a.id);
    const [result] = await repo.listExtracted(a.id);
    assert.equal(result.assignee, null); assert.equal(result.needs_confirmation, 1);
  }
  native.close();
});
test('v2 저장소를 보존하고 재시도 후 예전 결과와 실패 통지가 새 작업을 덮어쓰지 않는다', async () => {
  const { repo, native } = fixture();
  native.exec(schema.sql.replace('processing_token TEXT, ', '').replace('PRAGMA user_version = 3', 'PRAGMA user_version = 2'));
  await repo.addTodo({ title: 'v2에서 저장한 할 일' });
  await repo.initialize();
  assert.equal(native.prepare('PRAGMA user_version').get()!.user_version, 3);
  assert.equal((await repo.listTodos())[0].title, 'v2에서 저장한 할 일');
  await repo.setPreference('ai_local_consent', 'yes');
  const old = await repo.createAnalysis('retry-race', 'manual', null);
  await repo.failAnalysis(old.id, 'INTERRUPTED', old.token!);
  const attempts = await Promise.allSettled([repo.retryFailedAnalysis(old.id), repo.retryFailedAnalysis(old.id)]);
  assert.equal(attempts.filter(a => a.status === 'fulfilled').length, 1);
  const current = attempts.find(a => a.status === 'fulfilled') as PromiseFulfilledResult<string>;
  assert.notEqual(current.value, old.token);
  await assert.rejects(repo.finishAnalysis(old.id, [task], 'stale', old.token!), /상태/);
  await repo.failAnalysis(old.id, 'STALE_ERROR', old.token!);
  assert.equal((await repo.listAnalyses())[0].status, 'processing');
  assert.deepEqual(await repo.listExtracted(old.id), []);
  await repo.finishAnalysis(old.id, [task], 'current', current.value);
  assert.equal((await repo.listExtracted(old.id)).length, 1);
  assert.equal((await repo.listAnalyses())[0].model_version, 'current');
  native.close();
});

test('저장 전 재분석은 기존 제안을 교체하고 예전 승인·결과를 차단한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const a = await repo.createAnalysis('reanalyze-before-save', 'manual', null);
  await repo.finishAnalysis(a.id, [task], 'first', a.token!);
  const old = (await repo.listExtracted(a.id))[0];
  const token = await repo.restartUnstoredAnalysis(a.id);
  assert.notEqual(token, a.token); assert.deepEqual(await repo.listExtracted(a.id), []);
  await assert.rejects(repo.finishAnalysis(a.id, [task], 'stale', a.token!));
  await repo.finishAnalysis(a.id, [{ ...task, title: '새 분석 제안' }], 'second', token);
  await assert.rejects(repo.approve(a.id, [{ id: old.id, input: { title: '예전 화면 승인' } }]));
  await assert.rejects(repo.ignoreAnalysis(a.id, [old.id]), /변경/);
  const fresh = (await repo.listExtracted(a.id))[0];
  await repo.approve(a.id, [{ id: fresh.id, input: { title: fresh.title } }]);
  await assert.rejects(repo.restartUnstoredAnalysis(a.id), /저장한 캡처/);
  await repo.removeTodo((await repo.listTodos())[0].id);
  await assert.rejects(repo.restartUnstoredAnalysis(a.id), /저장한 캡처/);
  assert.deepEqual(await repo.listTodos(), []); native.close();
});

test('빈 결과·무시한 결과는 재분석하고 동의 철회·분석 중·부분 저장은 차단한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const a = await repo.createAnalysis('reanalyze-states', 'share', null);
  await assert.rejects(repo.restartUnstoredAnalysis(a.id), /분석 중/);
  await repo.finishAnalysis(a.id, [], 'empty', a.token!);
  let token = await repo.restartUnstoredAnalysis(a.id);
  await repo.finishAnalysis(a.id, [task], 'review', token);
  await repo.ignoreAnalysis(a.id);
  token = await repo.restartUnstoredAnalysis(a.id);
  await repo.finishAnalysis(a.id, [task, { ...task, title: '다른 제안' }], 'review', token);
  await repo.revokeLocalAIConsent();
  await assert.rejects(repo.restartUnstoredAnalysis(a.id), /동의/);
  assert.equal((await repo.listExtracted(a.id)).length, 2);
  await repo.setPreference('ai_local_consent', 'yes');
  const first = (await repo.listExtracted(a.id))[0];
  await repo.approve(a.id, [{ id: first.id, input: { title: first.title } }]);
  assert.equal((await repo.listAnalyses())[0].status, 'review');
  await assert.rejects(repo.restartUnstoredAnalysis(a.id), /저장한 캡처/);
  assert.equal((await repo.listExtracted(a.id)).length, 2); native.close();
});

test('재분석과 승인이 동시에 와도 한쪽만 실행하고 저장한 제안을 지우지 않는다', async () => {
  for (const approveFirst of [true, false]) {
    const { repo, native } = fixture(); await repo.initialize();
    await repo.setPreference('ai_local_consent', 'yes');
    const a = await repo.createAnalysis('reanalyze-approval-race', 'manual', null);
    await repo.finishAnalysis(a.id, [task], 'test', a.token!);
    const p = (await repo.listExtracted(a.id))[0];
    const approve = () => repo.approve(a.id, [{ id: p.id, input: { title: p.title } }]);
    const redo = () => repo.restartUnstoredAnalysis(a.id);
    const results = await Promise.allSettled(approveFirst ? [approve(), redo()] : [redo(), approve()]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal((await repo.listTodos()).length, approveFirst ? 1 : 0);
    assert.equal((await repo.listExtracted(a.id)).length, approveFirst ? 1 : 0);
    native.close();
  }
});

test('최근 원문이 남은 다른 분석만 비슷한 기록으로 안내하고 삭제·만료 기록은 제외한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const old = await repo.createAnalysis('similar-old', 'manual', null);
  await repo.finishAnalysis(old.id, [task], 'test', old.token!);
  const next = await repo.createAnalysis('similar-reencoded', 'share', null);
  await repo.finishAnalysis(next.id, [task], 'test', next.token!);
  const matches = await repo.findSimilarAnalyses(next.id, task.evidence_text);
  assert.equal(matches.length, 1); assert.equal(matches[0].analysis_id, old.id);
  assert.equal(matches[0].saved, false);
  const oldTask = (await repo.listExtracted(old.id))[0];
  await repo.approve(old.id, [{ id: oldTask.id, input: { title: oldTask.title } }]);
  assert.equal((await repo.findSimilarAnalyses(next.id, task.evidence_text))[0].saved, true);
  native.prepare("UPDATE analyses SET expires_at='2000-01-01T00:00:00Z' WHERE id=?").run(old.id);
  assert.deepEqual(await repo.findSimilarAnalyses(next.id, task.evidence_text), []);
  native.prepare("UPDATE analyses SET expires_at='2026-11-20T00:00:00Z' WHERE id=?").run(old.id);
  await repo.removeTodo((await repo.listTodos())[0].id);
  assert.deepEqual(await repo.findSimilarAnalyses(next.id, task.evidence_text), []);
  assert.equal((await repo.listExtracted(next.id)).length, 1);
  native.close();
});

test('분석함과 유사 기록은 날짜 표기 대신 실제 최신 시각으로 정렬한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  try {
    await repo.setPreference('ai_local_consent', 'yes');
    const dates = ['2026-11-13T01:00:00Z', '2026-11-13T01:00:00.500Z', '2026-11-13T09:59:59+09:00'];
    const ids: string[] = [];
    for (const [index, date] of dates.entries()) {
      const a = await repo.createAnalysis(`order-${index}`, 'manual', null);
      await repo.finishAnalysis(a.id, [task], 'test', a.token!);
      native.prepare('UPDATE analyses SET received_at=? WHERE id=?').run(date, a.id);
      ids.push(a.id);
    }
    const expected = [ids[1], ids[0], ids[2]];
    assert.deepEqual((await repo.listAnalyses()).map(a => a.id), expected);
    assert.deepEqual((await repo.findSimilarAnalyses('new-capture', task.evidence_text)).map(a => a.analysis_id), expected);
  } finally { native.close(); }
});

test('만료되거나 미래 시각인 기록은 최근 유사 근거 200개 제한을 소모하지 않는다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  try {
    await repo.setPreference('ai_local_consent', 'yes');
    const valid = await repo.createAnalysis('valid-similar', 'manual', null);
    await repo.finishAnalysis(valid.id, [task], 'test', valid.token!);
    native.prepare('UPDATE analyses SET received_at=? WHERE id=?').run('2026-11-13T01:00:00Z', valid.id);
    for (let index = 0; index < 200; index++) {
      const a = await repo.createAnalysis(`ineligible-${index}`, 'manual', null);
      await repo.finishAnalysis(a.id, [task], 'test', a.token!);
      native.prepare('UPDATE analyses SET received_at=?,expires_at=? WHERE id=?').run(
        index % 2 ? '2026-11-14T02:00:00Z' : '2026-11-13T01:59:00Z',
        index % 2 ? '2026-11-21T02:00:00Z' : '2026-11-13T02:00:00Z', a.id);
    }
    assert.deepEqual((await repo.findSimilarAnalyses('new-capture', task.evidence_text)).map(a => a.analysis_id), [valid.id]);
  } finally { native.close(); }
});

test('내보내기는 데이터 복사본이고 전체 삭제는 개인정보 설정까지 제거한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.addTodo({ title: '개인 정보' }); await repo.setPreference('ai_consent', 'yes');
  assert.equal(JSON.parse(await repo.exportData()).todos.length, 1);
  await repo.deleteAll(); assert.deepEqual(await repo.listTodos(), []);
  assert.equal(await repo.getPreference('ai_consent'), null); native.close();
});

test('저장한 할 일의 근거만 조회하고 삭제·철회·만료 후에는 반환하지 않는다', async () => {
  let now = '2026-11-13T02:00:00.000Z';
  const { repo, native } = fixture(() => now); await repo.initialize();
  try {
    await repo.setPreference('ai_local_consent', 'yes');
    const analysis = await repo.createAnalysis('evidence-detail', 'manual', null);
    await repo.finishAnalysis(analysis.id, [task, { ...task, title: '다른 작업', evidence_text: '다른 작업의 원문' }], 'test', analysis.token!);
    const proposals = await repo.listExtracted(analysis.id);
    await repo.approve(analysis.id, proposals.map(p => ({ id: p.id, input: { title: p.title } })));
    const todos = await repo.listTodos();
    const first = todos.find(t => t.source_id === proposals[0].id)!;
    const second = todos.find(t => t.source_id === proposals[1].id)!;
    assert.equal(await repo.getTodoEvidence(first.id), task.evidence_text);
    assert.equal(await repo.getTodoEvidence(second.id), '다른 작업의 원문');
    const manual = await repo.addTodo({ title: '직접 입력' });
    assert.equal(await repo.getTodoEvidence(manual), null);
    await repo.removeTodo(first.id);
    assert.equal(await repo.getTodoEvidence(first.id), null);
    assert.equal(await repo.getTodoEvidence(second.id), '다른 작업의 원문');
    await repo.revokeLocalAIConsent();
    assert.equal(await repo.getTodoEvidence(second.id), null);
    await repo.setPreference('ai_local_consent', 'yes');
    const next = await repo.createAnalysis('evidence-expiry', 'share', null);
    await repo.finishAnalysis(next.id, [task], 'test', next.token!);
    const proposal = (await repo.listExtracted(next.id))[0];
    await repo.approve(next.id, [{ id: proposal.id, input: { title: proposal.title } }]);
    const saved = (await repo.listTodos()).find(t => t.source_id === proposal.id)!;
    now = '2026-11-20T02:00:00.000Z';
    native.exec("CREATE TRIGGER fail_detail_cleanup BEFORE UPDATE OF evidence_text ON extracted_tasks BEGIN SELECT RAISE(ABORT, 'detail cleanup failed'); END;");
    await assert.rejects(repo.getTodoEvidence(saved.id), /detail cleanup failed/);
    native.exec('DROP TRIGGER fail_detail_cleanup');
    assert.equal(await repo.getTodoEvidence(saved.id), null);
    assert.equal((await repo.listTodos()).find(t => t.id === saved.id)!.title, task.title);
  } finally { native.close(); }
});

test('전체 삭제 트랜잭션이 실패하면 본문·할 일·설정을 모두 보존하고 실패를 전달한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  await repo.addTodo({ title: '롤백할 합성 할 일' });
  const a = await repo.createAnalysis('delete-rollback', 'manual', null);
  await repo.finishAnalysis(a.id, [task], 'test', a.token!);
  native.exec("CREATE TRIGGER stop_delete BEFORE DELETE ON todos BEGIN SELECT RAISE(ABORT, 'delete failed'); END;");
  await assert.rejects(repo.deleteAll(), /delete failed/);
  assert.equal((await repo.listTodos()).length, 1); assert.equal((await repo.listAnalyses()).length, 1);
  assert.equal((await repo.listExtracted(a.id))[0].evidence_text, task.evidence_text);
  assert.equal(await repo.getPreference('ai_local_consent'), 'yes');
  native.exec('DROP TRIGGER stop_delete');
  assert.deepEqual(await repo.deleteAll(), { compacted: true });
  assert.deepEqual(await repo.listTodos(), []); native.close();
});

test('앱 재실행 없이 만료 시점에 조회·내보내기해도 원문과 미저장 본문을 정리한다', async () => {
  for (const read of ['analyses', 'extracted', 'export'] as const) {
    let now = '2026-11-13T02:00:00.000Z';
    const { repo, native } = fixture(() => now); await repo.initialize();
    await repo.setPreference('ai_local_consent', 'yes');
    const a = await repo.createAnalysis(`retention-${read}`, 'manual', null);
    await repo.finishAnalysis(a.id, [task, { ...task, title: '지울 대기 제목', description: '지울 설명', assignee: '지울 담당', evidence_text: '지울 대기 근거' }], 'test', a.token!);
    const saved = (await repo.listExtracted(a.id))[0];
    await repo.approve(a.id, [{ id: saved.id, input: { title: saved.title, due_at: saved.due_at, due_precision: saved.due_precision } }]);
    // A separate, unexpired capture must retain its review contents.
    now = '2026-11-14T02:00:00.000Z';
    const fresh = await repo.createAnalysis(`fresh-${read}`, 'share', null);
    await repo.finishAnalysis(fresh.id, [task], 'test', fresh.token!);
    now = '2026-11-20T01:59:59.999Z';
    assert.equal((await repo.listExtracted(a.id))[1].title, '지울 대기 제목');
    now = '2026-11-20T02:00:00.000Z';
    if (read === 'analyses') assert.equal((await repo.listAnalyses()).find(row => row.id === a.id)!.status, 'saved');
    else if (read === 'extracted') assert.equal((await repo.listExtracted(a.id))[1].review_status, 'ignored');
    else {
      const data = await repo.exportData();
      for (const text of ['지울 대기 제목', '지울 설명', '지울 담당', '지울 대기 근거']) assert.ok(!data.includes(text));
      const exported = JSON.parse(data).extracted_tasks.filter((row: { analysis_id: string }) => row.analysis_id === a.id);
      assert.ok(exported.every((row: { evidence_text: string }) => row.evidence_text === ''));
    }
    const rows = native.prepare('SELECT * FROM extracted_tasks WHERE analysis_id=? ORDER BY rowid').all(a.id);
    assert.equal(rows[0].evidence_text, ''); assert.equal(rows[0].title, saved.title);
    assert.equal(rows[1].title, '보존 기간이 지난 제안');
    for (const field of ['description', 'due_at', 'assignee']) assert.equal(rows[1][field], null);
    assert.equal(rows[1].evidence_text, ''); assert.equal(rows[1].review_status, 'ignored');
    assert.equal((await repo.listTodos())[0].title, saved.title);
    assert.equal((await repo.listExtracted(fresh.id))[0].evidence_text, task.evidence_text);
    await assert.rejects(repo.restartUnstoredAnalysis(a.id), /저장한 캡처/);
    native.close();
  }
});

test('중단 복구는 날짜 표기와 무관하게 실제 10분 유예를 지킨다', async () => {
  for (const received of ['2026-11-13T02:00:00Z', '2026-11-13T02:00:00.000Z', '2026-11-13T11:00:00+09:00']) {
    let now = '2026-11-13T02:00:00.000Z';
    const { repo, native } = fixture(() => now); await repo.initialize();
    try {
      await repo.setPreference('ai_local_consent', 'yes');
      const a = await repo.createAnalysis('mixed-recovery', 'shortcuts', null);
      native.prepare('UPDATE analyses SET received_at=? WHERE id=?').run(received, a.id);
      for (const time of ['2026-11-13T02:09:59.999Z', '2026-11-13T02:10:00.000Z']) {
        now = time;
        const row = (await repo.listAnalyses())[0];
        assert.equal(row.status, 'processing'); assert.equal(row.processing_token, a.token);
      }
      now = '2026-11-13T02:10:00.001Z';
      const row = (await repo.listAnalyses())[0];
      assert.equal(row.status, 'failed', received);
      assert.equal(row.error_code, 'INTERRUPTED'); assert.equal(row.processing_token, null);
      await assert.rejects(repo.finishAnalysis(a.id, [task], 'stale', a.token!), /상태/);
      const token = await repo.retryFailedAnalysis(a.id);
      await repo.finishAnalysis(a.id, [task], 'retry', token);
      assert.equal((await repo.listExtracted(a.id))[0].title, task.title);
      assert.deepEqual(await repo.listTodos(), []);
    } finally { native.close(); }
  }
});

test('Swift와 앱의 서로 다른 날짜 형식도 실제 만료 시점에 정리한다', async () => {
  for (const expiry of ['2026-11-20T02:00:00Z', '2026-11-20T02:00:00.000Z', '2026-11-20T11:00:00+09:00']) {
    let now = '2026-11-13T02:00:00.000Z';
    const { repo, native } = fixture(() => now); await repo.initialize();
    try {
      await repo.setPreference('ai_local_consent', 'yes');
      const a = await repo.createAnalysis('mixed-expiry', 'shortcuts', null);
      await repo.finishAnalysis(a.id, [task], 'test', a.token!);
      native.prepare('UPDATE analyses SET expires_at=? WHERE id=?').run(expiry, a.id);
      now = '2026-11-20T01:59:59.999Z';
      assert.equal((await repo.listExtracted(a.id))[0].evidence_text, task.evidence_text);
      now = '2026-11-20T02:00:00.000Z';
      const exported = JSON.parse(await repo.exportData());
      assert.equal(exported.analyses[0].status, 'ignored', expiry);
      assert.equal(exported.extracted_tasks[0].title, '보존 기간이 지난 제안', expiry);
      assert.equal(exported.extracted_tasks[0].evidence_text, '', expiry);
      assert.equal(exported.extracted_tasks[0].due_at, null);
      assert.equal(exported.analyses[0].image_fingerprint, 'mixed-expiry');
      assert.deepEqual(exported.todos, []);
    } finally { native.close(); }
  }
});

test('내보내기 정리에 실패하면 본문을 반환하지 않고 변경도 롤백한다', async () => {
  let now = '2026-11-13T02:00:00.000Z';
  const { repo, native } = fixture(() => now); await repo.initialize();
  await repo.setPreference('ai_local_consent', 'yes');
  const a = await repo.createAnalysis('export-cleanup-failure', 'manual', null);
  await repo.finishAnalysis(a.id, [task], 'test', a.token!);
  now = '2026-11-20T02:00:00.000Z';
  native.exec("CREATE TRIGGER fail_cleanup BEFORE UPDATE OF evidence_text ON extracted_tasks BEGIN SELECT RAISE(ABORT, 'cleanup failed'); END;");
  await assert.rejects(repo.exportData(), /cleanup failed/);
  const row = native.prepare('SELECT * FROM extracted_tasks WHERE analysis_id=?').get(a.id)!;
  assert.equal(row.title, task.title); assert.equal(row.review_status, 'pending'); assert.equal(row.evidence_text, task.evidence_text);
  native.exec('DROP TRIGGER fail_cleanup');
  assert.ok(!(await repo.exportData()).includes(task.evidence_text));
  native.close();
});
test('잠금화면 제목·개수·전체 숨김 정책은 기존 설정과 일관되게 저장한다', async () => {
  const { repo, native } = fixture(); await repo.initialize();
  assert.equal(await repo.getPreference('private_lock'), null);
  await repo.setLockVisibility('titles');
  assert.equal(await repo.getPreference('private_lock'), 'no'); assert.equal(await repo.getPreference('hide_lock_content'), 'no');
  await repo.setLockVisibility('hidden');
  assert.equal(await repo.getPreference('private_lock'), 'yes'); assert.equal(await repo.getPreference('hide_lock_content'), 'yes');
  await repo.setLockVisibility('count');
  assert.equal(await repo.getPreference('private_lock'), 'yes'); assert.equal(await repo.getPreference('hide_lock_content'), 'no'); native.close();
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
