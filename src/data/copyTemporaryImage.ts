// Keep the picker file alive until the copy finishes, including failure paths.
export async function copyTemporaryImage(copy: () => Promise<void>, removeOriginal: () => void): Promise<void> {
  try { await copy(); } finally { removeOriginal(); }
}
