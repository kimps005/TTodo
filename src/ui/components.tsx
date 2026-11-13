import type { ReactNode } from 'react';
import { Pressable, Text, type StyleProp, type ViewStyle } from 'react-native';
import { ui } from './theme';
export function Button({ title, onPress, secondary = false, disabled = false, style }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [ui.button, secondary && ui.secondary, (pressed || disabled) && ui.disabled, style]}>
    <Text style={[ui.buttonText, secondary && ui.secondaryText]}>{title}</Text>
  </Pressable>;
}
export function Check({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked }} onPress={onPress} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: 28, color: checked ? '#23664E' : '#8793A2' }}>{checked ? '●' : '○'}</Text>
  </Pressable>;
}
export function Caption({ children }: { children: ReactNode }) { return <Text style={ui.subtitle}>{children}</Text>; }
