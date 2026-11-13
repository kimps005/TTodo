import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analysisReviewRoute } from '../src/notifications/route';
test('캡처 알림의 기본 탭/검토 버튼만 올바른 분석 ID로 연결한다', () => {
  const id = 'c11e806e-14ee-4b2a-9374-3a6040c7af51';
  const response = { actionIdentifier: 'TTODO_CAPTURE_OPEN', notification: { request: { content: { data: { analysis_id: id } } } } };
  assert.equal(analysisReviewRoute(response), id);
  assert.equal(analysisReviewRoute({ ...response, actionIdentifier: 'expo.modules.notifications.actions.DEFAULT' }), id);
  assert.equal(analysisReviewRoute({ ...response, actionIdentifier: 'TTODO_CAPTURE_IGNORE' }), null);
  assert.equal(analysisReviewRoute({ actionIdentifier: 'TTODO_CAPTURE_OPEN' }), null);
  assert.equal(analysisReviewRoute(null), null);
  response.notification.request.content.data.analysis_id = '../different-resource';
  assert.equal(analysisReviewRoute(response), null);
});
