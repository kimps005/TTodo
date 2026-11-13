import { useEffect, useState } from 'react';
import { File } from 'expo-file-system';
import { Alert, Image, Modal, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { nativeBridge } from '../native/bridge';
import { containsSensitiveText } from '../ai/extraction';
import { Button } from './components';
import { ui } from './theme';
export function Capture({ close }: { close: () => void }) {
  const [image, setImage] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => () => { if (image) { const file = new File(image); if (file.exists) file.delete(); } }, [image]);
  const select = async () => {
    setBusy(true); setText('');
    try {
      if (!nativeBridge) throw new Error('기기 내 OCR은 iOS 개발 빌드에서 사용할 수 있어요.');
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
      if (picked.canceled) return;
      const asset = picked.assets[0];
      if ((asset.fileSize ?? 0) > 20 * 1024 * 1024) throw new Error('20MB 이하 이미지를 선택해 주세요.');
      setImage(asset.uri);
      setText((await nativeBridge.recognizeText(asset.uri)).text);
    } catch (error) { Alert.alert('사진을 읽지 못했어요', error instanceof Error ? error.message : '다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  return <Modal animationType="slide" onRequestClose={close}><SafeAreaView style={ui.screen}><ScrollView contentContainerStyle={ui.body} keyboardShouldPersistTaps="handled">
    <Text style={ui.eyebrow}>CAPTURE TO TASK</Text><Text style={ui.title}>캡처 속 할 일</Text><Text style={ui.subtitle}>선택한 이미지에서 기기 안에서 글자를 읽어요. 이미지와 인식한 글자는 이 화면을 닫으면 보관하지 않아요.</Text>
    <Button title={busy ? '글자를 읽는 중…' : '사진에서 선택'} onPress={() => void select()} disabled={busy} />
    {image && <Image source={{ uri: image }} style={{ height: 240, borderRadius: 16, backgroundColor: '#E4E8EE' }} resizeMode="contain" accessibilityLabel="선택한 캡처 이미지" />}
    {!!text && <View style={ui.card}><Text style={ui.label}>기기에서 인식한 글자</Text><TextInput accessibilityLabel="인식된 글자" style={[ui.input, { minHeight: 150 }]} multiline value={text} onChangeText={setText} />{containsSensitiveText(text) && <Text style={[ui.subtitle, ui.danger]}>민감한 정보가 감지되었어요. 외부 AI 전송을 제한해야 하는 내용이에요.</Text>}</View>}
    <View style={ui.card}><Text style={ui.section}>AI 연결 준비 중</Text><Text style={ui.subtitle}>한국어 평가를 거친 AI 모델과 개인정보 처리 경로를 확정한 뒤 할 일 추출을 연결할 예정이에요. 현재는 외부 서버로 전송하지 않아요.</Text></View>
    <Button secondary title="닫기" disabled={busy} onPress={close} />
  </ScrollView></SafeAreaView></Modal>;
}
