import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { validateExtraction } from '../src/ai/extraction';

// Consumes production Swift encoder output from CaptureSmoke, never a model response.
const input = process.argv[2];
assert.ok(input, 'Swift 결과 파일 경로가 필요합니다.');
const raw = JSON.parse(readFileSync(input, 'utf8'));
const tasks = validateExtraction(raw, '내일 자료 보내줘.');
assert.equal(tasks.length, 1);
assert.equal(tasks[0].description, null);
assert.equal(tasks[0].due_at, null);
assert.equal(tasks[0].assignee, null);
assert.equal(tasks[0].needs_confirmation, 1);
console.log('실제 Swift JSON 인코더 → TypeScript 제안 검증기 계약 검사 통과 (모델 요청 없음)');
