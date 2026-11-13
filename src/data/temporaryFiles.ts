import { Directory, File, Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
const captureDirectory = () => new Directory(Paths.cache, 'ttodo-captures');
export function clearTemporaryFiles() {
  const directory = captureDirectory();
  if (directory.exists) directory.delete();
  for (const name of ['TTodo-export.json', 'TTodo-model-evaluation.json']) {
    const exported = new File(Paths.cache, name);
    if (exported.exists) exported.delete();
  }
}
export function ownTemporaryImage(uri: string): string {
  const original = new File(uri);
  if (!original.uri.startsWith(Paths.cache.uri)) throw new Error('안전한 임시 이미지 경로가 아니에요.');
  const directory = captureDirectory(); directory.create({ idempotent: true, intermediates: true });
  const target = new File(directory, `${randomUUID()}.image`);
  try { original.copy(target); return target.uri; }
  finally { if (original.exists) original.delete(); }
}
export function discardTemporaryImage(uri: string) {
  try { const file = new File(uri); if (file.exists) file.delete(); }
  catch { /* A cleanup interrupted by the OS is retried by clearTemporaryFiles on next startup. */ }
}
