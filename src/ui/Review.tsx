import { useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ExtractedTask, Repository } from '../data/repository';
import { Button, Check } from './components';
import { dueLabel } from '../domain/todo';
import { ui } from './theme';
export function Review({ tasks, repository, analysisId, close, changed }: { tasks: ExtractedTask[]; repository: Repository; analysisId: string; close: () => void; changed: () => Promise<void> }) {
  const [items, setItems] = useState(tasks.map(task => ({ ...task, selected: task.review_status === 'pending', dateEdited: false, date: task.due_precision === 'date' ? task.due_at ?? '' : '' })));
  const [busy, setBusy] = useState(false);
  const edit = (index: number, values: Partial<typeof items[number]>) => setItems(current => current.map((item, i) => i === index ? { ...item, ...values } : item));
  const run = async (operation: () => Promise<void>) => { setBusy(true); try { await operation(); await changed(); close(); } catch (e) { Alert.alert('처리하지 못했어요', e instanceof Error ? e.message : '다시 시도해 주세요.'); } finally { setBusy(false); } };
  const selected = items.filter(t => t.selected && t.review_status === 'pending');
  return <Modal animationType="slide" onRequestClose={close}><SafeAreaView style={ui.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={ui.body} keyboardShouldPersistTaps="handled">
    <Text style={ui.eyebrow}>CAPTURE REVIEW</Text><Text style={ui.title}>내 할 일이 맞나요?</Text><Text style={ui.subtitle}>제목과 날짜, 원문 근거를 확인한 뒤 필요한 항목만 저장하세요.</Text>
    <Button secondary title="대기 항목 전체 선택" disabled={busy} onPress={() => setItems(current => current.map(item => ({ ...item, selected: item.review_status === 'pending' })))} />
    {items.map((task, index) => <View key={task.id} style={ui.card}>
      <View style={ui.row}><Check checked={task.selected} label={`${task.title} 선택`} onPress={() => task.review_status === 'pending' && edit(index, { selected: !task.selected })} /><View style={ui.grow}><Text style={ui.pill}>{task.review_status === 'saved' ? '저장 완료' : task.review_status === 'ignored' ? '무시함' : task.needs_confirmation ? '확인 필요' : '추가 제안'}</Text><Text style={ui.small}>담당: {task.assignee ?? '확인 필요'}</Text></View></View>
      <TextInput accessibilityLabel="제안된 할 일 제목" editable={task.review_status === 'pending' && !busy} style={ui.input} value={task.title} onChangeText={title => edit(index, { title })} multiline maxLength={400} />
      <Text style={ui.label}>마감 · {dueLabel(task)}</Text><TextInput accessibilityLabel="제안 마감 날짜 수정 YYYY-MM-DD" editable={task.review_status === 'pending' && !busy} style={ui.input} placeholder="날짜 수정 YYYY-MM-DD" value={task.date} onChangeText={date => edit(index, { date, dateEdited: true })} maxLength={10} keyboardType="numbers-and-punctuation" />
      <Text style={ui.small}>날짜를 수정하면 시각 없이 저장해요. 입력 후 비우면 마감을 해제해요.</Text>
      <Text style={ui.subtitle}>{task.description}</Text><Text style={ui.label}>원문 근거</Text><Text selectable style={ui.small}>{task.evidence_text || '개인정보 보존 기간이 지나 원문을 삭제했어요.'}</Text>
    </View>)}
    <Button title={`선택한 ${selected.length}개 저장`} disabled={busy || !selected.length} onPress={() => void run(() => repository.approve(analysisId, selected.map(t => ({ id: t.id, input: { title: t.title, description: t.description, due_at: t.dateEdited ? t.date.trim() || null : t.due_at, due_precision: t.dateEdited ? t.date.trim() ? 'date' : 'unknown' : t.due_precision } }))))} />
    <Button secondary title="남은 제안 모두 무시" disabled={busy || !items.some(t => t.review_status === 'pending')} onPress={() => void run(() => repository.ignoreAnalysis(analysisId))} />
    <Button secondary title="닫기" disabled={busy} onPress={close} />
  </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}
