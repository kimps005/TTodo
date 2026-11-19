import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCaptureLink, isHomeLink } from '../src/navigation/route';

test('위젯의 할 일 링크만 이동 요청으로 인정하고 다른 앱·임의 매개변수는 무시한다', () => {
  for (const url of ['ttodo://today', 'ttodo://today/', 'TTODO://TODAY']) assert.equal(isHomeLink(url), true);
  for (const url of [null, undefined, {}, 'https://today', 'ttodo://today@other', 'ttodo://today?delete=all', 'ttodo://today/other', 'ttodo://settings']) assert.equal(isHomeLink(url), false);
});

test('공유 링크는 캡처 화면만 열며 이미지 경로나 매개변수를 받지 않는다', () => {
  for (const url of ['ttodo://capture', 'ttodo://capture/', 'TTODO://CAPTURE']) assert.equal(isCaptureLink(url), true);
  for (const url of [null, {}, 'ttodo://today', 'https://capture', 'ttodo://capture@other', 'ttodo://capture?url=file:///tmp/image', 'ttodo://capture/other', 'ttodo://capture#clipboard', 'ttodo://capture\n']) assert.equal(isCaptureLink(url), false);
});
