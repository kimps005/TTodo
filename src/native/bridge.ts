import { requireOptionalNativeModule } from 'expo';
export interface OCRResult { text: string; fingerprint: string; }
interface NativeBridge {
  databaseDirectory(): string;
  recognizeText(uri: string): Promise<OCRResult>;
  reloadWidgets(): void;
  startActivity(): Promise<void>;
  endActivities(): Promise<void>;
}
export const nativeBridge = requireOptionalNativeModule<NativeBridge>('TTodoNative');
