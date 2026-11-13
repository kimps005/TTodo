import { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ExtractedTask, Repository } from '../data/repository';
import { Button, Check } from './components';
import { dueLabel } from '../domain/todo';
import { ui } from './theme';
import { composeDeadline, deadlineFields } from '../domain/deadline';
import { DeadlineFields } from './DeadlineFields';
import { discardTemporaryImage } from '../data/temporaryFiles';
import type { SimilarCapture } from '../domain/duplicate';
export function Review({ tasks, repository, analysisId, close, changed, imageUri }: { tasks: ExtractedTask[]; repository: Repository; analysisId: string; close: () => void; changed: () => Promise<void>; imageUri?: string }) {
  const [items, setItems] = useState(tasks.map(task => ({ ...task, selected: task.review_status === 'pending', dateEdited: false, ...deadlineFields(task) })));
  const [busy, setBusy] = useState(false);
  const [similar, setSimilar] = useState<SimilarCapture[]>([]);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);
  useEffect(() => {
    let alive = true; setChecking(true); setCheckError(false);
    void repository.findSimilarAnalyses(analysisId, tasks.filter(t => t.review_status === 'pending').map(t => t.evidence_text).join('\n')).then(matches => { if (alive) setSimilar(matches); }).catch(() => { if (alive) setCheckError(true); }).finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, [repository, analysisId, tasks, checkAttempt]);
  useEffect(() => () => { if (imageUri) discardTemporaryImage(imageUri); }, [imageUri]);
  const edit = (index: number, values: Partial<typeof items[number]>) => setItems(current => current.map((item, i) => i === index ? { ...item, ...values } : item));
  const run = async (operation: () => Promise<void>) => { setBusy(true); try { await operation(); await changed(); close(); } catch (e) { Alert.alert('처리하지 못했어요', e instanceof Error ? e.message : '다시 시도해 주세요.'); } finally { setBusy(false); } };
  const selected = items.filter(t => t.selected && t.review_status === 'pending');
  const save = () => {
    const approve = () => void run(() => repository.approve(analysisId, selected.map(t => ({ id: t.id, input: { title: t.title, description: t.description, ...(t.dateEdited ? composeDeadline(t.day, t.time) : { due_at: t.due_at, due_precision: t.due_precision }) } }))));
    if (similar.length) Alert.alert('이미 있는 할 일인지 확인했나요?', '최근 분석과 비슷한 내용이 있어요. 같은 일이면 선택을 해제하고, 서로 다른 일이라면 저장해 주세요.', [{ text: '다시 확인', style: 'cancel' }, { text: '확인하고 저장', onPress: approve }]);
    else approve();
  };
  return <Modal animationType="slide" onRequestClose={close}><SafeAreaView style={ui.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={ui.body} keyboardShouldPersistTaps="handled">
    <Text style={ui.eyebrow}>CAPTURE REVIEW</Text><Text style={ui.title}>내 할 일이 맞나요?</Text><Text style={ui.subtitle}>제목과 날짜, 원문 근거를 확인한 뒤 필요한 항목만 저장하세요.</Text>
    {imageUri && <Image source={{ uri: imageUri }} style={{ height: 220, borderRadius: 16, backgroundColor: '#E4E8EE' }} resizeMode="contain" accessibilityLabel="이번 분석에 사용한 이미지 미리보기" />}
    {!!similar.length && <View style={ui.card}><Text style={ui.section}>비슷한 분석 기록이 있어요</Text><Text style={ui.small}>최근 7일의 원문 근거와 비교한 참고 안내예요. 서로 다른 일일 수 있으니 기존 항목과 비교해 주세요. 자동으로 합치거나 삭제하지 않아요.</Text>{similar.map(match => <Text key={match.analysis_id} style={ui.subtitle}>{match.saved ? '저장한 항목' : '검토 대기'} · {match.title}</Text>)}</View>}
    {checking && <Text style={ui.small}>최근 분석과 비교하고 있어요…</Text>}
    {checkError && <View style={ui.card}><Text style={ui.small}>최근 분석과 비교하지 못했어요. 편집 내용은 유지돼요.</Text><Button secondary title="비교 다시 시도" onPress={() => setCheckAttempt(n => n + 1)} /></View>}
    <Button secondary title="대기 항목 전체 선택" disabled={busy} onPress={() => setItems(current => current.map(item => ({ ...item, selected: item.review_status === 'pending' })))} />
    {items.map((task, index) => <View key={task.id} style={ui.card}>
      <View style={ui.row}><Check checked={task.selected} label={`${task.title} 선택`} onPress={() => task.review_status === 'pending' && edit(index, { selected: !task.selected })} /><View style={ui.grow}><Text style={ui.pill}>{task.review_status === 'saved' ? '저장 완료' : task.review_status === 'ignored' ? '무시함' : task.needs_confirmation ? '확인 필요' : '추가 제안'}</Text><Text style={ui.small}>담당: {task.assignee ?? '확인 필요'}</Text></View></View>
      <TextInput accessibilityLabel="제안된 할 일 제목" editable={task.review_status === 'pending' && !busy} style={ui.input} value={task.title} onChangeText={title => edit(index, { title })} multiline maxLength={400} />
      <Text style={ui.label}>마감 · {dueLabel(task)}</Text><DeadlineFields day={task.day} time={task.time} disabled={task.review_status !== 'pending' || busy} onDay={day => edit(index, { day, dateEdited: true })} onTime={time => edit(index, { time, dateEdited: true })} />
      <Text style={ui.subtitle}>{task.description}</Text><Text style={ui.label}>원문 근거</Text><Text selectable style={ui.small}>{task.evidence_text || '보존 정책 또는 삭제 요청에 따라 원문을 지웠어요.'}</Text>
    </View>)}
    <Button title={`선택한 ${selected.length}개 저장`} disabled={busy || checking || checkError || !selected.length} onPress={save} />
    <Button secondary title="남은 제안 모두 무시" disabled={busy || !items.some(t => t.review_status === 'pending')} onPress={() => void run(() => repository.ignoreAnalysis(analysisId, items.filter(t => t.review_status === 'pending').map(t => t.id)))} />
    <Button secondary title="닫기" disabled={busy} onPress={close} />
  </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}
