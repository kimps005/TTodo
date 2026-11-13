# 개발 현황

기준일: 2026-11-13 (한국 시간)

## 출시 차단 항목
- Apple Developer Team, 최종 Bundle ID / App Group, EAS 프로젝트 연결과 서명 필요.
- Windows에 Xcode/Swift가 없어 iOS 네이티브 빌드와 실기기 검증은 별도 macOS 빌드 및 iPhone이 필요.
- 인증 없는 잠금화면 텍스트 입력·저장과 앱 강제 종료 조건은 실제 iPhone 검증 전까지 미완료.
- Apple 공식 검색 결과에서 iOS 27 스크린샷 저장 자동화 트리거 존재 확인. 실제 이미지 전달과 잠금 실행은 미검증이며 자동 지원으로 홍보하지 않음.
- AI 제공자·서버·개인정보 처리방침·지원 이메일·앱 아이콘·스토어 자료 확정 필요.

## 원칙
로컬 기능과 네이티브 기술 검증부터 구현한다. 계정 없는 사용과 수동 입력을 AI 설정에 종속시키지 않는다.

## 구현 및 로컬 검증
- Expo SDK 58 공식 TypeScript 템플릿, React Native 0.88 기반.
- SQLite v1 스키마, CRUD, 오늘/지난 마감/미지정/미래/완료 정렬, 승인 트랜잭션과 중복 방지 구현.
- 홈, 할 일 편집, 분석함, 제안 검토, 설정 및 데이터 내보내기/삭제 UI 구현.
- AI 제공자 인터페이스, 원문 근거·날짜·신뢰도 응답 검증, 민감 텍스트 전송 제한 검사 구현. 실제 모델은 미선정/미연결.
- `npm test`: 실제 SQLite 기반 테스트 포함 9개 통과. `npm run typecheck`: 통과.
- Expo 전이 의존성 minimatch 취약점을 해당 의존성 범위의 override로 수정. 설치 시 보안 경고 0개.
- UI는 아직 iPhone에서 실행·시각 검증하지 않음. 네이티브 공유 저장소 없이는 iOS에서 별도 DB를 생성하지 않고 개발 빌드 필요 안내.
- App Group SQLite, 잠금 이후 접근 정책(재부팅 후 최초 인증 필요), AddTodo App Intent, Vision 한국어/영어 OCR, WidgetKit 및 Live Activity 코드 구현.
- Expo autolinking에서 `TTodoNativeModule` 인식 확인. Xcode 프로젝트 타깃·소스 연결과 재적용 중복 방지 테스트 추가: 전체 10개 테스트 통과.
- Windows에서는 Expo iOS prebuild가 지원되지 않음. GitHub macOS CI에서 iOS 생성·Pods·앱과 확장 컴파일을 검증하도록 구성. 아직 결과 확인 전.
- Windows Hermes 실행 오류의 원인: 운영체제 애플리케이션 제어 정책이 `hermesc.exe`를 차단. 보안 정책을 변경하지 않고, 로컬 JS 번들 검사와 CI의 실제 Hermes 빌드를 구분한다.
- 로컬 iOS JavaScript 번들 검사 통과. 첫 GitHub CI core 작업에서 타입·테스트·보안·실제 Hermes 바이트코드 모두 통과.
- 첫 macOS CI에서 iOS 생성과 Pods 성공 후 위젯 소스 경로 오류 발견: Xcode 라이브러리가 생략된 그룹 경로를 `undefined`로 직렬화. 경로를 명시하고 회귀 검사 추가, 재빌드 예정.
