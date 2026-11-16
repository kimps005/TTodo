# 알림 설정 이동 조사

기준일: 2026-11-16. 실제 iPhone 검증은 미완료다.

## 기대 동작과 공식 API

PRD 12.2에 따라 알림 거부 후에도 분석함을 사용할 수 있고 사용자가 기기 설정에서 권한을 변경할 수 있어야 한다. 제품은 메인 액터에서 `UIApplication.openNotificationSettingsURLString`으로 URL을 만들고 `await UIApplication.shared.open(url)`을 호출한다. [Apple 예제](https://developer.apple.com/documentation/uikit/uiapplication/opennotificationsettingsurlstring)와 같다. [반환 Bool](https://developer.apple.com/documentation/uikit/uiapplication/open(_:options:completionhandler:))은 URL 열기 성공이며 특정 화면 도착은 별도 확인한다.

## 제품 앱에서 확인한 사실

[4c27414 UI 실행](https://github.com/kimps005/TTodo/actions/runs/43746163021), primary, iPhone 16 Pro / iOS 26.5 (23F77), macOS 26.7.2 ARM. 산출물 `ui-tests-primary` ZIP SHA-256: `d3108fbb2e0ae2e638e45dd4a4f4772209646c37b1c15566c1ce6d066697444f`.

| 확인 대상 | 결과 |
|---|---|
| 권한 요청 | 실제 OS 요청창에서 거부, 앱도 거부 표시 |
| 네이티브 호출 직전 | bundle=com.kimps005.ttodo, authorization=1(denied), appState=0(active) |
| 호출 URL / 반환값 | 공개 상수 값 app-settings:notifications / opened=true |
| 빌드·설치 앱 | Bundle ID, 실행 파일 SHA-256, 서명 Identifier/TeamIdentifier/CDHash 일치 |
| 설치 등록 | simctl appinfo에 User 앱, 해당 번들 ID와 App Group 존재 |
| 설정 앱 로그 | TTodo 번들 ID를 포함한 알림 목적지로 변환 후 목적지 선택 불가 기록 |
| 실제 화면 / 접근성 트리 | 설정 첫 화면, TTodo 알림 화면·알림 허용 스위치 없음 |
| XCTest | 지정 1개 실패. 첫 화면을 성공으로 인정하지 않음 |

`notification-settings-system.log`의 18:38:48.103 UTC 기록:

> selection not possible currently 'notifications' which doesn't have async loading, returning.

이는 설정 앱의 목적지 선택 단계가 중단된 직접 근거다. 내부 변환 URL은 OS가 남긴 진단일 뿐이며 앱에서 호출하지 않는다. 일반 앱 등록 정보가 맞다는 사실만으로 알림 설정 내부 등록까지 정상이라고 단정하지 않는다. 시뮬레이터 전반의 제한이나 실제 iOS 결함 확정으로 확대하지 않는다.

같은 실행 oldest(iOS 26.2/23C54)의 ZIP SHA-256은 `dd2c4c4b7d8a1432f653ecbc4f80dfdd6e690653725d0c2b398a39343dfe5768`이다. 원문 로그에서도 denied/active/opened=true와 같은 notifications 목적지 선택 불가 기록(18:42:28.561 UTC)을 확인했다. compact는 최대 글자 입력 검사에서 실패했으며 알림 비교 근거로 사용하지 않는다.

## 독립 네이티브 비교

`notification-settings-probe.yml`을 GitHub Actions에서 수동 실행한다. 기본 `runtime=latest`, 선택적으로 `oldest-installed`를 사용한다. 설치된 런타임만 사용한다.

`NotificationSettingsProbe.swift`는 UIKit와 UserNotifications만 사용하는 독립 앱이다. Expo·제품 모듈·확장·App Group·원격 알림 등록 없이 실제 알림 요청(.alert/.badge/.sound)과 동일 공개 설정 API를 사용한다. 별도 번들 ID `com.kimps005.ttodo.notificationprobe`와 동일 CI 시뮬레이터 ad-hoc 서명 방식을 사용한다. 서명 차이가 실기기에서 어떻게 작동하는지는 이 비교로 판별할 수 없다.

XCTest는 거부 상태를 확인한 뒤 설정 앱의 첫 실행과 재진입을 각각 검사한다. 두 시도의 스크린샷·접근성 트리·앱 복귀 후 권한/반환값을 보존한 다음, 해당 앱 이름과 꺼진 알림 허용 스위치에 모두 도착했는지 단언한다. 산출물에는 SDK 상수 선언, Xcode/SDK/OS 정보, 앱 등록 정보와 격리된 합성 시뮬레이터 로그도 포함한다. 사용자 콘텐츠·개인 기기 로그를 수집하지 않는다.

독립 앱도 같은 목적지 선택 단계에서 실패하면 제품 통합에 특화되지 않은 CI 환경 재현 근거가 된다. 독립 앱이 통과하면 제품 앱과 등록·실행 컨텍스트 차이를 추가 조사해야 한다. 어느 결과도 실제 iPhone 성공이나 실패를 증명하지 않는다. 비교 실행 결과는 STATUS.md에 기록한다.

[첫 비교 실행](https://github.com/kimps005/TTodo/actions/runs/43748991228)은 실제 SDK 빌드와 권한 거부 뒤 cold/warm 모두 설정 첫 화면에 머물렀다. 복귀한 앱의 트리에는 두 번 모두 `authorization=1 opened=true`가 있다. ZIP SHA-256은 `8f7060d7f3cb68f86a4ed8d970fc1330315d78a3b0b53fed433ac8d9e7d003e5`이며 실제 PNG·트리와 최종 `[false,false]` 단언 실패를 대조했다. 시스템 로그는 16 MiB 파이프 버퍼 초과로 저장되지 않아 수집 방식만 파일 직접 연결로 수정하고 재검증한다.

[수집 보완 후 비교 실행](https://github.com/kimps005/TTodo/actions/runs/43750027357)에서 24,356,561바이트 로그와 앱 등록 정보 수집이 완료됐다. ZIP SHA-256은 `47f89a5e2f5ac370e0297846f38ef2e5a30890a0f45167ee360d0ce9023b35d2`다. Xcode 26.6(17F113) / SDK 26.5 / iOS 26.5(23F77), macOS 26.7.2 ARM, iPhone 16 Pro 시뮬레이터다. 지정 검사 1개 실패·건너뜀 0이며 두 화면 모두 첫 화면임을 PNG·트리로 다시 확인했다.

| 독립 앱 시도 | 첫 실행 | 재진입 |
|---|---|---|
| 네이티브 호출 UTC | 19:08:41.684 | 19:09:33.913 |
| 권한 / 앱 상태 | denied / active | denied / active |
| 반환값 | true | true |
| 설정 앱 목적지 선택 불가 UTC | 19:08:58.056 | 19:09:34.164 |
| 실제 화면 | 설정 첫 화면 | 설정 첫 화면 |

두 시도 모두 설정 앱이 비교 앱의 올바른 Bundle ID를 포함한 알림 목적지로 변환한 다음 제품 앱과 같은 `selection not possible currently 'notifications'` 기록을 남겼다. `simctl appinfo`에는 User 앱 등록 및 빈 GroupContainers가 있다. 이 환경에서 URL 전달 이후 설정 앱 목적지 선택 단계의 실패가 제품 통합 없이 재현된 것이다. 화면 단언은 유지해 workflow는 계속 실패로 남긴다. 실제 SDK의 공개 상수 선언 및 두 Swift 타깃의 컴파일도 확인했다.

## 수정 판단 기준과 남은 제한

현재 제품의 호출 방식·Bundle ID·활성 실행 컨텍스트를 바꿔야 할 증거는 없다. 공개 알림 API를 유지하고 화면 도착 검사를 계속 실패로 남기는 것이 추천 방안이다. 근거 없는 앱 수정으로 OS 실패를 가리거나 성공으로 잘못 표시하지 않는 장점이 있다. 직접 원인은 해당 CI 환경의 설정 앱에서 알림 목적지를 선택하지 못하는 단계까지 확인했다. 시뮬레이터의 의도된 지원 제한인지 OS 결함인지와 그 내부 원인은 아직 구분하지 못했다.

설정 앱의 목적지 선택 자체가 실패한다면 근본 해결에는 해당 OS 환경에서 목적지 탐색이 정상 동작하는지 확인해야 한다. 앱이 사용할 수 있는 문서화된 다른 알림 전용 이동 방법은 현재 확인하지 못했다. 사설 URL은 사용하지 않으며 일반 앱 설정 URL로 바꾸는 것은 알림 화면 직접 이동을 보장하지 않는다. 재시도·지연 추가도 근거가 없고, 독립 앱의 이미 실행된 설정 앱으로 재진입도 실패했다.

실제 iPhone에서는 미검증이며 서명/설치가 준비될 때까지 해당 출시 검증은 미완료다. Mac 대여·유료 가입·사이드로딩 경로를 제안하거나 변경하지 않는다. 이 조사만으로 제품 문제 해결 또는 실기기 OS 결함 확정으로 처리하지 않는다.
