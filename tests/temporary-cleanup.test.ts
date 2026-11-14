import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { cleanupTemporaryEntries } from '../src/data/temporaryCleanup';

test('임시 이미지 정리가 실패해도 두 내보내기 파일을 정리하고 불완전한 정리를 알린다', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'ttodo-temporary-cleanup-'));
  const entries = ['capture.image', 'TTodo-export.json', 'TTodo-model-evaluation.json'].map(name => path.join(root, name));
  try {
    for (const entry of entries) writeFileSync(entry, 'synthetic-only');
    assert.throws(() => cleanupTemporaryEntries([
      () => { throw new Error('injected file access failure'); },
      () => unlinkSync(entries[1]),
      () => unlinkSync(entries[2]),
    ]), /일부 임시 파일/);
    assert.equal(existsSync(entries[0]), true);
    assert.equal(existsSync(entries[1]), false);
    assert.equal(existsSync(entries[2]), false);
    cleanupTemporaryEntries([() => unlinkSync(entries[0])]);
    assert.equal(existsSync(entries[0]), false);
  } finally {
    const target = path.resolve(root);
    assert.ok(target.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(target).startsWith('ttodo-temporary-cleanup-'));
    rmSync(target, { recursive: true, force: true });
  }
});
