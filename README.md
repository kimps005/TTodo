# TTodo

잠금화면의 빠른 기록과 캡처 기반 할 일 제안을 목표로 하는 iPhone 앱입니다.
제품 기준은 [PRD](docs/PRD-v1.0.md), 개발 규칙은 [AGENTS.md](AGENTS.md), 실제 진행 상태는 [STATUS](docs/STATUS.md)를 확인하세요.

## 현재 상태

수동 할 일 CRUD, 로컬 SQLite, 제안 승인 트랜잭션, 기본 화면과 개인정보 제어를 구현했습니다.
iOS 공유 저장소, App Intent, Vision OCR, 위젯 및 Live Activity 코드를 추가했습니다.
**출시 가능한 완성 앱이 아닙니다.** 실제 모델·서버 연결, 공유 입력, 캡처 자동화와 실기기 잠금 테스트가 남아 있습니다.
기본 이미지 자산은 Expo 템플릿이며 출시 전 교체합니다.

## 개발

```sh
npm ci
npm run typecheck
npm test
npm start -- --dev-client
```

Node 24 이상을 사용합니다. iOS 네이티브 기능 때문에 Expo Go 대신 development build가 필요합니다.
Windows에서는 iOS prebuild와 Xcode 빌드를 실행하지 않습니다. GitHub Actions의 `ios` 작업 또는 EAS를 사용하세요.
Windows 앱 제어 정책이 Hermes 바이너리를 차단하면 보안 정책을 변경하지 말고 CI에서 실제 바이트코드를 검사합니다.
`npx expo export --platform ios --no-bytecode`는 JavaScript 번들 진단용이며 출시 빌드 성공으로 간주하지 않습니다.

## iPhone 개발 빌드 준비

1. Apple Developer Program과 Expo 계정을 준비합니다.
2. `.env.example`을 참고해 사용할 Bundle ID와 EAS 프로젝트 ID를 확정합니다. 기본 `com.kimps005.ttodo`는 개발 식별자 후보입니다.
3. EAS에 프로젝트를 연결하고 App Group `group.<Bundle ID>`와 위젯 `<Bundle ID>.widgets`를 같은 Apple Team에 등록합니다.
4. `npx eas-cli build --platform ios --profile development`로 실제 기기용 서명 빌드를 만듭니다.
5. 설치 후 [실기기 검증표](docs/DEVICE-QA.md)를 수행합니다.

계정 암호, API 키, 서명 인증서는 저장소·채팅에 붙여 넣지 않습니다. 계정 연결은 각 서비스의 인증 절차를 사용합니다.

## 저장소 구조

- `src/domain`: 입력 검증과 날짜·정렬 정책
- `src/data`: 공유 스키마와 트랜잭션 저장소
- `src/ai`: 교체 가능한 AI 제공자 계약과 응답 검증
- `src/ui`: 한국어 홈·편집·검토·설정 화면
- `modules/ttodo-native`: Swift App Group 저장소, OCR 및 네이티브 브리지
- `native/ios`: 앱 타깃의 App Intent와 위젯 타깃 Swift 소스
- `plugins/with-ttodo-ios.js`: iOS 타깃·공유 설정 생성, TypeScript/Swift 스키마 일치 보장
- `.github/workflows/quality.yml`: 타입·DB 테스트·보안·Hermes·네이티브 컴파일

App Group의 데이터 보호는 `completeUntilFirstUserAuthentication`입니다. 기기 재부팅 후 첫 잠금 해제 전에는 데이터에 접근할 수 없습니다.
이 정책의 개인정보 영향과 잠금 입력 동작은 출시 전 반드시 기기에서 검증해야 합니다.

앱과 확장은 동일 DB를 사용합니다. 잠금화면은 기본적으로 제목을 숨기며, OS 타임라인 예산과 Live Activity 만료 때문에 즉시 갱신이나 상시 표시를 보장하지 않습니다.

## 다음 의사결정

AI 모델은 PRD D-03에 따라 한국어 정답 데이터로 평가한 뒤 선택합니다. 제공 업체, 예산, 서버 운영과 개인정보 동의 문구를 확정하기 전 외부 전송은 활성화하지 않습니다.
