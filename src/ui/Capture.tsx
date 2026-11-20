import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyzeCapture, type CaptureResult, type CaptureSnapshot } from '../ai/captureAnalysis';
import { captureAIUnavailable, extractCaptureTask } from '../ai/onDeviceProvider';
import { discardTemporaryImage, ownTemporaryImage } from '../data/temporaryFiles';
import type { Repository } from '../data/repository';
import { nativeBridge } from '../native/bridge';
import { requestCaptureAnalysis } from './captureAction';
import { Button } from './components';
import { CaptureCandidate } from './Review';
import { createReviewConfirmation } from './reviewConfirmation';
import { colors, ui } from './theme';

type Attempt = { uri: string; channel: 'manual' | 'share'; controller: AbortController; working: { current: boolean } };
type Screen = CaptureResult | { kind: 'idle' | 'consent' | 'working' };

export function Capture({ initialImage, close, repository }: { initialImage?: string; close: () => void; repository: Repository }) {
  const [screen, setScreen] = useState<Screen>({ kind: 'idle' });
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inputError, setInputError] = useState('');
  const input = useRef({ uri: initialImage, channel: 'share' as Attempt['channel'] });
  const attempt = useRef<Attempt | null>(null);
  const active = useRef(true);
  const pickerLock = useRef(false);
  const saveLock = useRef(false);
  const confirmation = useRef(createReviewConfirmation()).current;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      attempt.current?.controller.abort();
      confirmation.invalidate();
      if (input.current.uri) discardTemporaryImage(input.current.uri);
    };
  }, [confirmation]);

  const closeCapture = () => {
    if (saveLock.current) return;
    active.current = false;
    attempt.current?.controller.abort();
    confirmation.invalidate();
    close();
  };
  const isCurrent = (job: Attempt) => active.current && attempt.current === job && !job.controller.signal.aborted;

  const requestAnalysis = async (job: Attempt, grantConsent = false, replacement?: CaptureSnapshot) => {
    try {
      await requestCaptureAnalysis({
        working: job.working,
        setBusy: busy => { if (busy && isCurrent(job)) setScreen({ kind: 'working' }); },
        readConsent: () => repository.getPreference('ai_local_consent'),
        writeConsent: () => repository.setPreference('ai_local_consent', 'yes'),
        isCurrent: () => isCurrent(job),
        prompt: () => setScreen({ kind: 'consent' }),
        analyze: async () => {
          if (!nativeBridge) {
            setScreen({ kind: 'status', message: 'iOS 앱 빌드에서 사진을 분석할 수 있어요.' });
            return;
          }
          const bridge = nativeBridge;
          const result = await analyzeCapture({
            repository,
            recognize: () => bridge.recognizeText(job.uri),
            extract: extractCaptureTask,
            unavailable: captureAIUnavailable,
            clearNotification: id => bridge.clearCaptureNotification(id),
            signal: job.controller.signal,
            channel: job.channel,
            replacement,
          });
          if (isCurrent(job)) setScreen(result);
        },
      }, grantConsent);
    } catch {
      if (isCurrent(job)) setScreen({ kind: 'status', message: '사진을 분석하지 못했어요. 다시 시도하거나 필요한 할 일을 직접 입력해 주세요.', retry: true });
    }
  };

  const start = (replacement?: CaptureSnapshot) => {
    const { uri, channel } = input.current;
    if (!active.current || !uri) return;
    attempt.current?.controller.abort();
    confirmation.invalidate();
    const job: Attempt = { uri, channel, controller: new AbortController(), working: { current: false } };
    attempt.current = job;
    setInputError('');
    void requestAnalysis(job, false, replacement);
  };

  const select = async (source: 'photo' | 'clipboard') => {
    if (pickerLock.current || saveLock.current || !active.current) return;
    pickerLock.current = true;
    setPicking(true);
    setInputError('');
    try {
      let uri: string;
      if (source === 'clipboard') {
        const pasted = await nativeBridge?.pasteClipboardImage?.();
        if (!pasted) {
          if (active.current) setInputError('사진을 다시 복사하고 iOS에서 붙여넣기를 허용해 주세요.');
          return;
        }
        uri = pasted;
      } else {
        const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
        if (picked.canceled) return;
        const asset = picked.assets[0];
        if (!active.current) { discardTemporaryImage(asset.uri); return; }
        attempt.current?.controller.abort();
        confirmation.invalidate();
        setScreen({ kind: 'idle' });
        if ((asset.fileSize ?? 0) > 20 * 1024 * 1024) {
          discardTemporaryImage(asset.uri);
          setInputError('20MB 이하 이미지를 선택해 주세요.');
          return;
        }
        uri = await ownTemporaryImage(asset.uri);
      }
      if (!active.current) { discardTemporaryImage(uri); return; }
      const previous = input.current.uri;
      input.current = { uri, channel: 'manual' };
      start();
      if (previous && previous !== uri) discardTemporaryImage(previous);
    } catch {
      if (active.current) setInputError('이미지를 가져오지 못했어요. 다시 시도해 주세요.');
    } finally {
      pickerLock.current = false;
      if (active.current) setPicking(false);
    }
  };

  const confirmReanalysis = async (fingerprint: string) => {
    const job = attempt.current;
    if (!job || !isCurrent(job) || pickerLock.current || saveLock.current) return;
    const take = confirmation.capture();
    try {
      const snapshot = await repository.reanalysisSnapshot(fingerprint);
      if (!isCurrent(job) || !take()) return;
      const respond = confirmation.capture();
      Alert.alert('다시 분석할까요?', '이 사진의 미저장 제안과 수정 내용을 새 분석으로 바꿔요.', [
        { text: '취소', style: 'cancel', onPress: () => { respond(); } },
        { text: '다시 분석', style: 'destructive', onPress: () => { if (isCurrent(job) && respond()) start(snapshot); } },
      ]);
    } catch {
      if (isCurrent(job) && take()) setInputError('분석 기록을 확인하지 못했어요. 다시 시도해 주세요.');
    }
  };

  const reanalyze = 'reanalyze' in screen ? screen.reanalyze : undefined;
  return <Modal animationType="slide" onShow={() => { if (initialImage && !attempt.current && !pickerLock.current) start(); }} onRequestClose={closeCapture}>
    <SafeAreaView style={ui.screen}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={ui.body} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" dynamicTypeRamp="largeTitle" style={ui.title}>캡처 속 할 일</Text>
        <Button title="사진에서 선택" disabled={picking || saving} onPress={() => void select('photo')} />
        {nativeBridge?.pasteClipboardImage && <Button secondary title="클립보드 이미지 붙여넣기" disabled={picking || saving} onPress={() => void select('clipboard')} />}
        {!!inputError && <Text accessibilityLiveRegion="polite" style={ui.subtitle}>{inputError}</Text>}
        {screen.kind === 'consent' && <View style={ui.card}>
          <Text accessibilityRole="header" style={ui.section}>기기 안에서 AI로 분석할까요?</Text>
          <Text style={ui.subtitle}>사진과 글자는 외부 서버로 보내지 않아요. 제안의 원문 근거를 기기에 저장하고 7일이 지나면 다음 앱 실행·확인 때 정리해요. 설정에서 동의를 철회할 수 있어요.</Text>
          <Button title="동의하고 분석" disabled={picking} onPress={() => { if (attempt.current) void requestAnalysis(attempt.current, true); }} />
        </View>}
        {screen.kind === 'working' && <View style={ui.row}><ActivityIndicator color={colors.accent} /><Text accessibilityLiveRegion="polite" style={[ui.subtitle, ui.grow]}>사진에서 할 일을 찾고 있어요…</Text></View>}
        {screen.kind === 'status' && <>
          <Text testID="capture-analysis-status" accessibilityLiveRegion="polite" style={ui.subtitle}>{screen.message}</Text>
          {screen.retry && <Button secondary title="다시 시도" disabled={picking} onPress={() => start()} />}
        </>}
        {screen.kind === 'candidate' && attempt.current && <CaptureCandidate
          key={screen.task.id}
          task={screen.task}
          repository={repository}
          signal={attempt.current.controller.signal}
          disabled={picking}
          onSaving={value => { saveLock.current = value; setSaving(value); if (value) confirmation.invalidate(); }}
          onSaved={closeCapture}
        />}
        {reanalyze && <Button secondary title="이 사진 다시 분석" disabled={picking || saving} onPress={() => void confirmReanalysis(reanalyze)} />}
        <Button secondary title="닫기" disabled={saving} onPress={closeCapture} />
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}
