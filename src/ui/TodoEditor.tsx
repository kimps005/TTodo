import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Todo, TodoInput } from '../domain/todo';
import { Button } from './components';
import { colors, ui } from './theme';

export function TodoEditor({ todo, save, remove, close }: { todo: Todo; save: (input: TodoInput) => Promise<void>; remove: () => Promise<void>; close: () => void }) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? '');
  const [date, setDate] = useState(todo.due_precision === 'date' ? todo.due_at ?? '' : '');
  const [keepTime, setKeepTime] = useState(todo.due_precision === 'datetime');
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); close(); } catch (e) { Alert.alert('저장하지 못했어요', e instanceof Error ? e.message : '다시 시도해 주세요.'); } finally { setBusy(false); } };
  return <Modal animationType="slide" onRequestClose={close}><SafeAreaView style={ui.screen}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={ui.body} keyboardShouldPersistTaps="handled">
      <Text style={ui.eyebrow}>TASK DETAILS</Text><Text style={ui.title}>할 일 다듬기</Text>
      <Text style={ui.label}>할 일</Text><TextInput accessibilityLabel="할 일 제목" style={ui.input} value={title} onChangeText={setTitle} multiline maxLength={400} />
      <Text style={ui.label}>메모</Text><TextInput accessibilityLabel="할 일 메모" style={[ui.input, { minHeight: 110 }]} value={description} onChangeText={setDescription} multiline maxLength={4000} />
      <Text style={ui.label}>마감 날짜</Text>
      {keepTime ? <View style={ui.card}><Text style={ui.subtitle}>{new Date(todo.due_at!).toLocaleString('ko-KR')}</Text><Button secondary title="날짜를 다시 지정하기" onPress={() => { setKeepTime(false); setDate(''); }} /></View> :
        <TextInput accessibilityLabel="마감 날짜 YYYY-MM-DD" placeholder="YYYY-MM-DD · 비워 두면 마감 없음" placeholderTextColor={colors.muted} style={ui.input} value={date} onChangeText={setDate} autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} />}
      <Text style={ui.small}>{todo.source_type === 'manual' ? '직접 입력한 할 일이에요.' : '캡처 분석에서 승인한 할 일이에요.'}</Text>
      <Button title={busy ? '저장 중…' : '변경 저장'} disabled={busy} onPress={() => void act(() => save({ title, description, due_at: keepTime ? todo.due_at : date.trim() || null, due_precision: keepTime ? 'datetime' : date.trim() ? 'date' : 'unknown' }))} />
      <Button title="닫기" secondary disabled={busy} onPress={close} />
      <Button title="할 일 삭제" secondary disabled={busy} onPress={() => Alert.alert('할 일을 삭제할까요?', '삭제한 할 일은 복구할 수 없어요.', [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => void act(remove) }])} />
    </ScrollView></KeyboardAvoidingView>
  </SafeAreaView></Modal>;
}
