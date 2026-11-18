import { requireOptionalNativeModule } from 'expo';
export interface OCRResult { text: string; fingerprint: string; }
interface NativeBridge {
  databaseDirectory(): string;
  execSQL(sql: string): Promise<void>;
  runSQL(sql: string, params: (string | null)[]): Promise<void>;
  querySQL(sql: string, params: (string | null)[]): Promise<Record<string, unknown>[]>;
  localAIAvailability(): string;
  ocrCandidates(text: string): string;
  systemVersion(): string;
  activityStatus(): string;
  recordStartupPhase?(phase: string): void;
  openNotificationSettings(): Promise<'notifications' | 'application' | 'simulator' | 'failed'>;
  clearCaptureNotifications(): Promise<void>;
  clearCaptureNotification(analysisId: string): void;
  refreshReminders(): Promise<boolean>;
  extractTasks(text: string, capturedAt: string | null, timezone: string, messageDate: string | null): Promise<string>;
  recognizeText(uri: string): Promise<OCRResult>;
  signalCapturePurge(): void;
  reloadWidgets(): void;
  recoverActivity(): Promise<void>;
  startActivity(): Promise<void>;
  endActivities(): Promise<void>;
}
export const nativeBridge = requireOptionalNativeModule<NativeBridge>('TTodoNative');
