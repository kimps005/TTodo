import type { ReactNode } from 'react';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { ui } from './theme';
export function Button({ title, onPress, secondary = false, disabled = false, style, hint, value }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; hint?: string; value?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={hint} accessibilityValue={value ? { text: value } : undefined} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [ui.button, secondary && ui.secondary, (pressed || disabled) && ui.disabled, style]}>
    <Text style={[ui.buttonText, secondary && ui.secondaryText]}>{title}</Text>
  </Pressable>;
}
export function Check({ checked, label, onPress, disabled = false }: { checked: boolean; label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityHint="이 항목의 선택 또는 완료 상태를 바꿔요" accessibilityValue={{ text: checked ? '선택됨' : '선택 안 됨' }} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: disabled ? .45 : 1 }}>
    <Text style={{ fontSize: 28, color: checked ? '#23664E' : '#8793A2' }}>{checked ? '●' : '○'}</Text>
  </Pressable>;
}
export function Caption({ children }: { children: ReactNode }) { return <Text style={ui.subtitle}>{children}</Text>; }
