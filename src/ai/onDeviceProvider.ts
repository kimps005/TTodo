import { nativeBridge } from '../native/bridge';
import { containsSensitiveText, enforceDateContext, validateExtraction, type TaskExtractionProvider } from './extraction';
export const availabilityLabels: Record<string, string> = {
  available: '기기 내 AI 사용 가능 · 정확도 검증 전',
  requires_ios26: '기기 내 AI에는 iOS 26 이상이 필요해요.',
  device_not_eligible: 'Apple Intelligence를 지원하는 iPhone이 필요해요.',
  intelligence_disabled: '설정에서 Apple Intelligence를 켜 주세요.',
  model_not_ready: '기기 내 AI 모델을 준비 중이에요. 다운로드 후 다시 시도해 주세요.',
  korean_unavailable: '현재 기기 모델이 한국어를 지원하지 않아요.',
  unavailable: '현재 기기 내 AI를 사용할 수 없어요.',
  missing_native: 'iOS 개발 빌드에서 사용할 수 있어요.',
};
export const onDeviceProvider: TaskExtractionProvider = {
  version: 'apple-ondevice/prompt-v1',
  async extract(context, signal) {
    if (signal.aborted) throw new Error('분석을 취소했어요.');
    if (!context.text.trim()) return [];
    if (!nativeBridge) throw new Error(availabilityLabels.missing_native);
    if (containsSensitiveText(context.text)) throw new Error('민감한 정보가 있는 글자는 분석하지 않아요. 필요한 할 일을 직접 입력해 주세요.');
    const status = nativeBridge.localAIAvailability();
    if (status !== 'available') throw new Error(availabilityLabels[status] ?? availabilityLabels.unavailable);
    const raw = await nativeBridge.extractTasks(context.text, context.captured_at, context.timezone, context.message_date);
    if (signal.aborted) throw new Error('분석을 취소했어요.');
    try { return enforceDateContext(validateExtraction(JSON.parse(raw), context.text), context); }
    catch { throw new Error('AI 결과의 날짜나 원문 근거를 확인하지 못했어요. 자동 저장하지 않았으니 다시 분석하거나 직접 입력해 주세요.'); }
  },
};
