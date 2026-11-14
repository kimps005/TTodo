// Try every entry even when one is locked or no longer accessible. Callers can
// report incomplete cleanup separately from an already committed DB operation.
export function cleanupTemporaryEntries(actions: (() => void)[]): void {
  let failed = false;
  for (const action of actions) {
    try { action(); } catch { failed = true; }
  }
  if (failed) throw new Error('일부 임시 파일을 정리하지 못했어요.');
}
