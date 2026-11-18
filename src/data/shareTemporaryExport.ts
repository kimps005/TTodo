export function shareDataExport(
  repository: { exportData(): Promise<string> },
  file: { create(options: { overwrite: boolean }): void; write(data: string): void | Promise<void> },
  sharing: { share(): Promise<void>; remove(): void },
) {
  return shareTemporaryExport({
    ...sharing,
    write: async () => {
      const data = await repository.exportData();
      file.create({ overwrite: true });
      await file.write(data);
    },
  });
}

// Native sharing must finish before cleanup. Preserve write/share errors even
// if deleting the cache file also fails; startup cleanup will retry deletion.
export async function shareTemporaryExport(operations: {
  write: () => Promise<void>;
  share: () => Promise<void>;
  remove: () => void;
}): Promise<{ cleaned: boolean }> {
  let cleaned = true;
  try {
    await operations.write();
    await operations.share();
  } finally {
    try { operations.remove(); } catch { cleaned = false; }
  }
  return { cleaned };
}
