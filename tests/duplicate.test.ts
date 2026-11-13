import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resemblesEvidence } from '../src/domain/duplicate';
import seed from '../evaluation/duplicate-seed.json';

test('Swift와 공유하는 합성 중복 사례의 예상 판정을 따른다', () => {
  for (const item of seed) assert.equal(resemblesEvidence(item.source, item.evidence), item.expected);
});

test('공백·문장부호·전각 차이를 비교하되 짧은 상용구는 중복 후보로 보지 않는다', () => {
  assert.equal(resemblesEvidence('２０２６년 １１월 ２０일까지 발표 자료를 보내 주세요!', '2026년 11월 20일까지 발표자료를 보내주세요.'), true);
  assert.equal(resemblesEvidence('2026년 11월 21일까지 발표자료를 보내주세요.', '2026년 11월 20일까지 발표자료를 보내주세요.'), false);
  assert.equal(resemblesEvidence('안녕하세요. 확인해요.', '확인해요'), false);
});
test('긴 문장의 작은 OCR 차이는 참고 후보로 보고 다른 날짜·금액은 구분한다', () => {
  const evidence = '이번 프로젝트 최종 발표를 준비하기 위해 설문 조사 결과와 인터뷰 내용을 정리한 보고서 초안을 팀 공유 폴더에 올리고 검토할 부분에 댓글을 남겨주세요';
  assert.equal(resemblesEvidence(evidence.replace('남겨주세요', '남겨주세오'), evidence), true);
  assert.equal(resemblesEvidence('내일 장을 보고 운동을 다녀온 뒤 도서관에서 책을 반납하세요.', evidence), false);
  assert.equal(resemblesEvidence(`${evidence} 예산은 200000원`, `${evidence} 예산은 300000원`), false);
});
