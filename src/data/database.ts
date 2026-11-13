import type { Database, SqlConnection } from './repository';
export interface ClosableConnection extends SqlConnection { closeAsync(): Promise<void>; }
export const connectionPragmas = 'PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON; PRAGMA temp_store=MEMORY;';

// Expo's exclusive transaction opens a new connection without inheriting connection-level
// PRAGMAs. Configure a dedicated connection BEFORE BEGIN, where foreign_keys can take effect.
export function createDatabase(base: SqlConnection, openConnection: () => Promise<ClosableConnection>): Database {
  return {
    execAsync: base.execAsync.bind(base), runAsync: base.runAsync.bind(base),
    getFirstAsync: base.getFirstAsync.bind(base), getAllAsync: base.getAllAsync.bind(base),
    async withExclusiveTransactionAsync(task) {
      const tx = await openConnection();
      try {
        await tx.execAsync(connectionPragmas);
        await tx.execAsync('BEGIN IMMEDIATE');
        try { await task(tx); await tx.execAsync('COMMIT'); }
        catch (error) { try { await tx.execAsync('ROLLBACK'); } catch { /* Preserve the operation's original error. */ } throw error; }
      } finally { await tx.closeAsync(); }
    },
  };
}
