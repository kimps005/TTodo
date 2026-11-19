export function isHomeLink(value: unknown): boolean {
  return typeof value === 'string' && /^ttodo:\/\/today\/?$/i.test(value);
}

export function isCaptureLink(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const url = value.toLowerCase();
  return url === 'ttodo://capture' || url === 'ttodo://capture/';
}
