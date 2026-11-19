import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCaptureLink, isHomeLink, isShareImportLink } from '../src/navigation/route';

test('위젯의 할 일 링크만 이동 요청으로 인정하고 다른 앱·임의 매개변수는 무시한다', () => {
  for (const url of ['ttodo://today', 'ttodo://today/', 'TTODO://TODAY']) assert.equal(isHomeLink(url), true);
  for (const url of [null, undefined, {}, 'https://today', 'ttodo://today@other', 'ttodo://today?delete=all', 'ttodo://today/other', 'ttodo://settings']) assert.equal(isHomeLink(url), false);
});

test('공유 링크는 캡처 화면만 열며 이미지 경로나 매개변수를 받지 않는다', () => {
  for (const url of ['ttodo://capture', 'ttodo://capture/', 'TTODO://CAPTURE']) assert.equal(isCaptureLink(url), true);
  for (const url of [null, {}, 'ttodo://today', 'https://capture', 'ttodo://capture@other', 'ttodo://capture?url=file:///tmp/image', 'ttodo://capture/other', 'ttodo://capture#clipboard', 'ttodo://capture\n']) assert.equal(isCaptureLink(url), false);
});

test('자동 공유 링크는 지정된 경로와 선택적 UUID 토큰만 허용한다', () => {
  const route = 'ttodo://share-import?fallback=pasteboard';
  const token = 'E70F9CEF-AD14-4F8F-821B-6F9F32E73110';
  for (const url of [route, `${route}&token=${token}`]) assert.equal(isShareImportLink(url), true);
  for (const url of [null, 'ttodo://share-import', 'ttodo://share-import/?fallback=pasteboard',
    `${route}&token=broken`, `${route}&token=${token}&token=${token}`, `${route}&token=${token}\n`,
    `${route}&url=file:///tmp/capture`, `${route}#other`, `${route}\n`]) assert.equal(isShareImportLink(url), false);
});
