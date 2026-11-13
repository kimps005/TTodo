export function analysisReviewRoute(response: unknown): string | null {
  if (!response || typeof response !== 'object') return null;
  const value = response as { actionIdentifier?: unknown; notification?: { request?: { content?: { data?: Record<string, unknown> } } } };
  if (!['expo.modules.notifications.actions.DEFAULT', 'TTODO_CAPTURE_OPEN'].includes(String(value.actionIdentifier))) return null;
  const id = value.notification?.request?.content?.data?.analysis_id;
  return typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) ? id : null;
}
