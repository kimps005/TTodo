export type SettingsDestination = 'notifications' | 'application' | 'simulator' | 'failed';
export const settingsInstructions = '설정 앱에서 앱 → TTodo → 알림을 선택해 주세요. 알림 항목이 없으면 이 환경에서는 변경할 수 없어요.';
export function settingsMessage(destination: SettingsDestination): string {
  if (destination === 'failed') throw new Error('설정을 열지 못했어요. ' + settingsInstructions);
  if (destination === 'simulator') return '시뮬레이터에서는 알림 설정이 표시되지 않을 수 있어 앱 설정 열기를 요청했어요. ' + settingsInstructions;
  if (destination === 'application') return '앱 설정 열기를 요청했어요. ' + settingsInstructions;
  return '알림 설정 열기를 요청했어요. 화면이 열리지 않으면 ' + settingsInstructions;
}
