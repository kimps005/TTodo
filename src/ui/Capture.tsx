import { useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { nativeBridge } from '../native/bridge';
import { containsSensitiveText } from '../ai/extraction';
import { Button } from './components';
import { ui } from './theme';
import { discardTemporaryImage, ownTemporaryImage } from '../data/temporaryFiles';
import type { Repository } from '../data/repository';
import { availabilityLabels, onDeviceProvider } from '../ai/onDeviceProvider';
import { validateDue } from '../domain/todo';
export function Capture({ close, repository, analyzed }: { close: () => void; repository: Repository; analyzed: (id: string, imageUri?: string) => Promise<void> }) {
  const [image, setImage] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [messageDate, setMessageDate] = useState('');
  const [hasPrevious, setHasPrevious] = useState(false);
  const working = useRef(false);
  const transferred = useRef<string | null>(null);
  useEffect(() => () => { if (image && transferred.current !== image) discardTemporaryImage(image); }, [image]);
  const openReview = async (id: string) => {
    transferred.current = image;
    try { await analyzed(id, image ?? undefined); }
    catch (error) { transferred.current = null; throw error; }
  };
  const select = async () => {
    if (working.current) return;
    working.current = true; setBusy(true);
    try {
      if (!nativeBridge) throw new Error('기기 내 OCR은 iOS 개발 빌드에서 사용할 수 있어요.');
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if ((asset.fileSize ?? 0) > 20 * 1024 * 1024) { discardTemporaryImage(asset.uri); throw new Error('20MB 이하 이미지를 선택해 주세요.'); }
      const uri = await ownTemporaryImage(asset.uri);
      // Commit a new draft only after a real selection. Cancelling preserves edits;
      // a different image must never inherit the previous conversation's date.
      setText(''); setFingerprint(null); setHasPrevious(false); setMessageDate('');
      setImage(uri);
      const result = await nativeBridge.recognizeText(uri);
      setText(result.text); setFingerprint(result.fingerprint);
      setHasPrevious((await repository.listAnalyses()).some(item => item.image_fingerprint === result.fingerprint));
      if (!result.text.trim()) Alert.alert('글자를 찾지 못했어요', '더 선명한 이미지를 선택해 주세요.');
    } catch (error) { Alert.alert('사진을 읽지 못했어요', error instanceof Error ? error.message : '다시 시도해 주세요.'); }
    finally { working.current = false; setBusy(false); }
  };
  const analyze = async (reanalyze = false) => {
    if (working.current || !fingerprint) return;
    working.current = true; setBusy(true);
    let analysisId: string | undefined;
    let token: string | null = null;
    try {
      if (messageDate.trim()) validateDue(messageDate.trim(), 'date');
      if (containsSensitiveText(text)) throw new Error('민감한 정보가 있는 글자는 분석하지 않아요. 필요한 할 일을 직접 입력해 주세요.');
      if (Array.from(text).length > 3500) throw new Error('기기 내 AI는 3,500자 이하를 분석해요. 필요한 부분만 남겨 주세요.');
      const result = await repository.createAnalysis(fingerprint, 'manual', null);
      analysisId = result.id;
      token = result.token;
      if (!result.created) {
        const previous = (await repository.listAnalyses()).find(item => item.id === result.id);
        if (reanalyze) token = await repository.restartUnstoredAnalysis(result.id);
        else if (previous?.status === 'failed') token = await repository.retryFailedAnalysis(result.id);
        else if (previous?.status === 'processing' || previous?.status === 'queued') { Alert.alert('이미 분석 중이에요', '잠시 후 분석함에서 결과를 확인해 주세요.'); return; }
        else { await openReview(result.id); return; }
      }
      if (!token) throw new Error('분석 상태가 변경되었어요. 다시 시도해 주세요.');
      nativeBridge?.clearCaptureNotification(result.id);
      const tasks = await onDeviceProvider.extract({ text, captured_at: null, message_date: messageDate.trim() || null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }, new AbortController().signal);
      await repository.finishAnalysis(result.id, tasks, onDeviceProvider.version, token);
      await openReview(result.id);
    } catch (error) {
      if (analysisId && token) await repository.failAnalysis(analysisId, 'LOCAL_AI_FAILED', token).catch(() => {});
      Alert.alert('분석하지 못했어요', error instanceof Error ? error.message : '기기 내 AI 준비 상태를 확인하고 다시 시도해 주세요.');
    } finally { working.current = false; setBusy(false); }
  };
  const requestAnalysis = async (reanalyze = false) => {
    if (await repository.getPreference('ai_local_consent') === 'yes') { await analyze(reanalyze); return; }
    Alert.alert('기기 안에서 AI로 분석할까요?', '외부 AI 서버로 이미지나 글자를 보내지 않아요. 승인할 항목을 확인하기 위해 원문 근거 문장을 저장하고, 7일이 지난 내용은 다음 앱 실행·확인 때 정리해요. 모델의 정확도는 아직 검증 중이며, 저장 전 직접 확인해야 해요.', [{ text: '취소', style: 'cancel' }, { text: '동의하고 분석', onPress: () => { void repository.setPreference('ai_local_consent', 'yes').then(() => analyze(reanalyze)).catch(() => Alert.alert('설정하지 못했어요', '다시 시도해 주세요.')); } }]);
  };
  const aiStatus = nativeBridge?.localAIAvailability() ?? 'missing_native';
  return <Modal animationType="slide" onRequestClose={() => { if (!working.current) close(); }}><SafeAreaView style={ui.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={ui.body} keyboardShouldPersistTaps="handled">
    <Text dynamicTypeRamp="caption2" style={ui.eyebrow}>CAPTURE TO TASK</Text><Text accessibilityRole="header" dynamicTypeRamp="largeTitle" style={ui.title}>캡처 속 할 일</Text><Text style={ui.subtitle}>선택한 이미지에서 기기 안에서 글자를 읽어요. 선택·검토 화면을 닫으면 임시 이미지를 삭제해요. 앱이 중단된 경우 다음 실행 때 남은 임시 파일을 정리해요.</Text>
    <Button title={busy ? '글자를 읽는 중…' : '사진에서 선택'} onPress={() => void select()} disabled={busy} />
    {image && <Image source={{ uri: image }} style={{ height: 240, borderRadius: 16, backgroundColor: '#E4E8EE' }} resizeMode="contain" accessibilityLabel="선택한 캡처 이미지" />}
    {fingerprint !== null && <View style={ui.card}><Text style={ui.label}>기기에서 인식한 글자</Text><TextInput accessibilityLabel="인식된 글자" style={[ui.input, { minHeight: 150 }]} multiline editable={!busy} value={text} onChangeText={setText} />{containsSensitiveText(text) && <Text style={[ui.subtitle, ui.danger]}>민감한 정보가 감지되었어요. 이 내용은 기기 내 AI로도 분석하지 않아요. 필요한 할 일은 직접 입력해 주세요.</Text>}</View>}
    <View style={ui.card}><Text style={ui.section}>무료 기기 내 AI · 실험 중</Text><Text style={ui.subtitle}>{availabilityLabels[aiStatus] ?? availabilityLabels.unavailable}</Text><Text style={ui.small}>인터넷 API 없이 Apple의 기기 내 모델을 사용해요. 한국어 정확도는 실제 기기에서 검증해야 해요.</Text><TextInput accessibilityLabel="원문 메시지 기준 날짜 YYYY-MM-DD" style={ui.input} placeholder="대화 기준 날짜 YYYY-MM-DD (선택)" editable={!busy} value={messageDate} onChangeText={setMessageDate} maxLength={10} keyboardType="numbers-and-punctuation" /><Text style={ui.small}>캡처 날짜와 대화 날짜는 다를 수 있어요. 기준 날짜가 없으면 ‘내일’ 같은 날짜를 확정하지 않아요.</Text><Button title={busy ? '처리 중…' : '기기 내 AI로 할 일 찾기'} disabled={busy || !text.trim() || !fingerprint || aiStatus !== 'available'} onPress={() => void requestAnalysis().catch(() => Alert.alert('설정을 확인하지 못했어요', '다시 시도해 주세요.'))} /></View>
    {hasPrevious && <View style={ui.card}><Text style={ui.small}>이 사진은 이전 분석 기록이 있어요. 한 번도 저장하지 않은 캡처만 다시 분석할 수 있어요. 저장한 할 일은 목록에서 직접 수정해 주세요.</Text><Button secondary title="이 사진 다시 분석" disabled={busy || !text.trim() || aiStatus !== 'available'} onPress={() => Alert.alert('다시 분석할까요?', '이 캡처의 미저장 제안과 수정 내용을 지우고 새로 분석해요. 저장한 기록이 있으면 재분석하지 않아요.', [{ text: '취소', style: 'cancel' }, { text: '다시 분석', style: 'destructive', onPress: () => { void requestAnalysis(true).catch(() => Alert.alert('분석을 시작하지 못했어요', '잠시 후 다시 시도해 주세요.')); } }])} /></View>}
    <Button secondary title="닫기" disabled={busy} onPress={close} />
  </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}
