import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { nativeBridge } from '../native/bridge';
import { runFixtureEvaluation, evalFixtures, evaluationConsoleSummary, type FixtureEvaluationReport } from '../ai/fixtureEvaluation';
import { serializeEvaluationReport, type EvaluationExportFormat } from '../ai/evaluationExport';
import { EvaluationReport } from './EvaluationReport';
import { onDeviceProvider, availabilityLabels } from '../ai/onDeviceProvider';
import { Button } from '../ui/components';
import { ui } from '../ui/theme';
import { shareTemporaryExport } from '../data/shareTemporaryExport';

export function ModelEvaluation({ close }: { close: () => void }) {
  const [progress, setProgress] = useState('아직 평가하지 않았어요.');
  const [evaluationResult, setEvaluationResult] = useState<FixtureEvaluationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const exporting = useRef(false);
  const [sharing, setSharing] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);
  const run = async () => {
    if (controller.current || exporting.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setEvaluationResult(null);
    setProgress('모델 상태 확인 중');
    try {
      const result = await runFixtureEvaluation(
        onDeviceProvider,
        () => nativeBridge?.localAIAvailability() ?? 'missing_native',
        abort.signal,
        (done, total) => setProgress(`${done} / ${total}개 처리`),
      );
      setEvaluationResult(result);
      if (__DEV__) console.info('TTodo Eval', JSON.stringify(evaluationConsoleSummary(result)));
      setProgress(result.status === 'SKIPPED_UNAVAILABLE'
        ? availabilityLabels[result.availability] ?? availabilityLabels.unavailable
        : `${result.results.length}개 처리 · ${result.results.filter(row => row.error).length}개 오류`);
    } catch { Alert.alert('평가가 중단되었어요', '기기 내 모델 상태를 확인한 뒤 다시 시도해 주세요.'); }
    finally { controller.current = null; setBusy(false); }
  };
  const exportReport = async (format: EvaluationExportFormat) => {
    if (!evaluationResult || exporting.current || controller.current) return;
    exporting.current = true; setSharing(true);
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error();
      const file = new File(Paths.cache, 'TTodo-model-evaluation.' + format);
      const report = serializeEvaluationReport(evaluationResult, format, nativeBridge?.systemVersion());
      const options = format === 'json'
        ? { mimeType: 'application/json', UTI: 'public.json' }
        : { mimeType: 'text/markdown', UTI: 'public.plain-text' };
      const result = await shareTemporaryExport({
        write: async () => { file.create({ overwrite: true }); await file.write(report); },
        share: () => Sharing.shareAsync(file.uri, options),
        remove: () => { if (file.exists) file.delete(); },
      });
      if (!result.cleaned) Alert.alert('임시 파일을 정리하지 못했어요', '남은 평가 파일은 다음 앱 실행 때 다시 정리해요.');
    } catch { Alert.alert('평가 파일을 내보내지 못했어요', '다시 시도해 주세요.'); }
    finally { exporting.current = false; setSharing(false); }
  };
  return <Modal animationType="slide" onRequestClose={() => { if (!busy && !exporting.current) close(); }}><SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.body}>
    <Text dynamicTypeRamp="caption2" style={ui.eyebrow}>DEVELOPMENT ONLY</Text><Text accessibilityRole="header" dynamicTypeRamp="largeTitle" style={ui.title}>한국어 AI 평가</Text><Text style={ui.subtitle}>합성 문장 {evalFixtures.cases.length}개만 사용해요. 개인 캡처와 할 일은 읽거나 저장하지 않고, 외부 API도 호출하지 않아요.</Text>
    <Text style={ui.small}>고정 어휘와 원문 범위로 일대일 자동 채점해요. 같은 의미의 다른 표현도 오답일 수 있어 사람이 함께 검토해야 해요. 누락된 할 일의 명시 마감도 날짜 정확도 분모에 포함해요. 글자가 없는 사례는 AI 호출 없이 빈 결과로 처리해요.</Text>
    <Text accessibilityLiveRegion="polite" style={ui.section}>{progress}</Text>
    {evaluationResult && <EvaluationReport report={evaluationResult} />}<Button title="합성 데이터로 기기 내 AI 평가" disabled={busy || sharing} onPress={() => void run()} />
    <Button secondary title="현재 분석 종료 후 중단" disabled={!busy} onPress={() => controller.current?.abort()} />
    <Button secondary title="Markdown 리포트 내보내기" disabled={busy || sharing || !evaluationResult} onPress={() => void exportReport('md')} />
    <Button secondary title="JSON 리포트 내보내기" disabled={busy || sharing || !evaluationResult} onPress={() => void exportReport('json')} />
    <Button secondary title="닫기" disabled={busy || sharing} onPress={close} />
  </ScrollView></SafeAreaView></Modal>;
}
