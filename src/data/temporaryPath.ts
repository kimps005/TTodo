// File deletion must stay inside the app cache, including rejection paths before
// a selected image has been copied into our dedicated capture directory.
export function isCacheFileUri(uri: string, cacheUri: string): boolean {
  try {
    const file = new URL(uri); const cache = new URL(cacheUri);
    if (file.protocol !== 'file:' || cache.protocol !== 'file:' || file.host || cache.host || file.search || file.hash) return false;
    const path = decodeURIComponent(file.pathname); const root = decodeURIComponent(cache.pathname).replace(/\/+$/, '') + '/';
    if (/[\\\0]/.test(path) || path.split('/').some(part => part === '.' || part === '..')) return false;
    return path.startsWith(root) && path.length > root.length;
  } catch { return false; }
}
