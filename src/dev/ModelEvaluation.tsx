import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { nativeBridge } from '../native/bridge';
import { evaluateProvider } from '../ai/evaluate';
import { onDeviceProvider, availabilityLabels } from '../ai/onDeviceProvider';
import { Button } from '../ui/components';
import { ui } from '../ui/theme';

export function ModelEvaluation({ close }: { close: () => void }) {
  const [progress, setProgress] = useState('아직 평가하지 않았어요.');
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const run = async () => {
    if (controller.current) return;
    const status = nativeBridge?.localAIAvailability() ?? 'missing_native';
    if (status !== 'available') { Alert.alert('평가를 시작할 수 없어요', availabilityLabels[status] ?? availabilityLabels.unavailable); return; }
    const abort = new AbortController(); controller.current = abort; setBusy(true); setReport(null);
    try {
      const result = await evaluateProvider(onDeviceProvider, abort.signal, (done, total) => setProgress(`${done} / ${total}개 처리`));
      setReport(JSON.stringify({ ...result, operating_system: nativeBridge?.systemVersion() }, null, 2));
      setProgress(`${result.results.length}개 처리 · ${result.results.filter(row => row.error).length}개 오류 · ${result.completed ? '평가 실행 완료' : '중단됨'}`);
    } catch { Alert.alert('평가가 중단되었어요', '기기 내 모델 상태를 확인한 뒤 다시 시도해 주세요.'); }
    finally { controller.current = null; setBusy(false); }
  };
  const exportReport = async () => {
    if (!report) return;
    const file = new File(Paths.cache, 'TTodo-model-evaluation.json');
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error();
      file.create({ overwrite: true }); await file.write(report);
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
    } catch { Alert.alert('평가 파일을 내보내지 못했어요', '다시 시도해 주세요.'); }
    finally { if (file.exists) file.delete(); }
  };
  return <Modal animationType="slide" onRequestClose={() => { if (!busy) close(); }}><SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.body}>
    <Text dynamicTypeRamp="caption2" style={ui.eyebrow}>DEVELOPMENT ONLY</Text><Text accessibilityRole="header" dynamicTypeRamp="largeTitle" style={ui.title}>한국어 AI 평가</Text><Text style={ui.subtitle}>합성 문장 24개만 사용해요. 개인 캡처와 할 일은 읽거나 저장하지 않고, 외부 API도 호출하지 않아요.</Text>
    <Text style={ui.small}>이 결과는 제목·날짜·담당을 사람이 대조하기 위한 자료예요. 실행 성공을 정확도 달성으로 판단하지 않아요. 글자가 없는 사례는 AI 호출 없이 빈 결과로 처리해요.</Text>
    <Text style={ui.section}>{progress}</Text><Button title="합성 데이터로 기기 내 AI 평가" disabled={busy} onPress={() => void run()} />
    <Button secondary title="현재 분석 종료 후 중단" disabled={!busy} onPress={() => controller.current?.abort()} />
    <Button secondary title="평가 결과 내보내기" disabled={busy || !report} onPress={() => void exportReport()} />
    <Button secondary title="닫기" disabled={busy} onPress={close} />
  </ScrollView></SafeAreaView></Modal>;
}
