# 개발 현황

## 2026-11-20 ‘캡처 속 할 일’ 사진 자동 분석과 단일 후보

- 사진 선택·클립보드 붙여넣기와 본앱으로 받은 공유 이미지가 기존 동의를 확인한 뒤 Vision OCR과 기기 내 AI로 이어진다. 첫 동의를 수락하면 바로 시작한다. OCR 원문·기준 날짜·직접 선택을 화면에서 제거했다. 한 장의 결과는 후보 0개 또는 1개이며, 확인된 마감만 표시한다. 제목과 마감은 편집할 수 있고, 기존 승인 트랜잭션이 저장을 처리한다.
- 같은 사진의 새 형식 미저장 후보는 다시 보여준다. 예전 형식의 결과는 분석함에서 볼 수 있고, 저장 이력이 없다면 확인 후 새 형식으로 분석할 수 있다. 부분 저장이나 저장 후 삭제가 있었던 사진도 재분석을 차단한다. 사진 교체·화면 닫기 후에는 늦게 끝난 요청의 화면 갱신을 무효화한다. 새 단일 후보 분석에는 변경된 네이티브 모듈을 포함한 앱 빌드가 필요하다.
- Windows에서 Node 테스트 170개, TypeScript, iOS Debug JS·Release Hermes 번들, diff 검사를 통과했다. 제어된 OCR·모델 경계와 실제 SQLite로 동의 직후 실행, 후보 0개·1개, 마감 근거, 편집 승인, 동시 중복 저장, 저장 후 삭제 시 재분석 제한과 이전 요청 무효화를 확인했다.
- `e6d5efb`의 macOS 품질 CI에서 Swift 저장소·캡처·합성 Vision OCR 검사와 앱·위젯·공유 확장의 arm64 시뮬레이터 빌드가 통과했다. core의 테스트 170개·타입·번들 검사도 통과했다. [품질 CI](https://github.com/kimps005/TTodo/actions/runs/44705326530)
- 사진 선택과 저장이 거의 동시에 눌릴 때 각각의 진행 잠금이 겹치지 않도록 보강했다. 이 JS 변경까지 로컬과 `2814afd`의 core CI에서 테스트 170개·타입·iOS 개발/배포 번들을 다시 통과했다. [JS 품질 CI](https://github.com/kimps005/TTodo/actions/runs/44710122500)
- `e6d5efb`의 사진 UI 검사는 iOS 26.5 시뮬레이터에서 Release 빌드와 시스템 사진 선택, 첫 동의 후 자동 분석 시작까지 확인했다. XCTest는 예상한 AI 사용 불가 문구에 대한 단언에서 실패했다. 녹화에는 분석 중 화면까지 남아 최종 문구를 확인할 수 없었다. 재검사에서 예상 문구 자체를 기다리고 실패 시 실제 문구와 화면을 남기도록 보강했다. [첫 사진 UI CI](https://github.com/kimps005/TTodo/actions/runs/44705329933)
- `2814afd`의 사진 UI 재검사 두 번은 시뮬레이터의 `simctl addmedia` 시간 초과로 앱 빌드·실행 전에 중단됐다. 진단에서 시뮬레이터 부팅 완료 이후에도 사진 보관함의 재구성이 진행됐고, 두 번째 실행은 가져오기 요청이 시간 제한 무렵에야 PhotoKit에 도달했다. 시뮬레이터가 부팅된 상태에서 앱을 빌드한 뒤 사진을 가져오도록 순서를 바꿨다. 가져오기에 실패하면 XCTest를 실행하지 않는다. [사진 UI 재검사](https://github.com/kimps005/TTodo/actions/runs/44710119008)
- 사진 가져오기 순서와 실패 처리를 포함해 로컬 테스트 171개, 타입 및 검사 스크립트 구문을 확인했다.
- `bb20dbb`의 사진 UI 실행은 Release 앱 빌드와 바뀐 순서의 사진 가져오기를 통과했다. 시스템 사진 선택과 동의 후 자동 분석을 시작했으나 일반 분석 실패 문구를 표시했다. 화면에서 동의 확인 오류와 OCR 오류의 안내를 구분하고, 사진 CI에 실패 단계와 네이티브 오류 번호만 남기도록 보강했다. [사진 가져오기 순서 검증](https://github.com/kimps005/TTodo/actions/runs/44713969457)
- 서명된 iPhone에서 사진·클립보드 권한, 최초 동의, 한국어 모델의 실제 0개·1개 선별과 마감 정확도, 편집 후 저장과 중복 저장 제한, 사진 교체·닫기 중 늦은 결과 차단 및 VoiceOver를 확인해야 한다.

## 2026-11-20 수정된 Dev Client IPA 빌드와 교체

- 빌드 전용 브랜치 `codex/share-fix-ipa`의 `edb85a1`에서 iPhoneOS arm64 Debug 아카이브, 공유 확장·단축어 포함 검사와 무서명 IPA 업로드를 통과했다. [GitHub Actions 빌드](https://github.com/kimps005/TTodo/actions/runs/44698038237) · [IPA 아티팩트](https://github.com/kimps005/TTodo/actions/runs/44698038237/artifacts/14611772960)
- 내려받은 ZIP은 GitHub의 SHA-256과 일치했다. IPA를 다시 검사해 수정 공유 화면과 `ReviewSharedImageIntent` 등록을 확인했다. 바탕화면의 기존 IPA를 교체했으며 새 파일 SHA-256은 `b764b203dc324443c93f38e78a380ef694710aa2ceb8c34055d4be01c1d8f145`다. 로컬 테스트 166개와 타입 검사도 재실행해 통과했다.
- 수정된 공유창 XCTest, 실제 iPhone 설치와 동작, 스크린샷 자동화 알림 및 한국어 AI 정확도는 미검증이다.

## 2026-11-20 사진 공유 첫 화면과 실제 IPA 재점검

- 사용자가 설치에 사용했다고 지정한 바탕화면의 `TTodo-dev-client-unsigned.ipa`를 직접 확인했다. 버전 1.0.0(빌드 1), iPhoneOS SDK 26.5이며 아래의 `64c3711` 보관 IPA와 SHA-256 전체가 일치한다. 확장에는 이전 URL 호출이 있고 새 검토 화면 식별자가 없다. 본앱에 등록된 단축어 동작은 `AddTodoIntent`와 `AnalyzeCaptureIntent` 두 개다. 설치에 사용한 파일에 로컬 수정이 포함되지 않았음을 확인했다. 실제 정지 지점은 기기 로그가 필요하다.

- 새 IPA를 설치한 후에도 정지했다는 보고를 받았다. 보관된 Dev Client IPA(`artifacts/dev-client-64c3711/TTodo-dev-client-unsigned.ipa`, SHA-256 `fb02a65f57d6e6665278ca5d30190f434bd47440cb3f8750645edf63d4a48b60`)의 확장 실행 파일에는 `openImport`, 완료 콜백을 기다리는 URL 열기, 클립보드 토큰 URL이 남아 있다. 이 IPA와 보관된 단독 Debug IPA 모두 본앱의 단축어 메타데이터에 `ReviewSharedImageIntent`가 없다. 설치 기기에서 실행된 마지막 단계는 확인되지 않았다.
- 기존 로컬 수정에서도 확장 첫 화면을 붙이기 전에 메인 스레드에서 첨부 항목과 Debug App Group을 조회했다. 이제 공유창이 먼저 제목·닫기·분석 버튼을 표시한다. 분석을 누르면 백그라운드에서 동의를 확인하고 첨부를 가져온다. 사진 제공자 선택·파일 요청 등록·응답 대기 전체에 30초 제한을 적용했다. 요청 실패 후 재시도·닫기가 가능하다. 기기 로그의 `app.ttodo.share`에는 컨트롤러 로드, 화면 표시, 이미지 요청·시간 초과 등 단계만 기록한다.
- 사진 공유 메뉴의 TTodo 아이콘은 사진 앱 안에 확장을 표시한다. TTodo 앱에서 검토하려면 이미지 입력을 받는 공유 단축어를 한 번 설정하고 공유 메뉴 아래에서 그 단축어를 선택한다. 본앱 설정은 설치된 네이티브 수신 기능을 확인하며, 이전 빌드에서는 분석함의 사진 선택을 안내한다. [Apple DTS의 공유 확장 실행 범위](https://developer.apple.com/forums/thread/779644) · [Apple의 공유 단축어 설정](https://support.apple.com/en-gb/guide/shortcuts/apd163eb9f95/9.0/ios/26)
- 두 Debug IPA 패키징 경로에 최종 ZIP 내부의 확장 진입점·화면 식별자·구형 토큰 URL·본앱 단축어 등록 검사를 추가했다. Windows에서 보관 IPA 두 개의 거부 및 모의 패키지의 실행 파일/Debug dylib 양성 사례와 단축어 누락 거부를 확인했다. JS 테스트 166개, 타입 검사, iOS Debug JS·Release Hermes 번들 통과. 네이티브 빌드·새 IPA 생성·수정된 XCTest·실제 iPhone 검증은 미실행이다.
- 실기기에서는 수정 IPA의 공유창 첫 표시와 닫기, iCloud 사진 시간 초과·재시도, 별도 공유 단축어로 본앱 최초 실행·복귀, 동의와 선택 저장 전후의 할 일 개수, 임시 파일 정리를 확인해야 한다. 스크린샷 자동화 알림과 한국어 AI 정확도도 미검증이다.

## 2026-11-19 사진 공유 정지 조사와 본앱 검토 경로 (로컬 변경)

- App Group 없는 Debug 확장은 사진 제공자의 파일 응답 후 클립보드에 쓰고 responder chain으로 본앱을 열었다. 파일 응답과 URL 열기 완료 콜백 중 하나만 누락돼도 준비 화면에서 대기했다. App Group이 있는 확장은 자체 검토 화면을 사용했으며 파일 응답 대기는 동일했다. 사용자 기기에서 마지막으로 실행된 줄은 확인되지 않았다.
- 설치된 Expo SDK 58의 콜드 스타트는 SceneDelegate가 연결 URL로 RN 초기 옵션을 구성한 뒤 AppDelegate에 전달한다. 복귀 시에도 SceneDelegate가 AppDelegate와 RN Linking 처리를 중계한다. 이전 JS는 초기화·활성화·URL 이벤트에서 네이티브 대기 토큰을 조회했다. 확장에서 URL을 열지 못하면 이 단계까지 이미지가 전달되지 않았다.
- 공유 확장의 비공식 앱 열기와 토큰 URL 수신을 제거했다. 파일 응답은 30초 뒤 시간 초과로 종료하고 닫기·재시도를 제공한다. Debug 수동 복사는 버튼을 눌렀을 때만 기기 내 5분 만료로 수행한다. App Group이 있으면 기존 확장 내 동의 확인·분석·선택 저장도 사용할 수 있다. Apple이 설명하는 확장 종류별 지원 범위와 iPhoneOS 26.5 헤더의 `sharedApplication` 확장 사용 불가 선언을 확인했다. [Apple DTS](https://developer.apple.com/forums/thread/779644) · [NSExtensionContext.open](https://developer.apple.com/documentation/foundation/nsextensioncontext/open%28_%3Acompletionhandler%3A%29) · [확인한 UIKit SDK 헤더](https://github.com/xybp888/iOS-SDKs/blob/master/iPhoneOS26.5.sdk/System/Library/Frameworks/UIKit.framework/Headers/UIApplication.h)
- 본앱에서 검토하려면 단축어를 하나 만들고 ‘공유 시트에서 보기’와 이미지 입력을 설정한다. ‘TTodo에서 공유 이미지 검토’의 사진에 ‘단축어 입력’을 연결한다. 이후 사진 공유 메뉴에서 이 단축어를 선택하면 전면 App Intent가 선택한 사진 한 장을 앱에 전달한다. iOS 26 이상은 `.foreground(.immediate)`, 그 이전 지원 버전은 `openAppWhenRun`을 사용한다. iPhoneOS 26.5의 AppIntents 인터페이스에서 선언을 확인했다. [Apple 공유 단축어 설정](https://support.apple.com/guide/shortcuts/apd163eb9f95/ios) · [전면 실행 모드](https://developer.apple.com/documentation/appintents/appintent/supportedmodes) · [AppIntents SDK 선언](https://github.com/xybp888/iOS-SDKs/blob/master/iPhoneOS26.5.sdk/System/Library/Frameworks/AppIntents.framework/Modules/AppIntents.swiftmodule/arm64e-apple-ios.swiftinterface)
- 본앱은 백업 제외·파일 보호를 적용한 임시 파일에서 기존 OCR·동의·검토로 이어간다. 파일 바이트를 보존해 기존 지문 비교를 사용한다. 여러 번 공유하거나 편집 중에 공유하면 차례로 열며, 철회·전체 삭제 시 대기 파일도 정리한다. 공유 입력 수신은 할 일을 생성하지 않는다.
- Windows에서 JS 테스트 166개, TypeScript 검사, iOS Debug JS 및 Release Hermes 번들을 검증했다. 이번 Swift 변경의 Xcode 빌드와 실제 iPhone 실행은 미검증이다. 사진/iCloud 지연·취소·재시도, 앱 최초 실행·복귀·편집 중 전달, OCR·한국어 AI·승인 전후 할 일 개수와 임시 파일 삭제를 확인해야 한다.
- iOS 27 단축어에는 ‘스크린샷이 저장될 때’ 트리거가 있다. 사용자가 설정한 자동화의 실행 확인 알림, 승인한 캡처 한 장이 실제 동작 입력으로 전달되는지, 잠금 상태에서 본앱으로 전환할 수 있는지는 실기기 검증 대상으로 남긴다. [Apple 단축어 업데이트](https://support.apple.com/en-us/149045) · [자동화 실행 확인](https://support.apple.com/guide/shortcuts/apd690170742/ios)

## 2026-11-19 Dev Client UI·UX QA 준비

- Debug 로컬 모드는 공유 확장에서 JPEG와 만료 토큰을 자동 전달한다. 앱 첫 실행 옵션에서도 공유 URL을 접수하고, 앱이 활성화되면 토큰과 일치하는 JPEG의 크기와 2048px 제한을 검사한 뒤 `Application Support`에 저장한다. 저장 성공 후 클립보드 항목을 소비하고 기존 미리보기와 OCR로 이동한다. 공유 호스트가 앱 열기를 거부하면 확장에서 수동 복사를 사용할 수 있다.
- Expo SDK 58 기본 호환표에 맞는 `expo-haptics` 58.0.8을 추가하고 `expo-image-picker`를 유지했다. Windows에서 두 Pod의 Expo 자동 링크 식별을 확인했다. Dev Client CI는 CocoaPods 잠금 파일에서 두 Pod를, IPA 패키징 단계에서 내장 공유 확장을 검사한다.
- 개발 설정에서 테스트용 할 일 5개를 한 트랜잭션으로 추가하거나 기기에 저장된 할 일을 한 번에 삭제할 수 있다. 초기화는 연결된 제안 본문과 마감 알림을 정리하며 재등록 방지 기록, 미저장 제안과 설정을 보존한다.
- Windows에서 테스트 163개, 타입 검사, iOS Debug·Release 번들 및 diff 검사를 통과했다. QA 버튼과 샘플이 Debug 번들에 있고 Release Hermes 번들에서 빠진 것을 확인했다.
- `64c3711`의 [Dev Client CI](https://github.com/kimps005/TTodo/actions/runs/44516685055)는 iOS 프로젝트 생성, Debug 로컬 저장소 검사, CocoaPods 설치 및 필수 Pod 확인, iPhoneOS arm64 아카이브, 내장 공유 확장 확인과 [무서명 IPA 업로드](https://github.com/kimps005/TTodo/actions/runs/44516685055/artifacts/14527105245)를 통과했다. 같은 푸시의 품질 검사와 Release 아카이브는 취소됐고 UI 검사는 트리거되지 않았다.
- 실제 기기의 공유 호스트 전환, 붙여넣기 권한, QA 화면 조작, Metro 연결과 AI 정확도는 실기기 검증이 필요하다.

## 2026-11-19 Debug 공유 이미지 자동 전달

- App Group이 없는 Debug 공유 확장은 이미지를 긴 변 2048px 이하, JPEG 품질 0.85로 줄인 뒤 5분 만료 토큰과 함께 기기 내 클립보드에 기록한다. 응답자 체인에서 `openURL:`을 시도하고 거절되면 완료 콜백이 있는 URL 열기 메서드도 시도한다. 앱 열기가 실패하면 복사 버튼을 표시한다. App Group이 연결된 경우 기존 공유 흐름을 사용한다.
- Expo AppDelegate가 콜드 스타트와 복귀 URL을 받아 두고, 활성화된 앱이 토큰과 일치하는 이미지를 `Application Support`에 임시 저장한 뒤 해당 클립보드 항목을 소비한다. 기존 편집·검토 화면을 닫으면 공유 이미지로 이동하며, 미리보기와 OCR은 자동으로 시작한다. 기기 내 분석 동의와 할 일 저장 승인은 기존 방식대로 진행한다. 임시 파일은 화면을 닫거나 앱을 다시 시작할 때, 동의 철회와 전체 삭제 때 정리한다.
- Windows 테스트 161개, 타입 검사, iOS Debug·Release JS 번들 및 diff 검사를 통과했다. 공유 호스트의 앱 열기 허용 여부, iOS 붙여넣기 권한, 실제 확장 메모리 사용량, iPhone의 최초 실행·복귀 및 AI 정확도는 실기기 검증이 필요하다.
- [첫 Dev Client CI](https://github.com/kimps005/TTodo/actions/runs/44511004613)의 iPhoneOS 아카이브가 `UIPasteboard.pasteboardTypes`의 Swift 이름 오류로 중단됐다. iPhoneOS 26.5 SDK 진단에 따라 `UIPasteboard.types`로 수정했다. `dc50b25`의 [재실행](https://github.com/kimps005/TTodo/actions/runs/44512689008)에서 Debug 로컬 저장소 검사, iPhoneOS 아카이브, IPA 패키징 검사 및 [무서명 IPA 업로드](https://github.com/kimps005/TTodo/actions/runs/44512689008/artifacts/14523954158)가 통과했다.

## 2026-11-19 공유 확장 로컬 모드와 Dev Client IPA

- 생성된 iOS 공유 확장은 사진·스크린샷 한 장을 받으며, 공유 제공자가 등록한 이미지 형식으로 파일을 요청한다. App Group이 연결된 공유 확장은 공용 DB와 기존 동의·검토 흐름을 사용한다.
- Debug에서 App Group 컨테이너가 없으면 공유 화면의 ‘클립보드에 이미지 복사’로 축소한 이미지를 이 기기에 5분간 복사한다. 공유 호스트가 `ttodo://capture` 열기를 허용하면 캡처 화면으로 이동한다. 앱이 열리지 않으면 직접 TTodo의 ‘사진·클립보드에서 할 일 찾기’로 이동한다. 확장이 표시되지 않을 때는 사진 앱에서 이미지를 복사할 수 있다. 캡처 화면에서 ‘클립보드 이미지 붙여넣기’를 누르면 기존 OCR·동의·승인 흐름으로 이어진다.
- 수동 `iPhone용 Dev Client Debug IPA` 작업이 `TTodo-dev-client-unsigned.ipa`를 생성하도록 구성했다. Expo Dev Client·Launcher·Menu Pods, URL 스킴과 iOS 로컬 네트워크 설정을 검사한다. Metro는 개발 PC에서 `npx expo start --dev-client`로 실행한다.
- Windows에서 테스트 160개, 타입 검사, iOS Debug·Release JS 번들, 두 IPA 모드의 Expo iOS 프로젝트 설정, 새 워크플로우 YAML·Bash 구문, diff 검사를 통과했다. `artifacts/`는 타입 검사 대상에서 제외했다.
- `a5e000b`의 [품질 CI](https://github.com/kimps005/TTodo/actions/runs/44501532789)에서 JS 품질 검사와 앱·공유 확장 Debug 시뮬레이터 빌드가 통과했고, [Release CI](https://github.com/kimps005/TTodo/actions/runs/44501532881)에서 iPhoneOS 아카이브와 산출물 검사가 통과했다.
- 같은 커밋의 [Dev Client CI](https://github.com/kimps005/TTodo/actions/runs/44501581758)에서 Debug 로컬 저장소 검사, iPhoneOS 아카이브, IPA 패키징 검사 및 [무서명 IPA 아티팩트 업로드](https://github.com/kimps005/TTodo/actions/runs/44501581758/artifacts/14518217674)가 통과했다. 서명된 iPhone의 공유 시트·붙여넣기 권한·Metro 접속과 실제 AI 정확도는 실기기 검증 대상으로 남아 있다.

## 2026-11-19 단독 실행 Debug IPA 번들링과 패키징 검증 보강

- Expo가 Debug에서 설정한 `SKIP_BUNDLING`을 생성된 Xcode 빌드 단계의 마지막 환경 파일 로드 직후 해제한다. 기존 Release와 같은 `export:embed` 경로로 `main.jsbundle`과 Metro 에셋을 앱에 넣는다.
- 단독 Debug AppDelegate는 React Native 초기화 전에 Metro 탐색을 끄고 두 번들 URL 진입점에서 내장 파일을 사용한다. Expo Dev Client·Launcher·Menu는 이 빌드의 Pod 자동 연결에서 제외한다.
- IPA를 압축하기 직전에 `Payload`에서 비어 있지 않은 번들, `Info.plist`의 앱 식별자와 실행 파일 이름, arm64 iPhoneOS Mach-O, Metro 호스트 파일 부재, 압축 해제 후에도 유효한 앱 내부 상대 링크를 검사한다.
- Windows에서 테스트 159개, 타입 검사, Expo 템플릿 기반 iOS 프로젝트 설정 생성, YAML·Bash 구문, Debug·Release 번들 생성과 `export:embed` 이미지·폰트 복사를 확인했다. 패키징의 정상·실패 경로 14개는 macOS 도구와 링크 응답을 모의해 검사했다. 새 변경의 macOS 아카이브·실제 IPA 생성과 서명된 iPhone에서 Metro 없이 최초 실행하는 검증은 후속 확인이 필요하다.

## 2026-11-18 단독 실행 Debug IPA의 내장 번들

- Expo의 Xcode 빌드 단계가 Debug에서 `SKIP_BUNDLING=1`을 설정해 아카이브의 번들과 Metro 에셋 생성이 건너뛰어졌다. Pods 설치가 끝난 뒤 Xcode가 마지막에 읽는 `.xcode.env.local`에서 이 값을 해제했다. 기존 Expo 빌드 단계가 Debug JS와 앱에서 사용하는 에셋을 앱 번들에 출력한다.
- Debug IPA용 prebuild는 Expo Dev Client와 하위 Launcher·Menu를 제외하고 AppDelegate가 로컬 `main.jsbundle`을 직접 열도록 생성한다. [첫 CI](https://github.com/kimps005/TTodo/actions/runs/44320935018)는 Launcher·Menu만 제외했을 때 Dev Client의 Pod 의존성 해석에 실패했다. 압축 직전 Payload에서 번들, 앱 식별자, arm64 Mach-O 실행 파일, 깨진 링크를 검사한다. Release 아카이브에도 내장 번들 확인을 추가했다.
- Windows에서 테스트 159개, 타입, 두 워크플로우의 YAML·Bash 구문, Expo 자동 연결 제외 목록을 확인했다. 패키징의 정상·실패 분기는 로컬 테스트 자료로 확인했고, 별도 Expo 번들에서 샘플 이미지·폰트의 바이트가 원본과 일치했다.
- `95815f2`의 [Debug IPA CI](https://github.com/kimps005/TTodo/actions/runs/44321611321)에서 Swift 저장소 검사, 무서명 iPhoneOS 아카이브, Payload 무결성 검사와 IPA 업로드가 통과했다. 내려받은 [IPA](https://github.com/kimps005/TTodo/actions/runs/44321611321/artifacts/14436001250)에서 3,870,536바이트 Hermes 번들, 원본과 같은 Metro 이미지 5개, 네이티브 에셋 카탈로그, Metro IP 파일 부재를 확인했다. 같은 커밋의 [Release 아카이브 CI](https://github.com/kimps005/TTodo/actions/runs/44321564290)도 Xcode 26.6·iPhoneOS SDK 26.5에서 내장 번들 검사까지 통과했다.
- 실제 iPhone의 서명·설치와 Metro 없이 앱을 처음 여는 동작은 실기기 검증을 기다린다.

## 2026-11-18 Debug 로컬 저장소와 무서명 IPA

- Debug 메인 앱은 App Group 경로가 없을 때 앱의 `Application Support/TTodo`에서 기존 SQLite 스키마를 사용하고 설정에 임시 로컬 모드를 표시한다. Release와 확장은 App Group 경로가 없으면 기존 저장소 오류를 반환한다.
- [macOS 단독 CI](https://github.com/kimps005/TTodo/actions/runs/44299051273)에서 `f445b07`의 `testMissingAppGroupUsesMainAppApplicationSupport` 한 건이 통과했다. Windows 타입 검사, iOS Debug·Release JavaScript 번들 생성, 새 워크플로우의 YAML·Bash 검사도 통과했다.
- 수동 Debug IPA 워크플로우에 무서명 iPhoneOS 아카이브, 내장 JavaScript 번들 확인 및 IPA 업로드를 추가했다. 작업 브랜치에 있으며 기본 브랜치 등록 후 수동 실행할 수 있다. Xcode 아카이브·IPA 업로드, 실제 iPhone 설치 및 AI 정확도는 미검증이다.

## 2026-11-18 잠금화면 렌더링 데이터 단독 검사

- `LockPresentationSmoke`에서 설정이 없는 기본 상태와 `private_lock`·`hide_lock_content`의 네 조합을 검사한다. 미완료 6개 중 위젯에 전달되는 최대 5개 행, 전체 개수, 마감과 ActivityKit의 전체 직렬화 데이터를 대조한다.
- `de939d6`의 [단독 macOS CI](https://github.com/kimps005/TTodo/actions/runs/44269637206)에서 제품 Swift 소스를 컴파일하고 iPhone 16 Pro 시뮬레이터로 해당 타깃만 실행해 통과했다. 실제 잠금화면 갱신 시점은 실기기 검증 대상으로 남아 있다.

## 2026-11-18 잠금화면 복구와 파일 내보내기 회귀 검사

- 카드 시작 선택을 SQLite에 보존하고 전경 복귀에서 ActivityKit의 현재 목록을 확인한다. 활성·stale 카드 한 개를 최신 마감 순서와 개인정보 설정으로 갱신하고 만료·중복 항목을 정리한다. 시작 선택이 남은 경우에만 사라진 카드를 복구한다. 확장 저장은 카드 생성을 요청하지 않는다.
- Windows에서 전체 JS 테스트 155개와 타입 검사를 통과했다. 공유 직전 디스크 파일의 필수 필드·UTF-8·개별 삭제와 동의 철회 전후 원문을 대조했다.
- 최신/이전 iOS 수명주기 CI에 실제 위젯 엔트리·ActivityKit 콘텐츠와 복구 정책 검사, 앱 내보내기 파일 및 중단된 공유의 재실행 정리 검사를 추가했다. 이번 소스의 원격 시뮬레이터와 iPhoneOS 아카이브 결과는 실행 기록 확인 전이다. 실제 기기의 8시간 만료·재부팅·잠금 표시와 파일 앱 저장은 미검증이다.

## 2026-11-18 후속: 단축어 큐 통합과 UI 실행 시간 분리

- `318063c`의 [UI 회귀 CI](https://github.com/kimps005/TTodo/actions/runs/44234310254)는 primary·oldest·compact 모두 통과했다. iPhone 16 Pro 시뮬레이터의 iOS 26.5와 26.2에서 각각 `testManualTaskLifecycleAndDataReset` 1/1 통과(건너뜀 없음). 두 XCTest 첨부 모두 `application_page=false notification_controls=false`였다. 설정 앱이 전면에 오고, TTodo 복귀 후 거부 상태·수동 안내·미저장 초안·기존 할 일이 유지되는 것을 검증했다. 전용 페이지 도착이나 권한 변경 성공을 뜻하지 않는다. compact는 최대 글자 크기의 입력·편집·탭 이동 검사다. 실기기 120 MB 피크와 한국어 모델 정확도는 보류한다.

- `318063c`의 [품질 CI](https://github.com/kimps005/TTodo/actions/runs/44234310385)에서 **ios 작업 통과**: Swift 검사, 한국어 Vision OCR, 시뮬레이터 앱·위젯·공유 확장 빌드 및 개인정보 선언 검사 성공. core의 타입 검사·JS 테스트는 통과했고 동일한 `picomatch` 권고로 `npm audit`만 실패했다.

- `da2dc18`의 [품질 CI](https://github.com/kimps005/TTodo/actions/runs/44233006798)에서 Swift 저장소·캡처·한국어 OCR·큐·설정 검사가 모두 통과했다. 앱 타깃은 Expo 생성 파일의 `internal import TTodoNative`와 단축어 파일의 암시적 import 가시성이 달라 컴파일에 실패했다. 단축어에도 동일한 접근 수준을 명시했다.
- 동일 실행에서 JS 154개와 타입 검사는 통과했고, `npm audit`가 빌드 도구의 간접 의존성 picomatch 2.3.2/4.0.7을 지적해 core는 실패했다. 2026-11-18 확인한 [보안 권고](https://github.com/advisories/GHSA-fc5q-39xc-vjpf)에는 패치 버전이 없다. 감사 기준과 의존성은 유지하고 CI가 건너뛴 iOS Release·개발 번들을 Windows에서 각각 생성해 확인했다.

- 앱의 단축어와 Expo 브리지가 같은 `TTodoNative`의 캡처/모델 큐를 사용하도록 단축어 진입점을 옮겼다. 공유 확장은 독립 프로세스에서 자체 큐와 세션을 사용한다. prompt-v4는 요청·기한·취소 단서가 있는 청크를 먼저 처리하고 나머지도 모두 검사한다. 제안은 원문 순서로 돌려주며 한 청크의 기존 3개 제한을 전체 계약인 최대 10개에 맞췄다.
- 이전 ARM UI 재시도에서도 러너를 배정받지 못했다. [Intel UI 실행](https://github.com/kimps005/TTodo/actions/runs/44134344901)은 iOS 26.5의 iPhone 16 Pro에 앱을 빌드·설치했지만, 빌드 약 29분 후 XCTest가 앱을 시작하는 동안 기존 30분 제한에 닿았다. 워크플로는 취소됐으며 알림 화면의 결과는 없다.
- CI에서 컴파일과 XCTest 실행 시간을 분리했다. 설정에서 앱으로 돌아온 뒤 실제 권한이 여전히 거부인지도 다시 단언한다. Windows에서 JS 154/154, 타입 검사, CI 스크립트 구문 검사를 통과했다. 아래 cc983e3의 Swift·빌드 통과는 이전 버전의 결과다. 현재 변경의 시뮬레이터 UI 결과와 실제 기기 검증은 별도다.

## 2026-11-18 알림 복구·공유 이미지·모델 안전장치 보강

- 사용자 요청에 따라 보류했던 알림 복구 경로를 수정했다. 기존 직접 원인은 CI 설정 앱의 Notifications 메뉴 숨김이며 제품 URL 전달 실패가 아니다. 실제 iPhone은 공개 알림 URL을 우선 열고 반환 false이면 공개 앱 설정 URL로 전환한다. 시뮬레이터는 앱 설정 URL을 사용하고 메뉴 부재·수동 경로를 안내한다. 반환값은 열기 요청 수락만 의미하며 알림 화면 도착/권한 변경 성공으로 기록하지 않는다. 숨겨진 OS 메뉴를 복구한 변경은 아니다.
- 공유 확장은 NSItemProvider 파일을 콜백 안에서 디스크 복사하고 URL로 처리한다. 원본 Data/UIImage 전체 로딩 없이 64 KiB 단위 SHA-256과 ImageIO 파일 소스 썸네일을 사용한다. OCR 최대 변 2400, 미리보기 720, 원본 캐시 비활성화 및 OCR autoreleasepool로 모델 실행 전 디코딩 버퍼를 해제한다. 임시 파일은 성공·실패·취소 종료에서 정리한다. 120 MB 전체 프로세스 한도 충족이나 실제 기기 OCR 정확도는 측정 전이다.
- 각 Swift 모듈의 모델 진입점에 명시적 FIFO permit을 두어 해당 진입점의 앱 직접 분석·평가·캡처 요청을 직렬화한다. 캡처 처리 FIFO도 유지한다. 생성 코드와 네이티브 브리지 모듈, 앱과 확장 사이의 전역 모델 실행 순서를 보장하는 프로세스 간 잠금은 추가하지 않았다. 요청/청크별 새 LanguageModelSession을 생성한다. 기존 캡처 큐/DB 토큰도 유지한다. 앱과 확장은 서로 별도 프로세스·세션이며 프로세스 간 모델 호출 전체의 직렬화를 주장하지 않는다.
- 4096 컨텍스트에 지시·JSON 프롬프트의 UTF-8 바이트 추정, 스키마 1000·응답 1024·여유 256 토큰을 합산한다. 원문은 순서와 완전한 문장을 유지한 최대 600 UTF-8 바이트 청크로 나누며, 20,000바이트/40청크/총 10제안을 넘거나 한 문장이 청크를 넘으면 원문 축소를 요청한다. 잘린 문장을 임의로 분석하거나 부분 결과를 저장하지 않는다. SDK 컨텍스트 초과는 별도 한국어 오류로 전달하고 해당 세션을 폐기한다. 공급자 버전은 prompt-v3다. 다중 청크의 문장 간 의미 관계·실제 토큰 수·모델 정확도는 실기기 평가가 필요하다.
- Windows에서 기존 148개+새 알림 안내 3개, 총 JS 151개 및 타입 검사가 통과했다. 새 Swift 런타임 검사(설정 라우터·한국어/이모지 예산·모델 직렬화/실패/취소), 고해상도 파일 다운샘플/OCR 검사 및 실제 UI fallback·초안 보존 검사를 macOS CI에 연결했다. [cc983e3 품질 CI](https://github.com/kimps005/TTodo/actions/runs/44130531978)의 core/ios가 모두 성공했다. Xcode 26.6 / iOS Simulator SDK 26.5 / arm64에서 앱·위젯·공유 확장이 BUILD SUCCEEDED이며 개인정보 선언 12개와 루트 선언을 확인했다. 새 Swift 검사와 6000×4000 합성 한국어 파일의 다운샘플/OCR도 실제 macOS SDK로 통과했다. 변경 Swift 파일의 컴파일 오류·경고는 없었다. [첫 UI CI](https://github.com/kimps005/TTodo/actions/runs/44130532013/attempts/1)는 약 15분간 러너가 배정되지 않아 세 작업 모두 취소, 실행 전체는 failure다. GitHub annotation은 hosted runner 획득 실패와 macOS arm64 수용량 부족을 명시한다. 앱 빌드·XCTest에는 도달하지 않았으며 제품 회귀로 판정하지 않는다. 원인이 명시된 일시적 인프라 실패이므로 primary만 한 차례 재실행했다. 재실행 결과는 확인 중이다.
- DEVICE-QA.md의 사용자 미커밋 변경은 수정하거나 커밋하지 않았다. 파일 SHA-256은 E1805FFDAF71D645B6F173770EF9BBBDFB41E98120790D01AF1239C32FE0D828로 시작 전과 동일하다. 실제 iPhone 설치·서명과 실제 모델 정확도는 기존 보류 상태다.


## 2026-11-17 잠금 저장과 AI 철회

초기 코드 695eeb7의 CI에서 Swift 저장소·캡처·OCR은 통과했으나 시뮬레이터 SDK가 Darwin notify 함수와 SQLite 보호 플래그를 가져오지 못해 앱 빌드가 실패했다. 공개 Core Foundation 알림과 Foundation 파일 보호 속성으로 수정했다.

수정 커밋 `9b833c6`의 [품질 CI](https://github.com/kimps005/TTodo/actions/runs/44098547964)에서 JS 140개·타입·보안·iOS 번들, 네이티브 저장소·캡처·Vision OCR, iOS 시뮬레이터 앱·확장 빌드와 개인정보 선언 검사가 모두 통과했다. [UI 회귀 CI](https://github.com/kimps005/TTodo/actions/runs/44098547877)에서도 primary·oldest·compact 세 구성이 통과했다.

Windows에서 SQLite 상태 전이와 JS 테스트 140개를 통과했다. 별도 프로세스 강제 종료 후 롤백, 철회 후 DB 파일의 합성 OCR 문자열 제거, 승인 이력 보존, CRUD 커밋 후 갱신 요청을 검사했다. CI의 파일 접근 거부/복구 검사는 실제 iOS 키백과 Face ID 동작을 대체하지 않는다. 앱이 소유한 캐시의 삭제와 확장에 대한 취소 요청까지만 제어할 수 있다. 서명된 기기에서 잠금 입력, OS 표시 지연, 권한 거부 및 정지된 확장 복귀는 미검증이다.

기준일: 2026-11-17 (한국 시간)

## 캡처 파이프라인 보강과 전체 품질 CI 통과

- 최종 코드 대상은 `fa84a30`이다. [품질 CI](https://github.com/kimps005/TTodo/actions/runs/44068504306)의 core/ios가 모두 성공했다. JS 137개·타입·보안·Hermes, Swift 저장소/캡처/JSON 계약·실제 합성 한국어 Vision OCR·새 파이프라인 검사가 통과했다. Xcode 26.6 / iOS Simulator SDK 26.5 / arm64에서 앱·위젯·공유 확장이 BUILD SUCCEEDED이며 빌드 앱의 개인정보 선언 12개와 루트 선언을 확인했다. 로그에 컴파일 오류는 없었다.
- OCR 정규화 좌표로 상태바/홈 영역을 제외하고 Y/X 읽기 순서와 보수적인 좌우 화자 힌트를 적용했다. 프롬프트에 현재 날짜·시각·요일 및 메시지 날짜의 요일을 넣고 NSDataDetector와 메시지 기준일로 마감을 보조 검산한다. 기준일 없는 상대 날짜를 확정하지 않는다. 호스트/분석 시간대가 달라도 날짜만 있는 탐지 결과를 일관되게 비교한다.
- 앱·공유창·단축어는 모델 사용 불가 시 OCR 직접 선택 초안으로 전환한다. OCR/AI 구분은 신뢰도 0이 아니라 저장된 provider를 사용한다. 인식문 탭·수정·다중 선택·저장 전에는 할 일이나 마감 알림을 만들지 않는다. 동의·원문 보존/철회·개별 삭제 정책을 유지한다.
- 프로세스 내 FIFO, DB queued 상태와 시도별 UUID+밀리초 토큰으로 요청을 격리한다. 승인 고유 제약·트랜잭션·저장 후 재분석 금지를 유지한다. 제목·마감·설명이 같은 미완료 항목의 중복 저장은 막되 완료 이력과 설명·담당이 다른 별개 요청을 구분한다. 취소 안내와 새 요청이 함께 있는 문장도 보존한다. 선택별 마감 알림은 승인과 함께 설정을 저장하고 OS 예약은 커밋 뒤 수행한다. 권한 거부/예약 실패와 저장 성공을 구분한다.
- 앞선 `edbf2ed`의 [UI 실행](https://github.com/kimps005/TTodo/actions/runs/44066310538)도 세 작업 모두 성공했다. iPhone 16 Pro / iOS 26.5 및 26.2의 수동 수명주기와 iPhone SE 3 / iOS 26.5 / 최대 접근성 글자 흐름은 각각 지정 XCTest 1개 통과·실패/건너뜀 0이다. 작업별 로그의 커밋·기종·런타임·report·실제 XCTest 통과 기록을 대조했다. 후속 OCR 직접 선택 UI와 provider 변경의 실행 검증으로 승계하지 않는다. 최신 코드는 전체 품질 CI의 컴파일·단위 검사로 확인했다.
- 앞선 품질 실행 44066310506, 44066936816, 44067392074는 후속 소스로 대체되어 취소되었다. 해당 실행의 부분 성공을 전체 빌드 통과로 표시하지 않는다. 최종 결과는 44068504306에 한정한다.
- 실제 모델 생성·한국어 정확도·실기기 연속 캡처·알림 전달·잠금 동작은 미검증이다. 서명·설치 보류, 무료 개발, 공개 운영자/지원 정보 미정 방침을 유지한다. 이번 변경의 iPhoneOS Release 아카이브는 재실행하지 않았다. 구현 정책/한계와 남은 기기 QA는 [파이프라인 검증](PIPELINE-QA.md)에 기록했다. 기존 DEVICE-QA.md 사용자 수정은 보존하고 커밋에 포함하지 않는다.

## SDK 준비 수정 후 iOS 26.2 앱 수명주기 통과
- [ceb4804 UI 실행](https://github.com/kimps005/TTodo/actions/runs/44057175849)은 iPhone 16 Pro / iOS 26.2 (23C54) / large에서 성공했다. 원본 ZIP SHA-256 `e57ea2161b9bb37b56999e9db058b7c040b6b765460120cc88c3586548289f05`와 커밋·기종·OS·보고서·SDK summary/tests JSON을 대조했다. 지정 `testManualTaskLifecycleWithoutSettingsNavigation` 1개 통과·실패/건너뜀 0, 약 135.8초다.
- 기존 두 실패의 SDK 준비 단계를 지나 실제 Release 시뮬레이터 앱 빌드/XCTest까지 실행했다. 추가·재실행 후 보존·제목/마감 수정·완료/복원·날짜만 보존·삭제 취소/삭제·삭제 후 재실행·키보드 입력의 단일 저장을 확인했다. 완료 목록의 연도 포함 마감과 키보드로 저장한 할 일은 첨부 화면에서도 확인했다. 시작 로그에는 마지막 재실행의 저장소·로컬 스냅샷·권한·ActivityKit·boot_ready가 기록됐다.
- 이번 성공은 수정된 SDK 준비 순서와 수동 수명주기의 이전 iOS 검증이다. 과거 실패 실행을 성공으로 바꾸지 않으며 알림 설정·전체 데이터 삭제·실제 AI 생성/정확도·잠금 입력·실제 iPhone·VoiceOver 성공을 뜻하지 않는다. 기존 최신 iOS와 작은 화면·최대 글자 결과는 별도 실행의 성공으로 유지한다. 실제 iPhone 설치 보류와 운영자/지원 정보 미정도 유지한다.

## 수정 순서로 이전 iOS 앱 UI 재검증 착수
- [ceb4804 수동 수명주기 검사](https://github.com/kimps005/TTodo/actions/runs/44057175849)를 iPhone 16 Pro / oldest-installed / large로 실행했다. SDK 준비만 통과한 뒤 남아 있던 실제 앱·XCTest 검증이며, 결과 확인 전이다. 기존 알림 설정 진단과 실기기 서명 경로는 재개하지 않았다.
- Windows에서 테스트 130개·타입·UI runner Node 구문·diff 검사를 통과했다. 준비 순서와 최신 검증 범위를 CI-VALIDATION/MVP-READINESS에도 반영했다. 기존 DEVICE-QA.md 수정은 보존하고 커밋에서 제외한다.

## 수정된 SDK 준비 순서의 iOS 26.2 검증 통과
- [d9639e5 준비 검증](https://github.com/kimps005/TTodo/actions/runs/44055891320)은 과거 두 실패와 같은 러너 이미지 20261112.0504.1, iPhone 16 Pro / iOS 26.2 (23C54)에서 성공했다. 원본 ZIP의 SHA-256과 커밋을 대조했다. SDK 도움말은 기기 생성 전 0.320초, 종료 0, 신호 없음이었다. stderr 1,776바이트가 비교 진단의 성공 9건과 바이트 단위로 일치했다.
- 부팅 완료 대기 144.819초 후 실제 `content_size large` 설정은 76.807초, 재조회는 2.171초였고 원문은 `large`였다. 일회성 기기 삭제까지 모든 명령이 종료 0, 실패·생략 0이다. 기존 도움말 제한 60초와 기기 설정·조회 제한 240초를 각각 유지했다. 부팅 직후 첫 기기 명령에는 여전히 시간이 걸린다.
- 앱·Pods 빌드 없는 별도 진단에서 수정된 준비 순서를 검증했다. 이번 결과로 이전 실패 실행의 XCTest 상태는 바뀌지 않으며, 수정 후 iOS 26.2 제품 UI 수명주기는 아직 실행하지 않았다. 아래 표에 수정 근거가 된 비교 측정과 스택의 한계를 기록했다.

## iOS 26.2 부팅 직후 도움말 지연 재현과 준비 순서 수정
- [분리 진단 873452e](https://github.com/kimps005/TTodo/actions/runs/44054707985)의 세 ZIP SHA-256·커밋·기종·빌드를 대조했다. macOS 26.7.2 (25G332), Xcode 26.6 (17F113), SDK 26.5, iPhone 16 Pro / 26.2 (23C54). 과거 UI 두 시도의 러너 이미지 버전은 20261112.0504.1, 이번 세 러너는 20261102.0473.1이다. 앱·Pods 빌드는 없었다.
- `xcrun --find simctl`은 `/Applications/Xcode_26.6.app/Contents/Developer/usr/bin/simctl`을 반환했다. 비교 두 러너에서 최초 탐색 1.052/0.871초, 부팅 후 도움말 쌍 뒤 탐색 0.160/0.110초다. 원래 순서 대조군의 도움말 뒤 탐색은 1.356초다.

| 러너별 호출 순서 | 부팅 전 도움말(초, 순서대로) | 부팅 직후 도움말(초, 순서대로) |
| --- | --- | --- |
| xcrun → 직접 | 0.202 → 0.191 | 54.504 → 5.659 |
| 직접 → xcrun | 0.196 → 0.236 | **79.070 경과 후 시간 초과** → 23.238 |
| 기존처럼 부팅 후 첫 도움말 | 사전 도움말·명시적 탐색 없음 | xcrun 53.958 → 경로 탐색 → 직접 4.375 |

- 도움말 성공 9건은 종료 0·신호 없음·stdout 0·stderr 1,776바이트. 직접 선행의 부팅 후 첫 호출은 제한 60초, ETIMEDOUT·SIGTERM·종료 코드 null·두 출력 모두 0바이트였다. 같은 러너의 후속 성공과 별도로 진단 job은 실패를 유지했다.
- 세 러너의 느린 성공 호출 스택에는 CoreSimulator 내부 실행 파일(`/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/Resources/bin/simctl`)과 `SimServiceContext` 초기화·런타임 프로필 읽기가 보인다. 시간 초과 난 직접 호출도 프로세스 목록에서 이 실행 파일에 도달했으나 해당 PID의 스택 수집은 실패했다. 직접 경로에서도 지연이 발생했고 순서를 바꾸면 두 번째 호출이 빨랐다. 호스트 부하·캐시·부팅 후 경과 시간의 개별 기여나 과거 두 호출의 정확한 내부 대기는 확정할 수 없다.
- UI runner의 기기 ID가 필요 없는 SDK 도움말 검사를 기기 생성 앞으로 이동했다. 실제 부팅 완료 → 글자 크기 설정 → 재조회 일치 검사와 기존 제한을 유지한다. 새 순서의 독립 macOS 검증은 결과 확인 전이다. 기존 최신 iOS·최대 글자 XCTest 통과와 이전 iOS 준비 실패는 각각 유지한다.
- Windows 테스트 130개·타입·Node/Bash 구문·workflow YAML·diff 검사를 통과했다. 비교 중 보조 셸까지 샘플링된 자료를 확인해 이후 수집 대상을 실행 중인 xcrun/simctl 및 그 자식으로 좁혔다.

## iOS 26.2 SDK 도움말 지연 비교 준비
- 앱·Pods 설치와 빌드가 없는 수동 macOS 진단을 추가했다. 기존 선택기로 iPhone 16 Pro / 26.2 (23C54)를 확인하고 두 러너에서 부팅 전·후 경유/직접 호출 순서를 반대로 비교한다. 세 번째 러너는 기존처럼 부팅 직후 첫 도움말을 xcrun으로 호출한다. 모두 60초 제한을 유지한다.
- 실제 경로·버전, 명령별 시각·소요 시간·종료 코드·신호·오류·두 출력 스트림을 보존한다. 12초 이상 실행 중인 탐색/도움말은 호스트 프로세스 스택 수집도 시도한다. 실제 macOS 결과와 필요한 수정은 확인 전이다.

## 새 채팅으로 SDK 준비 지연 진단 인계
- [3fad024 UI 실행](https://github.com/kimps005/TTodo/actions/runs/44048082961)의 oldest 두 번째 시도도 iOS 26.2 / iPhone 16 Pro 부팅 뒤 text-size 단계에서 `simctl ui help failed (status=null, signal=SIGTERM, error=spawnSync xcrun ETIMEDOUT)`로 실패했다. 명령 제한은 60초였고 앱 빌드/XCTest에는 도달하지 않았다. 두 번째 작업 ID는 133931509924, artifact ID는 14315116548이다. 최신 iOS·최대 글자 성공은 유지하지만 전체 UI 실행을 성공으로 표시하지 않는다.
- 사용자는 앱 빌드 없이 xcrun 경로 탐색과 부팅 전·후 도움말 호출을 나누는 근본 원인 진단을 선택했다. 이후 현재 작업을 마무리하고 새 채팅용 프롬프트를 요청하여 진단 workflow·스크립트 구현과 새 실행은 시작하지 않았다. [인계 문서](SDK-PREP-DIAGNOSTIC-HANDOFF.md)에 범위·자료·주의점을 정리했다.
- 이 시점에 실행 중인 CI는 없다. 사용자 수정인 DEVICE-QA.md의 한 줄은 보존하고 커밋에 포함하지 않는다. 실기기 설치/서명·실제 모델 정확도·공개 운영자/지원 정보 의존성은 기존 보류 상태다.

## 스크롤 수정·시작 진단을 포함한 iPhoneOS Release 아카이브
- [5bcfaee 서명 없는 Release 아카이브](https://github.com/kimps005/TTodo/actions/runs/44052256985) 성공. Xcode 26.6 / iPhoneOS SDK 26.5, ARCHIVE SUCCEEDED, arm64 Mach-O 실행 파일·위젯/공유 확장 포함 검사·Info.plist·개인정보 선언 12개 수집을 확인했다.
- 3fad024와 5bcfaee 사이의 변경은 CI-VALIDATION/MVP-READINESS/STATUS 문서뿐이다. 따라서 이번 아카이브에는 탭 스크롤 분리와 고정 시작 단계 진단도 포함한다. 실제 계정·프로비저닝·iPhone 설치·잠금 입력·AI 정확도 검증은 아니다. 이전 iOS UI의 두 번째 시도는 진행 중이다.

## 스크롤 분리·시작 진단의 전체 품질 CI
- [3fad024 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/44048082960)의 core/ios 모두 성공했다. 130개 JS 테스트·타입·보안·Hermes, Swift 저장소·캡처/JSON 계약·합성 Vision OCR, 앱·위젯·공유 확장 시뮬레이터 빌드와 개인정보 선언 12개 수집을 확인했다. 이 소스의 iPhoneOS 아카이브·실기기 검증은 없다.
- [세 환경 UI](https://github.com/kimps005/TTodo/actions/runs/44048082961)의 oldest는 iOS 26.2 부팅 뒤 `simctl help ui`가 60초에 응답하지 않아 text-size 준비 단계에서 실패했다. ZIP SHA256·커밋·report를 대조했으며 앱 빌드/XCTest에 도달하지 않았다. 제품 성공/회귀로 판단하지 않는다. 다른 두 작업 진행 중에는 GitHub가 동일 실행의 부분 재실행을 거부하여 완료 뒤 해당 작업만 한 차례 재시도할 예정이다. 이전 OS 명령 지연과 이번 지연의 근본 원인은 미확정이다.
- 첫 실행의 primary(iPhone 16 Pro / iOS 26.5) 수동 수명주기와 compact(iPhone SE 3세대 / iOS 26.5 / 최대 접근성 글자)는 지정 XCTest 각각 1개 통과·실패/건너뜀 0이다. 두 ZIP SHA256·커밋과 SDK summary/tests를 로컬 집계기로 재대조했다. primary 시작 로그는 재실행마다 저장소·로컬 스냅샷·권한·ActivityKit·boot_ready까지 도달했다. 앞선 42cce33 시작 대기는 재현되지 않았으나 원인은 미확정이다.
- compact는 설정 제목의 즉시 탭 가능, 실제 네이티브 상태 재조회 후 카드 없음/OS 비허용 중 하나인 레이블, 홈 복귀 뒤 정확한 초안 보존을 단언했다. 설정 제목의 맨 위 표시는 첨부 화면에서도 확인했다. 카드 상태 첨부에는 다음 안내문이 보이고 초안 캡처는 말줄임돼 있어 두 전체 문자열을 시각 확인했다고 주장하지 않는다. 카드 생성·실제 잠금화면·VoiceOver는 미검증이다. 실패한 oldest 작업만 재실행 요청이 수락되어 두 번째 시도 진행 중이다.

## 최신 CI 호스트의 실제 모델 가용성 재확인
- UI 첨부의 ‘기기 내 AI 사용 가능’ 표시는 생성 성공이 아니므로 [3fad024 호스트 점검](https://github.com/kimps005/TTodo/actions/runs/44048374197)을 실행했다. 보고서 ZIP SHA256과 커밋을 대조했다. macOS 26.7.2 CI 호스트는 `device_not_eligible`이며 inference_attempted/inference_completed/accuracy_measured 모두 false다.
- 점검 작업 성공은 가용성 확인 완료를 뜻하며 실제 모델 생성·iOS 실행·한국어 정확도 성공이 아니다. 이 자료만으로 시뮬레이터 표시의 원인이나 모델 실행 가능성을 확정하지 않는다. 외부 AI나 서명 경로는 추가하지 않았다.

## 탭 스크롤 분리와 최신 iOS 시작 대기 조사
- [42cce33 세 환경 UI](https://github.com/kimps005/TTodo/actions/runs/44030805430)는 oldest(iPhone 16 Pro / iOS 26.2)에서 수동 수명주기 1개 통과·실패/건너뜀 0이다. ZIP SHA256·커밋·report/summary/tests JSON을 대조했고 완료 목록에 연도를 포함한 마감 표시를 첨부 화면에서도 확인했다. 실제 AI 출처·검토 화면은 이 수동 검사에 포함하지 않는다.
- compact(iPhone SE 3세대 / iOS 26.5 / 최대 글자)는 설정 제목 탐색에서 실패했다. 실패 직전 화면은 설정의 첫 안내 카드이고 설정 탭이 선택돼 있다. 앱은 전경 실행 중이며 제목의 프레임은 y=-517.5로 화면 위쪽이다. 다른 탭과 같은 ScrollView를 사용해 스크롤 위치를 재사용하는 구조를 수정하여 탭 전환 시 새 화면의 위에서 시작하도록 했다. 초안은 상위 상태에 유지하며 XCTest에 설정 제목의 즉시 탭 가능 단언을 추가했다. 이전의 앱 자식 없는 탭 복귀 실패와 같은 원인이라고 확정하지 않는다.
- primary(iPhone 16 Pro / iOS 26.5)는 최초 저장 뒤 앱 재실행에서 항목을 찾지 못했다. 마지막 접근성 트리에는 로딩 표시가 남아 있어 데이터 유실로 단정하지 않는다. 저장소 열기·로컬 스냅샷·권한 조회·ActivityKit 조회·화면 준비의 고정된 단계명만 합성 CI 실행 환경에서 기록하도록 추가했다. 정상 앱에서는 기록하지 않고 OCR·제목·원문·이미지·권한값·SQL을 로그에 넣지 않는다. 재현 여부와 대기 원인은 후속 CI 확인 전이다.
- Windows 전체 130개 테스트·타입·UI runner 구문 검사를 통과했다. 새 화면/네이티브 빌드·실기기·VoiceOver 검증은 후속 실행 전이며 이전 전체 품질/아카이브 성공을 이번 수정으로 승계하지 않는다.

## 최신 카드 상태·마감 표시 변경의 전체 품질 CI
- [42cce33 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/44030805582)의 core/ios 모두 성공했다. 130개 JS 테스트·타입·취약점 0·Hermes, Swift 저장소·캡처/JSON 계약·합성 Vision OCR, 앱·위젯·공유 확장 시뮬레이터 빌드와 개인정보 선언 12개 수집을 로그에서 확인했다.
- 완료 목록의 마감/AI 출처와 연도, 검토 중 편집한 마감 요약, ActivityKit 상태 조회까지 포함한다. [세 환경 UI 검사](https://github.com/kimps005/TTodo/actions/runs/44030805430)와 [서명 없는 iPhoneOS Release 아카이브](https://github.com/kimps005/TTodo/actions/runs/44030964495)는 진행 중이며 완료로 기록하지 않는다. 앞선 b76d509/ddfbdd9 품질 CI와 b76d509 UI는 최신 실행으로 대체되어 취소됐으므로 통과로 집계하지 않는다.
- 이후 같은 소스의 [서명 없는 iPhoneOS Release 아카이브](https://github.com/kimps005/TTodo/actions/runs/44030964495)도 성공했다. Xcode 26.6 / iPhoneOS SDK 26.5, ARCHIVE SUCCEEDED, arm64 Mach-O 실행 파일·두 확장 포함 검사·Info.plist 검증·개인정보 선언 12개 수집을 확인했다. 계정·프로비저닝·설치·실기기 검증은 진행하지 않았다. UI 검사는 별도 확인 중이다.

## 큰 목록 카드의 시스템 상태 확인
- PRD 5.5에서 빠져 있던 앱 실행·전경 복귀 시 큰 목록 카드 상태 조회를 추가했다. 설정에서 ActivityKit의 활성·갱신 필요·진행 중 카드 없음·실시간 현황 비허용을 안내하고 재조회할 수 있다. 조회 실패는 별도 안내하며 수동 할 일 사용을 막지 않는다. 자동 시작이나 잠금화면 표시 성공을 추정하지 않는다.
- 카드가 없을 때 기존 시작 버튼과 별도 작은 위젯의 복구 경로를 안내한다. 실제 활성/만료/제거와 화면 확인 절차는 WIDGET-QA.md에 추가했다. Apple 공식 active/stale 정의를 확인했고 실제 SDK 컴파일은 후속 CI에서 검증한다.
- Windows 130개 테스트·타입 검사·iOS JS 번들(바이트코드 제외) 통과. 최대 글자 XCTest에 새 설치 상태 재조회 검사를 추가했다. 네이티브 빌드·시뮬레이터 화면 실행 전이며 실제 iPhone 카드 생성·수명·권한 변경·VoiceOver는 미검증이다. 기존 DEVICE-QA.md 사용자 수정은 포함하지 않는다.

## 검토 중 편집한 마감 요약 갱신
- PRD 8.2·12.4의 날짜 수정 흐름에서 날짜를 바꾸거나 지워도 기존 AI 마감을 계속 표시하던 문제를 수정했다. 검토 요약과 승인 입력은 같은 변환을 사용한다. 미완성·잘못된 입력은 확인 안내를 표시하고 승인 시에도 검증한다.
- 날짜를 건드리지 않은 제안은 원래 시간대·초·밀리초를 보존한다. 합성 제안의 마감 편집·해제·잘못된 입력·원본 정밀도 회귀를 포함한 Windows 전체 130개 테스트·타입 검사·iOS JS 번들(바이트코드 제외)·diff 검사 통과. 실제 AI 결과의 화면 조작·iPhone·모델 정확도는 미검증이다.

## 완료 목록의 마감·AI 출처 표시
- PRD 8.2에 따라 완료한 할 일에도 마감과 AI 제안 표시를 유지한다. 미완료/완료 목록은 같은 표시 컴포넌트를 사용하고, AI 출처는 상세 버튼의 접근성 레이블에도 포함한다. 큰 글자에서는 마감과 출처가 다음 줄로 배치될 수 있다.
- 앱 목록·검토의 마감에 연도를 포함해 다른 해의 같은 월·일을 구별한다. 저장 데이터·정렬·위젯은 변경하지 않았다.
- Windows 전체 127개 테스트·타입 검사·iOS JS 번들(바이트코드 제외) 통과. 수동 수명주기 XCTest에 마감 연도와 완료 후 목록 레이블 유지 검사를 추가했으나 새 시뮬레이터 UI 실행·네이티브 빌드·실제 VoiceOver/iPhone은 후속 검증 전이다. 기존 DEVICE-QA.md 사용자 수정은 포함하지 않는다.

## 작은 화면·최대 글자의 탭 복귀 검사 실패 조사
- [52155a0 UI 실행](https://github.com/kimps005/TTodo/actions/runs/44002198578)의 primary(iOS 26.5)·oldest(iOS 26.2)는 iPhone 16 Pro에서 수동 수명주기 지정 검사 각각 1개 통과·실패/건너뜀 0이다. 완료 후 재실행·상세 완료 표시와 복원 후 재실행·상세 미완료 표시를 포함한다.
- compact(iPhone SE 3세대 / iOS 26.5 / 최대 접근성 글자)는 1개 실행·1개 실패다. 첨부 화면에서 입력·저장·새 상세 미완료 상태·미저장 초안 입력·설정 진입까지 확인했다. 할 일 탭 복귀 후 입력칸 탐색이 실패했으며 마지막 접근성 스냅샷에는 앱 자식 요소가 없었다. 시스템 로그의 SIGTERM은 테스트 실패 직후 정리 시점이므로 사전 앱 크래시 근거로 해석하지 않는다. 앱 동작/레이아웃/탐색 중 어느 문제인지는 미확정이다.
- 화면 사후 캡처는 테스트 정리 뒤 홈 화면이라 실패 시점을 판정할 수 없다. XCTest의 탐색 실패 직전에 실제 화면·타깃/앱 접근성 트리·앱 실행 상태를 첨부하고 탭 복귀 직후 화면도 기록하도록 보강했다. 기존 존재/탭 가능 단언·탐색 횟수와 앱 코드는 변경하지 않는다. 진단 추가 후 실제 재현 검사는 후속 실행 전이다.
- [7fe3be3 단독 재검사](https://github.com/kimps005/TTodo/actions/runs/44025975218)는 같은 iPhone SE 3세대 / iOS 26.5 / 최대 접근성 글자에서 지정한 `testLargeTextInputEditingAndNavigation` 1개 실행·1개 통과, 실패/건너뜀 0이다. 내려받은 SDK summary/tests JSON을 로컬 집계기로 재대조했다. 탭 복귀 직후 화면은 홈이고, 미저장 초안의 정확한 문자열 보존은 XCTest 단언으로 확인했다. 보존 첨부 화면에서 입력칸은 위쪽 화면 밖이므로 문자열 자체를 시각 확인했다고 주장하지 않는다.
- 첫 실패는 제품 코드·단언·탐색 횟수를 바꾸지 않은 재실행에서 재현되지 않았다. 근본 원인은 미확정이며 해결 완료로 표시하지 않는다. 이후 같은 문제가 나면 새 실패 직전 화면/트리를 사용한다. 실제 VoiceOver·iPhone·오프라인 네트워크 차단·잠금 입력·AI 정확도는 이 검사에 포함하지 않는다.

## 상세 화면의 완료 상태 표시
- PRD 8.2의 할 일 상세 요구사항에 따라 완료·미완료 상태를 텍스트와 VoiceOver 레이블로 표시한다. 목록의 완료 처리와 저장 방식은 그대로 유지한다.
- 타입 검사·iOS JS 번들(바이트코드 제외)·diff 검사 통과. 수동 수명주기 XCTest에 완료 후 앱 재실행·상세 완료 표시, 복원 후 재실행·상세 미완료 표시 단언을 추가했다. 시뮬레이터 UI 실행·실제 VoiceOver·iPhone 검증은 후속 확인 전이다.
- [52155a0 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/44002198565)의 core/ios 모두 성공했다. 125개 테스트·타입·보안·Hermes, Swift 저장소·캡처·계약·합성 Vision OCR과 앱·위젯·공유 확장 빌드·개인정보 선언 수집을 통과했다. 별도 화면 XCTest 결과는 아래에 분리해 기록한다.

## 홈 날짜 변경 시 마감 정렬 갱신
- PRD 5.6의 오늘 마감 우선순위와 홈 날짜를 같은 시각 기준으로 계산한다. 앱을 켜 둔 채 자정을 지나도 날짜와 정렬이 갱신되고, 전경 복귀 시 즉시 다시 계산한다. 시계·시간대 변경은 전경에서 최대 1분 안에 확인하며 백그라운드에서는 타이머를 중지한다. 타이머는 DB·네트워크에 접근하지 않는다.
- Windows 전체 125개 테스트·타입 검사·iOS JS 번들(바이트코드 제외)·diff 검사를 통과했다. 가상 시계로 자정 직후 정렬, 앞뒤 날짜 이동, 같은 날 시간대 오프셋 변경, 중지 후 지연 콜백과 재시작을 확인했다. 실제 iPhone의 자정/시간대 변경·네이티브 SDK 빌드와 화면 통합 검증은 후속 검증 전이다. 기존 DEVICE-QA.md 사용자 수정은 포함하지 않는다.
- [5027897 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/44001276632)의 core/ios 모두 성공. 로그에서 125개 테스트·타입·보안 취약점 0·iOS Hermes 번들, Swift 저장소·캡처·JSON 계약·합성 Vision OCR, 앱·위젯·공유 확장 빌드와 개인정보 선언 수집을 확인했다. 별도 Windows 실행에서 뉴욕의 2026년 일광절약시간 시작·종료 때도 오프셋 변화를 감지하고 타이머를 1분 이내로 유지함을 확인했다. 실제 iPhone의 자정·시간대 변경이나 화면 통합 성공으로 해석하지 않는다.

## 유사 분석 승인 보호의 전체 CI·iPhoneOS 아카이브 통과
- [06863bc 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43999171606)의 core/ios 모두 성공. 로그에서 121개 JS 테스트·타입·보안 취약점 0·Hermes와 Swift 재분석 확인 보호·신규/변경 유사 분석 승인 차단·새 확인 후 저장·승인 재전송 중복 방지, JSON 계약·합성 Vision OCR, 앱·위젯·공유 확장 빌드를 확인했다.
- [같은 커밋의 서명 없는 iPhoneOS Release 아카이브](https://github.com/kimps005/TTodo/actions/runs/43999247359)도 성공. Xcode 26.6 / iPhoneOS SDK 26.5의 ARCHIVE SUCCEEDED, arm64 Mach-O 실행 파일·두 확장 포함 검사·Info.plist 검증·개인정보 선언 12개 수집을 확인했다. 계정·서명·설치·배포 경로는 변경하지 않았다.
- [MVP 구현 현황](MVP-READINESS.md)에 P0 12개 기능의 코드·CI·실기기 검증 수준을 모았다. 실제 iPhone 서명/설치가 보류되어 잠금 입력·캡처 자동화·실제 모델 생성/한국어 정확도·VoiceOver 등은 미완료다. 운영자/지원 연락처와 최종 출시 자산·심사 준비도 남아 있으며 구현/빌드 성공을 출시 완료로 표시하지 않는다.
- 위 기록 이후 변경은 문서뿐이다. 문서 링크·diff를 검사하며 불필요한 CI 재실행을 피하기 위해 기록 커밋의 CI는 생략한다. 기존 DEVICE-QA.md 사용자 수정은 포함하지 않는다.

## 유사 분석 저장 확인의 DB 재대조
- 저장 확인 뒤 다른 경로에서 비슷한 분석이 추가되거나 표시 내용·저장 상태가 바뀌면 앱과 공유창 모두 승인 트랜잭션에서 차이를 감지해 할 일 생성을 차단한다. 공유창 확인 버튼도 이전 비교 대상을 승인한 것으로만 취급하며 최신 내용을 다시 확인하도록 안내한다.
- 실제 SQLite 회귀 검사는 수정 전 실패했고 수정 후 Windows 전체 121개 테스트·타입·iOS JS 번들(바이트코드 제외)·diff 검사를 통과했다. 새 비교 목록을 확인한 저장과 동일 승인 재전송의 중복 방지도 확인했다. Swift의 같은 저장/거부 검사를 추가했으며 실행·SDK 빌드는 후속 CI 확인 전이다. 실제 확인창·다른 프로세스 경합·모델 정확도·iPhone은 미검증이다.

## 공유창 재분석 보호의 전체 품질 CI 통과
- [be068b3 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43998152866)의 core/ios가 모두 성공했다. Swift 저장소·캡처의 오래된 재분석 확인 거부, JSON 계약·합성 Vision OCR, 120개 JS 테스트·타입·보안·Hermes, 앱·위젯·공유 확장 시뮬레이터 빌드와 개인정보 선언 수집을 통과했다.
- 후속 유사 분석 저장 확인 변경, 실제 공유창의 확인 조작·iPhone·모델 정확도는 이 결과에 포함하지 않는다.

## 공유 확장 재분석 확인 뒤 제안 교체 보호
- 공유창의 재분석 확인 당시 분석 ID·상태·제안 ID를 기록하고 실제 등록 트랜잭션에서 다시 대조한다. 다른 경로가 새 결과를 만든 뒤 예전 확인을 승인해도 최신 제안을 삭제하거나 OCR/모델을 시작하지 않는다. 거부된 요청은 최신 알림도 지우지 않는다.
- 실제 Swift 저장소와 CaptureProcessor에 오래된 확인 거부·다른 지문 거부·분석 중 상태 보호·새 확인 후 재분석 검사를 추가했다. Windows 120개 테스트·타입·diff 통과. Swift 회귀 실행과 공유 확장 SDK 빌드는 후속 CI 확인 전이며 실제 iPhone·확인창 조작·AI 정확도는 미검증이다.

## 정확한 원문 근거 검사의 전체 품질 CI 통과
- [1114b1a 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43919921374)의 core/ios가 성공했다. 타입·테스트·보안·iOS 번들, Swift 저장소·캡처와 JSON 계약, 합성 한국어 Vision OCR, 앱·확장 시뮬레이터 빌드·개인정보 선언 수집을 통과했다.
- 실제 모델이 정확한 근거를 생성하는 비율·실제 iPhone과 이번 공유창 재분석 변경은 이 실행에 포함하지 않는다.

## 원문 근거 일치의 데이터 처리 문서 반영
- 새 분석의 정확한 원문 부분 문자열 검사와 수정된 OCR 입력의 기준, 과거 결과의 사후 대조 불가를 개발용 데이터 처리 문서에 기록했다.
- 문서 diff 검사만 수행했다. 실제 모델 정확도·거부 빈도와 iPhone 동작은 미검증이다. 진행 중인 품질 CI를 취소하지 않도록 문서 커밋은 CI를 생략한다.

## AI 원문 근거의 정확한 일치 검사
- 공백·문자 형태를 정규화하면 같지만 실제 OCR 원문에 없는 문장이 원문 근거로 저장될 수 있던 문제를 수정했다. TypeScript와 Swift가 입력에 연속으로 존재하는 근거만 허용한다. 근거가 달라지면 자동 저장하지 않고 기존 분석 오류를 안내한다.
- TypeScript 회귀 검사는 수정 전 실패했고 수정 후 Windows 전체 120개 검사·타입 검사·iOS 번들 통과. 전각 공백·연속 공백·분해 한글과 정확히 일치하는 근거를 검사했다. Swift 회귀와 네이티브 빌드는 후속 CI가 필요하며, 실제 모델이 정확한 근거를 반환하는 비율과 iPhone 동작은 미검증이다.
- 이 검사는 변경 후 새 분석에 적용된다. 기존 분석은 전체 OCR 원문을 보관하지 않으므로 이미 저장된 근거가 실제 원문의 부분 문자열인지 사후 재검증하지 못한다.

## 독립 수동 할 일 UI 검사 준비 단계 실패
- [c198f87 UI 실행](https://github.com/kimps005/TTodo/actions/runs/43912226252)은 iOS 26.5 / iPhone 16 Pro 시뮬레이터 부팅 후 `simctl help ui`가 60초 제한을 넘어 실패했다. 앱 UI 빌드와 XCTest에는 도달하지 않아 삭제 취소나 제품 동작의 성공·실패로 간주하지 않는다.
- Pods 설치와 사전 타입·테스트는 통과했다. 시스템 명령이 응답하지 않은 근본 원인은 미확정이며 같은 실패 작업을 다시 실행해 재현 여부를 확인한다. 실기기·잠금 입력·AI 정확도와 사진·알림 검사는 이 실행에 포함되지 않는다.
- 진단 산출물의 bootstatus는 약 1분 56초 뒤 완료이고 실패 화면은 시뮬레이터 홈이었다. `simctl help ui` 출력 파일은 비어 있었다. 이 정보만으로 호스트 명령 지연의 원인을 특정할 수 없다.
- 두 번째 실행은 그 단계 전에 React Native Core 의존성 다운로드 연결이 초기화되어(curl 56) Pods 설치에서 실패했다. 첫 번째 도움말 시간 초과의 재현 여부는 판단할 수 없고 XCTest도 실행되지 않았다. 첫 실패와 별개의 네트워크 오류다.
- 세 번째 실행은 iOS 26.5 / iPhone 16 Pro 시뮬레이터에서 지정한 `testManualTaskLifecycleWithoutSettingsNavigation` 1개 실행·1개 통과, 실패·건너뜀 0으로 완료됐다. 추가·편집·완료·복원·삭제 취소 후 보존·삭제와 재실행 후 유지, 키보드 입력을 확인했다. 이전 시간 초과와 연결 초기화는 이번에 재현되지 않았으나 근본 원인은 확정하지 못했다. 실제 iPhone·잠금 입력·AI 정확도, 전체 삭제·동의·사진·알림 검사는 포함하지 않는다.

## 평가 JSON의 UTF-8 BOM 처리
- Windows 편집기가 UTF-8 BOM을 붙인 평가 결과·판정 파일도 두 개발용 명령에서 읽도록 했다. 입력 파일 내용은 변경하지 않는다.
- 실제 명령에 BOM이 있는 합성 JSON을 전달해 검사했고 Windows 전체 119개 검사·타입 검사 통과. 다른 인코딩의 지원은 검증하지 않았다. 진행 중인 네이티브 CI를 취소하지 않도록 개발용 명령 커밋은 CI를 생략한다.
- [c198f87 JS 전용 CI](https://github.com/kimps005/TTodo/actions/runs/43912123353)에서 119개 검사·타입·보안·iOS 번들이 통과했다. macOS 작업은 생략했으며 실제 iPhone이나 모델 평가 검사는 아니다.

## AI 평가의 마감 정답 판정 대조
- 사람이 마감을 정답으로 표시한 경우 연결된 모델 출력의 날짜·정밀도도 정답과 일치하는지 검사한다. 시각은 시간대 표기가 달라도 같은 순간이면 허용한다. 명시 마감 여부와 작업 연결의 의미 판단은 사람이 수행한다.
- 합성 날짜 불일치와 동일 순간·다른 순간 검사 포함 Windows 전체 119개 검사·타입 검사 통과. 실제 모델 정확도 측정은 없다. 개발용 집계기 변경의 CI는 푸시 후 확인한다.
- [d8d589b 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43910609298)는 core와 ios 모두 성공했다. 타입·테스트·보안·iOS 번들, Swift 저장소·캡처, 합성 한국어 Vision OCR, 시뮬레이터 앱·확장 빌드와 개인정보 선언 수집이 통과했다. 후속 BOM 처리와 실제 iPhone·AI 정확도는 포함하지 않는다.

## AI 집계 도구 Linux 품질 검사
- [168325a JS 전용 CI](https://github.com/kimps005/TTodo/actions/runs/43910021808)에서 새 집계기·양식 명령을 포함한 118개 검사, 타입 검사, 보안 취약점 0개 및 iOS 번들이 통과했다. 이 실행은 macOS 작업을 의도적으로 생략했으며 네이티브 빌드 성공으로 간주하지 않는다.
- 실제 모델 출력과 사람의 실제 판정은 아직 없으며 합성 검사 결과를 정확도로 표시하지 않는다.

## AI 집계의 출처와 처리 시간
- 집계 결과에 제공자·데이터셋 버전·평가 시각·OS와 비어 있지 않은 입력의 전체·분류별 P50/P90 처리 시간을 포함한다. 빈 입력은 모델 호출 없이 처리되므로 시간 집계에서 제외하고, 시간은 모델 연산뿐 아니라 호출·검증을 포함한다고 명시한다.
- 합성 시간의 백분위·빈 입력 제외·비정상 시간 거부와 기존 전체 118개 검사, 후속 집계 검사 4개·타입 검사 통과. 실제 모델 성능 수치는 없다. 개발용 명령 변경이며 진행 중인 네이티브 CI를 취소하지 않도록 CI를 생략한다.

## 판정 양식의 UTF-8 파일 생성
- 양식 생성 명령이 출력 경로를 받으면 UTF-8 파일을 직접 만들고 같은 이름의 기존 파일은 덮어쓰지 않는다. 셸 리디렉션 인코딩 차이로 판정 JSON을 읽지 못하는 문제를 방지한다.
- 임시 파일 생성·재실행 시 기존 내용 보존 포함 Windows 전체 118개 검사와 타입 검사 통과. 개발용 CLI만 변경했으며 진행 중인 네이티브 CI를 취소하지 않도록 CI를 생략한다.

## AI 수동 판정 빈 양식 생성
- 완료된 평가 결과와 정답셋을 대조한 뒤 모든 연결·마감 판단이 비어 있는 판정 파일 양식을 생성한다. 사람이 빈 배열 또는 판정값을 명시하기 전에는 집계를 거부한다.
- 합성 자료로 양식·미작성 판정 거부·명령 실행을 검증했고 Windows 전체 118개 검사·타입 검사 통과. 실제 모델 평가나 사람의 실제 판정은 수행하지 않았다. 진행 중인 네이티브 CI를 취소하지 않도록 개발용 명령 커밋은 CI를 생략한다.

## 수동 판정 기반 한국어 AI 평가 집계기
- 사람이 작성한 일대일 작업 연결과 명시 마감 판정으로 전체·분류별 TP/FP/FN, 정밀도·재현율·마감 정확도와 빈 입력/비어 있지 않은 입력의 오탐률을 집계하는 로컬 명령을 추가했다. 정답셋과 다른 입력·정답·시점, 누락된 사례, 오류 결과, 중복 연결과 모순된 마감 판정을 거부한다. 의미 판정은 사람에게 남긴다.
- 합성 입력으로 집계·오류·누락·중복과 실제 명령의 파일 입출력을 검증했고 Windows 전체 117개 검사·타입 검사 통과. 실제 모델 실행·사람의 실제 판정·정확도 측정은 없다. 앱 코드 변경이 없는 개발용 명령이며 진행 중인 macOS 재검사를 취소하지 않도록 CI를 생략한다.
- [76ed257 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43905407776) 첫 실행은 core와 Swift 저장소·캡처·합성 OCR이 성공했으나 Pods 설치에서 Hermes 다운로드 연결 초기화(curl 56)로 실패했다. 시뮬레이터 빌드에는 도달하지 못했으며 같은 실패 작업을 재실행 중이다.
- 같은 CI의 두 번째 실행은 Pods 설치와 시뮬레이터 앱·확장 빌드, 개인정보 선언 수집까지 성공했다. 앞선 연결 초기화는 재실행에서 재현되지 않았지만 근본 원인을 확정할 수 없다. 후속 개발용 집계기 변경과 실제 iPhone·AI 정확도는 이 CI에 포함되지 않는다.

## 빈 입력의 모델 오탐 집계 구분
- 기기 내 제공자가 빈 글자를 모델 호출 없이 처리하므로 빈 입력과 비어 있지 않은 입력의 오탐 분자·분모를 별도로 기록하도록 평가 절차를 보완했다.
- 문서 diff 검사만 수행했다. 실제 모델이나 기기 평가 결과는 없다. 진행 중인 품질 CI를 취소하지 않도록 문서 커밋은 CI를 생략한다.

## 한국어 평가 입력의 범주·기준일 검사
- 정답셋에 필요한 각 범주와 할 일 없는 사례·복수 작업 사례가 실제로 존재하는지, 입력 메시지 기준일이 유효한 날짜인지 검사한다. 데이터와 제품 코드는 변경하지 않았다.
- Windows 전체 114개 검사·타입 검사 통과. 합성 정답의 의미나 실사용 대표성을 증명하는 검사는 아니며 모델 성능은 미측정이다. 진행 중인 네이티브 CI를 취소하지 않도록 검사 전용 커밋은 CI를 생략한다.

## 한국어 AI 결과의 수동 대조 기준
- 다중 작업을 일대일로 짝짓고 TP·FP·FN, 할 일 없는 사례의 오탐, 명시 마감 정답 수를 분리해 기록하는 절차를 추가했다. 실행 오류는 빈 결과로 취급하지 않고 분모·누락과 평가 환경을 남기도록 했다.
- 문서 diff 검사만 수행했다. 모델을 실행하거나 정확도를 측정하지 않았으며 실제 기기와 독립 검증셋 평가는 남아 있다. 진행 중인 품질 CI를 취소하지 않도록 문서 커밋은 CI를 생략한다.

## AI 평가의 시도와 오류 없는 실행 구분
- 모든 사례를 시도해도 오류가 있으면 평가 실행 완료로 표시하지 않는다. 결과 파일은 전체 시도 여부와 오류 없는 완료 여부를 분리하며 오류가 있으면 재실행을 안내한다. 정확도 통과로 해석하지 않는다.
- 테스트 대역으로 전체 성공·일부 실패·중단을 구분했고 Windows 전체 114개 검사·타입 검사·iOS 번들 통과. 실제 모델 실행과 평가 화면·iPhone은 미검증이며 후속 네이티브 CI가 필요하다.

## 한국어 AI 평가 결과에 입력 문맥 포함
- 개발용 평가 JSON 형식을 2로 올리고 각 사례에 합성 입력 전문·캡처 시각·메시지 기준일·시간대를 함께 기록한다. 성공과 실패 모두 문맥을 대조할 수 있고, 정답은 모델에 전달하지 않으며 실패 원문도 기록하지 않는다. 기존 형식 1의 대조 방법을 문서화했다.
- 테스트 대역으로 입력·정답 분리와 실패 시 입력 보존·오류 비노출을 확인했다. Windows 전체 113개 검사·타입 검사·iOS 번들 통과. 실제 기기 내 모델 실행과 정확도는 미검증이며 변경 후 네이티브 CI 확인이 필요하다.

## 검토 화면 종료·처리 시작 시 확인 무효화
- 제안 검토 화면을 닫거나 남은 제안 무시 등 처리를 시작하면 기존 저장 확인을 즉시 무효화한다. 처리가 실패하거나 화면 종료가 지연돼도 이전 저장 버튼을 사용할 수 없도록 한다.
- Windows 전체 112개 검사·타입 검사·iOS 번들 생성 통과. 기존 확인 유효성 단위 검사를 재사용했다. 실제 iOS 확인창과 처리 실패 화면·iPhone은 미검증이며 후속 네이티브 CI가 필요하다.
- [472380a 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43883487080)는 core와 ios 모두 성공했다. 타입·테스트·보안·iOS 번들, Swift 저장소·캡처, 합성 한국어 Vision OCR, 시뮬레이터 앱·확장 빌드와 개인정보 선언 수집을 통과했다. 실제 iOS 확인창·iPhone 및 AI 정확도 검증은 포함하지 않는다.

## 삭제·동의·제안 저장 확인 취소 보호
- 할 일 삭제와 전체 삭제·AI 동의 확인의 취소는 해당 확인만 무효화해 늦은 취소가 새 확인에 영향을 주지 않도록 했다. 비슷한 제안의 저장 확인도 취소 후 이전 저장 응답을 무효화한다.
- 확인 유틸리티 취소 회귀 검사 포함 Windows 전체 112개 검사·타입 검사·iOS 번들 생성 통과. 실제 iOS 확인창과 기기 동작은 검증하지 않았고 변경 후 네이티브 빌드는 CI 확인 전이다.

## 캡처 확인과 동의 요청 결합 검사
- 확인 유효성 유틸리티와 실제 동의 요청 함수를 함께 사용해 이전 확인·취소가 새 확인을 무효화하지 않고 유효한 동의만 한 번 저장·분석하는지 검사했다. 제품 코드는 변경하지 않았다.
- Windows 전체 111개 검사·타입 검사 통과. 함수 수준 검사이며 React Native 확인창 조작·실제 AI 추론·iPhone 동작은 검증하지 않았다. 검사 전용 커밋은 CI를 생략하며 후속 코드 CI에서 확인한다.

## 생성 번들의 타입 검사 경합 방지
- Expo의 기존 제외 항목을 유지하면서 생성된 dist도 타입 검사 대상에서 제외해 번들 생성 중 임시 파일이 사라져 검사에 실패하는 문제를 방지했다.
- Windows에서 iOS 번들 생성과 타입 검사를 동시에 실행해 둘 다 통과했고 타입 검사 파일 목록에 dist가 없음을 확인했다. 앱 코드는 변경하지 않았다. 진행 중인 네이티브 CI를 취소하지 않도록 설정 전용 커밋은 CI를 생략한다.
- [3b46ac3 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43879443317)는 core 성공, Swift 저장소·캡처와 합성 Vision OCR 통과 후 의존성 설치 중 취소되어 시뮬레이터 빌드는 확인하지 못했다. [88b9bac 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43880764452)는 core 성공, macOS 대기 중 취소됐다. 후속 코드 CI에서 네이티브 빌드를 확인해야 한다.

## 캡처의 이전 확인 버튼 보호
- 새 동의·재분석 확인이 이전 확인을 무효화하고 각 확인 버튼은 한 번만 처리한다. 재분석 대상 조회 중 앱 상태가 바뀌면 오래된 확인창을 열지 않는다. 기존 입력 버전과 저장소 트랜잭션 검사도 유지한다.
- Windows 전체 110개 검사·타입 검사·iOS Hermes 번들 통과. 타입 검사와 번들을 동시에 실행했을 때 생성 파일 경합이 발생해 번들 완료 후 타입 검사를 다시 통과했다. 기존 확인 유효성 단위 검사를 재사용했으며 실제 iOS 확인창·iPhone 및 AI 정확도는 미검증이다. 변경 후 네이티브 빌드는 CI 확인 전이다.
- [222ee5b 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43881025381)는 core와 ios 모두 성공했다. 타입·테스트·보안·iOS 번들, Swift 저장소·캡처, 합성 한국어 Vision OCR, 시뮬레이터 앱·확장 빌드와 개인정보 선언 수집을 통과했다. 실제 확인창·iPhone 및 AI 정확도 검증은 포함하지 않는다. 이후 타입 검사 설정 변경은 포함하지 않는다.

## 다른 연결의 동의 철회 후 분석 등록 검사
- 실제 파일 SQLite 두 연결에서 한쪽이 동의를 확인한 뒤 다른 쪽이 철회하면 새 지문 등록과 기존 지문 재사용이 거부되는지 확인했다. 기존 분석의 철회 상태와 토큰, 분석 행 수 및 할 일 미생성도 확인했다. 제품 코드는 변경하지 않았다.
- Windows 전체 110개 검사와 타입 검사 통과. 순서가 정해진 두 연결 검사이며 실제 동시 프로세스·iPhone·AI 추론 및 정확도는 검증하지 않았다. 네이티브 CI 상태 조회는 로컬 네트워크 제한으로 확인하지 못했다. 기존 기기 QA 문서 사용자 변경은 제외한다.

## 할 일 상세의 오래된 삭제 확인 보호
- 할 일 상세에서 삭제 확인을 연 뒤 앱 상태·입력 내용이 바뀌거나 화면을 닫고, 취소·다른 작업 또는 새 확인을 시작하면 이전 삭제 버튼을 무효화한다. 유효한 확인도 한 번만 실행한다. 저장소의 다른 연결 변경 비교는 그대로 유지한다.
- Windows 전체 109개 검사·타입 검사·iOS Hermes 번들 생성 통과. 기존 확인 유효성 단위 검사를 재사용했으며 실제 iOS 확인창과 다중 프로세스·iPhone 검증은 하지 않았다. 이 변경의 네이티브 빌드는 푸시 후 확인이 필요하다. 사진·알림 재검사 보류와 AI 정확도 미검증을 유지한다.

## 다른 연결에서 무시한 제안의 일괄 승인 검사
- 실제 파일 SQLite의 두 연결에서 한 제안을 저장하고 다른 연결로 나머지를 무시한 뒤, 오래된 승인에 저장된 제안과 무시된 제안을 함께 보내도 거부되고 기존 할 일이 유지되는지 확인했다. 제품 코드는 변경하지 않았다.
- Windows 전체 109개 검사와 타입 검사 통과. 이는 순차적인 두 연결 검사이며 실제 동시 프로세스·iOS 화면·iPhone 및 AI 정확도는 미검증이다. 사진·알림 재검사는 보류한다. 진행 중인 네이티브 CI가 취소되지 않도록 검사 전용 커밋은 CI를 생략한다.

## 무시된 제안의 오래된 승인 오류 처리
- 일부 제안을 저장한 뒤 나머지를 다른 경로에서 무시하면, 오래된 검토 화면에서 무시된 제안을 저장하려는 요청을 성공처럼 처리하지 않고 다시 확인하도록 안내한다. 이미 저장된 제안의 승인 재전송은 중복 생성 없이 계속 허용한다. 앱과 공유 확장의 검토 저장에 같은 기준을 적용한다.
- 앱 저장소의 실제 SQLite 회귀 검사는 수정 전 실패했고 수정 후 전체 109개 검사·타입·iOS Hermes 번들 생성이 통과했다. Swift 저장소 회귀 검사도 아래 macOS CI에서 통과했다. 실제 iOS 확인창·다중 프로세스·iPhone 및 AI 정확도는 미검증이며 사진·알림 재검사는 보류한다.
- [893493a 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43876579064)는 core와 ios 모두 성공했다. 타입·테스트·보안·iOS 번들, Swift 저장소·캡처, 합성 한국어 Vision OCR, 시뮬레이터 앱·확장 빌드와 개인정보 선언 수집이 통과했다. 후속 두 연결 검사와 상세 삭제 확인 변경은 포함하지 않는다.

## 데이터 처리 문서에 최신 변경 보호 반영
- 오래된 편집·삭제·완료 요청의 비교 범위와 편집 종료 후 갱신, 전체 삭제·AI 동의·캡처 확인의 무효화 범위 및 다중 프로세스 한계를 개발용 데이터 처리 문서에 기록했다. 제품 코드와 개인정보 공개 정책은 변경하지 않았다.
- 문서 diff 검사 통과. 진행 중인 f6ea50e 품질 CI를 취소하지 않도록 문서 전용 커밋의 CI는 생략한다.

## 할 일 편집 화면 종료 후 목록 갱신
- 상세 편집을 닫을 때 목록을 다시 조회한다. 다른 연결의 변경으로 오래된 편집이 거부된 뒤 닫으면 최신 항목을 다시 열 수 있으며, 조회 실패 시 할 일 탭에서 재시도하도록 안내한다. 닫기 전 미저장 편집은 보존되지 않는다.
- Windows 전체 108개 검사·타입 검사·iOS Hermes 번들 생성 통과. 실제 iOS 화면의 종료·조회 실패 흐름, 동시 프로세스 및 iPhone 동작은 미검증이다. 사진·알림 재검사 보류와 AI 정확도 미검증을 유지한다.
- [f6ea50e 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43873518722)는 core/ios 모두 성공했다. 로그에서 새 검사 포함 108개 통과·실패 0, 타입·보안 취약점 0·iOS 번들을 확인했다. Swift 저장소·캡처, 합성 한국어 Vision OCR, 시뮬레이터 앱·확장 빌드와 개인정보 선언 수집도 통과했다. 실제 iOS 화면 및 iPhone·AI 정확도 검증은 포함하지 않는다.

## 캡처 동의 저장 중 요청 무효화 검사
- 동의 저장을 기다리는 동안 요청이 무효화되면 저장 완료 후 분석·추가 확인을 시작하지 않고 작업 잠금을 해제하는지 지연 Promise로 검사했다. 이미 시작된 동의 저장을 취소하거나 되돌리는 검사는 아니다.
- Windows 전체 108개 검사·타입 검사 통과. 제품 코드와 네이티브 화면은 변경하지 않았으며 실제 iOS 상태 전환·DB 저장 경합·AI 추론은 미검증이다. 검사 전용 커밋의 CI는 생략하고 후속 품질 실행에서 새 검사를 확인한다.

## 오래된 AI 할 일 삭제의 원문 보존 검사
- 실제 파일 SQLite 두 연결로 AI 할 일 변경 후 오래된 삭제가 거부될 때 할 일과 연결 원문이 남는지 검사했다. 최신 내용 확인 후 삭제하면 그 제안의 원문만 지우며 같은 캡처의 대기 원문·저장 처리 기록·이미지 지문은 유지한다.
- Windows 전체 107개 검사·타입 검사 통과. 제품 코드는 바꾸지 않았고 실제 동시 프로세스·iOS 화면·실기기 검사는 아니다. 진행 중인 071c27d 네이티브 CI가 취소되지 않도록 이 검사 전용 커밋은 CI를 생략하며 새 검사의 CI 실행은 후속 변경에서 확인한다.

## 앱 상태 변경 뒤 캡처 확인 무효화
- 캡처 동의·재분석 확인을 기다리는 동안 앱 상태가 전환되면 기존 요청 버전을 무효화해 이전 확인으로 분석을 시작하지 않는다. 이미 시작된 동의 저장 중 상태 변경의 원자성은 별도 검증이 필요하다.
- 기존 캡처 요청 무효화 검사 포함 Windows 전체 106개 검사·타입·iOS Hermes 번들 통과. 실제 iOS 확인창·사진 선택 중 상태 전환과 다중 프로세스 경합은 미검증이다. 사진·알림 재검사 보류, 실기기 및 AI 정확도 미검증을 유지한다. 이번 네이티브 빌드는 푸시 후 확인해야 한다.
- [071c27d 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43872265279)는 core/ios 모두 성공했다. 타입·106개 검사·보안·iOS 번들과 Swift 저장소·캡처, 합성 한국어 Vision OCR, 시뮬레이터 앱·확장 빌드 및 개인정보 선언 수집이 통과했다. 후속 107번째 검사와 실제 iPhone·AI 정확도는 포함하지 않는다.

## 설정의 오래된 AI 동의 확인 보호
- 설정에서 AI 동의 확인을 연 뒤 앱 상태 전환·다른 작업 시작·변경 완료·취소 또는 새 확인이 발생하면 이전 동의 버튼을 무효화하고 다시 확인하도록 한다. 버튼의 중복 실행도 막는다. 다른 프로세스의 변경을 앱이 감지하지 못한 경우까지 보호한다고 보장하지 않는다.
- 기존 확인 유효성 단위 검사 포함 Windows 전체 106개 검사·타입·iOS Hermes 번들 통과. 실제 iOS 동의 확인창, 다른 프로세스 경합, 네이티브 빌드·실기기 및 AI 정확도는 검증 전이다. 사진·알림 재검사는 보류한다.
- [49834a7 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43872101010)는 core와 Swift 저장소 검사는 성공했지만 ios 캡처 검사 중 취소됐다. 합성 Vision·시뮬레이터 빌드·개인정보 선언 수집은 건너뛰었다.

## 전체 데이터 삭제의 오래된 확인 보호
- 전체 삭제 확인 이후 앱 상태 전환·다른 작업 시작·변경 완료·취소 또는 새 확인이 일어나면 이전 삭제 버튼을 무효화한다. 유효한 버튼도 한 번만 실행한다. 다른 프로세스의 변경을 앱이 감지하지 못한 경우까지 보호한다고 보장하지 않는다.
- 기존 확인 유효성 단위 검사 포함 Windows 전체 106개 검사·타입·iOS Hermes 번들 통과. 실제 iOS 전체 삭제 확인창과 다른 프로세스 경합은 미검증이며, 이 변경의 네이티브 빌드·실기기 및 AI 정확도도 확인 전이다. 사진·알림 재검사는 계속 보류한다.
- [05ad052 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43871827189)는 core 성공, ios는 Swift 저장소·캡처 및 합성 Vision 검사를 통과한 뒤 의존성 설치 중 취소됐다. 시뮬레이터 빌드와 개인정보 선언 수집은 건너뛰었다.

## 오래된 목록의 완료·복원 요청 보호
- 목록에 표시된 제목·마감·상태·출처와 저장된 값이 다르면 완료 또는 복원하지 않고 할 일 탭에서 최신 목록을 다시 확인하도록 안내한다. 비교와 변경은 같은 SQLite 쓰기 트랜잭션에서 수행한다.
- 실제 파일 SQLite 두 연결 회귀 검사는 수정 전 실패했고 수정 후 통과했다. Windows 전체 106개 검사·타입 검사·iOS Hermes 번들 생성 통과. 실제 iOS 목록·동시 프로세스·iPhone은 미검증이며 사진·알림 재검사 보류와 AI 정확도 미검증을 유지한다. 변경 후 네이티브 CI는 푸시 후 확인해야 한다.
- [0ff49de 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43871531857)는 core 성공, ios는 Swift 저장소·캡처 및 합성 Vision 검사를 통과한 뒤 의존성 설치 중 취소됐다. 시뮬레이터 빌드와 개인정보 선언 수집은 건너뛰었다.

## 다른 연결에서 변경된 할 일의 오래된 편집 보호
- 상세 화면을 연 뒤 다른 연결에서 제목·메모·마감 또는 출처가 바뀌면 같은 쓰기 트랜잭션에서 이를 감지해 오래된 편집 저장을 거부한다. 입력 내용을 확인하고 화면을 닫은 뒤 할 일 탭에서 최신 내용을 다시 확인하도록 안내한다. 저장하지 않은 편집은 화면을 닫으면 사라진다. 완료 상태만 변경된 경우에는 그 상태를 보존하고 편집을 허용한다.
- 새 실제 파일 SQLite 두 연결 검사는 수정 전 실패했고 수정 후 통과했다. Windows 전체 105개 검사·타입 검사·iOS Hermes 번들 생성 통과. 실제 iOS 화면·다중 프로세스 동시 경합 및 iPhone 검증은 미완료이며 사진·알림 재검사 보류와 AI 정확도 미검증을 유지한다. 이 변경의 네이티브 CI는 푸시 후 확인해야 한다.
- [59ef1a0 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43871309683)는 core 성공, ios는 Swift 저장소·캡처 및 합성 Vision 검사를 통과한 뒤 의존성 설치 중 취소됐다. 시뮬레이터 빌드와 개인정보 선언 수집은 건너뛰었다.

## 변경된 할 일의 오래된 삭제 확인 보호
- 삭제 확인을 연 상세 화면의 할 일과 현재 저장된 제목·메모·완료·마감·출처를 같은 SQLite 쓰기 트랜잭션에서 비교한다. 다른 연결에서 바뀌었다면 연결된 제안도 지우지 않고 목록을 다시 확인하도록 안내한다. 최신 항목을 다시 열어 확인한 삭제는 허용한다.
- Windows 전체 104개 검사·타입 검사·iOS Hermes 번들 생성 통과. 실제 파일 SQLite 두 연결에서 변경된 제목과 메모 보존 및 최신 확인 후 삭제를 검사했다. 실제 iOS 확인창·동시 프로세스 및 iPhone 동작은 미검증이다. 사진·알림 재검사 보류와 AI 정확도 미검증을 유지한다.
- [a6f298c 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43858233569)는 core/ios 모두 성공했다. 타입·테스트·보안·iOS 번들, Swift 저장소·캡처, 합성 한국어 Vision OCR, 시뮬레이터 앱·확장 빌드와 개인정보 선언 수집을 통과했다. 이후 편집 보호 변경은 포함하지 않는다.

## 제안 저장 확인 중 상태 변경 보호
- 비슷한 분석이 있을 때 저장 확인창을 띄운 뒤 앱 상태·제안 선택·편집·조회 상태가 바뀌거나 새 확인을 시작하면 이전 확인 버튼을 무효화한다. 변경된 내용을 다시 확인한 뒤 저장하도록 안내한다. 중복 버튼 호출도 한 번만 실행한다.
- Windows 전체 103개 검사·타입 검사와 iOS Hermes 번들 생성 통과. 확인 유효성의 단위 검사를 포함하며 실제 iOS 확인창과 실제 다중 프로세스 경합은 검증하지 않았다. 이 변경의 네이티브 빌드는 새 CI 확인 전이고 실제 iPhone 및 AI 정확도도 미검증이다. 사진·알림 재검사는 보류한다.
- [d54c7f3 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43856514663)는 core 성공, ios는 시뮬레이터 빌드 중 취소됐다. Swift 저장소·캡처 및 합성 한국어 Vision OCR은 통과했고 개인정보 선언 수집은 생략됐다.
- [162f825 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43856952597)는 core/ios 모두 성공했다. 타입·테스트·보안·iOS 번들, Swift 저장소·캡처, 합성 한국어 Vision OCR, 시뮬레이터 앱·확장 빌드와 개인정보 선언 수집을 통과했다. 후속 삭제 보호 변경은 포함하지 않는다.

## 재분석 확인과 입력 변경 경합 보호
- 재분석 확인이나 AI 동의 창을 기다리는 동안 사진 선택·입력 변경·화면 종료 또는 다른 분석 시작이 발생하면 이전 버튼의 요청을 무효화한다. 이전 캡처를 새 입력으로 교체하거나 오래된 동의 버튼이 동의를 저장하지 않도록 한다. 분석 상태와 제안 ID는 하나의 SQLite 트랜잭션에서 확인한다.
- 동의 대기 중 대상이 바뀌는 회귀 검사는 수정 전 실패했고 수정 후 Windows 전체 102개 검사·타입 검사·iOS 번들 생성을 통과했다. 저장소 검사는 실제 SQLite를 사용하지만 실제 iOS 확인창과 다중 프로세스 경합은 미검증이다. 이번 변경의 iOS 빌드 결과는 새 CI 확인 전이다. 사진·알림 재검사는 보류하며 iPhone 동작과 AI 정확도도 미검증이다.
- [53b6fe5 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43850485998)는 core와 ios 모두 성공했다. 타입·테스트·보안·iOS 번들, Swift 저장소·캡처, 합성 한국어 Vision OCR, 시뮬레이터 앱·확장 빌드 및 개인정보 선언 수집이 통과했다. 이번 변경은 포함하지 않는다.
- [e01c0a0 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43849989506)는 core 성공, ios는 시뮬레이터 빌드 중 취소됐고 개인정보 선언 수집은 건너뛰었다.

## 재분석 확인 이후 제안 교체 보호
- 재분석 확인 전 분석 상태와 제안 ID를 기록하고, 교체 트랜잭션에서 다시 비교한다. 확인 후 다른 작업이 제안을 교체하면 새 제안을 지우지 않고 다시 확인하도록 안내한다. 저장 이력이 있으면 계속 재분석을 차단한다.
- Windows 전체 100개 검사·타입·diff 검사 통과. SQLite 회귀 검사에서 확인 후 다른 재분석으로 바뀐 제안 보존과 새 확인 후 재분석을 확인했다. 실제 iOS 확인창·동시 프로세스·iPhone 및 AI 정확도는 미검증이며 사진·알림 재검사는 보류한다.
- e01c0a0 실행은 이후 iOS 빌드 중 취소됐으며 이 변경을 포함하지 않는다. 위의 53b6fe5 실행에서 해당 변경의 전체 품질 CI가 통과했다.

## 이미 삭제된 할 일의 오래된 삭제 요청 감지
- 다른 연결에서 삭제된 할 일을 오래된 화면에서 다시 삭제하면 성공으로 처리되던 문제를 수정했다. 삭제와 연결 제안 정리 전에 같은 독점 트랜잭션에서 할 일의 존재를 확인해, 이미 삭제된 경우 목록을 다시 확인하도록 안내한다.
- 실제 파일 SQLite 두 연결의 회귀 검사는 수정 전 실패했고 수정 후 다른 항목 보존과 편집·완료를 포함해 통과했다. Windows 전체 99개 검사와 타입 검사를 통과했다. 변경 후 iOS 빌드와 실제 화면·iPhone 검증은 CI 및 실기기 확인 전이다. 사진·알림 재검사는 보류하고 기존 DEVICE-QA.md 사용자 변경은 제외한다.

## 이른 연도의 마감 시각 편집 보완
- PRD P0-03과 날짜 정렬 요구에 따라 로컬 날짜의 연도를 네 자리로 표시한다. 허용된 1000년 이전 마감 시각이 편집 시 잘못 거부되거나 날짜 문자열 비교에서 잘못 정렬되는 경계를 수정했다.
- 추가 회귀 검사는 수정 전 실패했고 수정 후 Windows 전체 99개 검사·타입 검사·diff 검사를 통과했다. iOS 빌드와 실제 기기 동작은 CI 및 실기기 확인 전이다. 기존 DEVICE-QA.md 사용자 변경은 제외한다.

## 저장한 AI 할 일의 원문 근거 확인
- PRD 8.2에 따라 AI 제안으로 저장한 할 일의 상세 화면에서 연결된 원문 근거를 요청해 볼 수 있다. 직접 입력 항목에는 표시하지 않는다. 앱이 비활성화되면 표시 중인 원문과 대기 중인 조회 결과를 지워 다시 확인하도록 한다.
- 조회와 보존 기간 정리를 한 트랜잭션에서 수행하고 실제 할 일과 저장된 연결 제안이 일치할 때만 반환한다. 삭제·동의 철회·만료 후에는 원문을 반환하지 않으며 정리 실패도 원문을 내보내지 않고 오류로 처리한다. 같은 캡처의 다른 할 일은 보존한다.
- Windows 전체 98개 검사·타입 검사 통과, 추가한 정리 실패 사례를 포함한 저장소 검사 39개 통과. [1901448 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43845922301)의 core/ios 모두 통과했다. 타입·테스트·보안·iOS 번들과 Swift 저장소/캡처, 합성 Vision OCR, 시뮬레이터 앱·확장 빌드 및 개인정보 선언 수집을 확인했다. 실제 iOS 상세 화면·VoiceOver·실제 AI와 iPhone 동작은 미검증이다. 기존 사진·알림 추가 검사는 보류한다.
- 이전 [869d074 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43844561666)는 core/ios 모두 통과했다. Swift 저장소·캡처 회귀와 합성 Vision OCR, iOS 시뮬레이터 앱·확장 빌드 및 개인정보 선언 수집을 확인했다. 원문 조회 변경은 해당 실행 이후다.

## 수동 입력 마감의 0년 경계 보완
- PRD P0-03의 할 일 추가·수정과 공유 저장소 일관성을 위해 앱 및 네이티브 날짜 검증에서 서기 0년 입력을 거부한다. 기존 앱 검증은 JavaScript 날짜의 0년을 허용해 네이티브 편집과 다른 결과를 낼 수 있었다. 기존 저장 데이터는 변경하지 않는다.
- 새 경계 검사는 수정 전 실패했고, 수정 후 Windows에서 전체 97개 테스트·타입 검사·diff 검사를 통과했다. 실제 SQLite 추가·수정 거부와 기존 행 보존도 확인했다. Swift 회귀 검사를 추가했으나 macOS CI 실행 전이며 실제 iPhone·잠금 입력·AI 정확도는 미검증이다. 사진·알림 추가 검사는 기존 사용자 선택대로 보류한다.

## 네이티브 동의 철회 후 등록 회귀 검사
- 실제 Swift 공유 저장소 두 연결을 사용해 한 연결의 이전 동의 확인 후 다른 연결이 철회하면 신규 지문 등록과 기존 지문 재사용이 모두 거부되는 검사를 추가했다. 신규 분석 행이 생기지 않고 기존 분석 상태가 보존되는지도 확인한다. 순서가 정해진 SQLite 검사이며 실제 프로세스 동시 경합이나 모델 실행 검사는 아니다.
- Windows에서 95개 JS 검사·타입 검사·diff 확인 통과. [65322d9 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43842851581)는 core/ios 모두 통과했다. Swift 저장소·캡처 검사와 합성 한국어 Vision OCR, iPhone 시뮬레이터 앱/확장 빌드 및 개인정보 선언 수집이 성공했다. 실제 모델 추론·정확도와 iPhone 검증은 포함하지 않는다.

## 최신 수동 할 일 시뮬레이터 검사 결과
- [f740284 독립 할 일 UI](https://github.com/kimps005/TTodo/actions/runs/43838478700)는 iPhone 16 Pro / iOS 26.5(23F77) 시뮬레이터에서 지정 수명주기 검사 1개 통과·실패/건너뜀 0이다. 작업 로그의 XCTest 결과와 보고서, 업로드 산출물 SHA-256 `be648fb1fad27f6659e38b55c6fb94b495a7b6541f7c4aa53e2e5f9b0f0d804e`를 확인했다. 추가·수정·완료/복원·삭제 취소/삭제·재실행 보존과 키보드 입력의 단일 저장을 검사했다.
- 이 검사는 다른 연결에서 삭제된 할 일의 오류 안내 화면이나 실제 iPhone, 잠금 입력, AI 추론·정확도를 검증하지 않는다. 동의 철회가 분석 등록보다 먼저 처리되는 경우는 저장소 트랜잭션 회귀 검사로 보호되어 있으나 실제 기기/프로세스 경합 검증은 남아 있다. 사진·알림 추가 검사는 기존 보류를 유지한다.

## 최신 저장소 수정 품질 검증과 요청에 따른 마무리
- [f740284 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43838464659)는 core/ios 모두 성공했다. 로그에서 95개 검사·실패/건너뜀 0·타입·보안 취약점 0·실제 Hermes 번들을 대조했다. 실제 Swift 저장소/캡처의 원자적 쓰기 회귀·JSON 계약·합성 Vision OCR, 앱/위젯/공유 확장 SDK 빌드와 개인정보 선언 12개 수집도 통과했다.
- [동일 소스 독립 할 일 UI](https://github.com/kimps005/TTodo/actions/runs/43838478700)는 마무리 시점에 진행 중이다. 일회성 시뮬레이터 부팅 후 Release 빌드 로그를 확인했으며 지정 XCTest의 최종 결과/산출물은 아직 확보하지 못했다. UI 성공이나 다른 연결의 삭제 오류 안내 화면 통과로 표시하지 않는다. 새 재실행이나 취소는 요청하지 않았다.
- 데이터 처리 문서에 분석 저장/재분석 롤백과 삭제된 항목 오류 처리를 반영하고 CI 안내의 이전 기본 흐름/산출물 이름을 현재 workflow에 맞췄다. 후속 546aa54는 문서만 변경했다.
- 사용자의 마무리 요청에 따라 추가 개발 없이 확인한 결과를 기록·커밋·푸시한다. 기존 DEVICE-QA.md 사용자 변경은 보존하고 커밋에서 제외한다. 사진·알림 재검사 보류, 실제 iPhone 설치/잠금·VoiceOver·실제 모델/한국어 정확도 미검증을 유지한다.

## 삭제된 할 일의 오래된 편집·완료 요청 감지
- PRD P0-03·12·13.3에 따라 다른 연결에서 삭제된 행에 대한 UPDATE가 성공으로 반환되는 문제를 실제 파일 SQLite 두 연결로 재현했다. 오래된 상세 화면에서 저장하거나 목록에서 완료/복원하면 처리된 행이 없어도 성공으로 안내할 수 있었다.
- 수정·완료 처리에서 존재 확인과 쓰기를 같은 독점 트랜잭션으로 묶었다. 이미 삭제되었으면 목록 재확인 오류를 전달하며 행이나 삭제된 본문을 다시 생성하지 않는다. 다른 할 일은 보존되고 이후 정상 수정·완료도 진행된다.
- 수정 전 새 회귀 검사 실패·수정 후 로컬 95개 검사·타입·diff 통과. 실제 UI와 최신 CI는 확인 전이다. 기존 사진·알림 재검사 보류를 유지한다.

## 분석 저장·재분석 데이터 보존 전체 품질 CI 통과
- [c48b023 전체 품질 검사](https://github.com/kimps005/TTodo/actions/runs/43837055658)는 core/ios 모두 성공했다. 94개 검사·타입·보안·Hermes와 실제 Swift 저장소/캡처 검사를 통과했다. Swift 로그에서 두 번째 제안/최종 상태 쓰기 롤백, 재분석 본문 복원과 정상 재시도 검사의 완료 문구를 확인했다. 합성 Vision OCR·앱/위젯/공유 확장 SDK 빌드·개인정보 선언 수집도 통과했다.
- 실제 모델·프로세스 간 경합·실제 iPhone·잠금 검증을 뜻하지 않는다. 후속 오래된 편집 감지 변경과는 검증 소스를 구분한다.

## 분석 저장·재분석 실패 시 데이터 보존 검사 보강
- PRD 11.1·13.3의 개인정보와 데이터 보존 기준에 따라 실제 SQLite 트리거로 두 번째 제안 삽입·최종 분석 상태 갱신 실패를 발생시킨다. 분석 행/토큰/모델 정보와 제안이 함께 롤백되고, 같은 토큰으로 정상 재시도해도 승인 전 할 일이 생성되지 않는지 검사한다.
- 재분석에서 기존 제안을 삭제한 뒤 상태 갱신이 실패하면 기존 제안 ID·본문·원문과 분석 정보를 모두 복원하는지도 확인한다. 오류 제거 후 재분석은 새 토큰/새 제안 ID로만 진행되어야 한다. 앱 저장소와 실제 Swift 공유 저장소 검사에 동일한 실패 지점을 추가했다. 제품 로직은 변경하지 않았다.
- 로컬 94개 검사·타입·diff 통과. 트랜잭션을 제거한 대조 구현에서 신규 회귀 검사 2개가 모두 실패하고 원본을 복원했다. Swift 실행·전체 네이티브 빌드는 macOS CI 확인 전이며 모델/실기기 검증이 아니다. 사진·알림 추가 실행 보류와 기존 DEVICE-QA.md 사용자 변경을 유지한다.

## 독립 할 일 수명주기 UI 통과와 작업 종료
- [63a489c 독립 수명주기](https://github.com/kimps005/TTodo/actions/runs/43831295473)는 iPhone 16 Pro / iOS 26.5(23F77) / 기본 글자에서 testManualTaskLifecycleWithoutSettingsNavigation 1개 통과·실패/건너뜀 0이다. ZIP SHA-256 5996bcb142a6dbd9bb51f42729fac75b561ee4ca5e9a3ba192a99e30058efd47·소스·report/summary·첨부 manifest와 키보드 입력 재실행 화면을 대조했다. 추가·수정·완료/복원·날짜만 보존·삭제 취소/삭제·재실행 보존과 키보드 완료의 단일 저장 단언을 통과했다.
- 알림 설정·전체 데이터 삭제·사진 OCR·모델 호출·잠금·실제 iPhone 검사는 포함하지 않는다. 후속 d701005 홈 갱신 변경은 이 UI 소스 이후이며 해당 변경의 92개 검사·타입·보안·Hermes 통과와 구분한다. 최신 요청 보호가 없는 대조 구현에서는 지연 응답 회귀 3개 모두 실패하고, 수정 복원 후 3개 모두 통과하는 것도 로컬에서 확인했다.
- 사용자 요청으로 마지막 기록을 커밋·푸시하고 작업을 종료한다. 사진·알림 추가 실행은 없으며 DEVICE-QA.md의 기존 사용자 변경은 보존하고 커밋에서 제외한다. 자동 UI 기본값 변경의 실제 세 환경 실행과 실기기/AI 정확도는 미검증으로 남긴다.

## 자동 UI 검사에서 보류된 알림 경로 분리
- 사용자 지시에 따라 다음 UI 코드 push가 보류된 알림 전체 흐름을 자동 반복하지 않도록 기본 시나리오를 정리했다. primary/oldest는 task-lifecycle, compact는 기존 최대 글자 app 흐름을 실행하며 수동 기본값도 task-lifecycle이다. 알림 전체 검사는 기존 단언을 유지한 채 app/large를 명시적으로 선택할 때만 실행한다. 사진 검사는 자동으로 추가하지 않는다.
- YAML 구문·입력/행렬 연결·diff를 확인했다. 실제 자동 push의 세 환경 실행은 아직 미검증이며 이번 커밋은 skip ci로 보류된 경로를 실행하지 않는다. 진행 중인 63a489c 독립 UI와 후속 d701005 홈 갱신의 core 통과는 각각 구분한다.

## 독립 수명주기 준비·홈 갱신 수정의 JS 품질 CI 통과
- [63a489c core 검사](https://github.com/kimps005/TTodo/actions/runs/43831307481)와 [d701005 core 검사](https://github.com/kimps005/TTodo/actions/runs/43831545134)는 각각 89개·92개 테스트와 타입·보안·Hermes 번들을 통과했다. 최신 job 로그의 테스트 92/통과 92/실패·건너뜀 0, 취약점 0개, 761개 모듈과 실제 iOS .hbc 산출물 생성 기록을 대조했다.
- ios job은 core_only 입력에 따라 skipped다. 독립 수명주기 UI 43831295473은 63a489c에서 별도 실행 중이며, d701005 홈 갱신 변경의 실제 화면 검사나 네이티브 빌드 완료로 대신 인정하지 않는다.

## 홈 목록·개인정보 설정 갱신의 오래된 응답 차단
- PRD 12.6·13.3의 최신 데이터 재동기화와 11.3의 개인정보 표시 기준에 따라 홈 refresh를 점검했다. 복귀/탭/변경 후 요청이 겹치면 이전 조회가 늦게 끝나 목록·동의·잠금화면 표시 상태를 덮을 수 있었다. 조회 시작 순서를 기록하고 최신 요청의 전체 결과만 반영하도록 수정했다. 늦은 이전 오류도 현재 결과의 실패로 알리지 않는다.
- 지연 Promise 회귀 3개로 삭제된 목록/철회 동의의 늦은 복원 차단, 최신 실패 전달·이전 성공 차단·재시도, 이전 오류 무시를 확인했다. 로컬 92개 테스트·타입·YAML·diff 통과. 실제 데이터베이스 쓰기/OS 권한이나 모델을 주입한 검사는 아니다. Hermes와 변경 후 실제 UI는 CI 확인 전이다.
- 독립 수명주기 UI 실행 43831295473은 앞선 63a489c 소스이며 이 홈 갱신 변경과 구분한다. 사용자 선택대로 사진·알림 추가 실행은 보류한다.

## 알림과 독립적인 수동 할 일 수명주기 검사 준비
- PRD P0-03·5.7·13.3의 추가/수정/완료/삭제·오프라인 수동 입력·재실행 보존을 최신 소스에서 독립적으로 검증할 task-lifecycle 시나리오를 추가했다. 기존 전체 UI의 CRUD 단언을 공통 helper로 옮겨 동일하게 재사용하며 기존 알림 단언은 유지한다. 키보드 완료 입력 후 한 개만 생성되고 재실행 뒤 유지되는지도 검사한다. 제품 데이터/모델 응답은 주입하지 않는다.
- 로컬 89개 테스트·타입·스크립트 구문·diff 통과. 결과 검증기는 독립 테스트의 정확한 ID·1개 통과·실패/건너뜀 0만 인정하고 전체 알림·전체 삭제 결과와 혼동하지 않는다. 실제 SDK 컴파일과 실행은 CI 확인 전이다. 실제 iPhone·VoiceOver·AI 정확도·잠금 검증 완료를 뜻하지 않는다.
- 사용자가 사진 검사 보류·독립 개발 계속을 선택했다. Photos 진단/다른 런타임 비교나 알림 재시도는 진행하지 않는다. DEVICE-QA.md는 변경·스테이징하지 않는다.

## 작은 화면 양방향 탐색 재검사 통과
- [052a93a 작은 화면 UI](https://github.com/kimps005/TTodo/actions/runs/43800488102)는 iPhone SE 3 / iOS 26.5(23F77) / 최대 접근성 글자 크기에서 지정 testLargeTextInputEditingAndNavigation 1개 통과·실패/건너뜀 0이다. 다운로드 ZIP SHA-256 dceafd5457bfce4cb859ab33469d1dd1686e1d516dcbbbae3f0129e89cf20af3·소스·report/summary/tests·실행 로그·첨부 manifest와 설정 화면 PNG를 대조했다.
- 오래된 좌표 대신 두 방향을 탐색한 후 제목 편집 화면 접근·닫기, 키보드가 열린 초안에서 설정 이동·복귀와 초안 보존 단언까지 242.297초에 통과했다. 빌드/설치 실행 파일 해시도 일치한다. 이 시나리오는 제목 수정 저장·전체 삭제·알림 설정·사진 OCR·VoiceOver·실제 iPhone/잠금/모델 정확도를 검증하지 않는다.

## 사진 재검사: Photos 초기화 중 가져오기 시간 초과 반복
- [052a93a 사진 재검사](https://github.com/kimps005/TTodo/actions/runs/43800492587)는 iPhone 16 Pro / iOS 26.5(23F77) / 기본 글자 크기에서 photo-import 단계의 simctl addmedia가 240초 후 ETIMEDOUT/SIGTERM으로 끝났다. ZIP SHA-256 0f2d1016bf1b0b34a23a582939149b174965b4bf3a880f58439fcae47f9cb8aa·소스·보고서·빈 명령 출력·홈 화면 PNG·macOS 합성 Vision 사전 검사 통과를 대조했다. 앱/XCTest 빌드·실행 전이며 제품 OCR 회귀/동의 잠금의 성공 또는 실패로 세지 않는다.
- 새 진단은 성공했고 7,350,859바이트의 Photos 시스템 로그를 보존했다. 03:53:37 UTC부터 assetsd의 라이브러리 초기화가 기록되고, 03:56:55에는 라이브러리 식별자 없음(Code 46111)·DCIM 이미지 확장 속성 누락·초기화/마이그레이션 오류, 03:57:55에는 내부 dispatch group 대기 시간 초과가 있다. 이는 OS 사진 서비스 초기화 문제를 지지하지만 특정 오류와 addmedia 정지의 인과관계는 아직 미확정이다. 시스템 기본 이미지 오류를 합성 PNG 오류로 단정하지 않는다.
- 같은 가져오기 실패가 반복되어 추측 수정·단순 재실행을 중지하고 방향을 문의했다. 근본 원인 진단은 초기화 정지 지점을 더 좁혀야 하며, 다른 설치 런타임 비교는 환경 의존성을 좁히는 대안이나 현 런타임 문제의 해결은 아니다. 시간 제한·통과 조건은 유지한다. 알림은 사용자 지시대로 추가 시도하지 않는다. 기존 DEVICE-QA.md 사용자 변경도 보존한다.

## 작은 화면 탐색의 오래된 접근성 좌표 의존 제거
- [4c27414 compact 실패](https://github.com/kimps005/TTodo/actions/runs/43746163021)의 지정 산출물 ZIP SHA-256 33e68260a3c92ba2362676d0e903bba4f32a034584d9f0a834998efdde8c30cd·커밋·SE3/iOS26.5/최대 글자·검사 1개 실패를 대조했다. 녹화 100초/158초에는 편집 화면 맨 아래가 표시되지만 같은 시점 접근성 snapshot의 제목 좌표는 화면 안의 예전 위치로 남아 있었다.
- reveal이 존재하는 비가시 요소의 오래된 좌표로 방향을 고정해 두 번째 pass에서도 같은 방향만 탐색했다. 실제 모달 ScrollView를 조작한 로그도 대조했다. 좌표 추정 대신 기존 위/아래 두 pass가 각각 실행되도록 수정했다. 2×16회·대기값·최종 존재/실제 터치 가능 단언은 유지하며 좌표 탭·임의 지연은 없다.
- 로컬 88개 테스트·타입·스크립트 구문·diff 통과. 변경 후 실제 SDK/작은 화면 UI는 CI 재검증 전이다. 제품 화면 배치/알림 성공으로 해석하지 않는다.

## 사진 재검사의 앱 실행 전 가져오기 시간 초과 구분
- [6ebef27 photo-ocr](https://github.com/kimps005/TTodo/actions/runs/43798629039)는 부팅 완료·최대 글자 설정 조회·macOS 합성 Vision OCR 사전 검사를 지난 후 simctl addmedia가 240초 제한으로 SIGTERM/ETIMEDOUT에 종료됐다. 앱/XCTest 빌드·실행 전이다. ZIP SHA-256 69e5fac748e2e0f8aaafcf736e56bc23edc80ca85a366e5944b08fe4afafe2a2·보고서·빈 명령 stdout/stderr·시뮬레이터 홈 화면을 대조했다.
- 제품 OCR/동의 잠금 결함이나 UI 성공으로 집계하지 않는다. 정확한 Photos 서비스 원인은 기존 산출물에 없어 미확정이다. 실패 시 같은 일회성 시뮬레이터의 사진 관련 시스템 로그를 수집하도록 추가했다. 실제 SDK 도움말을 확인하고 파일 직접 출력으로 버퍼 제한을 피하며, 진단 실패는 원래 오류를 덮지 않는다. 시간 제한·fixture·통과 조건은 변경하지 않았다.

## CI 호스트의 모델 미가용 확인 — 실제 추론 미실행
- [104e11b 호스트 점검](https://github.com/kimps005/TTodo/actions/runs/43800041126)은 제품 추출/검증 코드와 probe를 macOS SDK로 컴파일하고 점검을 마쳤다. ZIP SHA-256 4cb28e1f3c3c537841a7818ca2fe52529996f1ff5e990abf715cd8e28729921f·보고서 소스/OS26.7.2를 대조했다.
- 실제 host API는 device_not_eligible이며 inference_attempted=false/inference_completed=false/accuracy_measured=false다. workflow 녹색은 검사 실행의 성공이며 모델 생성 성공이 아니다. 시뮬레이터 UI의 available 표시를 실제 생성으로 간주하지 않는다. 계정/설정/다운로드 없이 종료했고 실제 모델·한국어 정확도·iPhone은 미검증으로 유지한다.

## CI 호스트의 실제 모델 가용성 점검 준비
- 삭제 UI에서 실제 Foundation Models 가용성 API가 available로 표시된 것을 확인해, PRD의 무료 기기 내 모델 우선 평가를 위한 수동 호스트 점검 workflow를 추가했다. [Apple 공식 시뮬레이터 안내](https://developer.apple.com/videos/play/wwdc2025/259/)는 Apple Intelligence가 준비된 최신 macOS에서 기능 검사가 가능하지만 iPhone 성능과 다르다고 설명한다.
- 일회성 CI Mac에서 제품 추출/검증 코드를 그대로 컴파일하고 가용하면 합성 한국어 요청 1개만 실제 호출한다. 미가용이면 상태만 기록한다. Apple Intelligence 설정·계정·모델 다운로드·유료 API는 변경하지 않는다. 사용자 DB/이미지/글자를 읽지 않으며 생성 글자와 근거를 로그에 남기지 않는다.
- workflow 성공은 호스트 점검 성공이며 실제 추론 여부는 report의 inference_attempted/inference_completed로 구분한다. 마감/개수의 단일 샘플 확인은 전체 정확도 측정이 아니다. 실제 iOS/실기기/잠금·AI 정확도 완료로 인정하지 않는다. 로컬 YAML·diff 통과, 실제 SDK 컴파일과 호스트 결과는 CI 확인 전이다.

## 전체 삭제·동의 초기화의 독립 UI 통과
- [de82738 data-reset](https://github.com/kimps005/TTodo/actions/runs/43797466173)는 iOS 26.5(23F77) / iPhone 16 Pro 시뮬레이터에서 testDataResetAndConsentWithoutSettingsNavigation 지정 1개 통과·실패/건너뜀 0이다. ZIP SHA-256 676af5f2605fbe7cd1a1f5c1c7be46483f40b03747227f76bf7dfc62ac8f382f·대상 소스·summary/tests/report와 첨부 화면을 대조했다.
- 실제 UI로 동의 취소/허용, 재실행 후 동의 유지, 삭제 취소 뒤 할 일/온보딩/동의 유지, 전체 삭제 시 초안 제거, 재실행 후 빈 목록/분석함과 AI 동의 해제를 확인했다. 할 일은 직접 입력한 합성 데이터이며 AI 응답·DB 값을 주입하지 않는다.
- 알림 설정 이동 검사는 포함하지 않는다. 실제 기기의 알림/Live Activity 제거·저장 장치 원문 복구 가능성·진행 중 실제 모델/다른 프로세스와의 경합 검증은 별도로 남아 있다. 후속 접근성·캡처 동의 잠금 변경은 이 소스 이후다.

## 캡처 동의 잠금·접근성 후속 JS 품질 CI 통과
- [6ebef27 core 전용 검사](https://github.com/kimps005/TTodo/actions/runs/43798624953)는 88개 테스트·타입·보안 취약점 0·Hermes 번들을 통과했다. ios 작업은 선택적으로 skipped이며 네이티브 빌드는 앞의 de82738 전체 검사와 구분한다.
- 캡처 화면 변경 후 실제 사진 선택·OCR UI는 43798629039에서 별도 확인 중이다. 실제 동의 지연 UI·VoiceOver·실기기 모델 정확도는 미검증이다.

## 캡처 동의 조회·저장 중 이전 입력 분석 경합 수정
- PRD 11.2의 동의와 12의 입력 보존 기준을 점검해, 동의 조회와 승인 후 저장이 끝나기 전에 닫기·사진 재선택·중복 요청이 가능한 비동기 간격을 확인했다. 이전 사진/글자의 클로저로 분석이 늦게 시작될 수 있었다.
- 실제 분석 진입 helper가 동의 조회/저장부터 분석 종료까지 사진 선택과 동일한 ref 잠금을 유지하도록 수정했다. 닫기 버튼도 즉시 ref 가드를 사용한다. 사용자 동의 알림 응답을 기다리는 동안에는 잠금을 해제하며, 승인 후 분석이 내부 재진입 검사에 막히지 않도록 정리했다.
- 실제 helper의 동의 조회·저장·분석을 지연시킨 회귀 3개로 중복 진입 차단, 미동의 시 분석/저장 미호출, 승인 저장 완료 후 분석, 단계별 실패와 잠금 해제를 확인했다. 로컬 88개 테스트·타입·diff 통과. 모델 응답/정확도 검사가 아니며 변경 후 Hermes·사진 UI는 CI 재검증 전이다.

## 알림 한 차례 재검사 실패 — 재시도 보류
- [독립 공개 API 비교 attempt 2](https://github.com/kimps005/TTodo/actions/runs/43750027357/attempts/2)는 기존 비교 소스 0342e2b / Xcode 26.6 / SDK 26.5 / iOS 26.5(23F77)에서 지정 검사 1개 실패했다. 실제 권한 거부와 첫 실행·재진입 후 denied/opened=true는 확인했지만 최종 도착 값이 [false,false]여서 기존 [true,true] 단언에 실패했다. 빌드/실행 전 오류가 아닌 실제 화면 도착 실패다.
- 작업 로그·산출물 메타데이터를 대조했으며 새 ZIP digest는 320b9ad46ba6f56e860334463a7696315759f6e3d2974047390cf9bd2bebc246이다. 다운로드 ZIP 해시·보고서 소스·JSON·첫 실행/재진입 PNG와 트리를 직접 대조했다. 두 화면 모두 설정 첫 화면이다. 27,139,409바이트 시스템 로그에서 03:22:46.933·03:23:17.966 UTC의 같은 목적지 선택 불가와 알림 숨김 기록을 확인했다. 기존 환경 숨김 진단과 제품 공개 API는 유지하며 실기기 재현 여부는 미확정이다.
- 사용자가 ‘한 번 시도 후 안되면 다른 개발’을 선택했으므로 알림 추가 실행은 보류한다. 알림 화면 직접 이동과 실기기는 미완료이며 우회 URL/서명 변경은 없다. 독립 전체 삭제·접근성·캡처 동의 경합 개발로 진행했다.

## 독립 전체 삭제 검사 준비 소스의 전체 품질 CI 통과
- [de82738 전체 품질 검사](https://github.com/kimps005/TTodo/actions/runs/43797469506)의 core/ios 모두 성공했다. 85개 테스트·타입·보안·Hermes, 실제 Swift 저장소/캡처·합성 Vision OCR, 앱·위젯·공유 확장 SDK 빌드와 개인정보 선언 12개 수집을 확인했다.
- 독립 data-reset UI 실행은 별도 확인 중이다. 이 실행에는 후속 접근성 레이블과 캡처 동의 잠금 변경이 포함되지 않으며 실제 iPhone·VoiceOver·모델 정확도는 미검증이다.

## 제안 입력 구분과 완료 항목 편집의 접근성 보완
- PRD의 VoiceOver 기준에 따라 여러 제안의 제목·날짜·시각 입력에 ‘1번째 제안’과 같은 순번을 붙였다. 기존 할 일 상세의 입력 레이블은 유지한다. 완료한 할 일 상세 버튼도 완료 상태·마감·상세 편집 동작을 함께 읽도록 보완했다.
- 타입·diff 검사 통과. 레이블만 바꾸는 변경에 구현을 그대로 비교하는 테스트는 추가하지 않는다. 실제 VoiceOver 발화·탐색과 실제 iPhone은 미검증이며, 앞서 실행한 de82738의 CI에는 이 후속 변경이 포함되지 않는다.

## 알림 한 차례 재확인과 독립 전체 삭제 검사 준비
- 사용자 요청에 따라 공개 API 독립 비교 43750027357의 probe job을 한 차례 재실행했다. 결과 확인 전이며 추가 알림 재시도는 진행하지 않는다. 기존 환경 숨김 진단과 직접 이동 미완료는 유지한다.
- PRD 11.2·11.4의 전체 삭제와 동의 초기화를 알림 설정 이동과 독립적인 data-reset UI 시나리오로 추가했다. 실제 UI로 수동 할 일 저장·동의 취소/허용·재실행·삭제 취소·전체 삭제·초안 제거·재실행 후 빈 목록/분석함·동의 해제를 확인한다. 기존 알림 전체 흐름과 단언은 유지하며 독립 삭제 결과를 알림 성공으로 인정하지 않는다.
- 로컬 85개 테스트·타입·스크립트 구문·diff 통과. 독립 데이터 계층 검토의 실제 SQLite 38개도 통과했으며 신규 확정 결함은 없어 해당 제품 코드는 변경하지 않았다. 새 삭제 UI의 실제 SDK 컴파일·실행은 CI 확인 전이다. 실제 iPhone·AI 정확도는 미검증이다.
- 이미 실패한 알림 전체 UI의 자동 3환경 반복을 피하려고 이 준비 커밋은 자동 실행을 생략하고 전체 품질과 data-reset을 명시적으로 실행한다. 기존 사용자 수정 DEVICE-QA.md는 보존하고 커밋에 포함하지 않는다.

## 앱·XCTest 없이도 알림 목적지 숨김 확인 — 환경 의존 미해결
- [7188db7 직접 목록 검사, attempt 2](https://github.com/kimps005/TTodo/actions/runs/43787784458/attempts/2)는 macOS 26.7.2 ARM / Xcode 26.6(17F113) / SDK 26.5 / iPhone 16 Pro 시뮬레이터 iOS 26.5(23F77)에서 끝까지 실행했다. ZIP SHA-256 315e70ca46307d0c37eea95ca75a30957196e17cbf23958668866661903188d6·커밋·원본 JSON/PNG/접근성 트리와 지정 XCTest 1개 실패·건너뜀 0을 대조했다. 기존 launch 시간 초과·도움말 수집 오류와 구분하며 화면 단언 실패를 성공으로 바꾸지 않는다.
- **앱 설치 전 분리 결과:** 새 시뮬레이터에서 TTodo·비교 앱·XCTest를 설치하거나 공개 앱 설정 URL을 호출하기 전에 simctl로 설정 앱만 실행했다. 01:47:04.277 UTC에 실제 launch 완료, 그 전후 notifications 숨김 기록(01:47:02.962·01:47:04.381 등)과 초기 화면을 수집했다. `pretest_settings`는 app_installed=false, test_runner_installed=false, app_settings_url_called=false, launch_completed=true, notifications_hidden=true다. 이 숨김 현상은 제품 번들/엔타이틀먼트·Expo 브리지·XCTest 실행 맥락에 의존하지 않는다.
- **실제 목록 결과:** 권한 요청 전·실제 거부 후 모두 기본 설정 목록의 상단부터 Apps/Developer가 있는 하단까지 각 3개 화면/트리를 남겼다. 두 JSON은 notifications_visible=false이고 같은 18개 고유 버튼 메타데이터를 포함한다. 알림 항목은 없으며 실제 거부 상태도 확인했다. 앱별 하위 화면 전체가 없다고 확대하지 않고, 공개 알림 전용 API가 선택하는 기본 notifications 목적지의 숨김으로 한정한다.
- **현재 원인 분류와 조치:** 공개 API는 올바른 앱 ID를 전달하지만 OS 설정 앱이 숨긴 notifications 목적지를 선택하지 못해 첫 화면에 남는 환경 문제다. 제품 앱에서 변경할 식별자/호출 오류는 확인되지 않았다. 설치된 26.2·26.4.1·26.5에서 정상 공개 딥링크 경로를 찾지 못했으며 OS의 숨김 상태를 바꾸는 문서화된 앱 API도 확보하지 못했다. 제품 코드·공개 URL·엔타이틀먼트·서명은 유지했다. 사설 URL/OS 파일 수정/임의 지연/가짜 화면/성공 조건 완화로 해결한 것처럼 만들지 않는다.
- **남은 의존성:** 알림 목적지가 제공되는 OS 환경에서 동일 공개 API의 성공 확인, 이후 제품 UI의 왕복·데이터 보존 검증 및 실제 iPhone 검증. 현재 Windows·설치된 macOS CI 시뮬레이터만으로 직접 이동 성공을 만들 수 없어 해결 완료로 표시하지 않는다. 시뮬레이터의 의도된 지원 제한인지 OS 결함인지와 실기기 재현 여부는 미확정이다. 기존 사용자 선택대로 실기기 설치는 나중에 진행하며 유료 가입·Mac·다른 서명 경로를 요청하지 않는다.
- [7188db7 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43787777584)의 core/ios 모두 성공했다. 84개 테스트·타입·보안·Hermes, Swift 저장소/캡처·합성 Vision OCR·제품 앱/확장 빌드·선언 수집 통과다. 로컬 84개 테스트·타입·스크립트/YAML/diff 검사도 통과했다. 이 품질 결과는 알림 이동 성공을 뜻하지 않는다. 앞선 72aea15·4ccec96 품질 실행은 후속 소스로 대체되어 취소됐고 성공으로 집계하지 않는다.

## 중간 설치 OS에서도 알림 목적지 숨김 재현
- [4ccec96 / iOS 26.4.1 비교](https://github.com/kimps005/TTodo/actions/runs/43787379801)는 Xcode 26.6 / SDK 26.5 / iPhone 16 Pro 시뮬레이터 iOS 26.4.1(23E254a)에서 지정 XCTest 1개 실패·건너뜀 0이다. 요청 버전·실제 런타임·ZIP SHA-256 738e452a0e0795118c8285b05808b690698b29006592798181f6a82ea774fae1을 대조했다. 첫 실행·재진입의 PNG·트리는 모두 설정 첫 화면이다.
- 두 호출 모두 denied/active/opened=true이며 설정 앱은 notifications 숨김과 같은 목적지 선택 불가를 기록했다(01:42:52.327·01:43:54.829 UTC). 기존 26.2·26.5 외에 설치된 중간 버전으로 옮겨도 공개 API의 정상 직접 이동 경로는 확보되지 않았다. 제품 API·서명·엔타이틀먼트 변경 근거로 해석하지 않는다.
- 7188db7의 직접 목록 실행 43787784458 첫 시도는 SDK 목록 조회 구간에서 xcrun ETIMEDOUT으로 시뮬레이터 생성 전 중단됐다. 제품/UI 결과로 세지 않고 같은 소스의 해당 job만 재실행했다. 이 재실행의 앱 설치 전 설정 상태·실제 목록 결과는 별도 확인한다.

## 실제 SDK launch 도움말의 stderr 수집과 테스트 없는 비교
- [a8f5fa1 재검사](https://github.com/kimps005/TTodo/actions/runs/43787065994)는 XCTest 실행 전에 SDK launch 도움말 검사에서 중단됐다. 실제 도움말은 stderr에 출력됐지만 수집 코드가 stdout만 읽어 빈 파일을 만들었다. ZIP SHA-256 3be95b0a3f7482291b8ea8f2ab9dad52ee26a9c456b992d352d4304b89871ae7·작업 로그의 실제 usage를 대조했다. 제품/설정 이동 실패로 집계하지 않는다.
- stdout/stderr를 함께 보존하는 기존 도움말 검증기로 통일하고 실제 SDK fixture의 stderr 전용·stdout·빈 출력·오류 종료 회귀 검사를 추가했다. 단언/타임아웃은 완화하지 않는다.
- 설정 앱 사전 실행 뒤 앱/테스트 타깃을 생성·빌드·설치하기 전에 OS의 실제 launch 완료 로그를 최대 120초 기다려 기본 목록 숨김 상태와 화면을 기록한다. 임의 지연 후 성공으로 판정하지 않으며 XCTest·TTodo 실행 맥락이 없는 상태를 별도로 대조한다.

## 설치된 중간 OS의 독립 비교 준비
- SDK 점검에서 설치가 확인된 iOS 26.4.1은 기존 제품 UI의 latest(26.5)/oldest(26.2) 사이이며 아직 알림 이동 UI를 검사하지 않았다. 독립 비교에서 정확한 설치 버전을 선택하도록 추가했다. 누락/비가용/다른 플랫폼/arm64 미지원이면 다른 버전으로 대체하지 않고 실패한다. OS 다운로드·제품 OS 요건 변경은 없다.
- 정확한 버전·기존 latest/oldest 정책·누락/비호환 거부 회귀 검사를 추가했다. 이미 실패가 확인된 두 OS를 반복하는 대신 남은 설치 환경에 정상 공개 API 경로가 있는지 확인한다. 26.5의 직접 설정 목록 재검사는 별도 실행 중이다.

## 설정 목록 검사 첫 실행 시간 초과 구분
- [8e9ac87 직접 목록 검사](https://github.com/kimps005/TTodo/actions/runs/43786035354)는 Settings의 XCTest 첫 launch에서 시간 초과하여 목록 탐색/권한 요청 전 중단됐다. ZIP SHA-256 a9c1ee7f7808d9f2d480c3ec6c5dcd82d2bc6ad7bbac6ea09a93f8de8fa73793·실패 줄·시스템 로그를 대조했다. UI 실패 시각은 01:29:16 UTC, 설정 앱 launch 완료 로그는 01:29:21.820 UTC이며 이후에도 notifications 숨김 기록이 있다. 목록 접근 불가 단언 실패나 제품 오류로 집계하지 않는다.
- SDK가 문서화한 simctl launch로 해당 격리 시뮬레이터의 설정 앱을 먼저 시작하고 XCTest activate가 기존 인스턴스를 이어받도록 수정했다. Apple 문서상 activate는 실행 중인 앱을 종료하지 않고 사용 가능한 상태로 활성화한다. 권한 주입/OS 변경/임의 시간 지연/화면 단언 완화는 없으며 두 번째 탐색도 같은 설정 프로세스를 사용한다. 실제 목록 결과는 재검사 전이다.

## 설정 앱 자체의 알림 목록 접근 검사 준비
- [72aea15 SDK 점검](https://github.com/kimps005/TTodo/actions/runs/43785589863)은 성공했다. ZIP SHA-256 5eeefb1cd8d593f53b767c478395e2e6b4d64f6bc62c86301e3ec2d5c455b0fc를 대조했다. 설치된 iOS 26.2·26.4.1·26.5에 NotificationsSettings.bundle 및 NotificationsSettingsExtension.appex 메타데이터가 있어 단순 리소스 누락은 아니다. 수집한 plist/JSON에서 해당 목록의 숨김 결정 조건은 확인하지 못했다. 각 런타임의 eSIM 웹 자격 JSON 구문 오류 1건, 26.4.1·26.5의 ScreenTime 모델 VersionInfo 변환 오류 각 1건은 알림 설정 조건과 관련 없는 별도 파싱 제한이다.
- 기존 제품·독립 앱 로그 모두 `Not including notifications due to being hidden.`를 확인했다. 딥링크를 사용하지 않고 XCTest로 설정 앱을 직접 실행하여 권한 요청 전과 실제 거부 후의 전체 기본 목록을 탐색·캡처하는 독립 검사를 추가했다. 알림 항목이 있으면 실제 탭까지 기록한다. 원래 딥링크 검사는 유지하며 수동 flow로 분리해 이미 확인한 호출을 다시 돌리지 않는다. 실제 SDK 실행 후 목록 자체의 가용성을 판별한다.

## 알림 목적지 숨김 상태의 SDK 리소스 확인 준비
- 사용자 요청에 따라 원인 조사를 계속한다. 기존 독립 비교 로그의 설정 앱 Primary List Data Model은 `Not including notifications due to being hidden.`도 반복 기록한다(19:08:58.696 UTC 등). 목적지 선택 불가뿐 아니라 알림 목록 항목 자체가 숨겨진 증거다. 숨김 조건이 무엇인지는 아직 미확정이다.
- 기존 SDK 점검 workflow에 설치된 런타임의 설정 plist/JSON 가용성 조건을 읽기 전용으로 수집하는 검사를 추가했다. 앱·시뮬레이터 사용자 데이터·실행 바이너리를 읽거나 OS 파일을 수정하지 않는다. 사설 API/URL 호출은 없고 제품 코드도 유지한다. 실제 SDK 리소스와 숨김 조건 대조는 CI 실행 후 판단한다.

## 알림 설정 실패의 네이티브 비교·시스템 로그 대조 완료
- [0342e2b 독립 비교 재검사](https://github.com/kimps005/TTodo/actions/runs/43750027357)는 macOS 26.7.2 ARM / Xcode 26.6(17F113) / SDK 26.5 / iPhone 16 Pro 시뮬레이터 iOS 26.5(23F77)에서 실행했다. ZIP SHA-256 47f89a5e2f5ac370e0297846f38ef2e5a30890a0f45167ee360d0ce9023b35d2·보고서 커밋·지정 XCTest 1개 실패/건너뜀 0을 대조했다. 24,356,561바이트 시스템 로그와 appinfo가 모두 수집됐고 ENOBUFS는 재발하지 않았다.
- 독립 앱의 첫 호출(19:08:41 UTC)과 재진입(19:09:33 UTC) 모두 Bundle ID=com.kimps005.ttodo.notificationprobe, denied/active, 공개 API 반환 true다. 설정 앱은 올바른 비교 앱 ID의 알림 목적지로 변환한 다음 각각 19:08:58.056·19:09:34.164 UTC에 제품 앱과 동일한 `selection not possible currently 'notifications'`를 기록했다. PNG·접근성 트리는 두 번 모두 설정 첫 화면이며 앱 복귀 후에도 denied/opened=true다. appinfo는 비교 앱 User 등록 및 빈 App Group을 확인한다.
- **확인한 원인 범위:** 이 CI 시뮬레이터 환경에서는 공개 API의 URL 열기와 대상 앱 ID 전달 뒤, 설정 앱의 notifications 목적지 선택 단계에서 중단된다. Expo·제품 브리지·확장·App Group이 없는 별도 앱에서도 동일하여 TTodo 통합에만 특화된 실패가 아니다. 설정 앱의 첫 실행 지연만으로 설명할 수도 없다. **미확정:** 시뮬레이터의 의도된 지원 제한인지 OS 결함인지, 실제 iPhone에서도 발생하는지와 설정 앱 내부에서 해당 목적지를 선택할 수 없는 더 깊은 원인. 앱 등록/엔타이틀먼트 수정이 필요하다는 증거는 없으며 이를 완전히 일반화해 배제하지도 않는다.
- 제품 코드는 Apple 공식 공개 API를 유지했다. 다른 URL·사설 URL·지연/재시도·서명 변경을 넣지 않았고 화면 단언도 완화하지 않았다. 제품 문제 해결 완료로 표시하지 않는다. 직접 이동 성공과 복귀 후 제품 데이터 보존의 해당 전체 UI 단계, 실제 iPhone 검증은 미완료다. 기존 선택대로 실기기 설치는 나중에 진행하며 새 설치 경로를 요청하지 않는다.
- [0342e2b 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43749994992)의 core/ios 모두 성공했다. 82개 테스트·타입·보안·Hermes, Swift 저장소/캡처·합성 OCR, 제품 앱·확장 빌드/선언 수집 통과다. 로컬 스크립트 구문·YAML/프로젝트 파싱·diff 및 20 MiB 파일 직접 출력 보존도 확인했다. 상세 근거·재현 절차·추천 방안은 [알림 설정 조사](NOTIFICATION-SETTINGS-INVESTIGATION.md)에 기록했다.

## 독립 네이티브 비교의 첫 실행·재진입 실패 확인
- [58d7bb9 네이티브 비교](https://github.com/kimps005/TTodo/actions/runs/43748991228)는 Xcode 26.6 / SDK 26.5의 독립 앱·XCTest 빌드와 iOS 26.5 시뮬레이터 실행을 완료했다. 실제 권한 요청/거부 뒤 설정 앱 첫 실행과 재진입 모두 화면 도착 판정이 false다. 복귀 후 두 번 모두 authorization=1, opened=true를 UI로 확인했다. 마지막 [false,false] 대 [true,true] 단언에서 실패했으며 화면/트리를 첨부했다. 제품 통합 없이 재현됐지만 비교 앱의 시스템 로그 원문 대조는 아직 남아 있다.
- 전체 시스템 로그가 동기 파이프 16 MiB 한도를 넘어 ENOBUFS로 저장되지 않았다. UI 단언은 유지하고 진단 출력을 파일로 직접 연결해 버퍼 한도를 제거했다. 앱 등록 수집도 독립시켰다. 제품 URL/코드 변경은 없으며 로그 수집 보완 후 재검증한다.
- 기존 제품 UI의 oldest 원문도 확보했다(ZIP SHA-256 dd2c4c4b7d8a1432f653ecbc4f80dfdd6e690653725d0c2b398a39343dfe5768). iOS 26.2/23C54에서도 denied/active/opened=true이며 18:42:28.561 UTC에 같은 notifications 목적지 선택 불가 기록이 있다. 전체 UI workflow의 compact 실패는 최대 글자 입력 탐색 단계이며 알림 원인으로 분류하지 않는다.
- [58d7bb9 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43748972881)의 core/ios가 성공했다. 82개 테스트·타입·보안·Hermes, Swift 저장소/캡처·합성 Vision OCR 및 제품 앱·확장 빌드 통과다. 실제 iPhone·알림 화면 도착·잠금·모델 정확도 완료를 뜻하지 않는다.

## 알림 설정 진단 로그 확보와 독립 네이티브 비교 준비
- [4c27414 UI 실행](https://github.com/kimps005/TTodo/actions/runs/43746163021)의 primary(iOS 26.5/23F77)에서 기존 시스템 로그 수집이 완료됐다. 산출물 ZIP SHA-256 d3108fbb2e0ae2e638e45dd4a4f4772209646c37b1c15566c1ce6d066697444f와 보고서 커밋을 대조했다. 지정 UI 검사 1개 실패이며 실제 PNG·접근성 트리 모두 설정 첫 화면이다.
- 호출 직전 Bundle ID=com.kimps005.ttodo, authorization=1(denied), appState=0(active), 공개 URL=app-settings:notifications이고 반환값은 true다. 빌드/설치 앱의 실행 파일·서명 메타데이터가 일치하고 simctl appinfo에 User 앱·App Group 등록이 있다. 현재 호출은 [Apple 공식 예제](https://developer.apple.com/documentation/uikit/uiapplication/opennotificationsettingsurlstring)와 같다. [open 반환 Bool](https://developer.apple.com/documentation/uikit/uiapplication/open(_:options:completionhandler:))은 URL 열기 성공이며 목적 화면 도착 증명으로 쓰지 않는다.
- 설정 앱 로그는 전달된 TTodo 번들 ID를 포함한 알림 목적지로 변환한 다음 `selection not possible currently 'notifications' which doesn't have async loading, returning`을 기록한다(18:38:48.103 UTC). OS의 알림 목적지 선택 단계에서 중단된 근거지만, 시뮬레이터 공통 제한·앱 등록 영향·실기기 OS 결함 중 하나로 아직 확정하지 않는다. 로그에 보이는 내부 변환 URL을 제품에 사용하지 않는다.
- 동일 공개 API를 호출하는 UIKit 전용 비교 앱과 XCTest를 별도 CI 프로젝트로 준비했다. Expo·확장·App Group·원격 알림·제품 프로젝트 의존성 없이 실제 권한 요청/거부 후 설정 앱의 첫 실행과 재진입을 각각 캡처한다. 반환 Bool·권한·화면/접근성 트리·SDK 헤더·시뮬레이터 로그를 보존한다. 설정 첫 화면은 계속 실패로 판정한다. 제품 URL·코드·서명 경로는 변경하지 않았다. 네이티브 비교 SDK 빌드/실행은 CI 확인 전이며 실제 iPhone 검증은 미완료다.
- [4c27414 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43746162903)는 core/ios 모두 성공했다. 이는 기존 로그 도움말 수정까지의 81개 검사·타입·Hermes·네이티브 빌드 결과이며 새 비교 검사 성공을 뜻하지 않는다.

## 실제 SDK 도움말의 종료 코드와 로그 옵션 보완
- [ea4b024 UI 실행](https://github.com/kimps005/TTodo/actions/runs/43742993778)의 iOS 26.2/23C54 검사 1개가 같은 알림 설정 페이지 단언에서 실패했다. ZIP SHA-256 42efbab4b58a0e70f4c723829680e7bffe6aa7f2cff6f5dc1804a40b5eb76a92를 대조했고 실제 PNG/접근성 트리는 설정 첫 화면이다.
- 실제 설치 앱은 빌드 앱과 Bundle ID(com.kimps005.ttodo)·실행 파일 SHA-256·서명 Identifier/TeamIdentifier/CDHash가 일치한다. simctl appinfo에도 User 앱 및 App Group 등록이 있다. 이를 알림 설정 페이지 등록의 정상 증명이나 OS 결함 확정으로 확대하지 않는다.
- 시스템 로그 수집은 log help show가 정상 usage/옵션을 출력하면서 EX_USAGE(64)를 반환하고 info를 --[no-]info로 표기해 중단됐다. 실제 SDK 도움말을 fixture로 보존하고 정확한 해당 명령·usage·요청 옵션이 모두 맞을 때만 64를 인정한다. 다른 명령/오류/신호/누락 옵션은 계속 거부한다. 로컬 81개 테스트·타입·스크립트 구문·diff 통과. 실제 시스템 로그 수집과 URL 호출 결과 확인은 후속 CI 전이다.
- 같은 실행의 primary(iOS 26.5)도 동일 단언에서 실패했다. 작업 로그의 보고서에서 빌드/설치 앱 일치와 appinfo 수집 성공, 같은 도움말 단계 실패를 확인했다. compact 작업은 성공했으며 전체 workflow는 두 기본 흐름 실패로 실패 상태다. 설정 화면 검사 조건은 유지하며 도움말 보완 후 원인 진단을 계속한다.

## 긴 설명/원문 근거의 Unicode 절단 보완
- PRD 6.7·13.3의 정확한 근거와 데이터 보존을 점검했다. 앱 응답 검증기의 slice(0,4000)가 이모지의 UTF-16 서로게이트 쌍 중간을 자르는 것을 합성 응답으로 재현했다. Swift가 보존한 정상 문자열을 JS 후처리가 손상시킬 수 있었다.
- 기존 4000 UTF-16 단위 상한은 유지하고 경계가 서로게이트 쌍 중간일 때만 한 단위 앞에서 자른다. 설명/원문 근거에 공통 적용하며 원문의 부분 문자열을 유지한다. 문자소 단위나 새 길이 정책으로 변경하지 않는다.
- 수정 전 새 검사 2개 실패·수정 후 로컬 79개 테스트·타입·diff 통과. 한글·이모지 경계 양쪽·정확한 상한·가족 이모지·빈/null 설명·UTF-8 왕복과 원문 포함 관계를 확인했다. [9f8b68a 전체 CI](https://github.com/kimps005/TTodo/actions/runs/43743878497)의 core/ios 모두 성공해 79개 테스트·Hermes·Swift 저장소/캡처·합성 Vision OCR·앱/확장 빌드와 선언 12개 수집을 확인했다. 고정 응답 후처리 검사이며 실제 모델 정확도·기기 검증은 아니다.

## 알림 설정 이동의 앱 등록/시스템 진단 준비
- 사용자 선택에 따라 기존 실패를 판별할 진단을 추가했다. 수동 전체 UI 검사에서만 환경 변수로 네이티브 기록을 켜며 공개 URL 호출 직전의 Bundle ID·OS 권한·앱 실행 상태와 호출 Bool만 남긴다. 일반 실행은 기록하지 않고 OCR·이미지·할 일 내용도 기록하지 않는다.
- 일회성 CI 시뮬레이터에서 실제 SDK 도움말을 보존하고 빌드/설치 앱의 식별자·실행 파일 SHA-256·서명 Identifier/TeamIdentifier/CDHash를 비교한다. 실패 시 해당 시뮬레이터의 설정·등록·알림 프로세스 및 지정 앱 진단 이벤트만 조회한다. 진단 명령 실패의 출력/상태는 별도로 남기고 기존 XCTest 오류/성공 조건은 유지한다.
- 로컬 77개 테스트·타입·스크립트 구문·diff와 진단 명령 모킹을 통과했다. 실제 SDK 진단과 네이티브 기록·원인 구분은 CI 확인 전이다. 공개 URL 처리 성공만으로 올바른 알림 설정 화면 도착을 인정하지 않는다.
- [Apple iOS 26 릴리스 노트](https://developer.apple.com/documentation/ios-ipados-release-notes/ios-ipados-26-release-notes)의 NSLog 변경(137129180)을 추가 대조했다. 동적 문자열이 통합 로그에서 가려질 수 있어 진단 전용 Logger의 public 메타데이터로 식별자/공개 URL/호출 Bool을 기록한다. 본문 기록은 추가하지 않는다. 5d319ea의 선행 실행과 후속 Logger 변경의 실제 SDK 결과를 구분한다.
- 공개 알림 설정 브리지가 변경되어도 실제 UI 검사를 시작하도록 해당 네이티브 모듈을 workflow 경로에 포함했다. 네이티브 코드만 바뀐 후속 커밋을 이전 UI 실행으로 잘못 검증하지 않는다. YAML 파싱·diff 통과, 최신 소스의 UI 재실행 결과는 확인 전이다.
- [ea4b024 전체 CI](https://github.com/kimps005/TTodo/actions/runs/43742993784)의 core/ios가 성공했다. 77개 테스트·타입·보안·Hermes, Swift 저장소/캡처·합성 OCR·네이티브 Logger를 포함한 앱/확장 SDK 빌드를 확인했다. 같은 커밋의 실제 UI/진단 자료는 별도 실행에서 확인하며 후속 Unicode 수정은 이 실행에 포함되지 않는다. 5d319ea·1382dcb의 선행 품질 검사는 후속 소스로 대체되어 취소됐으며 성공으로 세지 않는다.

## UI 결과 진단의 산출물 선택 복구
- UI 검사가 화면/OS별 산출물을 만들도록 바뀐 뒤에도 기존 결과 진단 workflow는 이전 이름 ui-tests에 고정되어 있었다. primary/compact/oldest/manual와 과거 ui-tests 중 하나를 선택해 해당 실행의 결과만 다운로드하도록 보완했다.
- 실제 43724609112 산출물 이름·업로드 템플릿을 대조하고 YAML 파싱·입력/다운로드 연결·diff를 검사했다. 이 진단 workflow 자체의 수동 실행은 아직 미검증이며 앱/알림 동작을 변경하지 않는다.

## 새 버전 DB의 저널 설정 보존
- PRD 13.3의 업데이트/마이그레이션 데이터 보존을 점검했다. 앱 저장소 초기화가 새 스키마를 거부하기 전에 WAL을 DELETE로 바꾸는 것을 실제 파일 SQLite 회귀 검사로 재현했다.
- 저널 설정 전에 스키마 버전을 읽어 알려진 새 버전을 거부한다. 독점 트랜잭션 안의 재확인과 v1/v2 마이그레이션은 유지한다. WAL·버전·기존 할 일·미래 전용 테이블 보존을 검사했고 로컬 77개 테스트·타입·diff가 통과했다. 후속 진단 대상 선택 보완을 포함한 [7871078 전체 CI](https://github.com/kimps005/TTodo/actions/runs/43741720003)의 core/ios가 성공했다. 77개 테스트·타입·보안·Hermes, Swift 저장소/캡처·합성 Vision OCR·앱/확장 SDK 빌드를 확인했다. aa34b3e의 선행 실행은 후속 푸시로 취소되어 별도 성공으로 세지 않는다.

## 공유 SQLite의 내부 NUL 문자열 보존 수정
- PRD 9.3·13.3의 앱/확장 데이터 보존을 점검했다. Swift 바인딩의 음수 길이와 C 문자열 읽기는 내부 U+0000 뒤 본문을 잘라 앱의 Node SQLite 경로와 다른 결과를 만들 수 있었다. [SQLite 바인딩 문서](https://www.sqlite.org/c3ref/bind_blob.html)와 [열 읽기 문서](https://www.sqlite.org/c3ref/column_blob.html)에 따라 UTF-8 바이트 수를 명시해 저장하고 실제 열 바이트 수로 읽도록 공통화했다.
- Swift 저장소 검사에 빈 문자열·한글·가족 이모지·선두/중간/끝 NUL의 왕복, 제목/설명·위젯 스냅샷·재연결 보존을 추가했다. 로컬 76개 테스트·타입·diff와 [87dbbdc 전체 CI](https://github.com/kimps005/TTodo/actions/runs/43741029598)의 core/ios 모두 통과했다. 실제 Swift 저장소/캡처·JSON 계약·합성 Vision OCR, Hermes, 앱·위젯·공유 확장 빌드 및 개인정보 선언 12개 수집을 확인했다. SQLite의 NUL 포함 문자열 SQL 함수 결과나 실제 기기 UI 표시를 보장하지 않는다.

## 작은 화면 통과와 알림 설정 실패 비교
- [fb08926 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43724609124)의 core/ios 모두 성공했다. 76개 테스트·타입·보안·Hermes, 실제 Swift 저장소/캡처·합성 Vision OCR·앱/확장 빌드와 개인정보 선언 수집 단계를 확인했다.
- [동일 커밋 UI 검사](https://github.com/kimps005/TTodo/actions/runs/43724609112)의 compact는 성공했다. ZIP SHA-256 f9154f5f67b873042378b78d62bdb4f54bf2f1eab4219de82f424d007591b8e9와 보고서 커밋을 대조했고 iPhone SE 3세대/iOS 26.5/최대 접근성 글자에서 지정 검사 1개 통과·실패/건너뜀 0을 확인했다. 입력·저장·편집·키보드 중 탭 이동·미저장 입력 보존 검사다. TASK DETAILS 첫 글자 잘림이라는 최초 시각 판단은 원본 재검토에서 재현되지 않아 정정한다. 전체 가독성과 실제 VoiceOver/기기 검증 완료를 뜻하지 않는다.
- primary(iOS 26.5)와 oldest(iOS 26.2)는 모두 알림 설정의 TTodo 페이지 검사에서 실패했다. 실제 알림 거부 이후 설정 전경 전환까지 진행했으며 OS 차이만으로 해소되지 않았다. 공식 알림 설정 URL을 계속 유지하고 성공 조건은 완화하지 않는다. 반복 실패의 근본 원인이 미확정이어서 추측 수정을 중단했고, 사용자가 2026-11-16 CI 앱 등록/설정 프로세스 진단 추가를 선택해 해당 검사를 준비한다. 실기기·잠금·모델 정확도 검증은 미완료다.

## 초기화된 공유 저장소의 읽기 연결 잠금 보완
- PRD 9.3·13.3의 앱/확장 동시 접근을 점검했다. 스키마가 현재 버전이어도 SharedStore 초기화가 BEGIN IMMEDIATE를 실행해 위젯의 읽기 연결이 다른 쓰기 때문에 열리지 않는 구조였다. 로컬 실제 SQLite 두 연결로 같은 초기 PRAGMA와 쓰기 잠금 실패를 재현했고 일반 읽기는 미확정 수정/추가를 제외한 확정 데이터를 읽는 것을 확인했다.
- 처음 읽은 버전이 현재이면 초기화 쓰기 잠금을 생략한다. 이전 버전이면 쓰기 잠금 안에서 버전을 다시 확인한 뒤 기존 트랜잭션 이전을 수행한다. 알려진 새 버전은 journal mode 설정 전에 거부한다. 저장/승인 트랜잭션이나 쓰기 간 잠금 정책은 변경하지 않는다.
- Swift 실제 저장소 검사에 쓰기 진행 중 새 읽기 연결·확정 스냅샷·커밋/롤백 후 재조회와 새 버전의 WAL 설정 보존을 추가했다. 로컬 74개 테스트·타입·diff 통과. [d9a4c45 전체 CI](https://github.com/kimps005/TTodo/actions/runs/43721109407)의 core/ios 모두 통과해 실제 Swift 저장소·동시 읽기·캡처/계약·합성 Vision OCR과 앱/확장 시뮬레이터 빌드를 확인했다. 실제 iPhone의 중단/잠금 경합은 미검증이다.

## UI 실행기 기준 SDK·기종 목록 점검 통과
- PRD 13.4의 서로 다른 iPhone/OS 검증을 준비하며 기존 Intel SDK 점검을 실제 UI와 같은 macos-26 ARM 실행기로 맞췄다. 호스트 버전/아키텍처·Xcode·SDK·설치된 iOS 런타임과 기종 목록을 기록한다. 점검 workflow 변경 push와 수동 실행에만 연결한다.
- [f2b94f1 SDK 점검](https://github.com/kimps005/TTodo/actions/runs/43717786734) 통과. ZIP digest를 대조하고 macOS 26.7.2 arm64 / Xcode 26.6 / SDK 26.5와 사용 가능한 iOS 26.2·26.4.1·26.5를 직접 확인했다. iPhone 16 Pro·SE 3세대 프로필도 있다. iOS 18 런타임은 설치 목록에 없으며 최소 OS 실행을 검증한 것으로 표시하지 않는다. 작은 화면/이전 런타임의 실제 실행은 별도 확인 전이다. OS 다운로드·추가 비용은 발생시키지 않는다.

## 심사 재현 안내 초안
- PRD 17.3의 수동 입력·사진/OCR·AI 승인·단축어·공유·위젯·삭제 재현 절차를 [APP-REVIEW-DRAFT.md](APP-REVIEW-DRAFT.md)에 준비했다. 실제 버튼/Intent 이름과 기능별 검증 제한을 대조했고 미정 연락처나 공개 URL을 넣지 않았다. 제출용 최종 안내나 기능 검증 완료가 아니다.

## 서로 다른 화면·설치된 iOS의 UI 검사 구성 준비
- PRD 13.4의 기종/OS 차이를 검사하도록 UI runner가 SDK의 실제 기종·런타임 원문을 보존하고 선택한 모델/OS/빌드를 보고한다. 지원 목록의 arm64·기종을 확인하며 누락 시 다운로드/대체 없이 실패한다. 가장 이전 설치 OS는 서로 다른 버전이 있을 때만 허용한다.
- UI 구성 push는 기본 iPhone 16 Pro/최신 OS 전체 흐름, SE 3세대/최신 OS/최대 접근성 글자 흐름, iPhone 16 Pro/설치된 가장 이전 OS 전체 흐름을 독립 실행한다. 수동 사진/공유 검사는 모델·OS를 선택한 단일 실행을 유지한다.
- 실제 SDK 목록을 넣은 로컬 선택 결과는 각각 iOS 26.5·26.5·26.2다. 합성 선택 회귀 2개를 포함해 로컬 76개 테스트·타입·구문·YAML·diff 통과. 새 조합의 실제 XCTest/가독성은 CI 확인 전이며 iOS 18·실제 iPhone 검증을 대체하지 않는다.

## 알림 전용 시스템 설정 이동 보완
- [455f6aa UI 검사](https://github.com/kimps005/TTodo/actions/runs/43719088507)는 실제 시스템 권한 요청·거부·거부 표시·재요청 버튼 제거까지 통과했지만 앱별 설정 페이지 검사에서 실패했다. 첨부 화면과 접근성 트리에는 설정 첫 화면이 있어 단순한 제목 조회 실패로 처리하지 않았다.
- 기존 React Native Linking.openSettings는 일반 앱 설정 URL을 사용한다. PRD 12.2의 알림 권한 복구 목적에 맞게 [Apple 공식 알림 설정 API](https://developer.apple.com/documentation/uikit/uiapplication/opennotificationsettingsurlstring)를 메인 액터에서 호출하는 네이티브 메서드를 연결했다. 열기 실패는 사용자에게 안내하며 비공개 URL은 사용하지 않는다.
- UI 검사는 TTodo 제목과 실제 ‘알림 허용’ 스위치의 꺼짐을 함께 확인하고 실패 전 화면/트리를 보존한다. 로컬 74개 테스트·타입·diff 통과. [2ec4324 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43722296776)의 core/ios 모두 성공해 SDK 컴파일·Hermes·Swift/합성 OCR·앱/확장 빌드를 확인했다. 실제 설정 이동·왕복 보존은 UI CI 확인 전이며 시뮬레이터 제한 여부도 아직 확정하지 않는다.

- [2ec4324 UI 검사](https://github.com/kimps005/TTodo/actions/runs/43722296694)는 실제 거부 이후 공개 알림 전용 URL 호출·설정 전경 전환까지 진행했지만 TTodo 제목/알림 스위치를 찾지 못해 실패했다. 실제 PNG와 트리에도 설정 첫 화면만 있고 ZIP SHA-256은 e73c286366f3a0967b5b47850d1581f8fc3a2ff56497a98324cd587b3ea0f2e6이다. 원인이 앱 등록/시뮬레이터/OS 중 어디에 있는지는 미확정이며 시뮬레이터 제한으로 단정하거나 성공 조건을 완화하지 않는다. 설치된 iOS 26.2와의 비교 및 작은 화면 독립 흐름을 다음 CI에서 확인한다.

## 알림 권한 거부·기기 설정 왕복 UI 검사 준비
- PRD 12.2·권한 거부 경로에 맞춰 기존 전체 수동 입력 UI 검사를 보강했다. 새 CI 시뮬레이터의 실제 알림 요청에서 거부를 누르고, 거부 상태 표시·재요청 버튼 제거·앱 전용 기기 설정 이동을 확인한다. 권한/DB 상태 주입은 없다.
- 설정에서 앱으로 돌아온 뒤 저장한 할 일과 미저장 입력 유지, 전체 삭제·재실행 후 OS 권한은 여전히 거부로 표시되는지도 검사한다. 실제 알림 UI/설정 화면과 합성 앱 접근성 트리를 첨부한다. UI 테스트/workflow 변경 push는 기본 app/large 전체 검사를 자동 실행한다.
- 로컬 74개 테스트·타입·구문·YAML·diff 통과. 새 Swift XCTest SDK 컴파일/실행과 알림 거부 성공은 CI 확인 전이며 실제 iPhone·AI/잠금 검증은 포함하지 않는다.
- [첫 UI 실행](https://github.com/kimps005/TTodo/actions/runs/43716298788)은 실제 SDK 컴파일·앱 실행·수동 입력 흐름 뒤 앱 내부 alert 조회에서 실패했다. summary/tests JSON은 지정 검사 1개 실패이며 실패 화면에 시스템의 실제 TTodo 알림 요청 창과 Don’t Allow/Allow가 보인다. Apple 문서의 시스템 권한 alert 처리에 맞춰 SpringBoard 조회로 수정하고 대기 실패 전에도 전체 화면/시스템 접근성 트리를 남긴다. 시간 제한·검사 조건은 유지하며 수정 후 UI 재검증 전이다.

## 한국어 기본 언어와 지원 언어 선언 보완
- PRD P0-12의 한국어 우선 지원을 점검했다. 실제 iPhoneOS 아카이브 로그에서 한국어 App Shortcut 문구를 en 언어로 학습하고 있었고 생성 플러그인은 기본/지원 언어를 선언하지 않았다. Apple의 CFBundleDevelopmentRegion·CFBundleLocalizations 및 언어 선택 문서를 확인했다.
- 생성 Xcode 프로젝트의 기본 언어를 ko로 맞추고 앱·위젯·공유 확장 Info.plist에 기본 ko/지원 ko를 지정했다. JS에서 관리하는 한국어 UI도 번들 지원 언어로 선언한다. 재적용 중복 방지, 실제 생성 XML과 기존 entitlements 유지 검사를 보강했다. 로컬 74개 테스트·타입·구문·diff 통과.
- [b2d7636 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43715163208)와 [iPhoneOS Release 아카이브](https://github.com/kimps005/TTodo/actions/runs/43715163336) 모두 통과했다. 실제 SDK 로그에서 두 한국어 단축어 문구와 앱 이름을 ko로 학습하고 1개 locale을 아카이브한 것을 확인했다. ZIP digest·커밋·iPhoneOS 플랫폼·기본 ko/지원 [ko]·선언 12개를 직접 대조했다. 한국어 Siri·잠금 실행·VoiceOver 실기기는 미검증이다.

## 실제 iPhoneOS Release 아카이브 검사 통과
- 계정 없이 가능한 후속 검증으로 iPhoneOS SDK·Release·arm64의 서명 없는 archive workflow를 추가했다. 기존 앱/위젯/공유 확장의 아카이브 포함과 메타데이터·실행 파일·개인정보 선언을 기록한다. 계정·프로비저닝·설치·배포·사이드로딩을 진행하지 않는다.
- 선언 보고서에 빌드 문맥을 추가하고 시뮬레이터/iPhoneOS 플랫폼이 바뀌어 표기되면 거부하는 검사를 보강했다. 로컬 74개 테스트·타입·구문·YAML·diff 통과. 최종 서명된 배포·실제 iPhone 검증은 미완료다.
- [ec1ec09 iPhoneOS 아카이브 실행](https://github.com/kimps005/TTodo/actions/runs/43713306562)은 Xcode 26.6 / iPhoneOS SDK 26.5의 Release arm64 archive 생성과 두 확장 포함 확인을 통과했다. 전체 job은 후속 메타데이터 JSON 변환에서 실패했다. plutil 원본 lint는 OK지만 JSON 변환은 `Invalid object in plist for JSON format`으로 중단되어 선언 수집까지 진행하지 않았다. JSON으로 표현할 수 없는 plist 타입을 제거하지 않고 XML plist로 보존하도록 수정했다. 수정 후 전체 아카이브/수집 검증 전이다.
- [같은 커밋의 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43713306561)는 core/ios 모두 통과했다. 74개 테스트·Hermes·Swift·시뮬레이터 앱/확장 빌드와 새 문맥의 Debug 개인정보 수집을 확인했다. 이 성공을 위 실패한 아카이브 검사 전체 성공으로 대체하지 않는다.
- 수정 후 [abbfd32 iPhoneOS 아카이브 검사](https://github.com/kimps005/TTodo/actions/runs/43714107156)와 [전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43714107179)가 모두 통과했다. 실제 XML 메타데이터의 arm64·앱 경로·빈 SigningIdentity/Team과 CreationDate의 date 타입을 직접 확인했다. 이전 JSON 오류는 이 타입을 보존하는 XML 출력으로 해소되었다. 실행 파일은 Mach-O 64-bit arm64이며 앱·두 확장의 아카이브 포함과 Release의 iPhoneOS/선언 12개를 확인했다. ZIP digest와 커밋이 일치하고 같은 커밋 Debug의 선언 원문과 경로도 모두 같았다. 한국어 언어 선언 보완은 이 실행 이후다.

## 빌드 산출물의 개인정보 선언 수집 통과
- PRD 11의 개인정보·출시 기준과 Apple 공식 선언 문서를 대조했다. 전체 CI에서 실제 `.app` 안의 PrivacyInfo.xcprivacy를 macOS plutil로 읽고 번들 상대 경로·키 원문·플랫폼·커밋별 JSON을 남기도록 추가했다. 선언을 수정하거나 수집 없음으로 추정하지 않는다.
- 로컬 74개 테스트·타입·스크립트 구문·diff 통과. 새 검사 2개는 JSON 고정 입력의 폴더 탐색·누락/형식 처리이며 실제 plutil/빌드 산출물 수집과 구분한다. 상세 범위는 [PRIVACY-MANIFESTS.md](PRIVACY-MANIFESTS.md)에 기록했다.
- Debug 선언 목록은 Release Archive·SDK 서명·실제 네트워크·필수 사유 적합성·App Store 개인정보 응답을 검증하지 않는다. 해당 출시 차단 항목은 미완료다.
- [1c2021a 전체 CI](https://github.com/kimps005/TTodo/actions/runs/43712115642)의 core/ios 모두 통과했다. 74개 테스트·타입·보안·Hermes·Swift 저장소/캡처/계약·합성 Vision OCR·앱/확장 빌드와 실제 plutil 수집을 확인했다. 다운로드 ZIP의 digest·보고서 커밋/iPhoneSimulator 플랫폼을 대조했으며 앱 최상위 포함 12개 선언의 원문을 직접 확인했다. 선언상 추적 false·수집 배열 비어 있음이며 이를 실제 수집 없음으로 판정하지 않는다. 세부 분류/사유는 PRIVACY-MANIFESTS.md에 기록했다.

## 작은 위젯의 우선 마감 표시 연결
- PRD 5.4의 누락된 작은 위젯 마감을 연결했다. 사용자가 2026-11-15 앱 목록과 같은 우선순위를 선택해 PRD에도 기록했다. 미완료 오늘 마감→지난 마감→미래 마감 순서와 같은 날짜/시각 정렬을 재사용한다. 마감 없는 항목 다섯 개가 화면을 채워도 전체 대기 목록에서 마감을 찾는다.
- 날짜만 있는 마감은 날짜를 유지하고 시각이 있는 마감은 기기 시간대로 표시한다. 제한된 위젯에는 마감이 있을 때 제목 1개와 별도 ‘우선 마감’ 행을 표시한다. 기본 개수 표시·전체 숨김·읽기 실패에는 마감이 노출되지 않는다. 스키마와 Live Activity 저장 형식은 변경하지 않는다.
- 로컬 72개 테스트·타입·diff와 [af82d3b 전체 CI](https://github.com/kimps005/TTodo/actions/runs/43711483762)의 core/ios 모두 통과했다. 실제 Swift 우선순위·완료 제외·다섯 항목 밖 미래 마감·날짜/시각·숨김 검사, 캡처/계약·합성 Vision OCR, Hermes, 앱·위젯·공유 확장 arm64 시뮬레이터 빌드를 확인했다. 위젯 실제 화면/실기기는 미검증이다.
- 실제 표시·시간대 변경·숨김·큰 글자·VoiceOver의 별도 절차는 [WIDGET-QA.md](WIDGET-QA.md)에 정리했다. 기존 사용자 수정이 있는 DEVICE-QA.md는 덮어쓰거나 함께 커밋하지 않았다.

## 기준일 없는 연·월·주 상대 날짜의 보완
- PRD 6.7·6.8의 불명확한 날짜 미지정 기준을 점검했다. 근거에 다른 연도가 있으면 ‘내년·올해·지난주’ 등 기존 정규식에 없는 상대 표현의 모델 마감이 그대로 유지되는 오류를 합성 응답으로 재현했다.
- 앱과 Swift의 같은 제한 규칙에 연·과거 일자·지난 주/달/해 표현을 추가하고 정규화한 근거에서 판정한다. 기준일이 없으면 마감만 미지정·확인 필요로 바꾸며 원문 근거를 보존한다. 명시 날짜와 확인한 기준일이 있는 경로는 유지한다.
- 공유 합성 사례 18개로 수정 전 실패·수정 후 로컬 72개 테스트·타입·diff 통과. [c0fa7bb 검사](https://github.com/kimps005/TTodo/actions/runs/43711197492)는 core와 Swift 검사 후 후속 푸시로 취소되었다. 위젯 변경을 포함한 [af82d3b 전체 CI](https://github.com/kimps005/TTodo/actions/runs/43711483762)의 core/ios 모두 성공해 Swift 18개 사례·네이티브 빌드를 확인했다. 이 검사는 고정 응답 후처리이며 실제 모델 정확도나 모든 한국어 날짜 표현 탐지 성공을 뜻하지 않는다.

## 유사 캡처 조회의 시각 정렬과 비교 대상 제한 보완
- PRD 12.5의 중복 의심 안내를 점검해 두 오류를 실제 SQLite로 재현했다. 초/밀리초/시간대가 다른 기록의 문자열 정렬은 최신 순서를 뒤바꾸고, 만료·미래 기록을 200개 제한 후 제외하면 유효한 유사 근거를 놓친다.
- 앱 분석함과 앱·네이티브 유사 조회를 실제 시각으로 정렬하고, 최근 7일·미래 제외·보존 기한 조건을 제한 전에 적용했다. 비교 근거 200개·안내 최대 3개·자동 병합 금지 정책은 유지한다.
- 수정 전 새 회귀 검사 2개 실패, 수정 후 로컬 71개 테스트·타입·diff 통과. [160466b 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43710353390)의 core/ios 모두 성공했다. 실제 Swift 저장소·날짜 순서·제외 기록 200개·직접 승인 차단과 JSON 계약·합성 Vision OCR, Hermes 및 앱·위젯·공유 확장 arm64 빌드 통과. 실제 사용자 이미지 중복률·모델·실기기 검증은 미완료다.

## 만료 정리·중단 복구의 최신 전체 CI 통과
- [c76df77 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43709090533)의 core/ios가 모두 성공했다. 69개 테스트·타입·보안 취약점 0·실제 Hermes, Swift 저장소/캡처·Swift JSON→TypeScript 계약·합성 한국어 Vision OCR과 앱·위젯·공유 확장 arm64 시뮬레이터 빌드를 확인했다.
- 날짜 표기 차이에 따른 만료 정리와 10분 유예 회귀 검사는 합성 입력의 실제 SQLite 검사다. 이 실행을 실제 iPhone 시각 변경·기기 내 모델/정확도·잠금 동작 검증으로 대체하지 않는다. 후속 유사 조회·날짜 문맥 변경의 검증은 위 항목에서 구분한다.

## 중단 분석 복구의 날짜 형식 경계 보완
- 중단 복구의 10분 유예도 문자열 비교 때문에 Swift 초 단위/시간대 표기에서 늦게 적용되는 것을 실제 SQLite로 재현했다. PRD의 오류 복구·데이터 보존 기준에 따라 실제 시각 비교로 변경하고 기존 10분 초과 조건을 유지했다.
- 초/밀리초/한국 시간대 표기 각각에서 유예 1ms 전·정확한 경계의 진행 토큰 보존, 1ms 후 실패/토큰 무효화, 이전 응답 차단과 명시적 재시도 성공을 확인했다. 수정 전 실패·수정 후 로컬 69개 테스트·타입·diff와 위 최신 전체 CI 통과. 실제 프로세스/실기기 검증은 미완료다.

## 네이티브 캡처의 만료 시각 정리 보완
- PRD 11.2·11.4의 원문 정리를 점검해 Swift의 초 단위 날짜와 앱의 밀리초 날짜를 문자열로 비교하면 정확한 만료 시점에 제안·원문이 남는 오류를 실제 SQLite로 재현했다. 정리 트랜잭션의 세 쿼리를 실제 시각 비교로 변경했다. 스키마와 저장한 할 일의 보존 정책은 유지한다.
- [SQLite 공식 날짜 문서](https://www.sqlite.org/lang_datefunc.html)의 julianday·소수점·시간대 처리를 확인했다. 초/밀리초/한국 시간대 표기 각각에서 만료 1ms 전 보존·정확한 기한 정리·내보내기 원문 제거·지문 유지 검사를 추가했다. 수정 전 실패, 수정 후 로컬 68개 테스트·타입·diff 통과. 기존 부분 저장 항목 보존과 정리 실패 롤백 검사도 통과했다.
- 후속 중단 복구 보완을 포함한 위 최신 전체 CI/Hermes·네이티브 빌드를 통과했다. 실제 iPhone 시각 변경·앱 중단·기기 내 모델과 정확도 검증은 미완료로 유지한다.

## 분석 완료 시 보존 기한 재확인
- PRD 11.2·11.4에 따라 앱과 네이티브 공통 저장소가 분석 결과를 쓰는 트랜잭션 안에서 보존 기한을 다시 검사한다. 앱이 오래 중단되거나 시각이 변경되어 기한 이후 응답이 도착해도 제안·원문·모델 완료 상태를 새로 저장하지 않는다. 잘못된 기한도 거부한다.
- 실제 SQLite 회귀 검사가 수정 전 실패함을 확인하고 수정했다. 기한 1ms 전 성공·정확한 기한/이후 차단·잘못된 기한 거부·본문 미생성·중단 복구 후 명시적 재시도·이전 토큰 거부를 확인했다. 로컬 67개 테스트·타입·diff 통과. Swift에도 같은 경계/재시도 검사를 추가했으며 [00e5187 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43707459043)의 core/ios 모두 통과했다. 실제 Hermes, Swift 저장소/캡처·계약·합성 Vision OCR과 앱·위젯·공유 확장 시뮬레이터 빌드를 확인했다. 실제 모델·기기 시각 변경/중단·실제 iPhone 검증은 미완료다.

## 이전 동의 등록 보완 전체 CI 확인
- [02dd8cd 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43587824641)의 core/ios와 단계별 성공을 연결 API로 확인했다. 타입·테스트·보안·Hermes, Swift 저장소/캡처·계약·합성 Vision OCR, 앱·위젯·공유 확장 시뮬레이터 빌드 통과. 실제 프로세스 경합·기기 내 모델·실기기 검증은 포함하지 않는다.

## 분석 시작과 동의 철회의 경합 보완
- PRD 11.2에 따라 앱의 신규 분석 등록도 네이티브 경로처럼 동의 확인과 같은 트랜잭션에 묶었다. 화면에서 동의를 확인한 뒤 철회가 먼저 처리되면 신규 토큰 발급과 기존 지문 재사용을 모두 거부한다. 철회 전에 등록된 토큰은 기존 철회 트랜잭션에서 무효화한다.
- 실제 SQLite 회귀 검사가 수정 전 실패하는 것을 확인한 뒤 수정했다. 미동의 등록 거부·철회 우선 처리·새 행 미생성·재동의 후 명시적 새 요청 성공·승인 전 할 일 미생성을 확인했다. 기존 검사는 동의 후 등록하는 실제 제품 순서에 맞췄다. 로컬 66개 테스트·타입·diff 통과. 후속 CI/Hermes·네이티브 빌드·실제 모델/프로세스 경합·실기기 검증은 확인 전이다.

## AI 동의 재활성화 시 이전 분석 저장 차단
- 동의 철회가 근거 문장만 삭제하고 진행 토큰은 유지해, 동의를 다시 켜면 철회 전 모델 응답이 저장될 수 있는 경합을 확인했다. 철회 트랜잭션에서 queued/processing 분석을 CONSENT_REVOKED 실패로 전환하고 토큰을 제거한다. 같은 DB를 사용하는 앱·단축어·공유 확장의 기존 완료 토큰 검사가 이전 결과를 거부하도록 한다.
- 실제 SQLite 회귀 검사로 철회·재활성화·늦은 결과 거부·새 재시도 성공과 정리 실패 시 동의/토큰/원문 전체 롤백을 확인했다. 로컬 65개 테스트·타입·diff와 [918a4f5 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43586569826) 통과. 기기 내 모델 연산의 즉시 중단을 뜻하지 않으며 실제 모델/프로세스 경합·실기기 검증은 미완료다.

## OCR 입력 전체 삭제 후 재입력 보완
- PRD의 오류 수동 수정 원칙에 맞춰 기존 OCR 편집 경로를 보완했다. 인식문을 모두 지우면 입력칸도 사라지는 조건부 렌더링 오류를 수정하고, 글자 유무 대신 OCR 완료 지문을 기준으로 표시해 빈 인식 결과와 사용자 전체 삭제 뒤에도 입력을 계속할 수 있다. 빈 내용의 AI 분석은 기존대로 차단한다.
- 실제 사진 선택·Vision OCR UI 검사에 키보드로 전체 삭제→빈 편집칸 유지→재입력→재선택 취소 후 수정 보존 검사를 추가했다. 합성 이미지의 실제 OCR을 먼저 대조하며 응답·DB 주입은 없다.
- 로컬 63개 테스트·타입·diff와 [전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43584368392), [사진 UI 재검증](https://github.com/kimps005/TTodo/actions/runs/43584375416) 통과. 실제 iPhone·AI 정확도는 미검증이다.

## 최근 검증 요약
- [abbfd32 전체 CI](https://github.com/kimps005/TTodo/actions/runs/43714107179)와 [서명 없는 iPhoneOS Release 아카이브](https://github.com/kimps005/TTodo/actions/runs/43714107156) 모두 성공. 74개 테스트·타입·보안·Hermes·Swift/합성 Vision OCR·앱/확장 시뮬레이터 빌드와 실제 iPhoneOS arm64 archive 및 Debug/Release 개인정보 수집을 확인했다. 실제 iPhone 설치·실행, SDK 서명 적합성·배포 서명·App Store 신고는 미검증이다.
- [af82d3b 전체 CI](https://github.com/kimps005/TTodo/actions/runs/43711483762): 72개 테스트·타입·보안·Hermes, 실제 Swift 위젯 마감 우선순위/개인정보·날짜 문맥 18개 사례·캡처/계약·합성 Vision OCR 및 앱·위젯·공유 확장 arm64 시뮬레이터 빌드 통과. 실제 위젯 화면·AI 모델 정확도·실기기는 미검증이다. 후속 개인정보 선언 수집 검사는 별도 CI에서 확인한다.
- [c76df77 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43709090533): core/ios 모두 성공. 69개 테스트·타입·보안·Hermes, Swift 저장소/캡처·계약·합성 Vision OCR과 앱·위젯·공유 확장 시뮬레이터 빌드 통과. 날짜 표기별 만료/중단 복구 경계는 실제 SQLite에서 확인했으며 실제 모델/기기 검증은 미완료다.
- [00e5187 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43707459043): core/ios 모두 성공. 67개 테스트·타입·보안·Hermes, Swift 저장소/캡처·계약·합성 한국어 Vision OCR, 앱·위젯·공유 확장 시뮬레이터 빌드 통과. 분석 완료 기한 경계와 재시도 검사는 합성 응답을 사용했으며 실제 모델·기기 시각 변경/중단·iPhone 검증은 미완료다.
- [918a4f5 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43586569826): core/ios 모두 성공. 65개 테스트·타입·보안 취약점 0·Hermes, Swift 저장소/캡처 실행·Swift JSON→TypeScript 계약·macOS 합성 Vision OCR, 앱·위젯·공유 확장 시뮬레이터 빌드 통과. 동의 철회 후 재활성화 경합은 실제 SQLite 회귀 검사로 확인했으며 실제 기기 내 모델을 실행한 프로세스 간 경합이나 실기기 검증은 아니다.
- [4302f90 사진 UI 재검증](https://github.com/kimps005/TTodo/actions/runs/43584375416): iOS 26.5 / iPhone 16 Pro 시뮬레이터에서 지정한 `testPhotoOCRAndCancelPreservesDraft` 1개 실행·1개 통과, 실패/건너뜀 0. 실제 사진 선택·합성 한국어 Vision OCR 뒤 글자 전체 삭제·빈 편집칸 존재·재입력과 재선택 취소 후 글자/날짜 보존, 재실행 후 미승인 데이터 부재를 확인했다. SDK summary/tests JSON을 로컬에서 다시 대조했고 재입력·날짜 보존 화면도 시각 확인했다. 전체 삭제 직후 첨부 화면에서는 편집칸이 화면 밖에 있어 빈 편집칸 자체의 확인은 XCTest 단언에 근거한다. 이전 사진 가져오기 시간 초과는 같은 제한·통과 기준의 새 실행에서 재현되지 않았으며 최초 지연의 근본 원인은 미확정이다. 실제 사용자 사진·AI 생성/정확도·실제 iPhone 검증으로 대체하지 않는다.
- [4302f90 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43584368392): core/ios 모두 성공. 63개 테스트·타입·보안·Hermes, Swift 저장소/캡처/합성 Vision OCR, 앱·위젯·공유 확장 시뮬레이터 빌드 통과. 사진 준비 단계의 진단 보강을 포함한 소스이며 실제 편집 UI 검사는 별도 결과를 따른다.
- [d864a4e 사진 UI 실행](https://github.com/kimps005/TTodo/actions/runs/43582860291)은 합성 PNG를 시뮬레이터로 가져오는 `simctl addmedia`의 240초 시간 초과로 실패했다. 부팅 마이그레이션 약 4분과 macOS OCR 사전 검사 통과를 진단 파일에서 확인했으며 앱 빌드·XCTest에는 도달하지 않았다. 기기 사진 서비스 지연의 근본 원인은 아직 미확정이다. 후속 검사 스크립트는 OCR 컴파일/실행/사진 가져오기 단계를 구분하고 실패 명령·종료 상태·표준 출력/오류를 보존한다. 성공 조건이나 제한 시간은 완화하지 않는다.
- [d864a4e 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43582823839): core/ios 성공. OCR 입력 전체 삭제 후 편집칸 유지 변경을 포함해 63개 테스트·타입·보안·Hermes, Swift 저장소/캡처/합성 Vision OCR 검사와 앱·위젯·공유 확장 시뮬레이터 빌드 통과. 전체 삭제 후 재입력의 실제 사진 UI 검사는 별도 실행에서 확인하며 실제 iPhone·AI 정확도는 미검증이다.
- [e76e723 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43581881280): core/ios 모두 성공. 내보내기 오류 보존·중복 공유 차단과 부분 사진 복사본 정리 변경을 포함해 63개 테스트·타입·보안·Hermes, Swift 저장소/캡처/합성 Vision OCR 및 앱·위젯·공유 확장 시뮬레이터 빌드를 통과했다. 실제 공유 파일 내용·오류 경로·실제 iPhone은 미검증이며 DEVICE-QA에 확인 절차를 추가했다.
- 사진 복사 실패/원본 정리 실패 시 호출자가 소유하지 못한 부분 복사본을 즉시 정리하도록 보강했다. 복사와 삭제가 동시에 실패해도 원래 복사 오류를 유지한다. 앱 전용 캡처 폴더의 삭제 실패는 기존 시작 정리가 재시도하며, 사진 선택기의 원본 파일 삭제 실패 자체가 해결된 것으로 간주하지 않는다. 로컬 63개 테스트·타입·diff 통과. 실제 iOS 오류 재현은 미실시다.
- 내보내기 후 임시 파일 정리 오류가 쓰기/공유의 원래 오류를 덮어쓰지 않도록 두 내보내기 경로를 공통 처리했다. 개발용 평가 내보내기 중 중복 요청·평가 재시작·화면 닫기를 차단했다. 로컬 61개 테스트·타입·diff 통과. 후속 CI와 실제 공유 파일 내용/실기기 검증은 아직 미확인이다.
- [09e70b1 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43566980110): core/ios 성공. 58개 테스트·타입·보안·Hermes, Swift 저장소/캡처/합성 Vision OCR 검사와 앱·위젯·공유 확장 arm64 시뮬레이터 빌드 통과.
- [사진 선택·한국어 OCR UI 검사](https://github.com/kimps005/TTodo/actions/runs/43566983385): iOS 26.5 / iPhone 16 Pro 시뮬레이터의 지정 UI 검사 1개 통과. 사진 선택, 합성 이미지의 Vision OCR, 인식문·날짜 편집, 취소 후 재선택 시 입력 보존, 재실행 후 미승인 할 일/분석 없음 확인. 실제 사용자 사진의 정확도 검증은 아니다.
- [fc2aca6 core 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43567643960): 내보내기 파일 쓰기 완료를 기다리도록 수정한 뒤 58개 테스트·타입·보안·Hermes 통과. 이 실행은 iOS 작업을 생략했으며 실제 공유 파일 내용 확인은 남아 있다.
- 공유 동의 UI([검사](https://github.com/kimps005/TTodo/actions/runs/43562339509))와 최대 Dynamic Type UI([검사](https://github.com/kimps005/TTodo/actions/runs/43562355136))도 시뮬레이터에서 지정 검사 각 1개 통과. VoiceOver 및 실기기 접근성 검증은 미완료다.
- 실제 iPhone 설치·서명·잠금 입력/자동화, Foundation Models의 실제 생성과 한국어 정확도, 운영 개인정보·스토어 준비는 아직 검증되지 않았다. 자세한 잔여 조건은 아래 출시 차단 항목과 P0 목록을 따른다.

## 출시 차단 항목
- 최종 Bundle ID / App Group 및 실제 기기 서명 경로 필요. EAS는 선택한 배포 방식에서 연결하며, 현재 결제나 유료 배포를 진행하지 않음.
- Windows에 Xcode/Swift가 없어 iOS 네이티브 빌드와 실기기 검증은 별도 macOS 빌드 및 iPhone이 필요.
- 인증 없는 잠금화면 텍스트 입력·저장과 앱 강제 종료 조건은 실제 iPhone 검증 전까지 미완료.
- Apple 공식 검색 결과에서 iOS 27 스크린샷 저장 자동화 트리거 존재 확인. 실제 이미지 전달과 잠금 실행은 미검증이며 자동 지원으로 홍보하지 않음.
- 사용자: iPhone 16 Pro / 최신 iOS / Apple Developer Program 미가입. 정확한 OS 버전은 실기기 QA 때 기록.
- 사용자가 Mac을 사용할 수 없다고 확인. Apple 현재 기능 표의 무료 계정 App Groups 지원과 별개로, 현재 환경에는 무료 Xcode 서명/설치 경로가 준비되어 있지 않음. Windows 코드 개발과 macOS CI는 계속하고 실제 설치·잠금 검증은 미완료 유지.
- 무료 우선: 외부 유료 API와 서버 연결은 보류. Apple 기기 내 AI를 평가 후보로 구현하며 한국어 성능 통과 전 최종 모델로 확정하지 않음.
- 개인정보 처리방침·지원 이메일·앱 아이콘·스토어 자료 확정 필요.

## 원칙
로컬 기능과 네이티브 기술 검증부터 구현한다. 계정 없는 사용과 수동 입력을 AI 설정에 종속시키지 않는다.

## 구현 및 로컬 검증
- Expo SDK 58 공식 TypeScript 템플릿, React Native 0.88 기반.
- SQLite v2 스키마, v1 보존 마이그레이션, CRUD, 오늘/지난 마감/미지정/미래/완료 정렬, 승인 트랜잭션과 중복 방지 구현. 촬영 시각을 모르는 사진은 null로 저장.
- 홈, 할 일 편집, 분석함, 제안 검토, 설정 및 데이터 내보내기/삭제 UI 구현.
- AI 제공자 인터페이스, 원문 근거·날짜·신뢰도·실제 할 일 여부 응답 검증, 민감 텍스트 제한 구현.
- Apple Foundation Models 기기 내 추출 후보와 사진 선택→OCR→동의→추출→검토→승인 경로 연결. OS/기기/모델/한국어 준비 상태 확인. 외부 전송 없음. 실제 생성과 정확도는 미검증.
- `npm test`: SQLite·승인/마이그레이션·평가/입력 검증·동의 경합·시각 경계·임시 파일·개인정보 선언·한국어 프로젝트 생성 등 최근 CI 74개 통과. `npm run typecheck`: 통과. 이후 작업의 검증 범위는 위 최신 항목에서 구분한다.
- Expo 전이 의존성 minimatch 취약점을 해당 의존성 범위의 override로 수정. 설치 시 보안 경고 0개.
- 사진 선택/OCR과 앱 주요 흐름은 iPhone 16 Pro 시뮬레이터에서 일부 UI 검증 통과. 실제 iPhone 실행·시각 검증은 미완료. 네이티브 공유 저장소 없이는 iOS에서 별도 DB를 생성하지 않고 개발 빌드 필요 안내.
- App Group SQLite, 잠금 이후 접근 정책(재부팅 후 최초 인증 필요), AddTodo App Intent, Vision 한국어/영어 OCR, WidgetKit 및 Live Activity 코드 구현.
- Expo autolinking에서 `TTodoNativeModule` 인식 확인. Xcode 프로젝트 타깃·소스 연결과 재적용 중복 방지 테스트 통과.
- Windows에서는 Expo iOS prebuild가 지원되지 않음. GitHub macOS CI에서 iOS 생성·Pods·앱과 확장 컴파일 검증.
- Windows Hermes 실행 오류의 원인: 운영체제 애플리케이션 제어 정책이 `hermesc.exe`를 차단. 보안 정책을 변경하지 않고, 로컬 JS 번들 검사와 CI의 실제 Hermes 빌드를 구분한다.
- 로컬 iOS JavaScript 번들 검사 통과. 첫 GitHub CI core 작업에서 타입·테스트·보안·실제 Hermes 바이트코드 모두 통과.
- 첫 macOS CI 소스 경로 오류를 수정하고 [299af4a CI](https://github.com/kimps005/TTodo/actions/runs/43426175047)에서 앱과 확장의 네이티브 빌드 통과. 이후 DB 브리지/기기 내 AI 변경은 별도 재빌드 확인 필요.
- [f7fa8ea CI](https://github.com/kimps005/TTodo/actions/runs/43428618685): 새 시스템 SQLite 브리지와 Foundation Models 기기 내 AI를 포함한 iOS 앱/위젯 arm64 시뮬레이터 컴파일 통과. 실제 생성/기기 잠금 테스트와 구분.
- iOS는 앱·단축어·위젯이 시스템 SQLite를 사용하도록 통일. 같은 파일을 서로 다른 SQLite 복사본으로 접근하지 않으며, JS 작업/트랜잭션을 순서대로 실행. Android 준비용 Expo 어댑터는 새 연결의 PRAGMA를 개별 설정.
- 초기 지원 OS의 시스템 SQLite 버전을 고려해 rollback journal(DELETE)을 사용. 저장 성공을 우선하고 성능은 실기기에서 측정.
- 임시 사진은 전용 캐시로 옮겨 화면 종료 시 삭제하고, 강제 종료 잔여 파일과 임시 내보내기는 다음 시작에 정리.
- 24개 합성 한국어 OCR 정답셋 준비. 실제 이미지·모델 성능 측정 아님.
- 개발 빌드의 설정에서 합성 24문장 기기 내 평가 실행/중단 및 결과 JSON 내보내기 가능. 정답을 모델에 주입하지 않으며 자동 정확도 점수를 표시하지 않음. 실제 평가 실행은 미실시.
- 원문 무시 즉시 삭제, 만료 대기 제안 비식별화/저장 차단, 동의 철회 시 원문 근거 삭제, 날짜 기준일 없는 상대 날짜/연도 추정 제거, 마감의 실제 시각 정렬 보완.
- [0c2987e 최종 코드 CI](https://github.com/kimps005/TTodo/actions/runs/43430013677): 19개 TypeScript 테스트·타입·보안·Hermes, 실제 Swift 저장소의 마이그레이션/바인딩/개인정보 스냅샷/롤백 실행 검사, iOS 앱·위젯 arm64 시뮬레이터 컴파일 모두 통과. App Group 권한·파일 보호·AI 생성·잠금 입력은 이 검사로 검증하지 않음.
- 이후 변경은 보존 기간 안내 문구와 검증 문서 정리. 사용자의 Mac 미보유 답변을 반영했으며 유료 가입이나 결제를 진행하지 않음.

## 아직 구현/검증이 필요한 P0
- Share Extension, 단일 제안 승인·무시 알림 액션의 실제 기기/백그라운드 검증.
- 실제 자동화 입력 이미지 및 앱 종료/잠금 상황에서 OCR·AI 실행.
- 유사 중복 안내의 실제 이미지/한국어 판별 품질과 원문 기반 날짜/담당 정확도 평가.
- 정식 개인정보/보존 정책, 접근성 실기기 QA, 위젯 만료/동기화 QA, TestFlight 및 스토어 심사.

## Mac 미사용 답변 이후 작업
- 단축어 `TTodo에서 캡처 분석` App Intent 추가. 직접 전달한 IntentFile만 처리하며 최신 사진을 임의 조회하지 않음.
- OCR과 모델 출력 검증을 Swift 공통 계층으로 분리. 사용자 동의 전/철회 후 저장 차단, 민감정보 제한, 정확한 원문 근거·날짜 검증, 검토 대기 저장, 동일 이미지 중복 방지 구현.
- 제안 알림은 민감한 원문/제목 없이 개수와 검토 안내만 표시. 알림 기본 탭·확인 버튼의 검토 화면 연결 구현. 작성 중 화면이 있으면 닫은 후 연결해 미저장 편집을 덮어쓰지 않음.
- 앱 실행 시 네이티브 분석을 즉시 실패로 덮어쓰지 않도록, 10분 유예 후 중단 작업 복구. 재시도 시작 시 작업 시각 갱신.
- 앱 설정에서 기기 내 AI 동의를 켜거나 철회 가능. 알림 거부 시 분석함을 통해 결과 확인 가능.
- 로컬 타입 검사와 TypeScript 테스트 20개 통과. 네이티브 캡처 처리 검사에는 테스트용 OCR/모델 응답을 주입하며, 실제 AI 성능 검증으로 간주하지 않음. 이번 네이티브 변경은 macOS CI 검증 전.
- [b5ede9f CI](https://github.com/kimps005/TTodo/actions/runs/43433910887): 타입·테스트 20개·보안·Hermes, Swift 저장소/캡처 처리 실행 검사, iOS 앱·위젯 컴파일 통과. 실제 이미지/모델 실행·백그라운드 수명 검증과는 구분.
- 후속 변경: 제목 표시를 허용하고 확인 필요 표시가 없는 단일 제안에만 알림 직접 추가 제공. 기본 개인정보 모드/여러 제안/확인 필요 항목은 전면 검토로 연결. 승인·무시는 JS 시작 없이 네이티브의 짧은 로컬 트랜잭션으로 처리하며 중복 승인·만료·무시한 항목을 차단.
- 제목 숨김 변경/전체 삭제 시 기존 캡처 알림 제거. 알림 생성 직전 동의·저장 상태·제목 표시 정책 재확인. 알림 표시와 제거 타이밍은 실기기 QA 필요.
- 현재 SDK의 Expo 알림 매니저가 delegate 반환 후 completion을 호출하므로, 데이터 쓰기는 동기적으로 완료하고 모델/네트워크 작업을 알림 액션에 넣지 않음. Swift 승인·무시 회귀 검사 추가, CI 재검증 전.
- 사용자가 ‘CI 개발 유지, 실기기 설치는 나중에’를 선택. AltStore 설치/서명 변경 경로는 진행하지 않고, 추가 비용 없이 코드/CI 검증을 계속한다.
- Share Extension 코드 추가: 이미지 한 장을 직접 수신하고, 공유창에서 기기 내 분석/제안 선택/제목·마감 수정/승인·무시 제공. 원본을 공유 저장소에 복제하지 않으며, 분석 취소 시 미승인 Todo를 생성하지 않음.
- 공유 화면의 승인도 동일 SQLite에 원자적으로 저장. 혼합 승인 오류 롤백, 재승인 중복 방지, 출처 share 보존 Swift 검사 추가.
- EAS 확장 선언과 Xcode Share 타깃/동일 App Group 연결. 확장 버전·빌드 번호를 앱 설정에서 파생하도록 보완. 로컬 생성 타깃·타입 검사 통과, 실제 확장 API 컴파일/실행/메모리는 CI 및 기기 검증 전.
- [9a42cdc CI](https://github.com/kimps005/TTodo/actions/runs/43435297439): 네이티브 알림 delegate/승인·무시 처리 컴파일과 Swift 실행 검사 통과.
- [04b6a6a CI](https://github.com/kimps005/TTodo/actions/runs/43436954740): Share Extension 포함 앱·위젯 컴파일, 공유 승인 트랜잭션의 Swift 실행 검사 통과. 실제 확장 메모리/수명·이미지 입력·모델 실행은 미검증.
- 후속 변경: 앱 상세/AI 검토/공유창에서 날짜와 시각을 각각 수정 가능. 날짜만 있는 마감에 시각을 임의로 추가하지 않고, 사용자 수정 시 기기 시간대로 변환·유효성 확인. TypeScript 테스트 22개 통과, Swift 날짜/시각 회귀 검사는 다음 CI 확인 필요.
- [e27297d CI](https://github.com/kimps005/TTodo/actions/runs/43438669249): 날짜/시각 수정과 잘못된 현지 시각의 Swift 검사, 타입/테스트 22개/보안/Hermes 및 앱·두 확장 컴파일 통과.
- 수동 시뮬레이터 실행 workflow 추가. Release 앱 실제 기동, 공유 DB 초기화/무결성, 합성 데이터 재실행 화면과 보존 확인을 계획. 아직 실행 결과/시각 검토 전이며 실제 기기·모델·잠금 검증과 구분.
- 잠금화면 표시를 제목/개수/내용 숨김 3단계로 구현. 내용 숨김에서는 공유 스냅샷과 Live Activity에 실제 제목·개수를 전달하지 않고 Dynamic Island도 개수를 표시하지 않음. 이전 Activity 상태는 새 선택 필드를 optional로 두어 호환.
- 제목/내용 숨김 시 이전 캡처 알림 제거, 알림 전 개인정보 정책 재확인, 숨김 상태에서 캐시된 직접 승인 액션 차단 보완. TypeScript 23개/타입 검사 통과. 새 Swift 개인정보 스냅샷 검사는 CI 확인 전.
- [8208788 CI](https://github.com/kimps005/TTodo/actions/runs/43440751155): 개인정보 3단계의 Swift 검사·타입·23개 테스트·Hermes·앱/두 확장 컴파일 통과.
- [첫 실행 검사](https://github.com/kimps005/TTodo/actions/runs/43440210526): Release 컴파일 성공, iOS 26.5 시뮬레이터가 실행 요청을 SBMainWorkspace 오류로 거부. DB/화면 검증에 도달하지 못했으며 원인은 아직 미확정. 실패 전 시스템 로그가 없어 진단 로그·크래시 보고서·실패 화면 수집을 추가하고 재실행한다. App Group을 제거하거나 별도 DB로 우회하지 않는다.
- PRD 검토 화면 구성에 맞춰 이번 사진 선택에서 이어지는 검토 화면과 공유창에 임시 이미지 미리보기 추가. 앱 미리보기는 검토 종료 시 캐시 삭제, 공유창은 축소 이미지만 메모리에 유지. 분석함에서 과거 원본을 다시 여는 기능은 구현하지 않음.
- 공유창이 만료 제안을 읽을 때도 원문 근거·미승인 내용을 정리하도록 보완. 명시적 공유 분석 버튼은 실패 항목 재시도 가능. 로컬 타입·23개 테스트 통과, Swift 회귀/확장 컴파일은 다음 CI 확인 필요.
- 앱의 분석 결과 저장 트랜잭션에서 동의를 다시 확인하고, 승인 트랜잭션에서 만료 시점을 다시 확인하도록 보완. 분석 도중 동의 철회·오래 열린 검토 화면 만료를 재현한 회귀 검사를 포함해 로컬 테스트 25개와 타입 검사 통과.
- [9005422 CI](https://github.com/kimps005/TTodo/actions/runs/43443103184): 이미지 축소/공유 검토 변경을 포함한 Swift 저장소·캡처 실행 검사와 앱·위젯·공유 확장 컴파일, 23개 테스트·Hermes 통과. 이후 동의/만료 저장 직전 검사는 다음 CI 대상.
- [진단 실행](https://github.com/kimps005/TTodo/actions/runs/43442966552): Release 빌드/서명 검증 성공. 실패 화면은 Apple 로고·부팅 진행 막대이며 앱 관련 실행 로그가 없음. 새 시뮬레이터의 `bootstatus`가 공통 240초 제한을 넘은 것으로 확인. 초기 부팅에 별도 600초 한도를 주고 단계·부팅 로그를 기록한다. 첫 실행의 SBMainWorkspace 거부와 동일 원인인지는 다음 실행으로 확인하며 앱 실행 통과로 간주하지 않음.
- DB v3에서 분석 시도 식별자 추가. 앱·공유창·단축어의 오래된 결과/실패 통지가 재시작된 분석 상태를 덮어쓰지 않도록 완료·실패 갱신에서 식별자를 비교. 실패 재시도도 트랜잭션으로 한 번만 시작하며, 다른 분석이 진행 중이면 앱에 올바른 안내 표시. v1/v2 데이터 보존 이전 경로와 재시도 경쟁 회귀 검사 추가. 로컬 타입·26개 테스트 통과, 새 Swift 검사/컴파일은 다음 CI 대상.
- [부팅 대기 수정 후 검사](https://github.com/kimps005/TTodo/actions/runs/43445465063): 부팅 완료·설치 후 실행 단계에서 실패. 실제 크래시의 종료 사유는 `CODESIGNING / Taskgated Invalid Signature`, 앱 코드 실행 전 종료. 빌드 로그의 시뮬레이터 권한 목적지(`__entitlements`)와 별개로 기기용 plist를 수동 서명에 주입한 경로를 제거하고, Xcode 자체 시뮬레이터 서명으로 변경해 검증한다. 보안 정책 변경·App Group 제거·별도 DB 우회는 하지 않음.
- [5b6c46a CI](https://github.com/kimps005/TTodo/actions/runs/43446131998): DB v3 이전·오래된 분석 결과/실패 통지 차단의 Swift 실행 검사, 앱·위젯·공유 확장 컴파일, 26개 테스트·타입·보안·Hermes 통과. v1 TypeScript 테스트는 이후 실제 열이 없는 과거 구조로 더 엄격하게 보강했고 로컬 재검사 통과.
- PRD 11.3에 따라 첫 사용 화면에서 잠금화면 노출 위험을 설명하고 제목/개수/내용 숨김을 선택하도록 보완. 기본 개수 표시 유지, 단축어/위젯 연결 완료로 간주하지 않음. 설정과 동일한 라디오 선택 컴포넌트로 VoiceOver 선택/비활성 상태 제공. 전체 삭제 시 임시 이미지/내보내기 파일 정리, AI 중지 시 기존 캡처 알림 제거 연결. 타입 검사 통과, 실제 화면과 접근성은 다음 실행/기기 검사 필요.
- Swift 제안 인코더의 nil 선택 필드가 기본 합성 인코딩에서 생략되어 JS의 엄격한 null 계약과 불일치하는 문제 발견. description/due_at/assignee를 명시적 null로 인코딩하도록 수정. Swift가 출력한 합성 제안 JSON을 실제 TypeScript 검증기에 전달하는 CI 계약 검사 추가. 로컬 타입·26개 테스트 통과, Swift 출력 계약의 실제 실행은 CI 확인 전.
- [086295c 실행 검사](https://github.com/kimps005/TTodo/actions/runs/43447613048) 성공: Xcode 자체 시뮬레이터 서명으로 iOS 26.5 앱 실제 기동, App Group의 SQLite v3 초기화, 무결성 ok, 합성 데이터 3개 재실행 후 보존 확인. 앱·위젯·공유 확장 서명 검증 통과. 빈 목록과 합성 목록 화면을 직접 확인해 한국어·하단 탭·미완료 개수 2개 표시 확인. 이후 온보딩 변경은 이 화면 확인에 포함되지 않음. 버튼 조작·AI 생성·잠금 입력·실제 확장 동작은 미검증.
- [a527dff CI](https://github.com/kimps005/TTodo/actions/runs/43448382701): core의 타입·26개 테스트·보안·Hermes 성공. macOS 작업은 대기 후 코드 실행 없이 취소됨. 이 실행으로 Swift JSON 계약 통과를 주장하지 않으며 다음 코드 CI에서 검증한다.

## 확정된 개별 삭제 정책
- 사용자가 ‘연결된 분석 본문도 즉시 삭제’를 선택. 할 일과 연결된 제안의 제목·설명·날짜·담당·원문 근거를 동일 트랜잭션에서 지운다. 비내용 식별자·이미지 지문·saved 처리 상태는 남겨 승인 재전송으로 복원되지 않도록 한다.
- 같은 이미지의 다른 할 일과 미승인 제안은 유지한다. 이전 버전에서 삭제 후 남은 saved 제안 본문은 다음 앱 접근 시 정리한다.
- 삭제 확인창에 본문 삭제·중복 방지 기록 보존을 설명하고 해당 분석의 전달/대기 알림 제거를 요청한다. 위젯/Live Activity 갱신은 기존 변경 경로로 요청하며 OS 반영 시점은 실제 기기 QA 대상이다.
- 본문 삭제·내보내기 내용 제거·다른 항목 보존·승인 재전송·트랜잭션 롤백·과거 잔여 내용 정리를 검사. 로컬 타입·28개 테스트 통과. 새 알림 브리지는 네이티브 CI 확인 전.
- [3ae03e2 CI](https://github.com/kimps005/TTodo/actions/runs/43451527763): core/ios 모두 성공. 타입·28개 테스트·보안·Hermes, 실제 Swift 저장소/캡처 실행 검사와 Swift 인코더 출력→TypeScript 검증기 계약 검사, 삭제 알림 브리지를 포함한 앱·위젯·공유 확장 컴파일 통과. 실제 알림 제거·잠금 입력·AI 정확도는 기기 QA 대상이다.

## 확정된 재분석 범위
- 사용자가 1번 ‘저장 전 캡처만 재분석’을 선택. 앱 사진 선택 화면과 공유창에서 직접 재분석할 수 있고, 기존 미저장 제안/수정 내용을 교체한다는 확인을 받는다. 실패·빈 결과·무시한 결과도 저장한 기록이 없으면 다시 분석할 수 있다.
- 하나라도 saved 제안이 있거나 분석 상태가 saved이면 재분석을 차단한다. 부분 저장·개별 할 일 삭제 후에도 같은 규칙을 적용하고 직접 수정 안내를 표시한다. 자동화는 직접 재분석을 시작하지 않고 기존 중복/명시적 실패 재시도 경로를 유지한다.
- 동의·현재 상태·저장 기록 확인과 이전 제안 삭제/새 시도 시작을 한 트랜잭션으로 처리한다. 재분석과 승인 경쟁, 예전 제안 승인/늦은 결과, 부분 저장·삭제 후 재분석 차단 회귀 검사 추가. 로컬 타입·31개 테스트 통과. Swift 재분석 검사와 공유창 컴파일은 새 CI 검증 전.
- 동일 이미지 판단은 현재 동일 바이트 SHA-256 지문 기준이다. 파일 재인코딩/크롭 등 변경 이미지의 시간·텍스트 유사 중복 판단은 아직 별도 구현/검증 대상이다.
- 재분석 이전 알림/검토 화면이 새 제안을 승인하거나 무시하지 않도록 제안 ID를 비교한다. 단일 알림 추가는 해당 제안 ID, 무시는 당시 대기 제안 ID 집합과 일치해야 처리한다. 식별자가 없는 과거 알림과 실패한 액션은 직접 변경 대신 분석함 확인 안내로 연결. 재분석 실패 시 공유창의 오래된 편집 항목도 제거한다. 로컬 타입·31개 테스트 통과, 추가 Swift 검사/컴파일은 다음 CI 대상.
- [3ab071a CI](https://github.com/kimps005/TTodo/actions/runs/43472951851): core와 실제 Swift 회귀/JSON 계약 검사는 통과했으나 공유 확장 컴파일에서 CaptureNotifications 소스 미연결 오류 발생. 공유창에서 이 코드를 새로 사용한 만큼 확장 타깃에도 동일 파일을 포함하도록 config plugin 수정, 소스 연결 회귀 검사 추가.

## 비슷한 캡처 검토 안내
- PRD 12.5에 따라 최근 7일·보존 기간 내·원문 근거가 남은 다른 분석의 대기/저장 제안과 비교한다. 최근 근거 최대 200개를 조회하고 분석별 최대 3개 참고 항목을 표시한다. 전체 OCR/원본 이미지를 추가 저장하지 않는다.
- 한국어/영어·NFKC·공백/문장부호 차이를 정규화하고, 충분히 긴 문장의 3글자 조각 포함 비율을 보수적으로 비교한다. 짧은 상용구와 다른 날짜/금액은 구분한다. 0.93 임계값은 합성 사례 기반의 초기 참고 규칙이며 실제 중복률 KPI 통과를 의미하지 않는다.
- 앱·공유창에서 기존 항목을 보여주고 저장 전 재확인을 받는다. 유사 후보가 있으면 알림 직접 추가도 차단해 검토로 보낸다. 자동 병합·자동 삭제·자동 Todo 생성은 하지 않으며, 서로 다른 작업이면 사용자가 저장할 수 있다.
- 원문을 삭제/무시하거나 만료된 기록은 유사 비교에서 제외한다. 삭제된 본문을 비교 목적으로 되살리지 않으며, 동일 바이트 지문과 saved 기록에 의한 재분석 차단은 별도로 유지한다.
- TypeScript/Swift가 공유하는 합성 중복 사례와 만료/삭제 제외·직접 승인 차단 검사를 추가. 로컬 타입·35개 테스트 통과, 새 Swift 검사/확장 컴파일은 CI 확인 전. 기존 생성 타깃에도 누락 소스를 보충하도록 plugin 재적용 경로를 보완하고 회귀 검사 통과.
- 위젯/Live Activity의 `ttodo://today` 링크를 앱 최초 실행과 실행 중 모두 처리하도록 보완. 편집·사진 분석·검토 화면과 알림 검토 요청이 있으면 해당 화면 종료 후 할 일 탭으로 이동한다. 임의 경로/매개변수는 무시. 로컬 타입·36개 테스트 통과, 실제 위젯 탭/화면 전환은 기기 QA 대상.

## 보존 기간 경계의 조회·내보내기
- [58faaee CI](https://github.com/kimps005/TTodo/actions/runs/43474689623): core/ios 성공. 유사 캡처 Swift 회귀 검사·JSON 계약과 앱·위젯·공유 확장 컴파일 통과. 공유 타깃 소스 누락 수정도 포함하며 실제 이미지 중복 품질·위젯 탭 동작은 기기 QA 대상이다.
- 앱을 재실행하거나 탭을 바꾸지 않아도 분석 목록/제안 조회와 데이터 내보내기에서 보존 기간 정리를 수행한다. 정리와 읽기를 한 트랜잭션에 묶어 만료 원문·미저장 본문이 파일에 포함되지 않게 한다. 정리 실패 시 내보내기 자체를 실패 처리하고 변경을 롤백한다.
- 정확히 만료되는 시점·직전, 저장한 할 일 보존, 미만료 제안 보존, 저장 기록에 따른 재분석 차단 유지와 정리 실패 롤백 검사 추가. 로컬 38개 테스트·타입 검사 통과. 변경 후 Hermes·네이티브 CI는 확인 전이며 실기기 검증과 구분한다.

## 알림 권한 거부 경로
- PRD 12.2에 따라 재요청이 불가능한 권한 거부 상태에서도 기기 설정으로 이동할 수 있게 하고, 알림 없이 분석함에서 결과 확인이 가능함을 안내한다. 요청 가능한 경우에만 요청 버튼을 표시하며 조용한 알림/임시 허용/미요청 상태를 구분한다.
- 설치된 Expo 권한 타입과 [React Native 공식 Linking API](https://reactnative.dev/docs/linking#opensettings)를 확인해 공개 설정 이동 API를 사용한다. 앱 복귀 시 기존 상태 갱신 경로를 사용하며 권한 조회 실패가 오프라인 할 일 접근을 막지 않게 한다.
- 로컬 타입 검사 통과. 화면 조작·권한 거부·설정 복귀는 실기기 미검증이며 DEVICE-QA에 추가한다.
- [efb5634 최종 코드 CI](https://github.com/kimps005/TTodo/actions/runs/43482412427): core/ios 모두 성공. 보존 기간 경계의 조회·내보내기 수정과 알림 거부 경로를 포함해 타입·38개 테스트·보안·Hermes, Swift 저장소/캡처 회귀·Swift JSON→TypeScript 계약, 앱·위젯·공유 확장 컴파일 통과. 중간 709a955 실행은 후속 푸시로 취소되었으며 최종 실행 결과로 검증한다. 실제 권한 조작·기기 설정 복귀·잠금 입력·AI 정확도는 실기기 미검증 상태를 유지한다.

## 사진 선택 상태와 날짜 문맥
- 사진 선택창 취소 시 기존 이미지/OCR 수정/지문/이전 분석 표시/대화 기준일을 유지한다. 새 이미지를 실제 임시 캐시로 가져온 뒤에만 새 초안으로 전환하고 대화 기준일을 비운다. 이전 캡처의 기준일로 다른 대화의 상대 날짜를 해석하는 문제를 차단한다.
- OCR/분석 중 원문과 날짜 입력을 비활성화해 실행에 사용된 문맥과 화면 편집이 엇갈리지 않게 한다. 민감정보 안내를 실제 기기 내 분석 제한 정책과 일치시킨다.
- 사진 선택 취소·교체·OCR 실패 경로는 코드 확인 및 타입 검사 대상으로 검증하며, 실제 사진 선택 UI와 날짜 문맥 동작은 기기 QA 전이다.

## 열려 있는 검토 화면의 최신 상태
- 검토 화면 진입/앱 복귀/확인 재시도 시 보존 기간 정리를 포함해 최신 제안을 다시 읽고 유사 캡처 안내도 갱신한다. 이전 요청이 늦게 끝나 최신 결과를 덮어쓰지 않도록 요청 순서를 확인한다. 갱신 중/실패 시 저장·모두 무시를 차단한다.
- 같은 ID의 유효한 대기 제안만 제목·날짜 편집과 선택을 유지한다. 삭제·만료·다른 경로 승인 항목은 DB의 본문과 상태를 적용하고, 재분석으로 생긴 새 ID에는 이전 편집·선택을 상속하지 않는다. 새 항목은 직접 선택해야 저장할 수 있다.
- 편집 보존·동의 철회 원문 제거·삭제/만료 본문 적용·재분석 선택 상속 방지 회귀 검사 포함 로컬 41개 테스트·타입 검사 통과. 실제 앱 복귀/화면 조작과 접근성은 기기 QA 전이며 새 코드 CI는 확인 전이다.

## 저장 중 조작과 접근성 상태
- 홈 완료 체크·검토 선택 체크에 실제 비활성 속성과 VoiceOver 비활성 상태를 제공한다. 검토 갱신 중/실패·이미 처리된 제안은 선택/본문 편집을 막으며, 홈의 저장 중 상세 진입과 공유창 처리 중 편집도 차단한다.
- 상세 편집·검토의 저장/삭제/무시를 ref 잠금으로 직렬화하고 저장 중 시스템 닫기 요청을 막는다. 검토 액션 실패 후에는 최신 제안을 다시 읽어 오래된 결과를 계속 편집하지 않게 한다.
- 로컬 타입 검사 통과. 기존 DB 고유 제약/트랜잭션은 유지하며 실제 연속 탭·화면 닫기·VoiceOver·Swift 공유창 컴파일은 새 CI/기기 QA 대상으로 남긴다.

## 저장 결과와 화면 갱신 오류 분리
- 앱 복귀 시 목록 읽기가 실패해도 초기화 오류 화면으로 전환하지 않는다. 열린 입력·검토 화면과 편집 내용을 유지하고 탭으로 갱신을 재시도하도록 안내한다.
- 성공한 DB 변경 이후 목록/잠금화면 갱신 실패는 별도로 안내한다. 이미 저장된 수동 입력을 실패로 오인해 다시 추가하도록 만들지 않으며, 앱 목록 갱신 실패와 무관하게 잠금화면 갱신도 요청한다.
- 로컬 타입 검사 통과. 강제 DB busy/브리지 실패와 앱 복귀 편집 보존은 실기기 QA 전이며 저장 자체 실패는 기존 오류 경로로 처리한다.
- PRD 12.6에 맞춰 초기 실행/앱 복귀 후에도 기존 위젯·Live Activity 갱신 브리지를 요청한다. 만료된 Activity를 자동으로 새로 시작하지 않으며 OS의 실제 반영 시점·갱신 예산은 기기 QA 대상이다.

## 유사 캡처 숫자 경계
- 기존 부분문자열 경로에서 110만원/10만원, A112/A12, 150/1.50처럼 숫자가 다른 항목도 같은 후보가 되는 오류를 합성 사례로 재현했다. 부분문자열·유사도 판정 전에 완전한 숫자 토큰을 비교하도록 TypeScript/Swift를 함께 수정했다.
- 정규 천 단위 쉼표는 숫자 비교에서 정규화하고 소수점은 유지한다. 모호한 숫자/날짜 표기 차이는 후보에서 빠질 수 있는 보수적인 참고 규칙이며 자동 병합하지 않는다.
- 공유 합성 사례 11개와 기존 전체 41개 테스트·타입 검사 통과. Swift의 동일 사례 실행과 앱/확장 컴파일은 새 macOS CI 확인 전이며 실제 중복 품질 측정은 아니다.

## 네이티브 분석 취소 경계
- 취소된 작업은 저장소 등록 전에 중단하고, 등록 이후/OCR 직후/모델 응답 직후에도 취소를 확인한다. 공유창 종료 뒤 불필요하게 다음 처리 단계를 시작하는 경로를 줄이며, 등록된 취소 작업은 CANCELLED로 실패 처리하고 제안을 저장하지 않는다.
- 등록 전 취소 시 OCR/모델/DB 등록 차단, OCR 직후 취소 시 모델 호출 차단, 모델 응답 직후 취소 시 제안 저장 차단 Swift 회귀 검사 추가. OCR/모델 응답은 테스트 주입이며 실제 AI 실행·OS의 실행 중단 시간을 측정한 검사가 아니다.
- 로컬 타입 검사·diff 검사 통과. Windows에서는 Swift 실행 불가이므로 추가 검사와 컴파일은 macOS CI 확인 전이다. 이미 실행 중인 OCR/모델 호출 자체의 즉각 중단을 보장하지 않는다.

## 민감정보 표기 정규화
- 전각 password/카드번호·분해 한글·단어 사이의 보이지 않는 문자로 기존 제한을 우회하는 합성 사례를 재현했다. TypeScript/Swift의 민감정보 검사에 NFKC와 제한된 비표시 문자 정리를 적용한다. 검사용 문자열만 정규화하며 원문을 수정하거나 로그에 남기지 않는다.
- 양쪽에서 같은 합성 사례 12개를 읽도록 회귀 검사 추가. 일반 날짜·시간·이모지 문장은 계속 허용하는 사례 포함 로컬 42개 테스트·타입 검사 통과. Swift 실행/앱·확장 컴파일은 새 macOS CI 확인 전이다.
- 이 규칙이 모든 민감정보를 검출하거나 안전하게 제거한다고 보장하지 않는다. 외부 AI 미사용·명시 동의·저장 전 사용자 검토 정책은 그대로 유지한다.

## Dynamic Island 목록 연결
- 잠금화면 Live Activity와 별도로 Dynamic Island 구성에도 ttodo://today 기본 링크를 연결했다. [Apple 공식 DynamicIsland.widgetURL 문서](https://developer.apple.com/documentation/widgetkit/dynamicisland/widgeturl(_:))에서 각 표시 상태의 기본 앱 연결 API를 확인했다.
- 기존 앱의 링크 경로 제한·작성/검토 중 이동 지연 정책을 그대로 사용한다. Swift API/위젯 컴파일은 새 macOS CI, compact/minimal/expanded 탭 이동은 iPhone QA 전이다.

## 알림 생성 직전 제안 집합 검증
- 알림 카테고리를 비동기로 읽는 동안 재분석/승인/무시가 끝나 같은 분석 ID가 다시 review 상태가 되어도, 예전 제목·제안 ID로 알림을 보내지 않도록 현재 대기 제안 ID 집합과 당시 집합을 비교한다. 동의·상태·만료·제안 집합을 한 DB 읽기 트랜잭션에서 확인한다.
- 동일 상태 허용·빈 집합/만료/동의 철회 차단·재분석 진행/완료 후 예전 ID 차단·무시 후 차단 Swift 회귀 검사 추가. 로컬 타입·diff 검사 통과, Swift 실행/컴파일은 새 CI 확인 전이다.
- OS 알림 등록과 DB 변경은 하나의 원자적 트랜잭션으로 묶을 수 없으므로 최종 확인 후 실제 전달/제거 타이밍은 실기기 QA 대상이다. 알림 액션의 기존 제안 ID 검증도 유지한다.

## 누적 안정화 CI와 실행 검사 보완
- [9cf8c9a 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43487965191): core/ios 모두 성공. 42개 테스트·타입·보안·Hermes, Swift 저장소/캡처/JSON 계약과 앱·위젯·공유 확장 컴파일 통과. 사진 초안·검토 복귀·저장 중 조작·갱신 오류 격리·숫자 경계·민감정보 표기·취소 경계·알림 제안 집합·Dynamic Island 연결 변경을 포함한다. 실제 조작·AI 정확도·잠금 입력은 미검증이다.
- Release 시뮬레이터 실행 검사는 별도로 진행한다. 초기 온보딩과 합성 목록 화면을 나눠 확인하도록 검사 스크립트를 보완하고, 목록 환경의 온보딩 완료는 합성 DB 설정임을 명시한다. 실제 SQLite 버전도 공유 스키마와 같아야 통과하도록 보완한다.
- 검사 스크립트의 로컬 구문/diff 검사 통과. 보완한 실행 검사의 실제 결과와 화면 확인은 다음 workflow 실행 후 기록한다.

## 시뮬레이터 화면과 실제 UI 테스트 준비
- [9cf8c9a Release 실행 검사](https://github.com/kimps005/TTodo/actions/runs/43488381352): iOS 26.5, 앱·두 확장 서명 확인, SQLite v3·무결성 ok·합성 할 일 3개 재실행 보존 통과. 산출물 화면에서 한국어 온보딩/기본 개수 표시와 미완료 0→2를 확인했다. 온보딩이 목록을 가리므로 이 실행을 실제 목록 배치 확인으로 기록하지 않는다.
- 온보딩과 합성 목록을 분리한 [9253c29 실행](https://github.com/kimps005/TTodo/actions/runs/43490839958)은 진행 중이다. 앱 코드는 9cf8c9a와 같으며 검사 스크립트/문서만 보완한 상태다.
- GitHub macOS의 별도 수동 UI 검사 workflow를 추가했다. 새 시뮬레이터에서 실제 온보딩 버튼·수동 입력·재실행 보존·제목 편집·삭제 취소·삭제 후 재실행을 XCTest로 확인할 계획이다. 일반 prebuild에는 테스트 타깃을 추가하지 않고 앱 배포 의존성/제품에 넣지 않는다.
- UI 타깃 제품 유형·앱 의존 방향·재적용 중복 방지·생성 프로젝트 재파싱 검사 포함 로컬 43개 테스트·타입·스크립트 구문·workflow YAML 검사 통과. 실제 UI runner 빌드/실행은 아직 확인 전이며 실기기·AI·네트워크 차단 검증과 구분한다.

## 빈 담당자와 알림 직접 승인
- AI의 담당자 null/빈 문자열/공백을 미지정으로 통일하고 확인 필요를 강제한다. 명시한 담당자는 앞뒤 공백만 정리한다. 기존 Swift가 빈 문자열을 확인 불필요로 통과시킬 수 있던 JS/Swift 차이를 수정했다.
- 과거 DB의 확인 불필요 플래그가 잘못 남아도 앱/공유 검토에서는 빈 담당자를 확인 필요로 표시한다. 알림 직접 추가 생성과 실제 네이티브 승인 양쪽에서 담당자의 비어 있지 않은 값을 재확인한다. 의미상 실제 수행 주체가 맞는지는 여전히 사용자 검토와 AI 정확도 평가 대상이다.
- 빈 문자열·공백·NBSP·명시된 담당자 정규화와 과거 기록 조회 회귀 검사 포함 로컬 45개 테스트·타입 검사 통과. Swift 출력/기존 기록의 직접 승인 차단 검사도 추가했으며 새 macOS CI 확인 전이다.
- 이전 e7cb2d2 [품질 CI](https://github.com/kimps005/TTodo/actions/runs/43492444538)는 43개 테스트와 앱/두 확장 네이티브 작업 모두 성공했다. 이후 담당자 검증 변경은 이 결과에 포함하지 않는다. 별도 XCTest UI 실행은 아직 진행 중이다.

## UI 검사 결과 집계와 산출물
- UI 검사 완료는 xcodebuild 종료 코드만으로 결정하지 않는다. xcresulttool의 summary/tests 결과에서 지정한 수동 입력 흐름이 정확히 1개 실행·통과하고 실패/건너뜀이 없어야 완료로 표시한다. 0개·건너뜀·실패·다른 사례만 실행한 결과를 차단하는 로컬 회귀 검사를 추가했다.
- XCTest 첨부 이미지를 CI에서 평면 파일로 내보내 Windows에서 확인할 수 있도록 보완했다. 테스트 생성기의 제품 표시 이름도 실제 xctest와 일치시키고, 기존 CI와 같은 arm64/활성 아키텍처만 빌드한다. 앱 배포 코드/서명 경로는 바꾸지 않는다.
- [Apple Xcode 16.3 명령 안내](https://developer.apple.com/documentation/xcode-release-notes/xcode-16_3-release-notes)에 따라 xcresulttool get test-results/export attachments를 사용한다. 로컬 46개 테스트·타입·스크립트 구문 검사 통과. 실제 SDK 출력 계약과 UI runner 실행은 다음 수동 CI 확인 전이다.

## 첫 실제 UI 검사 실패 진단
- [기존 결과 번들 진단](https://github.com/kimps005/TTodo/actions/runs/43496640535) 성공. 실제 xcresulttool summary는 1개 실행/1개 실패였고, 접근성 트리의 저장 제목은 updatedCI manual task였다. 테스트는 다중 행 입력칸을 탭하면 항상 커서가 끝에 있다고 가정하여 CI manual task updated를 찾았다. 저장 실패로 단정하지 않는다.
- 편집한 입력칸의 실제 값을 읽고 원래 제목과 다름/입력 문자열 포함을 확인한 뒤, 저장된 목록 값과 일치하는지 대조하도록 XCTest 기대를 수정했다. 입력 직후 스크린샷도 추가해 향후 실패를 직접 확인한다. 임의 대기나 제품 동작 우회는 추가하지 않는다.
- 실제 SDK의 summary/tests JSON을 로컬 결과 검증기에 넣어 1개 실패 결과가 완료 처리되지 않음을 확인했다. 타입·diff 검사 통과. 수정 후 전체 UI 흐름은 새 수동 CI 검증 전이다.

## 실제 Vision OCR 합성 이미지 검사 준비
- 기존 캡처 처리 회귀 검사의 주입 OCR과 별도로, macOS CI에서 합성 한국어 PNG를 그려 실제 프로덕션 VisionOCR.recognize를 실행하는 검사를 추가한다. 한국어/날짜 문구 일치·빈 이미지의 빈 결과·잘못된 이미지 거부를 확인한다.
- Apple AppKit/ImageIO로 화면 없는 비트맵을 생성하며 사용자 이미지/할 일을 읽지 않는다. 정답 문자열을 OCR 응답으로 주입하지 않고 실제 API 출력과 대조한다. OCR 출력은 로그에 남기지 않으며 합성 입력 이미지에 한해 진단 artifact를 보존한다.
- workflow YAML·diff 검사 통과. Windows에서는 Swift/AppKit 실행 불가이므로 컴파일과 실제 OCR 실행은 새 macOS CI 확인 전이다. 실제 iPhone OCR·Foundation Models AI 정확도·다양한 캡처 품질 완료로 표시하지 않는다.

## 전체 삭제 후 공간 정리 실패 분리
- 서로 다른 실제 SQLite 연결로 삭제 커밋 직후 읽기 잠금을 잡아 VACUUM의 SQLITE_BUSY를 재현했다. 기존 코드는 이미 할 일·분석·설정을 삭제하고도 실패를 반환해 후속 알림/임시 파일 정리를 건너뛰었다.
- 삭제 트랜잭션 자체의 오류는 계속 롤백·전달한다. 커밋 후 공간 정리만 실패하면 compacted=false를 반환해 후속 정리를 진행하고 미완료 정리를 안내한다. secure_delete 설정은 유지한다. [SQLite 공식 VACUUM 문서](https://sqlite.org/lang_vacuum.html)의 다른 연결 잠금 조건과 일치한다.
- 전체 삭제에서 Activity 종료/알림 제거/임시 파일 삭제를 각각 시도하여 하나의 실패가 나머지를 막지 않도록 한다. 필요한 경우 같은 전체 삭제 버튼으로 정리를 재시도할 수 있게 안내한다. DB 삭제 전에 Activity 종료 실패로 삭제가 중단되는 순서도 제거했다.
- 실제 파일 DB 경합·삭제 실패 시 전체 본문/설정 롤백 검사 포함 로컬 48개 테스트·타입 검사 통과. 새 JS 번들/네이티브 CI와 실제 기기의 OS 잔여 표시 검증은 확인 전이다.

## 공유창 검토 상태 재확인
- 공유창 복귀와 저장 직전에 최신 대기 제안을 다시 읽는다. 같은 ID의 제목·날짜 편집과 선택은 유지하되 원문 근거·확인 필요 여부는 저장소에서 가져오며, 교체된 제안은 자동 선택하지 않는다.
- 무시 요청은 사용자가 본 제안 ID 집합과 현재 집합이 같을 때만 수행한다. 최신 조회 실패 시 편집·저장·재분석을 잠그고 재확인 버튼을 제공한다.
- 승인 커밋 이후 조회 실패는 저장 실패로 표시하지 않고 저장 완료와 후속 확인 안내를 구분한다.
- Apple 공식 NSExtensionHostDidBecomeActive 알림을 사용한다. 로컬 49개 테스트·타입·diff 검사 통과. 새 Swift 편집 보존/원문 삭제/교체 선택 회귀 검사와 앱·확장 컴파일은 macOS CI 확인 전이며 실제 공유창 수명은 iPhone 미검증이다.
- 기존 품질 실행 43503689019는 core 성공/ios 배정 전 취소, 확장 UI 실행 43503692908도 배정 전 취소였다. 네이티브 통과로 기록하지 않는다.

## 키보드 완료 입력의 마지막 글자 보존
- [확장 UI 실행](https://github.com/kimps005/TTodo/actions/runs/43504705317)은 1개 실행/1개 실패다. 완료·미완료 재실행, 날짜만 있는 마감, 삭제 취소·삭제 보존을 지난 뒤 키보드 제출 검사에서 실패했다. 전체 삭제 검증에는 도달하지 않았다.
- 실패 시점 실제 접근성 트리는 CI reset task 대신 CI reset tas가 저장되었음을 보여준다. onSubmitEditing이 마지막 onChangeText의 React 상태 반영 전에 기존 draft를 읽는 경로를 제거하고, 제출 이벤트의 nativeEvent.text를 저장한다. 버튼 입력은 현재 draft를 사용한다.
- 동일한 연속 입력+완료 키 재현은 유지하고 직후 스크린샷을 추가했다. 로컬 타입·diff 검사 통과. 수정 후 실제 UI 실행이 통과하기 전에는 해결 완료로 표시하지 않는다.
- [Intel 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43504230297)는 core/ios 성공. 실제 합성 한국어 Vision OCR·Swift 저장소/캡처 실행과 앱·두 확장 arm64 교차 컴파일 통과. 이 실행에는 이후 공유창 갱신 변경과 키보드 수정은 포함하지 않는다. 실제 iPhone OCR·AI 정확도 검증은 아니다.

## UI 집계와 개별 실행 결과 대조
- 결과 전체 문자열의 부분 이름 검색을 제거했다. 실제 xcresulttool 구조에서 Test Case 노드를 순회하고 정확한 TTodoUITests/testManualTaskLifecycleAndDataReset() ID가 한 개이며 개별 결과가 Passed인지 확인한다. 집계의 예상 실패도 0이어야 한다.
- 다른 suite/접미사 이름·suite 이름만 존재·실패/건너뜀·중복 사례·집계와 개별 결과 불일치 회귀 검사 추가. 로컬 50개 테스트·타입·구문·diff 검사 통과.
- 실제 실패 실행 43504705317의 SDK JSON과, 그 실패 상세에 성공 집계를 붙인 불일치 입력을 모두 거부함을 확인했다. 현재 UI 실행은 이전 집계 도구를 사용하므로 완료 후 새 도구로 산출물도 별도 확인한다.

## 공유 재분석 실패 시 유효한 편집 유지
- 공유창이 재분석 시작 직후 제안 배열을 비우던 경로를 제거했다. 이미지를 읽지 못해 DB 교체가 시작되지 않았다면 기존 편집은 비활성 상태로 유지하고 최신 저장소와 대조해 복구한다.
- 교체가 이미 시작되어 예전 제안 ID가 삭제됐거나 외부 저장·무시가 끝났다면 해당 편집은 복원하지 않는다. 실패 메시지는 최신 조회 결과와 분리해 유지한다.
- 기존 편집/삭제 ID/새 제안 선택 대조 회귀와 로컬 50개 테스트·타입 검사를 기준으로 검증한다. 이번 Swift 호출 경로 컴파일은 새 macOS CI 확인 전이며 실제 공유 호스트의 이미지 읽기 실패·재분석은 iPhone 미검증이다.

## 확장 변경의 독립 SDK 컴파일 검사 준비
- 공유·위젯 타깃은 React Native/Pods 의존성이 없는 네이티브 타깃이므로 생성한 Xcode 프로젝트의 해당 두 타깃만 직접 빌드하는 수동 workflow를 추가했다. 기존 무료 Intel 실행기와 실제 iOS Simulator SDK/arm64를 사용하며 서명은 하지 않는다.
- 전체 앱 빌드를 취소하거나 대체하지 않는다. 앱·Expo 브리지 링크와 실제 확장 실행 검증은 계속 별도다. YAML·diff 검사 통과, 새 workflow의 실제 실행/컴파일 결과는 확인 전이다.

## 공유창 안정화 전체 품질 CI 통과
- [b0aa4a2 품질 CI](https://github.com/kimps005/TTodo/actions/runs/43534413868): core/ios 모두 성공. 49개 테스트·타입·보안·Hermes, Swift 저장소/캡처/JSON 계약·실제 합성 한국어 Vision OCR과 앱·위젯·공유 확장 arm64 컴파일 통과.
- 이 실행은 공유창 최신 제안 재확인과 편집 대조를 포함한다. 이후 키보드 제출 수정은 별도 UI 실행, 재분석 실패 시 편집 보존은 별도 확장 전용 컴파일에서 확인한다. 실제 공유 호스트·기기 내 AI·잠금 입력 성공으로 해석하지 않는다.

## 최신 공유 변경의 독립 SDK 컴파일 통과
- [b0eba70 확장 전용 실행](https://github.com/kimps005/TTodo/actions/runs/43536680852): 두 타깃 모두 BUILD SUCCEEDED. Pods/React Native 빌드 없이 실제 iOS Simulator SDK 26.5/arm64로 공유·위젯을 컴파일했다. 공유 재분석 실패 시 유효한 편집 보존 변경 d72e350을 포함한다.
- 전체 작업 약 2분 30초, 두 타깃 빌드 구간 약 1분 44초. SDK 컴파일 검사로 확인한 것이며 실제 공유 호스트·설치·AI 생성은 미검증이다. 전체 앱 b0aa4a2 품질 CI와 후속 UI 검증 범위를 구분한다.

## 실제 키보드 제출 통과와 탭 가림 원인 수정
- [16a1d99 UI 재실행](https://github.com/kimps005/TTodo/actions/runs/43534761791)은 전체로는 1개 실행/1개 실패다. 키보드 완료로 CI reset task 전체 문자열이 정확히 한 개 저장되는 검사는 통과했고 첨부 화면에서도 확인했다. 최종 전체 초기화 검증은 아직 통과하지 않았다.
- 실패 시점 실제 접근성 트리는 여전히 할 일 탭이며 입력칸에 미저장 문구와 키보드 포커스가 남아 있었다. 설정 탭은 y=782, 키보드는 y=583부터 덮고 있었다. XCTest의 isHittable=true와 실제 터치 도달이 달라 설정 이동 없이 키보드를 터치했다. 초기에 의심한 단순 스크롤 문제로 확정하지 않는다.
- 제품의 하단 탭 바를 기존 KeyboardAvoidingView 안으로 옮겨 키보드가 열린 동안 함께 피하도록 수정했다. 임의 좌표 탭이나 키보드 강제 숨김으로 검사를 우회하지 않는다. React Native 공식 KeyboardAvoidingView 문서의 자식 영역 조정 방식에 따른다.
- 검사에는 설정 제목 확인을 추가하고, 화면 아래 요소가 접근성 트리에 없을 때에도 최대 8회 실제 스크롤로 찾도록 보완했다. 로컬 50개 테스트·타입·diff 통과. 수정 후 실제 UI 재실행 전에는 탭 이동·전체 초기화 성공으로 기록하지 않는다.

## 초기화 UI 검사의 실제 표시 대조
- 초기화 후 온보딩 아래 입력칸을 실제로 스크롤해 비어 있음을 확인한다. 재실행 후 온보딩이 초기화된 상태를 확인하고 시작 버튼을 누른 뒤 빈 목록과 이전 합성 항목 부재도 대조한다. 화면에 가려진 요소의 부재만으로 DB 삭제 성공을 판단하지 않는다.
- diff 검사 통과. 준비 단계였던 UI 실행 43538211099는 검사 보강 커밋의 재실행으로 대체하며 새 전체 흐름 통과 전에는 완료로 표시하지 않는다.

## 임시 정리 실패와 앱 시작 분리
- 기존 앱 시작은 임시 캐시 삭제 예외를 DB 초기화 실패와 함께 처리해 수동 할 일 화면까지 막았다. 캐시 정리 실패는 별도 안내하고 DB 열기·목록 불러오기를 계속하도록 분리했다. 남은 파일은 다음 실행 때 재시도한다.
- 캡처 디렉터리 삭제가 실패해도 두 내보내기 임시 파일을 각각 정리한 뒤 불완전한 정리 오류를 반환한다. 전체 데이터 삭제의 기존 정리 실패 안내도 이 오류를 받는다.
- 실제 임시 파일을 만든 뒤 첫 정리 실패를 주입해 나머지 두 파일 삭제·오류 전달·다음 정리 성공을 확인했다. 로컬 51개 테스트·타입·diff 통과. 실제 iOS 파일 접근 실패와 시작 경고 화면은 기기 QA 전이며 테스트 주입을 OS 검증으로 간주하지 않는다.
- Swift/네이티브 설정이 없는 JS 후속 변경용 core_only 수동 검사 선택을 추가했다. 기본 push/PR/수동은 전체 검사이며 core_only의 ios 건너뜀을 네이티브 통과로 기록하지 않는다.

## 임시 정리 수정의 JS 품질 CI 통과
- [cfa9383 core 전용 검사](https://github.com/kimps005/TTodo/actions/runs/43540173499): core 성공. 51개 테스트·타입·보안·실제 iOS Hermes 번들 통과. ios 작업은 의도적으로 skipped이며 이번 실행을 네이티브 빌드 성공으로 기록하지 않는다.
- 정상 경로의 이전 전체 네이티브 빌드 및 최신 확장 SDK 컴파일과 구분한다. 임시 파일 접근 실패 경고·실제 iOS 캐시 삭제·실기기 저장 기능은 기기 QA 전이다.

## 확장된 실제 UI 전체 통과
- [64e0e7b UI 실행](https://github.com/kimps005/TTodo/actions/runs/43538482846): 지정한 testManualTaskLifecycleAndDataReset 1개 실행/1개 통과, 실패/건너뜀/예상 실패 0. 실제 xcresulttool JSON을 정확한 Test Case ID/개별 Passed/집계 대조 도구로 검증했고 completed=true를 확인했다.
- 마지막 글자 전체·단일 저장, 키보드가 열린 미저장 입력에서 설정으로 이동, 설정의 전체 삭제, 비어 있는 입력칸, 재실행 후 온보딩 초기화, 온보딩 완료 후 실제 빈 목록까지 통과. 설정 진입/온보딩 초기화/0개 빈 목록의 첨부 화면도 직접 시각 검토했다.
- Release 앱/위젯/공유 확장 빌드 포함. 이후 cfa9383 임시 정리 실패 격리는 이 UI 실행에 포함되지 않으며 별도 51개 테스트·Hermes core CI로 검증했다. 실제 iPhone·한글 조합 키보드·잠금 입력·AI 정확도 완료로 표시하지 않는다.

## Dynamic Type 시뮬레이터 검사 착수
- PRD 13.2/13.4의 Dynamic Type·다양한 설정 검증을 이어간다. Apple 공식 UIContentSizeCategory 문서에서 접근성 최대 글자 크기 범주를 확인했다. 시뮬레이터 명령의 구체적인 값과 조회 방식은 실제 SDK 도움말로 먼저 확인한다.
- 사용자 노트북 UI를 조작하지 않고 무료 macOS 실행기에서 설치 SDK·simctl ui 도움말·런타임 목록만 수집하는 수동 workflow를 추가했다. 명령 지원 확인과 실제 큰 글자 화면 검증은 별도이며 아직 통과로 기록하지 않는다.

## 최대 접근성 글자 검사 준비
- [실제 SDK 도움말 확인](https://github.com/kimps005/TTodo/actions/runs/43541690522) 성공. simctl ui의 content_size 설정/조회와 accessibility-extra-extra-extra-large 값을 설치 SDK에서 확인했다. Apple 공식 UIContentSizeCategory 문서도 최대 접근성 범주를 명시한다.
- 수동 UI 실행에 기본 large와 최대 접근성 크기 선택을 추가했다. 새 일회성 CI 시뮬레이터에 설정 후 조회 값이 정확히 같아야 검사하며 보고서에 실제 값을 남긴다. SDK 도움말은 stdout/stderr 모두 보존한다.
- 최대 크기에서는 온보딩 스크롤·키보드 저장·목록/편집·키보드 중 탭 이동·미저장 입력 보존의 별도 XCTest를 정확히 1개 선택해 실행한다. 기본 전체 삭제 흐름은 별도 선택으로 유지하고 서로의 통과 결과를 대신 인정하지 않는다.
- 큰 화면 높이와 화면 위의 편집칸을 찾기 위해 제한된 양방향 스크롤 탐색을 지원한다. 앱에 강제 폰트 설정이나 데이터 주입을 넣지 않는다.
- 로컬 52개 테스트·타입·스크립트 구문·workflow YAML·diff 통과. 최대 글자 실제 화면/조작과 새 SDK 설정 조회는 macOS CI 실행 전이다. VoiceOver·실제 iPhone 접근성 완료로 표시하지 않는다.

## 입력칸 경계 대비 보강
- PRD 13.2 접근성 점검에서 기존 입력 경계와 흰 배경의 정적 대비가 1.23:1임을 확인했다. 입력 경계용 색을 장식선과 분리해 #7B8797로 보강했다. 카드 장식선은 유지한다.
- W3C 대비 안내를 참고해 실제 팔레트 값의 상대 휘도를 계산했으며 흰 배경과 앱 배경 양쪽에서 3:1 이상임을 반올림 전 값으로 확인했다. 주요 글자/버튼/체크 표시 측정도 DEVICE-QA에 기록했다.
- 타입·diff·정적 색 대비 검사 통과. 색상만 바꾸는 변경에 구현을 그대로 비교하는 테스트는 추가하지 않는다. 현재 최대 글자 UI 실행에는 이 후속 색 변경이 포함되지 않으며 실제 렌더링·VoiceOver는 별도 확인 대상이다.

## 입력 경계 보완의 JS 품질 검사 통과
- [55dfb64 core 전용 CI](https://github.com/kimps005/TTodo/actions/runs/43542797047): 52개 테스트·타입·보안·실제 Hermes 통과. ios는 의도적으로 skipped다.
- 새 입력 경계의 정적 대비는 흰 배경 3.65:1, 앱 배경 3.40:1이다. 기본 문자/설명/버튼 조합과 빈 체크 표시도 별도 측정했다. 전체 접근성 인증이나 최대 글자 화면의 시각 통과로 해석하지 않는다.
- 최대 글자 UI 실행 43542167662는 c7ae342이며 후속 입력 경계 색 변경은 포함하지 않는다. 해당 화면 검증은 결과 확인 후 구분해 기록한다.

## 실제 공유 확장 검사용 CI 호스트 준비
- PRD 수동 공유 입력과 동의 전 차단을 실제 시뮬레이터에서 확인하기 위해 합성 PNG 한 장만 만드는 CI 전용 SwiftUI 공유 호스트를 준비했다. UIActivityViewController로 파일을 전달하며 개인 사진/할 일/AI 응답을 읽거나 주입하지 않는다.
- 일반 prebuild에는 연결하지 않는다. 생성기는 호스트를 UI 테스트의 의존성에만 추가하고 기존 앱의 확장 의존성·앱 제품 포함 관계를 유지한다. Apple XCUIApplication(bundleIdentifier:) 공식 문서의 테스트 의존 앱 빌드/설치 규칙을 근거로 한다.
- 실제 Expo 프로젝트를 생성·재파싱해 제품 유형/비포함/기존 의존성 유지/반복 적용 무변경을 검사했다. 로컬 53개 테스트·타입·구문·diff 통과. 호스트 Swift SDK 컴파일·공유창 실행·동의 차단의 실제 UI는 아직 검증 전이다.

## 공유 확장 동의 차단 UI 흐름 연결 준비
- 수동 UI 실행에 share-extension 시나리오를 추가했다. 이 선택에서만 CI 전용 공유 호스트를 테스트 의존성으로 생성한다. 기본/최대 글자 앱 흐름은 호스트를 생성하지 않는다.
- 합성 PNG를 실제 시스템 공유창으로 전달하고 TTodo 확장 열기·동의 전 분석 거부·닫기·기존 수동 할 일 유지·분석 내역 미생성을 확인하는 별도 XCTest를 연결했다. 실제 OCR/AI 결과를 주입하지 않는다.
- 지정한 공유 테스트 ID와 실행 결과만 인정하며 앱 흐름 통과를 대신 쓰지 않는다. 로컬 54개 테스트·타입·구문·YAML·diff 통과. 호스트 컴파일과 실제 공유 UI는 아직 실행 전이며, 최대 글자 검사 실패를 먼저 진단한다.

## 최대 글자 실패 진단과 화면 보완
- [c7ae342 최대 글자 실행](https://github.com/kimps005/TTodo/actions/runs/43542167662)은 1개 실행/1개 실패. 보고서의 실제 text_size는 accessibility-extra-extra-extra-large로 일치했다. 온보딩/저장/편집/키보드 중 탭 이동을 지난 뒤 설정 제목의 중복 StaticText 조회에서 위치를 읽지 못했다. 같은 이름의 첫 요소를 명시하는 조회로 수정한다.
- 첨부 화면에서는 상단 소개 문구가 오른쪽 화면 밖으로 잘렸다. 큰 글자에서 브랜드/소개 문구를 세로 배치하고, 화면 제목에는 기본 body 대신 iOS largeTitle Dynamic Type 확대 규칙과 header 접근성 역할을 지정했다. 확대를 끄거나 임의 최대 배율을 적용하지 않는다.
- React Native 공식 Text 문서와 설치된 RCTAttributedTextUtils의 UIFontMetrics 연결, Apple UIFontMetrics 문서를 확인했다. 실제 화면 재검증 전에는 가독성 개선 완료로 기록하지 않는다.
- 로컬 54개 테스트·타입·diff 통과. 앱 큰 글자 흐름과 공유 확장 흐름은 서로 취소하지 않도록 CI 동시 실행 그룹을 시나리오별로 나누고, 각각 정확한 테스트 결과를 대조한다.

## CI 공유 호스트의 독립 SDK 컴파일 검사 연결
- 기존 빠른 네이티브 타깃 검사의 기본 제품 확장 두 개는 유지하고, share-host를 명시할 때만 CI 호스트를 생성·단독 컴파일하도록 추가했다. 서명/설치/공유 실행과 별도 검사다.
- 호스트가 앱/runner를 의존하지 않는다는 프로젝트 검사도 보강했다. 로컬 54개 테스트·타입·YAML·diff 통과. 실제 SDK 컴파일 결과는 CI 확인 전이다.

## CI 공유 호스트 SDK 컴파일 통과
- [30c5788 호스트 단독 검사](https://github.com/kimps005/TTodo/actions/runs/43545807488) 성공. 생성된 TTodoCIShareHost 타깃의 SwiftUI/UIKit 코드와 앱 제품을 실제 iOS Simulator SDK/arm64로 컴파일했다.
- 서명/설치/실제 공유창과 확장 실행의 성공은 별도 UI 실행에서 확인한다. 이번 SDK 성공을 AI 실행·확장 전체 기능·실기기 검증으로 대체하지 않는다.

## 최대 글자 재검증 통과와 공유 호스트 표시 수정
- [3f8e2f3 최대 글자 실행](https://github.com/kimps005/TTodo/actions/runs/43545098254) 성공. 실제 최대 접근성 크기 조회가 일치하고 지정한 testLargeTextInputEditingAndNavigation 1개 통과, 실패/건너뜀 0이다. 온보딩·저장·편집·키보드 중 탭 이동·미저장 입력 보존을 확인했다. 첨부 화면의 상단 브랜드와 소개 문구는 세로로 표시되어 오른쪽 잘림이 사라졌다. 실제 iPhone/VoiceOver 검증은 미완료다.
- [첫 공유 UI 실행](https://github.com/kimps005/TTodo/actions/runs/43545100252)은 실패했다. CI 호스트 설치/실행은 통과했지만 첨부 화면과 접근성 트리에는 빈 모달만 표시되어 제품 확장에 도달하지 못했다.
- CI 호스트의 URL/표시 여부 두 상태와 조건부 빈 내용을 없애고 Apple sheet(item:onDismiss:content:) 방식으로 이미지 URL이 있는 단일 항목을 창 내용에 전달한다. 공유 후 검사는 앱을 재실행해 실제 저장소에서도 분석이 생성되지 않았는지 확인하도록 보강했다.
- 로컬 54개 테스트·타입·diff 통과. 수정 호스트의 실제 SDK/공유 UI는 재검증 전이다. 빈 창의 원인 해소는 재실행 결과로 판단한다.

## 실제 사진 선택과 한국어 OCR UI 검사 준비
- PRD P0-10 수동 사진 선택 경로를 별도 photo-ocr 시나리오로 연결했다. 일회성 CI 시뮬레이터의 사진 보관함에 기존 OCRSmoke가 생성한 합성 PNG만 가져온다. 실제 SDK의 addmedia 도움말을 저장·확인하고 macOS Vision 사전 검사 후 진행한다.
- 설치된 Expo ImagePicker의 PHPicker 단일 선택 경로와 Apple 공식 PHPickerViewController 문서를 확인했다. 앱의 실제 사진 선택→iOS Vision→편집 가능한 인식 글자에 합성 한글 문장이 있는지 검사한다. 다시 선택 후 취소하면 원문/기준 날짜가 보존되는지, 닫고 재실행하면 승인하지 않은 할 일·분석이 없는지도 확인한다.
- OCR 결과·AI 응답·DB 데이터를 주입하지 않는다. macOS 합성 OCR 사전 통과와 iOS UI 통과는 보고서에서 분리하고 지정 테스트 1개 통과만 인정한다. 실제 사진 선택기·iOS OCR 실행 결과는 CI 확인 전이며 합성 이미지 검사를 실제 사용자 이미지의 정확도 평가로 간주하지 않는다.

## 최대 글자 보조 표제의 의미별 확대 규칙
- 최대 글자 통과 실행의 편집 화면을 추가 시각 검토해 TASK DETAILS 보조 표제의 왼쪽 글자 잘림을 발견했다. 보조 표제에 기본 body 대신 caption2 Dynamic Type 규칙을 지정했다. 모든 화면의 같은 보조 표제에 일관되게 적용하며 사용자 글자 확대는 유지한다.
- 타입·workflow YAML·diff 통과. 제품 로직 변경이 없어 같은 구현을 비교하는 테스트는 추가하지 않는다. 수정 후 최대 글자 실제 화면은 별도 UI 재검증에서 확인한다.

## 최신 전체 품질 CI 재검증 통과
- [59a364b 전체 품질 실행](https://github.com/kimps005/TTodo/actions/runs/43548256339)의 core/ios 모두 성공했다. 로그에서 55개 테스트·타입·보안 경고 0·실제 Hermes 번들, Swift 저장소/캡처·Swift JSON→TypeScript 계약·macOS Vision 합성 한국어/빈 이미지/잘못된 이미지, 앱·위젯·공유 확장 arm64 컴파일을 확인했다.
- 임시 정리 실패 격리, 입력 경계와 Dynamic Type 보완을 포함한 최신 소스다. 실제 사진 선택·공유 UI·최대 글자 보조 표제 화면은 각 UI 실행에서 별도로 판단한다. 실제 iPhone 서명/설치·잠금 입력·AI 생성/정확도는 미검증을 유지한다.

## 사진·공유 UI 실패의 실제 접근성 트리 대조
- 공유 재실행 43547968174는 실패했지만 이전 빈 모달과 달리 시스템 공유창이 생성되었고 실제 접근성 트리에 TTodo 항목이 있다. 검사가 확장 전체 이름만 찾았던 것이 이번 정지 원인이다. TTodo/확장 이름의 실제 공유 셀로 조회를 제한하고 준비 후 화면을 추가 수집한다.
- 사진 실행 43548157251은 macOS 합성 OCR 사전 검사·앱 빌드/실행·사진 선택기 표시까지 도달했다. 실제 사진 썸네일은 CollectionView Cell이 아닌 PXGGridLayout-Info Image로 노출된다. 해당 이미지 조회로 수정한다. 시뮬레이터에는 Apple 기본 샘플 사진도 있으므로 ‘한 장뿐’이라는 설명을 바로잡고 최신 합성 이미지의 실제 한국어 OCR 결과를 계속 대조한다.
- 로컬 55개 테스트·타입·diff 검사 통과. 두 수정 UI 흐름의 실제 SDK 컴파일/실행은 재검증 전이며 iOS OCR·공유 동의 차단 성공으로 표시하지 않는다.

## 캡처 편집의 키보드 회피와 사용자 수정 보존 검사
- PRD의 수동 OCR 수정·접근 가능한 입력 흐름에 맞춰 캡처 화면에도 기존 상세/검토 화면과 동일한 iOS KeyboardAvoidingView를 적용했다. 키보드가 열린 상태에서 기준 날짜와 하단 동작까지 스크롤할 수 있도록 화면 영역을 조정한다.
- 사진 UI 검사는 실제 OCR 문장을 먼저 대조한 뒤 사용자가 글자를 수정하고 기준일을 입력하도록 보강했다. 재선택 취소 뒤 두 입력값 모두 보존되어야 통과한다. OCR/AI/DB 응답 주입은 없다.
- 로컬 55개 테스트·타입·diff 통과. 변경 후 실제 키보드 화면/사진 UI는 CI 확인 전이다. 먼저 실행한 8aed3ce의 공유·사진·최대 글자 UI와 이 후속 변경의 검증 범위를 구분한다.

## 비동기 DB 트랜잭션의 다른 작업 격리 검사
- PRD 13.3의 데이터 보존·트랜잭션 안정성 검증을 보강했다. 실제 SQLite 트랜잭션을 중간에서 대기시킨 동안 별도 쓰기와 조회를 예약하고, 성공/롤백 양쪽에서 다른 작업이 트랜잭션 안에 섞이지 않는지 검사한다.
- 실패 트랜잭션 뒤에도 다른 쓰기가 사라지지 않고 이후 작업이 정상 진행되는 것을 확인했다. 임의 시간 지연 대신 명시적인 시작/재개 신호를 써 경합 시점을 고정한다.
- 로컬 57개 테스트·타입·diff 통과. 제품 코드 변경은 없으며 새 검사 CI는 이전 제품 변경의 전체 품질 실행 뒤 별도로 확인한다.

## 사진 UI 재검사의 SDK 도움말 오류 진단
- [8aed3ce 사진 UI 재실행](https://github.com/kimps005/TTodo/actions/runs/43562331556)은 앱 빌드·OCR 검사 전 `simctl ui` 도움말 확인 단계에서 중단됐다. 첨부된 도움말은 빈 파일이며 이전에 확인한 SDK 지원이 사라졌다고 단정할 근거는 없다. 실제 오류 코드·타임아웃 여부는 기존 진단에서 남기지 않아 원인 미확정이다.
- 도움말 프로세스의 실행 오류·종료 코드·신호를 보고서에 포함하도록 보완했다. SDK 지원 확인이나 실제 설정 조회는 유지한다. 최신 캡처 화면 변경을 포함한 사진 UI 검사를 다시 시작했으며 결과는 확인 전이다.
- 스크립트 구문·diff 검사 통과. 실제 사진 선택·iOS OCR·편집 보존 성공은 아직 미확인이다.

## 캡처 키보드 개선 전체 품질 CI 통과
- [03c0961 전체 품질 검사](https://github.com/kimps005/TTodo/actions/runs/43562478979)는 core/ios 모두 성공했다. 타입·55개 테스트·보안·Hermes와 Swift 저장소/캡처, 합성 한국어 Vision OCR, 앱·위젯·공유 확장 시뮬레이터 빌드를 통과했다.
- 후속 57개 테스트와 SDK 오류 진단 변경은 이 실행 이후다. 캡처 화면의 키보드 조작 및 사진 선택·OCR UI 성공이나 실제 iPhone·AI 정확도 검증을 뜻하지 않는다.

## 후속 DB 경합 검사의 CI 통과
- [0298a11 core 전용 검사](https://github.com/kimps005/TTodo/actions/runs/43563050892)는 새 SQLite 경합 검사 2개를 포함한 57개 테스트·타입·보안·Hermes를 통과했다. ios 작업은 선택적으로 생략했으며 네이티브 빌드는 앞의 03c0961 전체 품질 검사로 구분한다.

## 실제 시스템 공유창에서 동의 전 차단 확인
- [8aed3ce 공유 UI 검사](https://github.com/kimps005/TTodo/actions/runs/43562339509)는 iOS 26.5 iPhone 16 Pro 시뮬레이터에서 지정 XCTest 1개 통과·실패/건너뜀 0이다. 합성 이미지를 시스템 공유창으로 전달해 TTodo 확장을 열고 기기 내 AI 동의 전 분석 거부, 기존 수동 할 일 유지, 앱 재실행 후 분석 내역 미생성을 확인했다.
- 실제 확장을 실행한 검사지만 AI 생성·승인·기기 잠금·실제 iPhone의 공유 호스트 수명/메모리 검증은 포함하지 않는다.

## 사진 선택기의 비활성 접근성 이미지 진단
- [d8ec35e 사진 UI 검사](https://github.com/kimps005/TTodo/actions/runs/43562863284)는 실제 사진 선택기에서 합성 이미지를 찾았으나 iOS가 해당 썸네일을 직접 터치 가능한 요소로 노출하지 않아 실패했다. 첨부 화면에서 합성 이미지가 첫 썸네일로 보이는 것을 확인했다. 아직 iOS OCR이나 편집 보존까지 도달하지 못했다.
- 접근성 트리의 해당 이미지 영역 중심을 눌러 시스템 선택기를 조작하고, 선택된 이미지가 맞는지는 기존 실제 한국어 OCR 대조로 확인하도록 수정했다. 제품 코드나 OCR 결과 주입은 없다. 수정 후 UI 재검증 전이다.

## 사진 검사 보완 후 전체 품질 CI 통과
- [2fb9082 전체 품질 검사](https://github.com/kimps005/TTodo/actions/runs/43564976089)는 core/ios 모두 성공했다. 57개 테스트·타입·보안·Hermes와 Swift 저장소/캡처·합성 Vision OCR, 앱·위젯·공유 확장 시뮬레이터 빌드를 확인했다. 실제 사진 선택 UI 실행은 별도 진행 중이다.

## 사진 임시 파일 복사 경합 수정
- [2fb9082 사진 UI 검사](https://github.com/kimps005/TTodo/actions/runs/43564988276)는 실제 사진을 선택했지만 OCR 대상 임시 파일이 없다는 앱 오류로 실패했다. 접근성 트리의 실제 오류와 설치된 Expo iOS 모듈을 대조해 `File.copy`가 비동기임에도 완료 전 원본을 삭제하고 OCR을 시작하는 경합을 확인했다.
- 복사 완료를 기다린 후 원본을 정리하고 OCR을 실행하도록 수정했다. 복사 성공·실패 모두 완료 전 원본을 지우지 않고 실패가 호출자에게 전달되는 회귀 검사를 추가했다. 로컬 58개 테스트·타입·diff 통과.
- 수정 후 실제 iOS 사진 선택/OCR 및 편집 보존은 CI 재검증 전이며 실기기 사진·AI 정확도도 미검증이다.

## 내보내기 파일 쓰기 완료 후 공유
- 설치된 Expo 파일 API에서 `File.write`도 비동기임을 확인했다. 데이터 내보내기와 개발용 평가 내보내기 모두 쓰기 완료 전에 공유창을 열 수 있었고 쓰기 오류가 전달되지 않을 수 있었다. 두 경로가 쓰기 성공 후 공유하고 실패 시 기존 오류 안내와 임시 파일 정리를 수행하도록 수정했다.
- 로컬 58개 테스트·타입·diff 통과. 파일 공유창과 실제 내보낸 내용은 시뮬레이터/실기기에서 아직 검증하지 않았다. 진행 중인 사진 복사 수정 전체 CI와 검사 대상 커밋을 구분한다.

## 사진 복사 경합 수정의 전체 품질 CI 통과
- [09e70b1 전체 품질 검사](https://github.com/kimps005/TTodo/actions/runs/43566980110)는 core/ios 성공. 58개 테스트·타입·보안·Hermes, Swift 저장소·캡처·합성 Vision OCR, 앱·위젯·공유 확장 빌드 통과. 후속 내보내기 쓰기 수정은 이 실행에 포함되지 않는다.
- 사진 선택기에서 실제 OCR·편집 보존을 확인하는 별도 UI 재검사는 진행 중이다. 실기기 및 실제 모델 정확도는 여전히 미검증이다.

## 내보내기 쓰기 수정 JS 품질 CI 통과
- [fc2aca6 core 전용 검사](https://github.com/kimps005/TTodo/actions/runs/43567643960)는 58개 테스트·타입·보안·Hermes를 통과했다. ios 작업은 생략되었으며 네이티브 빌드는 09e70b1 전체 검사와 구분한다. 실제 공유한 파일의 내용 검증은 남아 있다.

## 사진 선택·iOS 한국어 OCR과 편집 보존 UI 통과
- [09e70b1 사진 UI 검사](https://github.com/kimps005/TTodo/actions/runs/43566983385)는 iOS 26.5 / iPhone 16 Pro 시뮬레이터에서 지정 검사 1개 통과·실패/건너뜀 0이다. 시스템 사진 선택기에서 합성 PNG를 선택하고 실제 iOS Vision이 한국어 문장을 인식했으며, 글자 수정과 기준일 입력 후 재선택 취소 시 두 값이 보존되었다. 앱 재실행 뒤 미승인 할 일과 분석이 없는 것도 확인했다.
- 이전 임시 파일 없음 오류 이후 실제 선택→복사→OCR 경로가 통과한 것이다. 이 검사는 합성 이미지 한 장을 사용했으며 실제 사용자 이미지 정확도·모델 생성·실제 iPhone/잠금 검증을 뜻하지 않는다. 후속 내보내기 쓰기 수정은 별도 core 검사에서 확인했다.

## 온디바이스 자동 평가와 모델 경계·접근성 보강
- `TodoExtractionServiceProtocol`과 실제 Apple 구현을 도입했다. 앱 브리지·단축어·공유 확장은 실제 모델을, CI 캡처 검사는 프로토콜 주입을 사용한다. 모델 호스트 probe와 모든 macOS smoke 컴파일 소스 목록에도 프로토콜을 연결했다.
- Debug 설정에 36개 `EvalFixtures.json` 실행/자동 채점을 연결했다. Precision·Recall·명시 마감 정확도와 오탐/누락/마감 오류를 화면에 표시하며 콘솔은 원문 없는 ID/집계/인덱스만 출력한다. 합성 텍스트·고정 어휘 판정으로 실제 의미 정확도·이미지 OCR 전체 성능을 대신하지 않는다. [실행/채점 안내](EVAL-RUNNER.md).
- 상대 날짜 검증에 월말과 평년/윤년 검사를 추가했다. 목록/빠른 입력/검토 카드/설정에 VoiceOver 레이블·힌트·값·표제, 큰 글자 줄바꿈·세로 배치를 보강했다. 빠른 입력 TextView에 맞춰 기존 CI UI 조회를 수정했다.
- Windows 로컬: Node 테스트 148개, 타입 검사, iOS Hermes 번들, diff 검사 통과. 로컬 npm audit는 네트워크 DNS 제한으로 실행되지 않았다. macOS 전체 CI·변경 후 UI 검사는 아직 결과 확인 전이다.
- 실제 모델 생성/한국어 90%·95% 달성, iPhone VoiceOver/최대 글자, 서명·실기기 설치는 미검증이다. CI 외곽 시나리오 검증을 코드 커버리지 100% 측정이나 제품 완료로 표시하지 않는다. 기존 사용자의 `docs/DEVICE-QA.md` 변경은 수정/커밋하지 않는다.

## 개발 전용 평가 화면의 번들 검사 분리
- 일반 iOS export와 별도로 `--dev` export를 전체 품질 CI core에 추가했다. 로컬 개발 번들에서 `__DEV__=true`, 평가 러너와 새 정답 ID 포함을 확인했다. 타입·diff 검사도 통과했다.
- 큰 글자에서 제안 카드의 세로 배치 내부 정보가 flex 높이 분배로 줄어들지 않도록 자동 높이를 유지한다. 실제 최대 글자 카드 화면·VoiceOver는 실기기 검증 전이다.
- ca4763a의 CI core는 테스트 148개·타입·보안·Hermes 성공이며 macOS는 실행기 대기 상태다. 이 후속 변경을 포함한 최신 전체 CI를 다시 대조한다.

## 전체 Debug 품질 통과와 빠른 입력 UI 조회 수정
- [ee55d72 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/44110120581)는 core/ios 모두 성공했다. 실제 로그에서 테스트 148개·실패 0, 보안 취약점 0, 일반/개발 번들, Swift 저장소·캡처·전처리/상대 날짜·승인/중복 검사, Swift→TS 계약, 합성 Vision OCR, 앱·위젯·공유 확장 arm64 Debug 빌드 성공을 확인했다.
- ca4763a의 이전 OS UI 회귀는 첫 입력의 TextView 레이블 조회에서 실패했다. 설치된 `RCTUITextView.accessibilityLabel`이 빈 입력일 때 placeholder를 레이블 뒤에 붙이는 것을 확인했다. 실제 입력에 `quick-todo-input` 식별자를 부여하고 모든 빠른 입력 XCTest 조회를 해당 식별자로 바꿨다. 여러 줄 입력은 유지하며 완료 키는 기존 단일 줄과 같이 저장 후 키보드를 닫는다.
- 후속 로컬 테스트 148개·타입·개발 번들·diff 검사 통과. UI 수정 후 실제 시뮬레이터 재검증은 결과 확인 전이다. 사람의 실기기 VoiceOver와 실제 모델 점수는 계속 미검증이다.

## 최종 코드 전체 품질과 최대 글자 재검증 통과
- [0d6c7be 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/44113936125)의 core/ios 모두 성공. 테스트 148개·타입·보안 취약점 0·일반/개발 번들, Swift 저장소·캡처·날짜/승인/중복·계약·Vision OCR 검사와 앱·위젯·공유 확장의 arm64 Debug 빌드 성공을 실제 로그에서 확인했다.
- [같은 커밋 UI 재검사](https://github.com/kimps005/TTodo/actions/runs/44113873773)의 compact 작업은 iPhone SE 3세대 / iOS 26.5 / accessibility-extra-extra-extra-large에서 지정 `testLargeTextInputEditingAndNavigation` 1개 통과·실패/건너뜀 0. 실제 입력 식별자 조회·저장·편집·탭 이동 경로가 통과했다. 새 최대 글자 화면 전체의 시각 검수나 실제 VoiceOver 검사로 대체하지 않는다.
- primary/oldest 작업은 실행기 배정 전 취소됐다. GitHub 검사 주석의 원인은 `The job was not acquired by Runner of type hosted even after multiple attempts`와 macOS arm64 용량 부족이다. 테스트가 실행되지 않았으므로 통과로 표시하지 않고, 통과한 compact를 유지한 채 미실행 작업만 재시도했다. 재시도 결과는 아직 확인 전이다.
- 실제 iPhone 설치·AI 생성/정확도 90%·95% 달성·VoiceOver는 계속 미검증이다. 새 도구는 실제 모델을 실행해 측정할 준비와 컴파일 검증을 갖췄으며, 샘플 응답으로 성능을 주장하지 않는다.

## 마감 해제 VoiceOver 안내 정정
- 마감 날짜 입력의 힌트를 실제 저장 규칙과 맞췄다. 마감을 없애려면 날짜와 시각을 모두 비워야 하며, 날짜만 지우면 시각이 남아 저장 검증에서 거부된다. 제품 데이터/날짜 처리 로직과 네이티브 코드는 바꾸지 않는다.
- 타입·개발 번들·diff 검사 통과. 이 문구 수정의 JS 품질 CI와 앞서 통과한 0d6c7be의 전체 네이티브 Debug 검증을 구분해 기록한다. 진행 중인 두 UI 재검사는 0d6c7be이며 이번 힌트 문구 수정 이전이다.

## UI 회귀 전체 통과와 검증 마무리
- [0d6c7be UI 회귀 재시도](https://github.com/kimps005/TTodo/actions/runs/44113873773)는 최종 success다. primary(iPhone 16 Pro/iOS 26.5), oldest(iPhone 16 Pro/iOS 26.2)는 `testManualTaskLifecycleWithoutSettingsNavigation` 각각 1개 통과·실패/건너뜀 0이다. 저장·실제 앱 재실행 보존·편집·완료/복원·삭제 흐름을 확인했다. compact의 iPhone SE 3세대/iOS 26.5 최대 접근성 글자 검사 통과도 유지됐다. 실행기 배정 실패였던 두 작업을 실제 실행 성공으로 재확인했다.
- [fcc7237 문구 수정 JS 품질 CI](https://github.com/kimps005/TTodo/actions/runs/44119898707)는 148개 테스트·실패 0·타입·보안 취약점 0·일반/개발 번들 성공이다. ios는 의도적으로 skipped이며 동일 Swift 소스의 네이티브 Debug 검증은 [0d6c7be 전체 품질 CI](https://github.com/kimps005/TTodo/actions/runs/44113936125) 성공으로 구분한다. 문구 수정은 위 UI 실행 이후의 별도 변경이며 실제 VoiceOver 음성 검증은 하지 않았다.
- 코드·정답셋·실행/채점 안내와 CI 검증 기록을 커밋·푸시했다. 실제 모델의 정밀도 90%·명시 마감 정확도 95% 달성 여부, 실제 iPhone VoiceOver/시각 검수와 설치·서명은 미검증으로 남는다. 실제 AI 기능 전체 완료나 접근성 인증으로 표시하지 않는다.

## 2026-11-18 ARM 러너 부족에 대비한 명시적 Intel UI 경로

GitHub가 ARM 수용량 부족을 명시하여 UI workflow에 기존 저장소에서도 사용하는 무료 macos-26-intel 선택지를 추가했다. 기본 push는 기존 ARM을 유지한다. 수동 실행에서 선택하면 호스트 아키텍처와 일치하는 x86_64 설치 런타임·요청 기종·OS 조합만 허용하고 Xcode ARCHS와 report에 명시한다. 미지원 조합은 다른 OS/기종으로 대체하지 않고 실행 전 실패한다. 실제 SDK 지원과 UI 실행은 아직 확인 전이다. Windows JS 152개·타입·Node 구문·diff 검사는 통과했다. 제품 Swift/JS 코드는 cc983e3 품질 통과 소스와 동일하다.

## Eval Runner 가용성 판정과 검수 리포트

- 모델 사용 불가 상태는 실행 전과 도중 모두 `SKIPPED_UNAVAILABLE`로 기록하고 목표 판정을 보류한다. Debug 화면에서 PRD 목표 요약(할 일 정밀도 90%, 명시적 마감일 정확도 95%)과 사례별 합성 원문·기대값·모델 출력·검수 양식이 담긴 Markdown 또는 JSON 형식 4를 내보낸다. [실행 및 검수 안내](EVAL-RUNNER.md)
- Windows에서 Eval Runner 타겟 단위 테스트 11개, 타입 검사, iOS 개발 JS 번들을 검증했다. 이번 확인 범위는 주입한 모델 가용성과 출력으로 검증한 상태 분기와 직렬화다. 최신 변경의 네이티브 빌드, iPhone 공유 메뉴, 실제 AI 생성과 정확도는 검증 대기다.
