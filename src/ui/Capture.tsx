import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { nativeBridge } from '../native/bridge';
import { containsSensitiveText, validateExtraction } from '../ai/extraction';
import { Button } from './components';
import { ui } from './theme';
import { discardTemporaryImage, ownTemporaryImage } from '../data/temporaryFiles';
import type { Analysis, Repository } from '../data/repository';
import { availabilityLabels, onDeviceProvider } from '../ai/onDeviceProvider';
import { validateDue } from '../domain/todo';
import { requestCaptureAnalysis } from './captureAction';
import { createReviewConfirmation } from './reviewConfirmation';
export function Capture({ initialImage, close, repository, analyzed }: { initialImage?: string; close: () => void; repository: Repository; analyzed: (id: string, imageUri?: string) => Promise<void> }) {
  const [image, setImage] = useState<string | null>(initialImage ?? null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [messageDate, setMessageDate] = useState('');
  const [hasPrevious, setHasPrevious] = useState(false);
  const [aiStatus, setAIStatus] = useState(() => nativeBridge?.localAIAvailability() ?? 'missing_native');
  const working = useRef(false);
  const mounted = useRef(false);
  const draftVersion = useRef(0);
  const confirmation = useRef(createReviewConfirmation()).current;
  const closeIfIdle = () => { if (!working.current) { draftVersion.current++; close(); } };
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => { draftVersion.current++; if (state === 'active') setAIStatus(nativeBridge?.localAIAvailability() ?? 'missing_native'); });
    return () => { mounted.current = false; draftVersion.current++; subscription.remove(); };
  }, []);
  const transferred = useRef<string | null>(null);
  useEffect(() => () => { if (image && transferred.current !== image) discardTemporaryImage(image); }, [image]);
  const openReview = async (id: string) => {
    transferred.current = image;
    try { await analyzed(id, image ?? undefined); }
    catch (error) { transferred.current = null; throw error; }
  };
  const recognize = useCallback(async (uri: string) => {
    if (!nativeBridge) throw new Error('기기 내 OCR은 iOS 개발 빌드에서 사용할 수 있어요.');
    const result = await nativeBridge.recognizeText(uri);
    if (!mounted.current) return;
    setText(result.text); setFingerprint(result.fingerprint);
    const analyses = await repository.listAnalyses();
    if (!mounted.current) return;
    setHasPrevious(analyses.some(item => item.image_fingerprint === result.fingerprint));
    if (!result.text.trim()) Alert.alert('글자를 찾지 못했어요', '더 선명한 이미지를 선택해 주세요.');
  }, [repository]);
  useEffect(() => {
    if (!initialImage) return;
    working.current = true; setBusy(true);
    void recognize(initialImage).catch(error => {
      if (mounted.current) Alert.alert('공유한 이미지를 읽지 못했어요', error instanceof Error ? error.message : '이미지를 다시 공유해 주세요.');
    }).finally(() => {
      working.current = false;
      if (mounted.current) setBusy(false);
    });
  }, [initialImage, recognize]);
  const select = async (source: 'photo' | 'clipboard') => {
    if (working.current) return;
    draftVersion.current++;
    working.current = true; setBusy(true);
    try {
      if (!nativeBridge) throw new Error('기기 내 OCR은 iOS 개발 빌드에서 사용할 수 있어요.');
      let uri: string;
      if (source === 'clipboard') {
        const pasted = await nativeBridge.pasteClipboardImage?.();
        if (!pasted) throw new Error('붙여넣을 수 있는 이미지가 없어요. 사진을 다시 복사하고 iOS에서 붙여넣기를 허용해 주세요.');
        uri = pasted;
      } else {
        const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
        if (picked.canceled) return;
        const asset = picked.assets[0];
        if ((asset.fileSize ?? 0) > 20 * 1024 * 1024) { discardTemporaryImage(asset.uri); throw new Error('20MB 이하 이미지를 선택해 주세요.'); }
        uri = await ownTemporaryImage(asset.uri);
      }
      if (!mounted.current) { discardTemporaryImage(uri); return; }
      // Commit a new draft only after a real selection. Cancelling preserves edits;
      // a different image must never inherit the previous conversation's date.
      setText(''); setFingerprint(null); setHasPrevious(false); setMessageDate('');
      setImage(uri);
      await recognize(uri);
    } catch (error) {
      if (mounted.current) Alert.alert(source === 'clipboard' ? '이미지를 붙여넣지 못했어요' : '사진을 읽지 못했어요', error instanceof Error ? error.message : '다시 시도해 주세요.');
    } finally { working.current = false; if (mounted.current) setBusy(false); }
  };
  type Reanalysis = { id: string; status: Analysis['status']; taskIds: string[] };
  const analyze = async (reanalyze?: Reanalysis) => {
    if (!fingerprint) return;
    let analysisId: string | undefined;
    let token: string | null = null;
    try {
      if (messageDate.trim()) validateDue(messageDate.trim(), 'date');
      if (containsSensitiveText(text)) throw new Error('민감한 정보가 있는 글자는 분석하지 않아요. 필요한 할 일을 직접 입력해 주세요.');
      const result = reanalyze ? { id: reanalyze.id, created: false, token: null } : await repository.createAnalysis(fingerprint, 'manual', null);
      analysisId = result.id;
      token = result.token;
      if (!result.created) {
        const previous = (await repository.listAnalyses()).find(item => item.id === result.id);
        if (reanalyze) {
          token = await repository.restartUnstoredAnalysis(result.id, false, reanalyze);
        }
        else if (previous?.status === 'failed') token = await repository.retryFailedAnalysis(result.id);
        else if (previous?.status === 'processing' || previous?.status === 'queued') { Alert.alert('이미 분석 중이에요', '잠시 후 분석함에서 결과를 확인해 주세요.'); return; }
        else { await openReview(result.id); return; }
      }
      if (!token) throw new Error('분석 상태가 변경되었어요. 다시 시도해 주세요.');
      nativeBridge?.clearCaptureNotification(result.id);
      if (!nativeBridge) throw new Error('iOS 개발 빌드에서 사용할 수 있어요.');
      let semiAutomatic = nativeBridge.localAIAvailability() !== 'available';
      let tasks;
      try {
        tasks = semiAutomatic ? validateExtraction(JSON.parse(nativeBridge.ocrCandidates(text)), text, 'ocr') : await onDeviceProvider.extract({ text, captured_at: null, message_date: messageDate.trim() || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, new AbortController().signal);
      } catch (error) {
        if (nativeBridge.localAIAvailability() === 'available') throw error;
        semiAutomatic = true;
        tasks = validateExtraction(JSON.parse(nativeBridge.ocrCandidates(text)), text, 'ocr');
      }
      await repository.finishAnalysis(result.id, tasks, semiAutomatic ? 'vision-ocr/manual-v1' : onDeviceProvider.version, token);
      await openReview(result.id);
    } catch (error) {
      if (analysisId && token) await repository.failAnalysis(analysisId, 'LOCAL_AI_FAILED', token).catch(() => {});
      Alert.alert('분석하지 못했어요', error instanceof Error ? error.message : '기기 내 AI 준비 상태를 확인하고 다시 시도해 주세요.');
    }
  };
  const requestAnalysis = (reanalyze?: Reanalysis, grantConsent = false, version = draftVersion.current): Promise<void> => requestCaptureAnalysis({
    working, setBusy,
    readConsent: () => repository.getPreference('ai_local_consent'),
    writeConsent: () => repository.setPreference('ai_local_consent', 'yes'),
    isCurrent: () => draftVersion.current === version,
    analyze: () => { draftVersion.current++; return analyze(reanalyze); },
    // Waiting for an alert response holds no work lock, including cancellation.
    prompt: () => {
      const take = confirmation.capture();
      const semiAutomatic = nativeBridge?.localAIAvailability() !== 'available';
      Alert.alert(semiAutomatic ? '기기 내 분석과 원문 보관에 동의할까요?' : '기기 안에서 AI로 분석할까요?', semiAutomatic ? '기기 내 OCR·AI 분석과 검토용 원문 보관에 동의해요. 현재는 AI를 사용할 수 없어 OCR 글자를 직접 선택해요. 외부 서버로 보내지 않으며 원문은 7일이 지난 뒤 앱 실행·확인 때 정리해요. 설정에서 동의를 철회할 수 있고, 선택하고 저장하기 전에는 할 일을 만들지 않아요.' : '외부 AI 서버로 이미지나 글자를 보내지 않아요. 승인할 항목을 확인하기 위해 원문 근거 문장을 저장하고, 7일이 지난 내용은 다음 앱 실행·확인 때 정리해요. 모델의 정확도는 아직 검증 중이며, 저장 전 직접 확인해야 해요.', [{ text: '취소', style: 'cancel', onPress: () => { take(); } }, { text: semiAutomatic ? '동의하고 검토' : '동의하고 분석', onPress: () => { if (take()) void requestAnalysis(reanalyze, true, version).catch(() => Alert.alert('설정하지 못했어요', '다시 시도해 주세요.')); } }]);
    },
  }, grantConsent);
  const confirmReanalysis = async () => {
    if (working.current || !fingerprint) return;
    working.current = true; setBusy(true);
    const version = draftVersion.current;
    const take = confirmation.capture();
    try {
      const snapshot = await repository.reanalysisSnapshot(fingerprint);
      if (version !== draftVersion.current) return;
      Alert.alert('다시 분석할까요?', '이 캡처의 미저장 제안과 수정 내용을 지우고 새로 분석해요. 저장한 기록이 있으면 재분석하지 않아요.', [{ text: '취소', style: 'cancel', onPress: () => { take(); } }, { text: '다시 분석', style: 'destructive', onPress: () => { if (take()) void requestAnalysis(snapshot, false, version).catch(() => Alert.alert('분석을 시작하지 못했어요', '잠시 후 다시 시도해 주세요.')); } }]);
    } catch (error) { Alert.alert('분석 기록을 확인하지 못했어요', error instanceof Error ? error.message : '다시 시도해 주세요.'); }
    finally { working.current = false; setBusy(false); }
  };
  return <Modal animationType="slide" onRequestClose={closeIfIdle}><SafeAreaView style={ui.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={ui.body} keyboardShouldPersistTaps="handled">
    <Text dynamicTypeRamp="caption2" style={ui.eyebrow}>CAPTURE TO TASK</Text><Text accessibilityRole="header" dynamicTypeRamp="largeTitle" style={ui.title}>{initialImage ? '공유한 이미지 가져오기' : '캡처 속 할 일'}</Text><Text style={ui.subtitle}>선택한 이미지에서 기기 안에서 글자를 읽어요. 선택·검토 화면을 닫으면 임시 이미지를 삭제해요. 앱이 중단된 경우 다음 실행 때 남은 임시 파일을 정리해요.</Text>
    <Button title={busy ? '처리 중…' : '사진에서 선택'} onPress={() => void select('photo')} disabled={busy} />
    {nativeBridge?.pasteClipboardImage && <Button secondary title="클립보드 이미지 붙여넣기" onPress={() => void select('clipboard')} disabled={busy} />}
    {image && <Image source={{ uri: image }} style={{ height: 240, borderRadius: 16, backgroundColor: '#E4E8EE' }} resizeMode="contain" accessibilityLabel="선택한 캡처 이미지" />}
    {fingerprint !== null && <View style={ui.card}><Text style={ui.label}>기기에서 인식한 글자</Text><TextInput accessibilityLabel="인식된 글자" style={[ui.input, { minHeight: 150 }]} multiline editable={!busy} value={text} onChangeText={value => { draftVersion.current++; setText(value); }} />{containsSensitiveText(text) && <Text style={[ui.subtitle, ui.danger]}>민감한 정보가 감지되었어요. 이 내용은 기기 내 AI로도 분석하지 않아요. 필요한 할 일은 직접 입력해 주세요.</Text>}</View>}
    <View style={ui.card}><Text style={ui.section}>무료 기기 내 AI · 실험 중</Text><Text style={ui.subtitle}>{availabilityLabels[aiStatus] ?? availabilityLabels.unavailable}</Text><Text style={ui.small}>{aiStatus !== 'available' ? 'AI를 쓸 수 없을 때는 인식한 글자를 탭하고 제목·날짜를 수정한 뒤 저장할 수 있어요. AI 제안이 아니며 선택 전에는 저장하지 않아요.' : '인터넷 API 없이 Apple의 기기 내 모델을 사용해요.'}</Text><Text style={ui.small}> 한국어 정확도는 실제 기기에서 검증해야 해요.</Text><TextInput accessibilityLabel="원문 메시지 기준 날짜 YYYY-MM-DD" style={ui.input} placeholder="대화 기준 날짜 YYYY-MM-DD (선택)" editable={!busy} value={messageDate} onChangeText={value => { draftVersion.current++; setMessageDate(value); }} maxLength={10} keyboardType="numbers-and-punctuation" /><Text style={ui.small}>캡처 날짜와 대화 날짜는 다를 수 있어요. 기준 날짜가 없으면 ‘내일’ 같은 날짜를 확정하지 않아요.</Text><Button title={busy ? '처리 중…' : aiStatus === 'available' ? '기기 내 AI로 할 일 찾기' : '인식한 글자에서 직접 선택'} disabled={busy || !text.trim() || !fingerprint} onPress={() => void requestAnalysis().catch(() => Alert.alert('설정을 확인하지 못했어요', '다시 시도해 주세요.'))} /></View>
    {hasPrevious && <View style={ui.card}><Text style={ui.small}>이 사진은 이전 분석 기록이 있어요. 한 번도 저장하지 않은 캡처만 다시 분석할 수 있어요. 저장한 할 일은 목록에서 직접 수정해 주세요.</Text><Button secondary title="이 사진 다시 분석" disabled={busy || !text.trim()} onPress={() => void confirmReanalysis()} /></View>}
    <Button secondary title="닫기" disabled={busy} onPress={closeIfIdle} />
  </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}
