import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Todo, TodoInput } from '../domain/todo';
import { Button } from './components';
import { ui } from './theme';
import { composeDeadline, deadlineFields } from '../domain/deadline';
import { DeadlineFields } from './DeadlineFields';

export function TodoEditor({ todo, save, remove, close }: { todo: Todo; save: (input: TodoInput) => Promise<void>; remove: () => Promise<void>; close: () => void }) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? '');
  const initial = deadlineFields(todo);
  const [date, setDate] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [dateEdited, setDateEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const act = async (fn: () => Promise<void>) => { if (working.current) return; working.current = true; setBusy(true); try { await fn(); close(); } catch (e) { Alert.alert('변경하지 못했어요', e instanceof Error ? e.message : '다시 시도해 주세요.'); } finally { working.current = false; setBusy(false); } };
  return <Modal animationType="slide" onRequestClose={() => { if (!working.current) close(); }}><SafeAreaView style={ui.screen}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={ui.body} keyboardShouldPersistTaps="handled">
      <Text style={ui.eyebrow}>TASK DETAILS</Text><Text style={ui.title}>할 일 다듬기</Text>
      <Text style={ui.label}>할 일</Text><TextInput accessibilityLabel="할 일 제목" editable={!busy} style={ui.input} value={title} onChangeText={setTitle} multiline maxLength={400} />
      <Text style={ui.label}>메모</Text><TextInput accessibilityLabel="할 일 메모" editable={!busy} style={[ui.input, { minHeight: 110 }]} value={description} onChangeText={setDescription} multiline maxLength={4000} />
      <Text style={ui.label}>마감 날짜</Text>
      <DeadlineFields day={date} time={time} disabled={busy} onDay={value => { setDate(value); setDateEdited(true); }} onTime={value => { setTime(value); setDateEdited(true); }} />
      <Text style={ui.small}>{todo.source_type === 'manual' ? '직접 입력한 할 일이에요.' : '캡처 분석에서 승인한 할 일이에요.'}</Text>
      <Button title={busy ? '저장 중…' : '변경 저장'} disabled={busy} onPress={() => void act(() => save({ title, description, ...(dateEdited ? composeDeadline(date, time) : { due_at: todo.due_at, due_precision: todo.due_precision }) }))} />
      <Button title="닫기" secondary disabled={busy} onPress={close} />
      <Button title="할 일 삭제" secondary disabled={busy} onPress={() => Alert.alert('할 일을 삭제할까요?', todo.source_type === 'manual' ? '삭제한 할 일은 복구할 수 없어요.' : '연결된 AI 제안의 제목·설명·원문도 함께 삭제해요. 중복 방지용 지문과 처리 기록은 남으며, 삭제한 내용은 복구할 수 없어요.', [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => void act(remove) }])} />
    </ScrollView></KeyboardAvoidingView>
  </SafeAreaView></Modal>;
}
