# SDK 준비 지연 진단 인계

기준일: 2026-11-17. 사용자는 현재 작업을 마무리하고 새 채팅에서 아래 진단을 이어가도록 요청했다. 진단 방향은 승인됐지만 새 workflow/스크립트 작성이나 실행은 아직 하지 않았다.

## 목적과 범위

앱·Pods 빌드 없이 xcrun 경로 탐색과 시뮬레이터 부팅 전·후 도움말 호출을 분리해 지연 위치를 확인한다. 같은 전체 UI 재실행을 반복하거나 60초 제한을 늘려 통과시키지 않는다. 원인이 확인되면 그 근거로 최소 수정하고 관련 검사를 수행한다.

먼저 AGENTS.md, PRD-v1.0.md, STATUS.md, CI-VALIDATION.md를 읽는다. Windows 파일/CLI와 GitHub macOS CI만 사용하며 사용자의 노트북 UI를 조작하지 않는다.

## 확인된 증거

- 제품 코드 기준: `3fad024`. 이후 현재까지는 문서 변경뿐이다.
- [전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/44048082960): 130개 JS 테스트·타입·보안·Hermes·Swift 저장소/캡처·계약·합성 OCR·앱/확장 빌드 통과.
- [UI 실행](https://github.com/kimps005/TTodo/actions/runs/44048082961): 최신 iOS 26.5의 iPhone 16 Pro 수동 수명주기와 iPhone SE 3세대/최대 글자 흐름은 각각 지정 XCTest 1개 통과, 실패·건너뜀 0.
- 같은 UI 실행의 oldest(iPhone 16 Pro / iOS 26.2 / 23C54)는 두 시도 모두 부팅 뒤 text-size 준비 단계에서 실패. 앱 빌드/XCTest 이전이다.
- 정확한 오류: `simctl ui help failed (status=null, signal=SIGTERM, error=spawnSync xcrun ETIMEDOUT).` `xcrun simctl help ui`에 적용한 제한은 60초다. 지연의 근본 원인은 미확정이다.
- 첫 실패 job/artifact: `133918664768` / `14313180747`. 재실행 job/artifact: `133931509924` / `14315116548`.
- 두 번째 artifact SHA256: `1af24c5b2309e4cdd6d2b090ce9fefd233183c77431fd73e8c7cca70b8a57c02`. 두 번째 결과는 작업 로그와 API 결과로 확인했으며 해당 ZIP은 아직 로컬에 내려받지 않았다.
- 첫 실패 자료는 `artifacts/3fad024/oldest/`에 있다. 보고서·boot.log·simctl-ui-help.txt·failure.png 등을 확인한다. artifacts는 Git에서 제외돼 있다.
- [현재 앱 코드의 서명 없는 iPhoneOS Release](https://github.com/kimps005/TTodo/actions/runs/44052256985)는 `5bcfaee`로 성공했다. 계정·서명·기기 설치 성공은 아니다.

## 권장 진단 설계

1. 기존 `scripts/ui-tests.mjs`, `scripts/ui-simulator-selection.cjs`, `scripts/ui-diagnostic-help.cjs`, `.github/workflows/ui-tests.yml`, `.github/workflows/inspect-ios-sdk.yml`을 확인한다. 기존 SDK 검사 workflow의 알림 설정 조사는 이번 범위에 포함하지 않는다.
2. 앱/Pods 설치 없이 동작하는 별도 CLI 진단을 준비한다. 실제 Xcode/SDK/호스트 버전과 `xcrun --find simctl`의 결과·시간을 기록한다. 반환된 경로를 검증한 뒤 xcrun을 거친 호출과 실제 simctl 실행 파일 직접 호출을 분리한다.
3. 부팅 전·후 각각 `help ui`를 관찰한다. 호출 순서와 캐시/워밍 효과도 기록해, 뒤에 성공한 호출만으로 경로 차이를 원인으로 단정하지 않는다.
4. 각 명령의 시작·경과 시간·종료 코드·신호·오류·stdout/stderr를 별도 파일과 요약 JSON에 남긴다. 실패해도 독립적으로 가능한 진단을 수행하고 원래 실패를 보존한다. 시간 초과와 누락된 도움말을 성공으로 바꾸지 않는다.
5. 설치된 SDK inventory와 기존 선택기로 동일한 iPhone 16 Pro/이전 iOS를 고른다. 일회성 CI 시뮬레이터만 생성·정리한다. 다른 OS로 몰래 대체하거나 런타임을 내려받지 않는다.
6. 실제 자료로 지연이 xcrun 탐색·simctl·CoreSimulator/부팅 상태 중 어디에 있는지 좁힌 뒤 최소 수정한다. 재현되지 않으면 미확정으로 기록한다. 준비 진단 성공을 제품 UI 성공으로 대신하지 않는다.

## 유지할 제약

- AGENTS.md의 PRD 확인·불확실성 설명·관련 검증 후 한국어 커밋/즉시 푸시·STATUS 갱신 규칙을 따른다.
- DEVICE-QA.md에 기존 사용자 수정 한 줄이 남아 있다. 덮어쓰거나 관련 없는 커밋에 포함하지 않는다.
- 실제 iPhone 설치는 나중에 진행하기로 확정됐다. AltStore·서명 변경·Mac 대여·유료 가입·유료 AI/인프라를 진행하거나 같은 선택을 다시 묻지 않는다.
- CI 모델 호스트는 device_not_eligible이며 생성 시도/정확도 측정은 없었다. 실제 모델·잠금 입력·VoiceOver·기기 검증을 완료로 표시하지 않는다.
- 앞선 최신 iOS의 재실행 후 로딩 대기는 다음 검사에서 재현되지 않았다. 이 SDK 도움말 지연과 같은 원인이라고 합치지 않는다.
