import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Todo, TodoInput } from '../domain/todo';
import { Button } from './components';
import { ui } from './theme';
import { composeDeadline, deadlineFields } from '../domain/deadline';
import { DeadlineFields } from './DeadlineFields';
import { createReviewConfirmation } from './reviewConfirmation';

export function TodoEditor({ todo, save, remove, close, loadEvidence }: { todo: Todo; save: (input: TodoInput) => Promise<void>; remove: () => Promise<void>; close: () => void; loadEvidence: () => Promise<string | null> }) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? '');
  const initial = deadlineFields(todo);
  const [date, setDate] = useState(initial.day);
  const [time, setTime] = useState(initial.time);
  const [dateEdited, setDateEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const deleteConfirmation = useRef(createReviewConfirmation()).current;
  const evidenceRequest = useRef(0);
  const [evidence, setEvidence] = useState<string | null | undefined>(undefined);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      deleteConfirmation.invalidate();
      if (state !== 'active') { evidenceRequest.current++; setEvidence(undefined); setLoadingEvidence(false); }
    });
    return () => { deleteConfirmation.invalidate(); evidenceRequest.current++; sub.remove(); };
  }, [deleteConfirmation]);
  const showEvidence = async () => {
    const request = ++evidenceRequest.current;
    setLoadingEvidence(true); setEvidence(undefined);
    try { const result = await loadEvidence(); if (request === evidenceRequest.current) setEvidence(result); }
    catch { if (request === evidenceRequest.current) Alert.alert('원문을 불러오지 못했어요', '잠시 후 다시 시도해 주세요.'); }
    finally { if (request === evidenceRequest.current) setLoadingEvidence(false); }
  };
  const act = async (fn: () => Promise<void>) => { if (working.current) return; deleteConfirmation.invalidate(); working.current = true; setBusy(true); try { await fn(); close(); } catch (e) { Alert.alert('변경하지 못했어요', e instanceof Error ? e.message : '다시 시도해 주세요.'); } finally { working.current = false; setBusy(false); } };
  const confirmDelete = () => {
    const isCurrent = deleteConfirmation.capture();
    Alert.alert('할 일을 삭제할까요?', todo.source_type === 'manual' ? '삭제한 할 일은 복구할 수 없어요.' : '연결된 AI 제안의 제목·설명·원문도 함께 삭제해요. 중복 방지용 지문과 처리 기록은 남으며, 삭제한 내용은 복구할 수 없어요.', [
      { text: '취소', style: 'cancel', onPress: () => deleteConfirmation.invalidate() },
      { text: '삭제', style: 'destructive', onPress: () => { if (!isCurrent()) { Alert.alert('다시 확인해 주세요', '화면 상태가 바뀌었어요. 삭제할 할 일을 다시 확인해 주세요.'); return; } void act(remove); } },
    ]);
  };
  const closeEditor = () => { deleteConfirmation.invalidate(); close(); };
  return <Modal animationType="slide" onRequestClose={() => { if (!working.current) closeEditor(); }}><SafeAreaView style={ui.screen}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={ui.body} keyboardShouldPersistTaps="handled">
      <Text dynamicTypeRamp="caption2" style={ui.eyebrow}>TASK DETAILS</Text><Text accessibilityRole="header" dynamicTypeRamp="largeTitle" style={ui.title}>할 일 다듬기</Text>
      <Text style={ui.label}>할 일</Text><TextInput accessibilityLabel="할 일 제목" editable={!busy} style={ui.input} value={title} onChangeText={value => { deleteConfirmation.invalidate(); setTitle(value); }} multiline maxLength={400} />
      <Text style={ui.label}>메모</Text><TextInput accessibilityLabel="할 일 메모" editable={!busy} style={[ui.input, { minHeight: 110 }]} value={description} onChangeText={value => { deleteConfirmation.invalidate(); setDescription(value); }} multiline maxLength={4000} />
      <Text style={ui.label}>마감 날짜</Text>
      <DeadlineFields day={date} time={time} disabled={busy} onDay={value => { deleteConfirmation.invalidate(); setDate(value); setDateEdited(true); }} onTime={value => { deleteConfirmation.invalidate(); setTime(value); setDateEdited(true); }} />
      <Text style={ui.small}>{todo.source_type === 'manual' ? '직접 입력한 할 일이에요.' : '캡처 분석에서 승인한 할 일이에요.'}</Text>
      {todo.source_type !== 'manual' && <View><Button secondary title={loadingEvidence ? '원문 확인 중…' : '원문 근거 확인'} disabled={busy || loadingEvidence} onPress={() => void showEvidence()} />{evidence !== undefined && <Text selectable style={ui.small}>{evidence ?? '원문이 없거나 보존 기간 만료·동의 철회·삭제로 지워졌어요.'}</Text>}</View>}
      <Button title={busy ? '저장 중…' : '변경 저장'} disabled={busy} onPress={() => void act(() => save({ title, description, ...(dateEdited ? composeDeadline(date, time) : { due_at: todo.due_at, due_precision: todo.due_precision }) }))} />
      <Button title="닫기" secondary disabled={busy} onPress={closeEditor} />
      <Button title="할 일 삭제" secondary disabled={busy} onPress={confirmDelete} />
    </ScrollView></KeyboardAvoidingView>
  </SafeAreaView></Modal>;
}
