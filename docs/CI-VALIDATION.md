# CI 검증 범위

사용자 조건: Windows, iPhone 16 Pro, Mac 사용 불가, 무료 우선, 실기기 설치는 나중에.
노트북의 브라우저/앱 UI를 자동 조작하지 않습니다. 아래 검사는 GitHub의 일회성 macOS 실행기에서 코드·CLI로 수행합니다.

## 품질 검사

`quality.yml`은 TypeScript 타입/도메인/SQLite 테스트, 의존성 보안 검사, iOS Hermes 번들, 실제 Swift 저장소와 캡처 처리 로직 실행, iOS 앱·Widget·Share Extension 컴파일을 수행합니다.
캡처 처리 실행 검사는 OCR/모델 응답을 테스트에서 주입합니다. 실제 OCR 정확도와 AI 정확도 점수를 측정한 결과가 아닙니다.

별도의 `OCRSmoke.swift`는 macOS에서 합성 한국어 PNG를 직접 그려 실제 프로덕션 Vision OCR 함수로 읽고, 빈 이미지와 잘못된 이미지도 확인합니다. 실제 OCR API 실행 검사이지만 명확한 글꼴의 합성 이미지 몇 가지에 한정되며 iPhone·실제 대화 캡처의 OCR 품질·Foundation Models 추출 정확도와 구분합니다. 원문 OCR 결과는 로그에 출력하지 않고 합성 입력 fixture만 진단 artifact에 남깁니다.

## 시뮬레이터 실행 검사

`simulator-preview.yml`은 수동 실행용입니다.

1. JavaScript가 포함된 Release 시뮬레이터 앱을 빌드합니다.
2. Apple 계정/개인 인증서 없이 Xcode가 시뮬레이터용 ad-hoc 서명을 생성합니다. 별도 수동 재서명 없이 App Group 설정과 Xcode의 시뮬레이션 권한 배치를 유지하며 iPhone용 설치 프로필을 만들지 않습니다.
3. 새 iPhone 16 Pro 시뮬레이터에 앱을 설치하고 실행합니다.
4. 초기 온보딩 화면을 캡처하고 공유 SQLite 초기화·코드와 일치하는 스키마 버전·프로세스 생존을 확인합니다.
5. 앱을 종료한 뒤 합성 할 일 3개와 합성 환경의 온보딩 완료 설정을 DB에 넣고 재실행해 목록 화면을 캡처합니다. 온보딩 완료는 UI 버튼 시험이 아니며 report.json에 별도로 표시합니다. 앱이 DB를 연 상태에서 파일 내용을 직접 읽거나 수정하지 않습니다.
6. 앱 종료 후 DB 무결성과 합성 데이터 보존을 확인하고 해당 일회성 시뮬레이터를 삭제합니다.
7. `simulator-preview` artifact에 화면 PNG와 `report.json`을 남깁니다. 화면은 별도로 시각 검토해야 하며 job 성공을 시각 검토 통과로 간주하지 않습니다.

합성 데이터 입력은 UI 버튼 조작 검사가 아닙니다. 이 실행 검사가 통과해도 다음은 미검증입니다.

- 잠금 상태 인증 없는 단축어 입력/저장
- 실제 iPhone의 App Group 프로비저닝/파일 보호
- 기기 내 모델 준비 상태/한국어 정확도/지연/배터리
- 스크린샷 자동화가 전달하는 정확한 이미지
- 실제 공유 호스트에서의 확장 활성화·메모리·수명
- 알림 백그라운드 액션의 실제 기기 동작
- TestFlight/App Store 설치·심사

## 별도 수동 입력 UI 검사

`ui-tests.yml`은 수동 실행용이며, GitHub macOS 시뮬레이터에서 XCTest로 실제 화면의 온보딩 완료·수동 입력·프로세스 재실행 후 보존·제목 편집·삭제 취소·삭제 후 재실행을 확인합니다. 합성 제목만 사용하고 AI/OCR/알림/잠금 입력은 시험하지 않습니다.

`configure-ui-tests.cjs`가 생성된 프로젝트에 테스트 타깃과 스킴을 추가합니다. 일반 prebuild/plugin은 이 스크립트를 호출하지 않으며 테스트 타깃은 앱의 의존성이나 배포 제품에 포함하지 않습니다. `SKIP_INSTALL=YES`이고 스킴의 archive 참여도 꺼 둡니다. 실제 실행 전에는 준비 상태로만 표시하며, 성공 후에도 실기기·오프라인 네트워크 차단·VoiceOver 완료로 해석하지 않습니다.

산출물은 `ui-tests` artifact의 `report.json`, 로그와 `results.xcresult`입니다. 새 일회성 시뮬레이터를 사용하며 종료 후 해당 기기만 삭제합니다. 사용자 노트북의 UI는 조작하지 않습니다. [Apple XCUIApplication API](https://developer.apple.com/documentation/xcuiautomation/xcuiapplication)를 사용한 코드 검사입니다.

## 확인된 실행 결과

[f04990a 실제 UI 실행](https://github.com/kimps005/TTodo/actions/runs/43497127233): iOS 26.5 / iPhone 16 Pro 시뮬레이터에서 지정한 XCTest 1개 실행·1개 통과, 실패/건너뜀 0. 합성 제목을 실제 화면으로 입력하고 프로세스 재실행 보존·제목 편집과 저장 일치·삭제 취소 후 편집 화면 유지·개별 삭제 후 재실행을 확인했다. 입력 중 화면·편집 목록·삭제 후 빈 목록을 직접 시각 확인했다. 당시 완료 상태 변경·마감 편집·전체 데이터 삭제는 이 테스트에 포함하지 않았다.

[9253c29 실행](https://github.com/kimps005/TTodo/actions/runs/43490839958): iOS 26.5 / iPhone 16 Pro 시뮬레이터에서 앱·위젯·공유 확장 서명 검증, 실제 앱 기동, SQLite v3 일치·무결성 ok·합성 데이터 3개 보존 통과. 초기 온보딩의 기본 개수 표시와 한국어 문구, 합성 목록의 미완료 2개·완료 1개·입력창·마감 없음·하단 탭을 직접 시각 확인했다. 온보딩 완료 설정을 DB에 넣은 목록용 fixture이며 버튼 조작 검사와 구분한다.

[086295c 실행](https://github.com/kimps005/TTodo/actions/runs/43447613048): iOS 26.5 / iPhone 16 Pro 시뮬레이터, Xcode 자체 서명으로 앱 실행·App Group SQLite v3 초기화·무결성 ok·합성 데이터 3개 재실행 보존 통과. 초기 화면과 합성 목록 화면을 직접 시각 검토했고 한글·하단 탭·미완료 2개 표시를 확인했다. 목록 아래로 스크롤하거나 버튼을 조작한 검사는 아니다.

이전 수동 서명 방식은 macOS taskgated가 앱 코드를 실행하기 전에 서명 오류로 종료했다. Xcode의 시뮬레이터용 권한 배치를 유지하는 빌드로 변경하여 해결했으며, App Group을 제거하거나 기기 보안 정책을 변경하지 않았다.

## macOS 실행기 용량 부족 대응

품질 검사의 수동 실행 `macos_runner`는 기본 `macos-26` 외에 `macos-26-intel`을 선택할 수 있다. GitHub가 ARM 호스팅 실행기 미배정/용량 부족으로 작업을 취소하면 Intel 표준 실행기로 Swift 저장소·캡처·실제 OCR 실행과 arm64 iOS 교차 컴파일을 확인한다. Intel에서 통과한 macOS OCR을 실제 iPhone이나 AI 모델 정확도 통과로 해석하지 않는다. 실제 iOS 시뮬레이터 UI 검사는 arm64 실행기를 유지한다.

공식 [표준 실행기 사양](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)은 공개 저장소의 `macos-26-intel`을 무료 표준 실행기에 포함한다. 유료 `large`/`xlarge` 실행기를 사용하지 않는다.
