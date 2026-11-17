import { Text, TextInput, View } from 'react-native';
import { colors, ui } from './theme';
export function DeadlineFields({ day, time, onDay, onTime, disabled = false, accessibilityContext }: { day: string; time: string; onDay: (value: string) => void; onTime: (value: string) => void; disabled?: boolean; accessibilityContext?: string }) {
  const label = (field: string) => accessibilityContext ? `${accessibilityContext}, ${field}` : field;
  return <View style={{ gap: 10 }}>
    <TextInput accessibilityLabel={label('마감 날짜 YYYY-MM-DD')} accessibilityHint="연도, 월, 일을 숫자로 입력해요. 비우면 날짜를 해제해요" editable={!disabled} placeholder="날짜 YYYY-MM-DD" placeholderTextColor={colors.muted} style={ui.input} value={day} onChangeText={onDay} keyboardType="numbers-and-punctuation" maxLength={10} />
    <TextInput accessibilityLabel={label('마감 시각 시와 분')} accessibilityHint="24시간 형식으로 입력해요. 비우면 날짜만 저장해요" editable={!disabled} placeholder="시각 17:30 (선택)" placeholderTextColor={colors.muted} style={ui.input} value={time} onChangeText={onTime} keyboardType="numbers-and-punctuation" maxLength={5} />
    <Text style={ui.small}>시각을 비우면 날짜만 저장해요. 둘 다 비우면 마감을 해제해요. 시각은 현재 기기 시간대를 사용해요.</Text>
  </View>;
}
