import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSerializedDatabase } from '../src/data/serializedDatabase';
import type { SqlConnection, SqlValue } from '../src/data/repository';

for (const rollback of [false, true]) {
  test(`대기 중인 ${rollback ? '실패' : '성공'} 트랜잭션에 다른 쓰기를 섞지 않고 다음 작업을 계속한다`, async () => {
    const sqlite = new DatabaseSync(':memory:');
    const connection: SqlConnection = {
      execAsync: async sql => { sqlite.exec(sql); },
      runAsync: async (sql, ...params) => sqlite.prepare(sql).run(...params),
      getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => (sqlite.prepare(sql).get(...params) as T) ?? null,
      getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => sqlite.prepare(sql).all(...params) as T[],
    };
    const db = createSerializedDatabase(connection);
    const started = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    try {
      await db.execAsync('CREATE TABLE entries (id TEXT PRIMARY KEY)');
      const transaction = db.withExclusiveTransactionAsync(async tx => {
        await tx.runAsync('INSERT INTO entries VALUES (?)', 'inside');
        started.resolve();
        await resume.promise;
        if (rollback) throw new Error('synthetic transaction failure');
      });
      const outcome = rollback ? assert.rejects(transaction, /synthetic transaction failure/) : transaction;
      await started.promise;
      // Queue unrelated work while the real SQLite transaction is suspended.
      // It must neither enter that transaction nor disappear in its rollback.
      const outside = db.runAsync('INSERT INTO entries VALUES (?)', 'outside');
      const snapshot = db.getAllAsync<{ id: string }>('SELECT id FROM entries ORDER BY id');
      resume.resolve();
      await outcome;
      await outside;
      assert.deepEqual((await snapshot).map(row => row.id), rollback ? ['outside'] : ['inside', 'outside']);
      await db.runAsync('INSERT INTO entries VALUES (?)', 'later');
      assert.equal((await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM entries'))!.count, rollback ? 2 : 3);
    } finally { resume.resolve(); sqlite.close(); }
  });
}
