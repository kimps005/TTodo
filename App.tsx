import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import { openRepository } from './src/data/open';
import type { Analysis, ExtractedTask, Repository } from './src/data/repository';
import { dueLabel, sortTodos, type Todo } from './src/domain/todo';
import { nativeBridge } from './src/native/bridge';
import { colors, ui } from './src/ui/theme';
import { Button, Check } from './src/ui/components';
import { TodoEditor } from './src/ui/TodoEditor';
import { Review } from './src/ui/Review';
import { Capture } from './src/ui/Capture';
import { clearTemporaryFiles } from './src/data/temporaryFiles';
import { availabilityLabels } from './src/ai/onDeviceProvider';
import { ModelEvaluation } from './src/dev/ModelEvaluation';
import { analysisReviewRoute } from './src/notifications/route';

const statusLabels: Record<Analysis['status'], string> = { queued: '분석 대기', processing: '분석 중', review: '확인 대기', saved: '저장 완료', ignored: '무시함', failed: '분석 실패', empty: '할 일 없음' };
function Application() {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [error, setError] = useState('');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [tab, setTab] = useState<'today' | 'inbox' | 'settings'>('today');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const mutationInFlight = useRef(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [review, setReview] = useState<{ id: string; tasks: ExtractedTask[] } | null>(null);
  const [capture, setCapture] = useState(false);
  const [evaluation, setEvaluation] = useState(false);
  const [privateLock, setPrivateLock] = useState(true);
  const [localAIConsent, setLocalAIConsent] = useState(false);
  const [notificationReview, setNotificationReview] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(false);
  const [permission, setPermission] = useState('확인 전');
  const refresh = useCallback(async (repository: Repository) => {
    await repository.pruneEvidence();
    const [all, captures, privacy, intro] = await Promise.all([repository.listTodos(), repository.listAnalyses(), repository.getPreference('private_lock'), repository.getPreference('onboarded')]);
    setTodos(sortTodos(all)); setAnalyses(captures); setPrivateLock(privacy !== 'no'); setOnboarded(intro === 'yes');
    setLocalAIConsent(await repository.getPreference('ai_local_consent') === 'yes');
    setPermission((await Notifications.getPermissionsAsync()).granted ? '허용됨' : '허용되지 않음');
  }, []);
  const boot = useCallback(async () => { try { setError(''); clearTemporaryFiles(); const repository = await openRepository(); await refresh(repository); setRepo(repository); } catch (e) { setError(e instanceof Error ? e.message : '저장소를 열 수 없어요.'); } }, [refresh]);
  useEffect(() => { void boot(); }, [boot]);
  useEffect(() => { const sub = AppState.addEventListener('change', state => { if (state === 'active' && repo) void refresh(repo).catch(() => setError('최신 목록을 불러오지 못했어요. 다시 시도해 주세요.')); }); return () => sub.remove(); }, [repo, refresh]);
  useEffect(() => {
    if (!repo) return;
    let alive = true;
    const received = async (response: Notifications.NotificationResponse) => {
      const id = analysisReviewRoute(response); if (!id || !alive) return;
      setNotificationReview(id); setTab('inbox');
      await Notifications.clearLastNotificationResponseAsync();
      await refresh(repo);
    };
    const response = Notifications.addNotificationResponseReceivedListener(value => { void received(value).catch(() => Alert.alert('분석함에서 확인해 주세요', '알림 결과를 바로 열지 못했어요. 저장된 분석 결과는 유지돼요.')); });
    const notification = Notifications.addNotificationReceivedListener(() => { void refresh(repo).catch(() => {}); });
    void Notifications.getLastNotificationResponseAsync().then(value => { if (value) return received(value); }).catch(() => {});
    return () => { alive = false; response.remove(); notification.remove(); };
  }, [repo, refresh]);
  useEffect(() => {
    if (!repo || !notificationReview || editing || capture || evaluation || review) return;
    let alive = true;
    void repo.listExtracted(notificationReview).then(tasks => {
      if (!alive) return;
      if (tasks.length) setReview({ id: notificationReview, tasks });
      setNotificationReview(null);
    }).catch(() => { if (alive) setNotificationReview(null); });
    return () => { alive = false; };
  }, [repo, notificationReview, editing, capture, evaluation, review]);
  const changed = async () => { if (repo) await refresh(repo); nativeBridge?.reloadWidgets(); };
  const run = async (action: () => Promise<unknown>) => { if (mutationInFlight.current) return; mutationInFlight.current = true; setBusy(true); try { await action(); await changed(); } catch (e) { Alert.alert('처리하지 못했어요', e instanceof Error ? e.message : '잠시 후 다시 시도해 주세요.'); } finally { mutationInFlight.current = false; setBusy(false); } };
  if (error) return <SafeAreaView style={ui.screen}><View style={ui.body}><Text style={ui.title}>준비가 필요해요</Text><Text style={ui.subtitle}>{error}</Text><Button title="다시 시도" onPress={() => void boot()} /></View></SafeAreaView>;
  if (!repo) return <SafeAreaView style={[ui.screen, { justifyContent: 'center' }]}><ActivityIndicator size="large" color={colors.accent} accessibilityLabel="할 일 불러오는 중" /></SafeAreaView>;
  const pending = todos.filter(t => t.status === 'pending');
  const completed = todos.filter(t => t.status === 'completed');
  const add = () => void run(async () => { await repo.addTodo({ title: draft }); setDraft(''); });
  const exportData = () => void run(async () => {
    if (!(await Sharing.isAvailableAsync())) throw new Error('이 기기에서는 파일 공유를 사용할 수 없어요.');
    const file = new File(Paths.cache, 'TTodo-export.json');
    try { file.create({ overwrite: true }); file.write(await repo.exportData()); await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' }); }
    finally { if (file.exists) file.delete(); }
  });
  return <SafeAreaView style={ui.screen} edges={['top', 'left', 'right', 'bottom']}><StatusBar style="dark" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={ui.body} keyboardShouldPersistTaps="handled">
        <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.eyebrow}>TTODO</Text><Text style={ui.small}>생각난 순간, 가볍게.</Text></View>
        {tab === 'today' && <>
          <View style={{ gap: 7 }}><Text style={ui.subtitle}>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</Text><Text style={ui.title}>오늘의 할 일</Text><Text style={ui.subtitle}>앞으로 할 일 <Text style={{ color: colors.accent, fontWeight: '700' }}>{pending.length}개</Text></Text></View>
          {!onboarded && <View style={[ui.card, { backgroundColor: colors.pale }]}><Text style={ui.section}>잊기 전에 적어 두세요</Text><Text style={ui.subtitle}>할 일은 기기에 저장돼요. 잠금화면과 캡처 기능은 설정에서 준비 상태를 확인할 수 있어요.</Text><Button secondary title="시작하기" onPress={() => void run(() => repo.setPreference('onboarded', 'yes'))} /></View>}
          <View style={ui.card}><TextInput accessibilityLabel="새 할 일" placeholder="어떤 일을 해야 하나요?" placeholderTextColor={colors.muted} value={draft} onChangeText={setDraft} style={ui.input} returnKeyType="done" onSubmitEditing={add} maxLength={400} editable={!busy} /><Button title="할 일 추가" disabled={busy || !draft.trim()} onPress={add} /></View>
          {!pending.length && <View style={[ui.card, { paddingVertical: 36 }]}><Text style={{ fontSize: 30, color: colors.accent }}>✓</Text><Text style={ui.section}>머릿속을 조금 비워 보세요</Text><Text style={ui.subtitle}>할 일을 하나 적어 두면 기억하는 대신 지금 하는 일에 집중할 수 있어요.</Text></View>}
          {pending.map(todo => <View key={todo.id} style={[ui.card, ui.row, { padding: 12 }]}><Check checked={false} label={`${todo.title} 완료하기`} onPress={() => void run(() => repo.setCompleted(todo.id, true))} /><Pressable accessibilityRole="button" accessibilityLabel={`${todo.title}, ${dueLabel(todo)}, 상세 편집`} style={[ui.grow, { paddingVertical: 7 }]} onPress={() => setEditing(todo)}><Text style={{ fontSize: 17, color: colors.ink, lineHeight: 25 }}>{todo.title}</Text><View style={ui.row}><Text style={ui.small}>{dueLabel(todo)}</Text>{todo.source_type !== 'manual' && <Text style={ui.pill}>AI 제안</Text>}</View></Pressable></View>)}
          {!!completed.length && <><Text style={ui.section}>마친 일 · {completed.length}</Text>{completed.map(todo => <View key={todo.id} style={[ui.row, { paddingVertical: 3 }]}><Check checked label={`${todo.title} 미완료로 되돌리기`} onPress={() => void run(() => repo.setCompleted(todo.id, false))} /><Pressable style={ui.grow} accessibilityRole="button" onPress={() => setEditing(todo)}><Text style={{ color: colors.muted, fontSize: 16, textDecorationLine: 'line-through' }}>{todo.title}</Text></Pressable></View>)}</>}
        </>}
        {tab === 'inbox' && <>
          <Text style={ui.title}>캡처 분석함</Text><Text style={ui.subtitle}>캡처에서 찾은 제안은 확인한 뒤 저장돼요.</Text><Button title="캡처에서 할 일 찾기" onPress={() => setCapture(true)} />
          {!analyses.length && <View style={ui.card}><Text style={ui.section}>아직 분석 내역이 없어요</Text><Text style={ui.subtitle}>사진을 선택하면 기기에서 글자를 읽어요. 지원 기기에서는 무료 기기 내 AI를 시험할 수 있어요. 정확도는 검증 중이에요.</Text></View>}
          {analyses.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => void run(async () => setReview({ id: item.id, tasks: await repo.listExtracted(item.id) }))} style={ui.card}><Text style={ui.pill}>{statusLabels[item.status]}</Text><Text style={ui.section}>{new Date(item.received_at).toLocaleString('ko-KR')}</Text>{item.status === 'failed' && <Text style={ui.subtitle}>분석을 마치지 못했어요. 원본 사진을 다시 선택해 주세요.</Text>}</Pressable>)}
        </>}
        {tab === 'settings' && <>
          <Text style={ui.title}>내 방식으로</Text><Text style={ui.subtitle}>빠른 기록과 개인정보를 함께 챙겨요.</Text>
          <View style={ui.card}><Text style={ui.section}>잠금화면 빠른 추가</Text><Text style={ui.subtitle}>단축어에서 ‘입력 요청’ 다음에 ‘TTodo에 할 일 추가’를 연결하세요. 잠긴 상태에서 인증 없는 입력은 실제 iPhone 검증이 필요해요.</Text><Text style={ui.small}>설정 안내를 읽은 것만으로 연결 완료로 처리하지 않아요.</Text></View>
          <View style={ui.card}><Text style={ui.section}>잠금화면 목록</Text><Text style={ui.subtitle}>위젯과 큰 목록 카드는 네이티브 빌드에서 검증하고 있어요. 큰 목록은 iOS에 의해 만료될 수 있어요.</Text><View style={ui.row}><Text style={[ui.label, { flex: 1 }]}>잠금화면 제목 숨기기</Text><Switch accessibilityLabel="잠금화면 제목 숨기기" value={privateLock} disabled={busy} onValueChange={value => void run(() => repo.setPreference('private_lock', value ? 'yes' : 'no'))} /></View><Button secondary title="큰 목록 카드 시작" disabled={busy || !nativeBridge} onPress={() => void run(async () => { await nativeBridge!.startActivity(); })} /><Button secondary title="큰 목록 카드 종료" disabled={busy || !nativeBridge} onPress={() => void run(async () => { await nativeBridge!.endActivities(); })} /></View>
          <View style={ui.card}><Text style={ui.section}>캡처 자동화</Text><Text style={ui.subtitle}>단축어의 ‘TTodo에서 캡처 분석’에 이미지를 직접 전달하세요. 스크린샷 자동화가 없는 환경에서는 사진 선택 단축어로 시험할 수 있어요.</Text><Text style={ui.small}>실제 스크린샷 전달·잠금 실행·AI 정확도는 미검증이에요. 최신 사진을 임의로 가져오지 않으며, 설정 화면 방문만으로 연결 완료로 처리하지 않아요.</Text></View>
          <View style={ui.card}><Text style={ui.section}>분석 결과 알림</Text><Text style={ui.subtitle}>권한: {permission}</Text><Button secondary title="알림 권한 요청" onPress={() => void run(async () => { await Notifications.requestPermissionsAsync(); })} disabled={busy} /></View>
          <View style={ui.card}><Text style={ui.section}>무료 기기 내 AI</Text><Text style={ui.subtitle}>{availabilityLabels[nativeBridge?.localAIAvailability() ?? 'missing_native'] ?? availabilityLabels.unavailable}</Text><Text style={ui.small}>분석 동의: {localAIConsent ? '켜짐' : '꺼짐'}{'\n'}외부 유료 API를 사용하지 않아요. 원문 근거는 동의한 경우에만 저장하며, 7일 지난 내용은 다음 앱 실행·확인 때 삭제해요. 현재 한국어 정확도 검증 전이에요.</Text>{!localAIConsent && <Button title="기기 내 AI 분석 켜기" disabled={busy} onPress={() => Alert.alert('기기 내 AI 분석을 켤까요?', '직접 선택하거나 단축어로 전달한 이미지에서만 글자를 분석해요. 외부 AI 서버로 보내지 않아요. 제안 검토를 위한 원문 근거를 저장하며, 7일이 지나면 다음 앱 실행·확인 때 정리해요. 저장 전 내용을 직접 확인해 주세요.', [{ text: '취소', style: 'cancel' }, { text: '동의하고 켜기', onPress: () => void run(() => repo.setPreference('ai_local_consent', 'yes')) }])} />}<Button title="AI 중지 및 원문 근거 삭제" secondary disabled={busy || !localAIConsent} onPress={() => void run(() => repo.revokeLocalAIConsent())} /></View>
          <View style={ui.card}><Text style={ui.section}>개인정보와 데이터</Text><Text style={ui.subtitle}>이미지나 글자를 외부 AI 서버에 보내지 않아요. 할 일과 분석 제안은 기기에 저장돼요. 원본 이미지는 보관하지 않고 임시 파일은 화면 종료 또는 다음 앱 실행 때 정리해요.</Text><Button title="내 데이터 내보내기" secondary onPress={exportData} disabled={busy} /><Button title="모든 데이터 삭제" secondary disabled={busy} onPress={() => Alert.alert('모든 데이터를 삭제할까요?', '할 일, 분석 내역과 설정이 삭제돼요. 복구할 수 없어요.', [{ text: '취소', style: 'cancel' }, { text: '모두 삭제', style: 'destructive', onPress: () => void run(async () => { await nativeBridge?.endActivities(); await repo.deleteAll(); }) }])} /></View>
          <Text style={ui.small}>TTodo 1.0.0 · 개발 중{'\n'}실기기 검증 및 App Store 출시 준비 전 버전이에요.</Text>
          {__DEV__ && <Button secondary title="개발용 한국어 AI 평가" disabled={busy} onPress={() => setEvaluation(true)} />}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
    <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line }}>{([['today', '할 일'], ['inbox', '분석함'], ['settings', '설정']] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} style={{ flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', padding: 10 }} onPress={() => { setTab(key); void refresh(repo).catch(() => Alert.alert('목록을 갱신하지 못했어요', '잠시 후 다시 시도해 주세요.')); }}><Text style={{ color: tab === key ? colors.accent : colors.muted, fontWeight: tab === key ? '800' : '500', fontSize: 15 }}>{label}{key === 'inbox' && analyses.some(a => a.status === 'review') ? ' •' : ''}</Text></Pressable>)}</View>
    {editing && <TodoEditor key={editing.id} todo={editing} close={() => setEditing(null)} save={async input => { await repo.updateTodo(editing.id, input); await changed(); }} remove={async () => { await repo.removeTodo(editing.id); await changed(); }} />}
    {review && <Review key={review.id} analysisId={review.id} tasks={review.tasks} repository={repo} close={() => setReview(null)} changed={changed} />}
    {capture && <Capture repository={repo} close={() => setCapture(false)} analyzed={async id => { await changed(); const tasks = await repo.listExtracted(id); setCapture(false); if (tasks.length) setReview({ id, tasks }); else Alert.alert('발견한 할 일이 없어요', '필요한 내용은 직접 할 일로 입력할 수 있어요.'); }} />}
    {__DEV__ && evaluation && <ModelEvaluation close={() => setEvaluation(false)} />}
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Application /></SafeAreaProvider>; }
