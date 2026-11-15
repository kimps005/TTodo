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

같은 실행 oldest(iOS 26.2/23C54)는 작업 로그상 같은 페이지 단언 실패, 앱 정보 일치 및 시스템 로그 수집 완료다. primary의 원문 로그 분석과 구분한다. compact는 최대 글자 입력 검사에서 실패했으며 알림 비교 근거로 사용하지 않는다.

## 독립 네이티브 비교

`notification-settings-probe.yml`을 GitHub Actions에서 수동 실행한다. 기본 `runtime=latest`, 선택적으로 `oldest-installed`를 사용한다. 설치된 런타임만 사용한다.

`NotificationSettingsProbe.swift`는 UIKit와 UserNotifications만 사용하는 독립 앱이다. Expo·제품 모듈·확장·App Group·원격 알림 등록 없이 실제 알림 요청(.alert/.badge/.sound)과 동일 공개 설정 API를 사용한다. 별도 번들 ID `com.kimps005.ttodo.notificationprobe`와 동일 CI 시뮬레이터 ad-hoc 서명 방식을 사용한다. 서명 차이가 실기기에서 어떻게 작동하는지는 이 비교로 판별할 수 없다.

XCTest는 거부 상태를 확인한 뒤 설정 앱의 첫 실행과 재진입을 각각 검사한다. 두 시도의 스크린샷·접근성 트리·앱 복귀 후 권한/반환값을 보존한 다음, 해당 앱 이름과 꺼진 알림 허용 스위치에 모두 도착했는지 단언한다. 산출물에는 SDK 상수 선언, Xcode/SDK/OS 정보, 앱 등록 정보와 격리된 합성 시뮬레이터 로그도 포함한다. 사용자 콘텐츠·개인 기기 로그를 수집하지 않는다.

독립 앱도 같은 목적지 선택 단계에서 실패하면 제품 통합에 특화되지 않은 CI 환경 재현 근거가 된다. 독립 앱이 통과하면 제품 앱과 등록·실행 컨텍스트 차이를 추가 조사해야 한다. 어느 결과도 실제 iPhone 성공이나 실패를 증명하지 않는다. 비교 실행 결과는 STATUS.md에 기록한다.
