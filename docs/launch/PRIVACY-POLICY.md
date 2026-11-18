<!-- {% raw %} -->
# TTodo 개인정보 처리방침 / Privacy Policy

| 항목 / Item | 내용 / Details |
| --- | --- |
| 운영자 / Operator | `{{OPERATOR_NAME}}` |
| 시행일 / Effective date | `{{EFFECTIVE_DATE}}` |
| 앱 식별자 / Bundle ID | `{{BUNDLE_ID}}` |
| 개인정보 문의 / Privacy contact | `{{SUPPORT_EMAIL}}` |

## 한국어

### 처리하는 정보와 목적

- **할 일 관리** — 직접 입력하거나 승인한 할 일의 제목, 설명, 마감일, 완료 상태를 기기에 저장합니다. 앱, 위젯, 단축어, 공유 확장은 기기 내 공유 저장소를 통해 해당 기능에 필요한 데이터에 접근합니다. 계정 없이 사용하며 TTodo는 할 일을 자체 서버에 저장하거나 기기 간에 동기화하지 않습니다.
- **캡처 분석** — 사용자가 분석에 동의한 경우, 직접 선택하거나 공유한 이미지 또는 사용자가 설정한 단축어가 전달한 이미지를 처리합니다. Apple Vision이 기기에서 문자 인식(OCR)을 수행합니다. 사용 가능한 경우 Apple 기기 내 모델만으로 텍스트에서 할 일 후보와 마감일을 추출합니다. 사진, 스크린샷, OCR 텍스트, 판단 근거 원문을 외부 AI 서버로 전송하지 않습니다. 제안은 검토용이며 사용자가 승인한 항목만 할 일로 저장됩니다.
- **중복 방지와 처리 상태** — 이미지 자체 대신 이미지 지문과 내용이 포함되지 않은 식별자 및 처리 상태를 중복 방지에 사용합니다. 사진과 OCR·원문은 로그에 남기지 않습니다.

### 보존, 동의 철회 및 삭제

- 분석용 이미지의 임시 사본은 처리 후 정리하며 앱에 영구 보관하지 않습니다. 미승인 제안과 관련 원문은 검토 또는 재시도에 필요한 기간 동안만 보관하며, 저장되지 않은 원문은 처리 종료 또는 보존 기한에 따라 삭제합니다. 저장된 할 일은 사용자가 삭제할 때까지 보관합니다.
- 앱 설정에서 분석 동의를 철회할 수 있습니다. 철회 즉시 앱에 남아 있는 미승인 제안과 관련 원문을 삭제하고, 진행 중이던 분석 결과가 뒤늦게 저장되지 않도록 처리 요청을 무효화합니다. 이미 저장한 할 일은 계속 사용할 수 있으며 개별 삭제나 앱 데이터 삭제로 지울 수 있습니다. 수동 입력은 분석 동의 없이도 사용할 수 있습니다.
- 할 일을 개별 삭제하면 해당 할 일과 연결된 제안의 제목, 설명, 근거 원문, 마감일과 담당자 등 본문 정보를 앱 저장소에서 즉시 삭제합니다. 중복 방지용 이미지 지문, 내용이 포함되지 않은 식별자와 처리 상태는 유지합니다. 같은 이미지에서 나온 다른 제안과 다른 할 일은 그대로 보관합니다.
- 앱 설정의 데이터 삭제를 실행하면 앱이 관리하는 할 일과 분석 데이터를 즉시 삭제합니다. 사진 보관함의 원본과 사용자가 내보낸 파일은 해당 위치에서 직접 삭제할 수 있습니다.

### 권한과 잠금화면 표시

이미지는 사용자가 선택하거나 공유하거나 설정한 자동화에서 전달된 경우에만 분석합니다. 알림 권한을 끈 경우에는 앱의 분석함에서 결과를 확인할 수 있습니다. 잠금화면의 할 일 표시를 제목, 개수만 표시, 내용 숨김 중에서 선택할 수 있습니다. 잠금화면 알림에는 분석에 쓰인 대화 원문을 그대로 표시하지 않습니다.

### 문의

개인정보 처리, 동의 철회 또는 데이터 삭제에 관한 문의는 `{{SUPPORT_EMAIL}}`로 보내 주세요.

## English

### Data we process and why

- **Task management.** TTodo stores the titles, descriptions, due dates, and completion status of tasks you enter or approve on your device. The app, widget, Shortcuts actions, and share extension use shared on-device storage to access the data they need. TTodo does not require an account, store tasks on its own servers, or sync tasks between devices.
- **Image analysis.** With your consent, TTodo processes images you select or share, or images passed in by a shortcut you set up. Apple Vision runs optical character recognition (OCR) on your device. When available, TTodo uses only Apple's on-device model to identify possible tasks and due dates in the text. TTodo does not send photos, screenshots, OCR text, or source excerpts to external AI servers. Suggestions are available for review, and only items you approve are saved as tasks.
- **Duplicate prevention and processing status.** TTodo uses image fingerprints, non-content identifiers, and processing status to prevent duplicates. It does not log photos, OCR text, or source excerpts.

### Retention, consent withdrawal, and deletion

- TTodo removes temporary image copies after processing and does not keep permanent copies. It keeps unapproved suggestions and associated source text only as long as needed for review or retry. Unsaved source text is deleted when processing ends or the retention period expires. Saved tasks remain until you delete them.
- You can withdraw consent in the app's settings. TTodo immediately deletes unapproved suggestions and related source text still held by the app, and invalidates pending processing requests so their results cannot be saved later. Previously saved tasks remain available and can be removed individually or through the app's data deletion option. You can enter tasks manually without consenting to analysis.
- When you delete an individual task, TTodo immediately deletes that task and content from its linked suggestion, including its title, description, source excerpt, due date, and assignee. It retains only the image fingerprint, non-content identifiers, and processing status for duplicate prevention. Other tasks and suggestions from the same image are preserved.
- When you use the data deletion option in settings, TTodo immediately deletes the task and analysis data it manages. You can delete originals in your photo library and any files you exported from their respective locations.

### Permissions and Lock Screen visibility

TTodo analyzes only images you select, share, or pass in through an automation you set up. If notifications are disabled, you can review results in the app's analysis inbox. You can choose whether the Lock Screen shows task titles, only a task count, or no task content. Lock Screen notifications do not show verbatim conversation text used for analysis.

### Contact

For questions about privacy, consent withdrawal, or data deletion, email `{{SUPPORT_EMAIL}}`.
<!-- {% endraw %} -->
