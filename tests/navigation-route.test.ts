import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHomeLink } from '../src/navigation/route';

test('위젯의 할 일 링크만 이동 요청으로 인정하고 다른 앱·임의 매개변수는 무시한다', () => {
  for (const url of ['ttodo://today', 'ttodo://today/', 'TTODO://TODAY']) assert.equal(isHomeLink(url), true);
  for (const url of [null, undefined, {}, 'https://today', 'ttodo://today@other', 'ttodo://today?delete=all', 'ttodo://today/other', 'ttodo://settings']) assert.equal(isHomeLink(url), false);
});
