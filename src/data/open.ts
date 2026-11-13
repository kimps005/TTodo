import * as SQLite from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import { nativeBridge } from '../native/bridge';
import { Repository, type SqlConnection, type SqlValue } from './repository';
import { createDatabase } from './database';
import { createSerializedDatabase } from './serializedDatabase';
let opening: Promise<Repository> | undefined;
export function openRepository(): Promise<Repository> {
  if (!opening) opening = (async () => {
    // Never silently create a second iOS database if the App Group is unavailable.
    if (Platform.OS === 'ios' && !nativeBridge) throw new Error('iOS 개발 빌드가 필요해요. Expo Go에서는 공유 저장소를 사용할 수 없어요.');
    let repositoryDatabase;
    if (Platform.OS === 'ios') {
      const bridge = nativeBridge!;
      const bind = (params: SqlValue[]) => params.map(value => value === null ? null : String(value));
      const connection: SqlConnection = {
        execAsync: sql => bridge.execSQL(sql),
        runAsync: (sql, ...params) => bridge.runSQL(sql, bind(params)),
        getFirstAsync: async <T>(sql: string, ...params: SqlValue[]) => (await bridge.querySQL(sql, bind(params)))[0] as T ?? null,
        getAllAsync: async <T>(sql: string, ...params: SqlValue[]) => await bridge.querySQL(sql, bind(params)) as T[],
      };
      repositoryDatabase = createSerializedDatabase(connection);
    } else {
      const db = await SQLite.openDatabaseAsync('ttodo.sqlite');
      repositoryDatabase = createDatabase(db, () => SQLite.openDatabaseAsync('ttodo.sqlite', { useNewConnection: true }));
    }
    const repo = new Repository(repositoryDatabase, randomUUID);
    await repo.initialize(); return repo;
  })().catch(error => { opening = undefined; throw error; });
  return opening;
}
