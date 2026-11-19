export function isHomeLink(value: unknown): boolean {
  return typeof value === 'string' && /^ttodo:\/\/today\/?$/i.test(value);
}

export function isCaptureLink(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const url = value.toLowerCase();
  return url === 'ttodo://capture' || url === 'ttodo://capture/';
}

export function isShareImportLink(value: unknown): boolean {
  return typeof value === 'string' && /^ttodo:\/\/share-import\?fallback=pasteboard(?:&token=[\da-fA-F]{8}(?:-[\da-fA-F]{4}){3}-[\da-fA-F]{12})?(?![\s\S])/.test(value);
}
