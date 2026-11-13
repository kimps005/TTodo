import * as SQLite from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import { nativeBridge } from '../native/bridge';
import { Repository } from './repository';
let opening: Promise<Repository> | undefined;
export function openRepository(): Promise<Repository> {
  if (!opening) opening = (async () => {
    // Never silently create a second iOS database if the App Group is unavailable.
    if (Platform.OS === 'ios' && !nativeBridge) throw new Error('iOS 개발 빌드가 필요해요. Expo Go에서는 공유 저장소를 사용할 수 없어요.');
    const directory = Platform.OS === 'ios' ? nativeBridge!.databaseDirectory() : undefined;
    const db = await SQLite.openDatabaseAsync('ttodo.sqlite', {}, directory);
    const repo = new Repository(db, randomUUID);
    await repo.initialize(); return repo;
  })().catch(error => { opening = undefined; throw error; });
  return opening;
}
