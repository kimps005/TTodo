import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, type ClosableConnection } from '../src/data/database';
import { Repository, type SqlValue } from '../src/data/repository';
function connect(filename: string): ClosableConnection {
  const db = new DatabaseSync(filename);
  return {
    execAsync: async sql => { db.exec(sql); },
    runAsync: async (sql, ...args) => db.prepare(sql).run(...args),
    getFirstAsync: async <T>(sql: string, ...args: SqlValue[]) => (db.prepare(sql).get(...args) as T) ?? null,
    getAllAsync: async <T>(sql: string, ...args: SqlValue[]) => db.prepare(sql).all(...args) as T[],
    closeAsync: async () => { db.close(); },
  };
}
test('새 트랜잭션 연결마다 외래키를 활성화하고 디스크 데이터는 연결 종료 후에도 보존한다', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ttodo-database-'));
  const filename = path.join(root, 'test.sqlite');
  let base = connect(filename);
  try {
    const db = createDatabase(base, async () => connect(filename));
    const repo = new Repository(db, randomUUID); await repo.initialize();
    const id = await repo.addTodo({ title: '재부팅 후에도 보존할 일' });
    await db.withExclusiveTransactionAsync(async tx => {
      assert.equal((await tx.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys'))!.foreign_keys, 1);
      assert.equal((await tx.getFirstAsync<{ secure_delete: number }>('PRAGMA secure_delete'))!.secure_delete, 1);
      await assert.rejects(tx.runAsync("INSERT INTO extracted_tasks(id,analysis_id,title,due_precision,confidence,evidence_text) VALUES('bad','missing','잘못된 연결','unknown',1,'근거')"));
    });
    await base.closeAsync(); base = connect(filename);
    const reopened = new Repository(createDatabase(base, async () => connect(filename)), randomUUID);
    await reopened.initialize(); assert.equal((await reopened.listTodos())[0].id, id);
    await base.execAsync('PRAGMA user_version=99');
    await assert.rejects(reopened.initialize(), /업데이트/);
  } finally { await base.closeAsync(); rmSync(root, { recursive: true, force: true }); }
});

test('삭제 커밋 뒤 다른 연결이 공간 정리를 막아도 삭제 성공을 후속 정리에 전달한다', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ttodo-delete-cleanup-'));
  const filename = path.join(root, 'test.sqlite');
  const base = connect(filename);
  const execute = base.execAsync;
  let reader: DatabaseSync | null = null, reading = false, busyObserved = false;
  base.execAsync = async sql => {
    if (sql === 'VACUUM;' && reader) { reader.exec('BEGIN; SELECT COUNT(*) FROM todos;'); reading = true; }
    try { await execute(sql); }
    catch (error) { if (sql === 'VACUUM;' && (error as { errcode?: number }).errcode === 5) busyObserved = true; throw error; }
  };
  try {
    const db = createDatabase(base, async () => connect(filename));
    const repo = new Repository(db, randomUUID); await repo.initialize();
    await repo.addTodo({ title: '삭제 경합 합성 항목' });
    await repo.setPreference('ai_local_consent', 'yes');
    await repo.createAnalysis('synthetic-cleanup', 'manual', null);
    reader = new DatabaseSync(filename);
    await db.execAsync('PRAGMA busy_timeout=0;');
    let rejected = false, result: unknown;
    try { result = await repo.deleteAll(); } catch { rejected = true; }
    assert.equal(busyObserved, true, '실제 외부 읽기 잠금으로 VACUUM이 실패해야 한다');
    for (const table of ['todos', 'analyses', 'extracted_tasks', 'preferences']) assert.equal(reader.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()!.count, 0);
    assert.equal(rejected, false, '이미 커밋된 삭제를 실패로 반환하면 알림/임시 파일 정리가 실행되지 않는다');
    assert.deepEqual(result, { compacted: false });
  } finally {
    if (reading) reader?.exec('ROLLBACK');
    reader?.close(); await base.closeAsync();
    const target = path.resolve(root);
    assert.ok(target.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(target).startsWith('ttodo-delete-cleanup-'));
    rmSync(target, { recursive: true, force: true });
  }
});
