import type { Database, SqlConnection } from './repository';
// The iOS bridge uses the system SQLite driver for UI, App Intents and extensions.
// Serialize whole transactions so unrelated async calls cannot enter their connection.
export function createSerializedDatabase(connection: SqlConnection): Database {
  let tail: Promise<unknown> = Promise.resolve();
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = tail.then(operation); tail = next.catch(() => undefined); return next;
  }
  return {
    execAsync: sql => enqueue(() => connection.execAsync(sql)),
    runAsync: (sql, ...params) => enqueue(() => connection.runAsync(sql, ...params)),
    getFirstAsync: (sql, ...params) => enqueue(() => connection.getFirstAsync(sql, ...params)),
    getAllAsync: (sql, ...params) => enqueue(() => connection.getAllAsync(sql, ...params)),
    withExclusiveTransactionAsync: task => enqueue(async () => {
      await connection.execAsync('BEGIN IMMEDIATE');
      try { await task(connection); await connection.execAsync('COMMIT'); }
      catch (error) { try { await connection.execAsync('ROLLBACK'); } catch { /* Keep the original failure. */ } throw error; }
    }),
  };
}
