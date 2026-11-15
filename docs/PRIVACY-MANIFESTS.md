# 빌드된 앱의 개인정보 선언 목록

기준일: 2026-11-15. 출시 검토를 위한 선언 수집이며 App Store 개인정보 신고가 아니다.

## 근거와 범위

[Apple 개인정보 선언 문서](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)는 `PrivacyInfo.xcprivacy`라는 속성 목록 파일과 네 가지 개인정보 키를 정의한다. [데이터 수집 선언 안내](https://developer.apple.com/documentation/bundleresources/describing-data-use-in-privacy-manifests)는 SDK의 자체 선언과 앱의 선언을 구분한다. [필수 사유 API 안내](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)는 해당 실행 파일/동적 라이브러리가 속한 번들의 선언과 실제 사용 사유가 일치해야 한다고 설명한다.

소스에 파일이 존재해도 앱의 리소스로 포함되었음을 증명하지 못하므로, CI가 실제 빌드한 `.app`을 검사한다. 이 목록은 Xcode Organizer의 Archive 기반 ‘Generate Privacy Report’를 실행한 결과가 아니다.

## 실행과 산출물

전체 `quality.yml`의 시뮬레이터 앱 빌드가 성공한 뒤 다음 명령을 실행한다.

```sh
node scripts/privacy-manifests.mjs build/Build/Products/Debug-iphonesimulator/TTodo.app artifacts/privacy-manifests.json debug_simulator
```

macOS의 `/usr/bin/plutil`로 XML/바이너리 plist를 JSON으로 읽는다. 외부 서버를 호출하거나 선언을 수정하지 않는다. 앱·프레임워크·리소스 번들·확장 하위의 실제 선언을 상대 경로별로 보존한다. 앱 ID·버전·플랫폼·커밋도 기록하며 `ios-build-log` 산출물에 JSON을 포함한다.

검사는 선언 키의 자료형, API 분류/사유 배열, 수집 데이터의 연결·추적 여부와 목적 배열 형태를 확인한다. 선언이 하나도 없거나 읽기·형식 검사가 실패하면 성공으로 기록하지 않는다. 심볼릭 링크는 조용히 누락하거나 번들 밖을 따라가지 않고 별도 검토가 필요하다는 오류로 중단한다.

빠진 키를 `false`나 빈 배열로 바꾸지 않는다. 선언된 추적·수집 값, 미확인 값과 추가 키도 그대로 남긴다. 최상위 선언 유무는 별도 항목으로 기록하며, 그 값만으로 필수 선언의 충족 여부를 판단하지 않는다.

## 해석과 남은 검증

- 로컬 테스트는 임시 디렉터리와 JSON 고정 입력으로 탐색·형식 검사·누락 처리만 확인한다. 실제 `plutil`과 빌드된 앱의 선언 수집은 macOS CI 결과로 별도 확인한다.
- Debug 시뮬레이터의 개발용 의존성은 최종 Release와 다를 수 있다. 이 목록을 최종 출시 번들의 선언 목록으로 사용하지 않는다.
- 사유/데이터 분류 값이 현재 Apple이 허용한 값인지, 실제 소스 API 사용과 일치하는지, 필수 SDK 선언이 빠지지 않았는지는 별도 검토한다. SDK 서명·실제 네트워크·추적 동작도 이 검사로 검증하지 않는다.
- 최종 서명·Release Archive·공개 운영 정보가 준비된 뒤 실제 출시 산출물과 SDK 서명, Xcode 개인정보 보고서와 App Store Connect 응답을 대조한다. 현재 계정·결제·유료 서비스를 새로 활성화하지 않는다.

실제 수집 결과를 확인하기 전에는 선언 개수나 추적/수집 여부를 확정하지 않는다.

## Debug 앱의 실제 수집 결과

[1c2021a 전체 CI](https://github.com/kimps005/TTodo/actions/runs/43712115642)에서 실제 plutil 수집을 통과했다. `ios-build-log` ZIP의 SHA-256은 `09b3d8df7fa03b45bc834fe0612d06ceaafd7f4c1de95d196dc259a127bef594`이며 연결 API의 digest와 내려받은 ZIP이 일치한다. JSON의 커밋·플랫폼은 해당 커밋과 iPhoneSimulator로 대조했다.

앱 최상위·ExpoApplication·ExpoConstants·ExpoNotifications·ExpoFileSystem·React·ReactNativeDependencies(boost/folly/glog/SocketRocket)·React-cxxreact·React-timing에 선언 12개가 포함되었다. 모두 `NSPrivacyTracking=false`, `NSPrivacyCollectedDataTypes=[]`를 선언하며 미확인 최상위 키는 없었다. 추적 도메인 키가 없는 파일을 빈 배열로 보충하지 않았다.

| 선언된 API 분류 | 발견한 사유 코드의 합집합 |
|---|---|
| FileTimestamp | C617.1, 0A2A.1, 3B52.1 |
| UserDefaults | CA92.1 |
| SystemBootTime | 35F9.1 |
| DiskSpace | E174.1, 85F4.1 |

위 값은 발견한 선언이며 각 사유의 적합성이나 실제 데이터 수집 없음의 증명이 아니다. 확장 하위에서 선언이 발견되지 않았다는 사실만으로 확장의 선언 충족 여부도 판단하지 않는다.

## iPhone용 서명 없는 Release 아카이브

`release-archive.yml`은 실제 iPhoneOS SDK·Release 구성·arm64로 `xcodebuild archive`를 실행한다. `CODE_SIGNING_ALLOWED=NO`를 명령에 지정하며 Apple 계정·프로비저닝·설치·TestFlight·사이드로딩을 진행하지 않는다. 이 workflow 자체를 변경한 push와 별도 수동 실행에만 연결해 매 개발 push마다 아카이브를 반복하지 않는다.

생성된 아카이브의 앱과 위젯/공유 확장 존재, 아카이브 메타데이터와 실행 파일 형식, 같은 개인정보 선언 목록을 확인한다. 보고서의 `build_context=unsigned_release_archive`와 iPhoneOS 플랫폼을 시뮬레이터와 구분한다. 문맥 표시는 workflow의 명시적 빌드 구성에 근거하며 코드 서명 검증기는 아니다.

아카이브 전체나 설치 파일은 배포하지 않고 도구 버전·빌드 로그·아카이브 메타데이터·선언 JSON만 CI 산출물로 남긴다. 이 검사가 통과해도 서명된 최종 배포 아카이브, SDK 서명 적합성, 실제 iPhone·App Store 응답은 미검증이다.
