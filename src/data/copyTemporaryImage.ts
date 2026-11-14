// Keep the picker file alive until the copy finishes, including failure paths.
export async function copyTemporaryImage(copy: () => Promise<void>, removeOriginal: () => void, removeIncompleteCopy: () => void): Promise<void> {
  try {
    await copy();
  } catch (error) {
    // A failed copy may have already created part of the destination image.
    // Try both deletions without hiding the original copy error.
    try { removeOriginal(); } catch { /* Report the copy failure. */ }
    try { removeIncompleteCopy(); } catch { /* Startup cleanup retries. */ }
    throw error;
  }
  try { removeOriginal(); }
  catch (error) {
    // No URI will reach the caller on failure, so release its unowned copy.
    try { removeIncompleteCopy(); } catch { /* Startup cleanup retries. */ }
    throw error;
  }
}
