# PRD 검토와 구현 결정

기준일: 2026-11-13. 원본 PRD는 수정하지 않고 본 문서에 검증 근거를 추가합니다.

| 결정 | PRD 근거 | 구현/검증 상태 |
|---|---|---|
| React Native + Expo + TypeScript | 9.1: Windows 개발과 Android 재사용 | 공식 최신 템플릿 SDK 58 사용. 실제 설치 버전 lockfile 고정 |
| Swift 네이티브 모듈과 확장 | 9.1: App Intents·Vision·WidgetKit·ActivityKit | 로컬 Expo 모듈 + config plugin. 생성 설정 테스트 통과, CI 빌드 확인 필요 |
| SQLite App Group 단일 저장소 | 9.3: 앱·단축어·확장 동시 접근 | iOS 시스템 SQLite 드라이버 통일, rollback journal·busy timeout·버전 검사. 승인 원자성/고유 제약 테스트 |
| 잠금 입력용 보호 정책 | 5.3, 9.3: 잠긴 상태의 데이터 접근 | 최초 인증 후 접근 정책. 재부팅 최초 해제 전은 접근 불가. 실제 보안/동작 검증 필요 |
| 인증 없는 입력 완료를 보류 | 5.3, 14.1: 실제 기기 통과가 필수 | alwaysAllowed만으로 입력 UI 인증을 보장하지 않음 |
| 잠금 목록 기본 제목 숨기기 | 7.4, 11: 민감정보 최소 노출 | 위젯 스냅샷과 Activity state에서 제목 제거. 갱신 지연의 잔여 노출은 기기 검증 필요 |
| 제안과 Todo 분리 | 10.3: 승인·무시·중복 방지 | 다중 승인 트랜잭션과 중복 요청 테스트 |
| 개별 삭제 시 연결 분석 본문도 삭제 | 11.4의 미정 부분에 대해 사용자가 즉시 삭제 선택 | 같은 트랜잭션으로 본문 제거, 지문·saved 상태로 재승인 방지. 다른 항목 보존·롤백·과거 삭제 잔여 정리 검사 |
| MVP 재분석은 저장 전 캡처만 허용 | 12.4·12.5의 저장 후 처리 범위를 사용자에게 확인해 1번 확정 | 미저장 결과 교체 확인, 부분 저장/삭제 후 차단, 승인과 재분석 경쟁 검사. 저장된 할 일은 직접 편집 |
| AI 제공자 교체 인터페이스 | 9.4, D-03: 한국어 평가 후 선택 + 사용자 무료 우선 지시 | Apple 기기 내 모델을 평가 후보로 연결. 실제 성능 통과 전 최종 선택으로 확정하지 않음. 외부 요청 없음 |
| macOS CI 빌드 | 17.2: Windows 네이티브 검증 제한 | GitHub Actions. 로컬 정책 우회나 GUI 조작 없음 |

## 확인한 공식 자료

- [Expo SDK 58 기준](https://docs.expo.dev/versions/v58.0.0/): iOS 16.4+, Xcode 26.4+. 앱은 PRD 검토안에 맞춰 iOS 18을 배포 타깃으로 설정.
- [Expo 네이티브 확장](https://docs.expo.dev/build-reference/app-extensions/): config plugin으로 확장 타깃 생성, EAS 서명 대상에 확장 선언 필요.
- [Expo 로컬 네이티브 코드](https://docs.expo.dev/workflow/customizing/): 단일 앱 전용 모듈은 local module로 구성.
- [Apple iOS 27 단축어 변경](https://support.apple.com/en-us/149045): 검색 인덱스를 통해 스크린샷 저장 트리거 존재 확인. 문서 직접 열기는 429. **이미지 전달 방식·잠금 실행 성공은 확인하지 못했으며 실기기 검증이 필요.**
- [App Intent 인증 정책](https://developer.apple.com/documentation/appintents/intentauthenticationpolicy/alwaysallowed), [Vision OCR](https://developer.apple.com/documentation/vision/recognizing-text-in-images), [Live Activity](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities): 네이티브 구현 근거. API 설정과 실제 기기 성공은 구분.

## 아직 결정하지 않은 사항

사용자가 무료 우선을 선택했으므로 Apple 기기 내 모델을 우선 평가합니다. 기기와 한국어 모델 지원을 런타임에 확인하며 실제 정확도·날짜 처리·불필요 제안·지연을 기기에서 측정합니다. 유료 API는 사용자 동의 없이 활성화하지 않습니다.
사용자 계정·친구·Android 기능·수익 모델은 P0 검증 전에 확대하지 않습니다.

## SQLite 세부 결정의 이유
PRD 9.3의 공통 저장소와 13.3의 안정성 요구에 따라 iOS에서 Expo의 번들 SQLite와 시스템 SQLite가 같은 파일을 동시에 열지 않도록 네이티브 시스템 드라이버에 접근을 통일합니다. [SQLite 공식 문서 2.3](https://sqlite.org/howtocorrupt.html#multiple_copies_of_sqlite_linked_into_the_same_application)은 같은 앱에 링크한 서로 다른 SQLite 복사본의 잠금 조정 문제를 설명합니다.
지원 최소 OS의 시스템 SQLite가 최신 버전이라고 가정하지 않으므로 rollback journal을 사용합니다. 작은 로컬 할 일 저장소에서 성능보다 정확한 저장을 우선하고, 실기기 부하 테스트 후 조정합니다.
