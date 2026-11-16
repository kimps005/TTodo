import { readFileSync } from 'node:fs';

// Windows editors may save UTF-8 JSON with a byte-order mark.
export function readEvaluationJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}
