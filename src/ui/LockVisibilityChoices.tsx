import { Pressable, Text, View } from 'react-native';
import { ui } from './theme';

export type LockVisibility = 'titles' | 'count' | 'hidden';
const choices = [['titles', '할 일 제목 표시'], ['count', '할 일 개수만 표시'], ['hidden', '내용 숨김']] as const;
export function LockVisibilityChoices({ value, disabled, onSelect }: { value: LockVisibility; disabled: boolean; onSelect: (value: LockVisibility) => void }) {
  return <View accessibilityRole="radiogroup" accessibilityLabel="잠금화면 표시 수준" style={{ gap: 8 }}>
    {choices.map(([key, label]) => <Pressable key={key} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: value === key, disabled }} disabled={disabled} onPress={() => onSelect(key)} style={({ pressed }) => [ui.button, value !== key && ui.secondary, (pressed || disabled) && ui.disabled]}>
      <Text style={[ui.buttonText, value !== key && ui.secondaryText]}>{value === key ? '✓ ' : ''}{label}</Text>
    </Pressable>)}
  </View>;
}
