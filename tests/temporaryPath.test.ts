import assert from 'node:assert/strict';
import test from 'node:test';
import { isCacheFileUri } from '../src/data/temporaryPath';

test('선택 거부와 화면 종료의 이미지 삭제는 앱 캐시 하위 파일에만 허용한다', () => {
  const cache = 'file:///private/app/Library/Caches/';
  for (const uri of [cache + 'picker/photo.jpg', cache + 'ttodo-captures/한글%20사진.image']) {
    assert.equal(isCacheFileUri(uri, cache), true, uri);
    assert.equal(isCacheFileUri(uri, cache.slice(0, -1)), true, uri);
  }
  for (const uri of [
    'file:///private/app/Documents/original.jpg', 'ph://original', 'content://photos/original',
    'file:///private/app/Library/Caches-other/photo.jpg', cache, cache.slice(0, -1),
    cache + '../original.jpg', cache + '%2e%2e/original.jpg', cache + 'picker/%2e%2e/%2e%2e/original.jpg',
    cache + 'picker/%2f..%2f..%2foriginal.jpg', cache + 'picker/%5c..%5coriginal.jpg',
    cache + 'photo%00.jpg', cache + 'photo%.jpg', cache + 'photo.jpg?path=original',
    cache + 'photo.jpg#original', 'file://other/private/app/Library/Caches/photo.jpg', 'not a URI',
  ]) assert.equal(isCacheFileUri(uri, cache), false, uri);
});
