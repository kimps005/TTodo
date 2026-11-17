import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, Modal, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ExtractedTask, Repository } from '../data/repository';
import { Button, Check } from './components';
import { ui } from './theme';
import { reconcileReviewDrafts, reviewDraft, reviewDeadlineLabel, reviewInput } from '../domain/reviewDraft';
import { DeadlineFields } from './DeadlineFields';
import { discardTemporaryImage } from '../data/temporaryFiles';
import type { SimilarCapture } from '../domain/duplicate';
import { createReviewConfirmation } from './reviewConfirmation';
import { nativeBridge } from '../native/bridge';
export function Review({ tasks, repository, analysisId, close, changed, imageUri }: { tasks: ExtractedTask[]; repository: Repository; analysisId: string; close: () => void; changed: () => Promise<void>; imageUri?: string }) {
  const [items, setItems] = useState(() => tasks.map(task => reviewDraft(task)));
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const confirmation = useRef(createReviewConfirmation()).current;
  const [similar, setSimilar] = useState<SimilarCapture[]>([]);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);
  useEffect(() => {
    let alive = true, generation = 0;
    const refresh = async () => {
      confirmation.invalidate();
      const request = ++generation;
      setChecking(true); setCheckError(false); setSimilar([]);
      try {
        const stored = await repository.listExtracted(analysisId);
        if (!alive || request !== generation) return;
        setItems(current => reconcileReviewDrafts(current, stored));
        const matches = await repository.findSimilarAnalyses(analysisId, stored.filter(t => t.review_status === 'pending').map(t => t.evidence_text).join('\n'));
        if (alive && request === generation) setSimilar(matches);
      } catch { if (alive && request === generation) setCheckError(true); }
      finally { if (alive && request === generation) setChecking(false); }
    };
    void refresh();
    const subscription = AppState.addEventListener('change', state => { confirmation.invalidate(); if (state === 'active') void refresh(); });
    return () => { alive = false; confirmation.invalidate(); subscription.remove(); };
  }, [repository, analysisId, tasks, checkAttempt]);
  useEffect(() => () => { if (imageUri) discardTemporaryImage(imageUri); }, [imageUri]);
  const edit = (index: number, values: Partial<typeof items[number]>) => { confirmation.invalidate(); setItems(current => current.map((item, i) => i === index ? { ...item, ...values } : item)); };
  const closeReview = () => { confirmation.invalidate(); close(); };
  const run = async (operation: () => Promise<void>) => { if (working.current) return; confirmation.invalidate(); working.current = true; setBusy(true); try { await operation(); await changed(); close(); } catch (e) { setCheckAttempt(n => n + 1); Alert.alert('처리하지 못했어요', e instanceof Error ? e.message : '다시 시도해 주세요.'); } finally { working.current = false; setBusy(false); } };
  const selected = items.filter(t => t.selected && t.review_status === 'pending');
  const save = () => {
    const isCurrent = confirmation.capture();
    const approve = () => { if (!isCurrent()) { Alert.alert('다시 확인해 주세요', '제안 상태가 바뀌었어요. 내용을 다시 확인한 뒤 저장해 주세요.'); return; } void run(async () => {
      await repository.approve(analysisId, selected.map(t => ({ id: t.id, input: reviewInput(t) })), similar);
      try {
        if (nativeBridge && !await nativeBridge.refreshReminders() && selected.some(t => t.reminder)) Alert.alert('저장 완료 · 알림 권한 필요', '할 일은 저장했어요. 기기 설정에서 TTodo 알림을 허용한 뒤 앱으로 돌아오면 예약을 다시 시도해요.');
      } catch { Alert.alert('저장 완료 · 알림 예약 확인 필요', '할 일은 저장했어요. 알림을 예약하지 못해 다음 목록 갱신 때 다시 시도해요.'); }
    }); };
    if (similar.length) Alert.alert('이미 있는 할 일인지 확인했나요?', '최근 분석과 비슷한 내용이 있어요. 같은 일이면 선택을 해제하고, 서로 다른 일이라면 저장해 주세요.', [{ text: '다시 확인', style: 'cancel', onPress: () => { isCurrent(); } }, { text: '확인하고 저장', onPress: approve }]);
    else approve();
  };
  return <Modal animationType="slide" onRequestClose={() => { if (!working.current) closeReview(); }}><SafeAreaView style={ui.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={ui.body} keyboardShouldPersistTaps="handled">
    <Text dynamicTypeRamp="caption2" style={ui.eyebrow}>CAPTURE REVIEW</Text><Text accessibilityRole="header" dynamicTypeRamp="largeTitle" style={ui.title}>내 할 일이 맞나요?</Text><Text style={ui.subtitle}>제목과 날짜, 원문 근거를 확인한 뒤 필요한 항목만 저장하세요.</Text>
    {imageUri && <Image source={{ uri: imageUri }} style={{ height: 220, borderRadius: 16, backgroundColor: '#E4E8EE' }} resizeMode="contain" accessibilityLabel="이번 분석에 사용한 이미지 미리보기" />}
    {!!similar.length && <View style={ui.card}><Text style={ui.section}>비슷한 분석 기록이 있어요</Text><Text style={ui.small}>최근 7일의 원문 근거와 비교한 참고 안내예요. 서로 다른 일일 수 있으니 기존 항목과 비교해 주세요. 자동으로 합치거나 삭제하지 않아요.</Text>{similar.map(match => <Text key={match.analysis_id} style={ui.subtitle}>{match.saved ? '저장한 항목' : '검토 대기'} · {match.title}</Text>)}</View>}
    {checking && <Text style={ui.small}>최근 분석과 비교하고 있어요…</Text>}
    {checkError && <View style={ui.card}><Text style={ui.small}>최신 제안 상태나 비슷한 분석을 확인하지 못했어요. 유효한 대기 항목의 편집 내용은 유지돼요.</Text><Button secondary title="최신 상태 다시 확인" onPress={() => setCheckAttempt(n => n + 1)} /></View>}
    <Button secondary title="대기 항목 전체 선택" disabled={busy || checking || checkError} onPress={() => { confirmation.invalidate(); setItems(current => current.map(item => ({ ...item, selected: item.review_status === 'pending' }))); }} />
    {items.map((task, index) => <View key={task.id} style={ui.card}>
      <View style={ui.row}><Check disabled={busy || checking || checkError || task.review_status !== 'pending'} checked={task.selected} label={`${task.title} 선택`} onPress={() => task.review_status === 'pending' && edit(index, { selected: !task.selected })} /><View style={ui.grow}><Text style={ui.pill}>{task.review_status === 'saved' ? '저장 완료' : task.review_status === 'ignored' ? '무시함' : task.capture_provider === 'vision-ocr/manual-v1' ? 'OCR · 직접 선택' : task.needs_confirmation ? '확인 필요' : '추가 제안'}</Text><Text style={ui.small}>담당: {task.assignee ?? '확인 필요'}</Text></View></View>
      <TextInput accessibilityLabel={`${index + 1}번째 제안, 할 일 제목`} editable={task.review_status === 'pending' && !busy && !checking && !checkError} style={ui.input} value={task.title} onChangeText={title => edit(index, { title })} multiline maxLength={400} />
      <Text style={ui.label}>마감 · {reviewDeadlineLabel(task)}</Text><DeadlineFields accessibilityContext={`${index + 1}번째 제안`} day={task.day} time={task.time} disabled={task.review_status !== 'pending' || busy || checking || checkError} onDay={day => edit(index, { day, dateEdited: true })} onTime={time => edit(index, { time, dateEdited: true })} />
      <View style={ui.row}><Check checked={task.reminder} disabled={task.review_status !== 'pending' || busy || checking || checkError} label={`${index + 1}번째 제안 마감 시각에 알림`} onPress={() => edit(index, { reminder: !task.reminder })} /><Text style={ui.small}>마감 시각에 알림 · 날짜와 시각을 지정하세요</Text></View>
      <Text style={ui.subtitle}>{task.description}</Text><Text style={ui.label}>원문 근거</Text>{task.capture_provider === 'vision-ocr/manual-v1' ? <Pressable accessibilityRole="button" accessibilityLabel={`${index + 1}번째 인식문을 제목으로 선택`} accessibilityState={{ selected: task.selected, disabled: busy || checking || checkError || task.review_status !== 'pending' }} disabled={busy || checking || checkError || task.review_status !== 'pending'} onPress={() => edit(index, { selected: true })}><Text style={ui.small}>{task.evidence_text || '보존 정책 또는 삭제 요청에 따라 원문을 지웠어요.'}</Text><Text style={ui.label}>탭해서 제목으로 선택</Text></Pressable> : <Text selectable style={ui.small}>{task.evidence_text || '보존 정책 또는 삭제 요청에 따라 원문을 지웠어요.'}</Text>}
    </View>)}
    <Button title={`선택한 ${selected.length}개 저장`} disabled={busy || checking || checkError || !selected.length} onPress={save} />
    <Button secondary title="남은 제안 모두 무시" disabled={busy || checking || checkError || !items.some(t => t.review_status === 'pending')} onPress={() => void run(() => repository.ignoreAnalysis(analysisId, items.filter(t => t.review_status === 'pending').map(t => t.id)))} />
    <Button secondary title="닫기" disabled={busy} onPress={closeReview} />
  </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}
