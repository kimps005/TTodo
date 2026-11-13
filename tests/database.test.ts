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
