<!-- {% raw %} -->
# TTodo App Store 제출 자료

## 스토어 등록 문구

| 항목 | 초안 |
| --- | --- |
| 앱 이름 후보 | TTodo |
| 부제 | 잠금화면에서 시작하는 할 일 |
| 소개 문구 | 생각난 할 일은 바로 적고, 화면 속 할 일은 사진에서 찾아 필요한 항목만 저장하세요. |
| 번들 ID | `{{BUNDLE_ID}}` |
| 개인정보 처리방침 URL | [개인정보 처리방침](PRIVACY-POLICY.md)의 공개 HTTPS 주소 |
| 지원 URL | [TTodo 지원](SUPPORT.md)의 공개 HTTPS 주소 |
| 심사 연락처 이메일 | `{{SUPPORT_EMAIL}}` |

### 앱 설명

TTodo는 생각난 할 일과 스크린샷 속 할 일을 한곳에서 정리하는 iPhone 앱입니다.

- 할 일을 직접 추가하고 마감일을 수정하거나 완료 처리하세요. 수동 입력은 오프라인에서도 동작합니다.
- 잠금화면 위젯으로 남은 할 일을 확인하고, 지원 환경에서는 단축어로 빠르게 입력하세요. 잠금화면에 표시할 내용도 선택할 수 있습니다.
- 사진을 선택하거나 공유 메뉴로 가져오면 Apple Vision이 기기에서 글자를 읽습니다. Apple 기기 내 모델을 사용할 수 있는 환경에서는 할 일 후보를 검토하고, 제목과 마감일을 고쳐 원하는 항목만 저장할 수 있습니다.
- 앱에서 분석 동의를 철회하거나 앱 데이터를 삭제할 수 있습니다. TTodo는 사진이나 분석 원문을 외부 AI 서버로 전송하지 않습니다.

## App Privacy 응답 가이드

| App Store Connect 항목 | 제출 빌드 점검 및 응답 |
| --- | --- |
| 데이터 수집 | 앱·위젯·공유 확장과 포함된 SDK에 개발자 또는 제3자가 접근할 수 있는 기기 외부 수집 경로가 없음을 확인한 경우 **데이터를 수집하지 않음(No Data Collected)**을 선택합니다. |
| 사용자 콘텐츠 | 할 일, 사진·스크린샷, OCR 텍스트와 AI 제안의 처리가 기기 내에만 머무르면 사용자 콘텐츠 수집 항목에 추가하지 않습니다. |
| 사용 목적 및 사용자 연결 | 수집 데이터가 없다는 응답을 확인한 경우 목적과 사용자 연결 여부를 신고할 수집 항목이 없습니다. |
| 추적 | 앱과 포함된 SDK에 추적이 없음을 확인한 뒤 추적용 데이터를 신고하지 않습니다. |
| 지원 및 오류 신고 | 지원 페이지의 이메일로 사용자가 직접 문의하는 흐름을 기준으로 작성했습니다. 제출 빌드에 앱 내부 신고·첨부 전송, 원격 진단이나 분석 도구가 들어가면 전송 데이터, 접근 주체, 보존과 목적을 확인한 뒤 라벨과 정책을 다시 작성합니다. |

위 답변은 출시 후보 빌드 확인을 전제로 한 가이드입니다. 앱과 확장에 포함된 개인정보 선언, SDK, 실제 데이터 전송 경로를 대조한 뒤 App Store Connect에 등록합니다.

## 심사 노트 / Review Notes

No account or sign-in is required. Start by opening TTodo once. Manual task entry works offline. Image analysis requires in-app consent and runs on the device.

### Test 1. Lock Screen quick entry

1. In TTodo settings, open the Lock Screen quick-add guidance. In Apple Shortcuts, create a shortcut with **Ask for Input**, set the input type to **Text**, and add TTodo's add-task action. Pass the input result into the task text field. The app intent is `AddTodoIntent`.
2. In Lock Screen customization, assign the saved shortcut to a Shortcuts control. To test a genuinely locked state, unlock the phone once, lock it again, and avoid triggering Face ID during the test.
3. Run the shortcut from the Lock Screen. Enter “Review tomorrow's checklist” and confirm. Record whether the prompt and save complete while the phone remains locked and TTodo stays in the background. Open TTodo afterward and confirm the task appears exactly once.
4. Run the shortcut again and cancel the prompt. Confirm that no additional task appears. Repeat with Airplane Mode enabled to verify offline storage. If iOS requests authentication or opens the app during entry, record the device model and iOS version as a failed locked-state check.

### Test 2. Photos share extension

1. Use an image with sample text such as “내일까지 회의 자료를 이메일로 보내 주세요.” Open it in Photos, tap **Share**, and select **TTodo**.
2. If analysis consent is off, confirm that processing is blocked. Open the app, enable analysis in settings, and share the image again.
3. On a supported iPhone with Apple Intelligence enabled and the on-device model available, check the proposed task against the recognized text. Select the task, edit its title if desired, and save it. Open TTodo and confirm that only the approved task appears. On a device where the model is unavailable, use the OCR text-selection flow to create and confirm the task manually.

## 제출 전 확인

- 앱 이름 후보를 확정하고 운영자, 지원 이메일, 시행일, 번들 ID 플레이스홀더를 치환합니다. 개인정보 처리방침과 지원 문서를 정적 호스팅에 게시하고 공개 HTTPS 주소를 등록합니다.
- 서명된 제출 후보를 실제 iPhone에 설치해 잠금화면에서 인증 없이 입력·저장되는지, 공유 확장에서 동의·분석·승인이 동작하는지, 캡처 자동화가 의도한 이미지를 전달하는지 확인합니다. 현재 확인 범위는 CI와 시뮬레이터이며 실기기 통과 여부는 미확정입니다.
- 실제 기기 내 모델의 한국어 할 일 식별과 마감일 추출 정확도를 측정하고 지원 기기·iOS·언어 범위를 확정합니다. 결과를 심사 노트의 재현 조건과 스토어 문구에 반영합니다.
<!-- {% endraw %} -->
