export function isHomeLink(value: unknown): boolean {
  return typeof value === 'string' && /^ttodo:\/\/today\/?$/i.test(value);
}
