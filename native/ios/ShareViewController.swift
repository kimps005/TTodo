import UIKit
import SwiftUI
import UniformTypeIdentifiers
import WidgetKit
import OSLog

final class ShareViewController: UIViewController {
  private let presentationLog = Logger(subsystem: "app.ttodo.share", category: "presentation")

  override func viewDidLoad() {
    super.viewDidLoad()
    presentationLog.notice("Share controller loaded")
    // The scrollable SwiftUI content has no intrinsic sheet height of its own.
    preferredContentSize = CGSize(width: max(view.bounds.width, 320), height: 480)
    view.backgroundColor = .systemBackground
    let close: () -> Void = { [weak self] in
      self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
    show(CaptureShareView(context: { [weak self] in self?.extensionContext }, close: close))
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    presentationLog.notice("Share sheet appeared")
  }

  private func show<Content: View>(_ content: Content) {
    let host = UIHostingController(rootView: content)
    addChild(host); host.view.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(host.view)
    NSLayoutConstraint.activate([host.view.topAnchor.constraint(equalTo: view.topAnchor), host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor), host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor), host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)])
    host.didMove(toParent: self)
  }
}

#if DEBUG
private struct LocalShareView: View {
  let context: () -> NSExtensionContext?
  let close: () -> Void
  @State private var preparing = false
  @State private var copied = false
  @State private var failure: String?
  @State private var operation: Task<Void, Never>?

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 16) {
          Text("앱에서 사진 검토하기").font(.title.bold()).accessibilityAddTraits(.isHeader)
          Text("사진 공유 메뉴에서 이미지 입력 단축어를 선택하면 TTodo가 열려요. 단축어 앱에서 ‘TTodo에서 공유 이미지 검토’ 동작에 단축어 입력을 연결하고 ‘공유 시트에서 보기’를 켜 주세요.")
          if preparing {
            ProgressView("복사할 이미지를 준비하고 있어요")
          } else if copied {
            Text("이 기기에 5분간 복사했어요. 닫은 뒤 TTodo의 ‘사진·클립보드에서 할 일 찾기’에서 ‘클립보드 이미지 붙여넣기’를 눌러 주세요.")
          } else {
            Text("단축어 설정 전에는 이 사진을 직접 복사해 앱에 붙여넣을 수 있어요.")
            if let failure { Text(failure).foregroundStyle(.red) }
            Button(failure == nil ? "이 사진 수동 복사" : "다시 시도") { copyImage() }
              .buttonStyle(.borderedProminent)
          }
        }.padding(24)
      }.navigationTitle("TTodo").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("닫기") { operation?.cancel(); close() } } }
        .onDisappear { operation?.cancel() }
    }
  }

  @MainActor private func copyImage() {
    guard !preparing else { return }
    preparing = true
    failure = nil
    operation = Task {
      defer { preparing = false; operation = nil }
      do {
        let jpeg = try await CaptureImageInput.compressedImage(from: context())
        try Task.checkCancellation()
        ShareImageHandoff.copy(jpeg)
        copied = true
      } catch {
        if !Task.isCancelled { failure = (error as? LocalizedError)?.errorDescription ?? CaptureImageInput.Failure.unreadable.errorDescription }
      }
    }
  }
}
#endif

private struct CaptureShareView: View {
  let context: () -> NSExtensionContext?
  let close: () -> Void
  #if DEBUG
  @State private var needsLocalMode = false
  #endif
  @State private var working = false
  @State private var message = "공유한 이미지에서 기기 내 AI로 할 일을 찾아요. 원본은 영구 저장하지 않아요."
  @State private var failure: String?
  @State private var analysisId: String?
  @State private var items: [CaptureReviewItem] = []
  @State private var purgeObserver: CapturePurgeObserver?
  @State private var operation: Task<Void, Never>?
  @State private var preview: UIImage?
  @State private var confirmReanalysis = false
  @State private var reanalysisSnapshot: CaptureReanalysisSnapshot?
  @State private var hasSaved = false
  @State private var similar: [SimilarCapture] = []
  @State private var confirmSimilar = false
  @State private var similarConfirmation: [SimilarCapture]?
  @State private var reviewUnavailable = false
  @State private var semiAutomatic = false
  private func discardCapture() {
    operation?.cancel(); preview = nil; items = []; similar = []; analysisId = nil
    reanalysisSnapshot = nil; similarConfirmation = nil; close()
  }
  @discardableResult private func refreshReview() -> Bool {
    guard let analysisId else { return true }
    do {
      let store = try SharedStore()
      semiAutomatic = try store.querySQL("SELECT model_version FROM analyses WHERE id=?", params: [analysisId]).first?["model_version"] as? String == "vision-ocr/manual-v1"
      let stored = try store.captureReviewItems(id: analysisId)
      items = CaptureReviewItem.reconciled(current: items, stored: stored)
      similar = try store.similarCaptures(id: analysisId)
      hasSaved = !(try store.querySQL("SELECT id FROM extracted_tasks WHERE analysis_id=? AND review_status='saved' LIMIT 1", params: [analysisId])).isEmpty
      reviewUnavailable = false
      if items.isEmpty { message = "검토할 대기 제안이 없어요. 처리되었거나 보존 기간이 지난 항목은 앱 분석함에서 확인해 주세요." }
      return true
    } catch {
      reviewUnavailable = true
      failure = "최신 제안 상태를 확인하지 못했어요. 다시 확인한 뒤 저장해 주세요."
      return false
    }
  }
  private func dueLabel(_ item: CaptureReviewItem) -> String {
    guard let due = item.dueAt else { return "마감 없음" }
    if item.duePrecision == "date" {
      let parts = due.split(separator: "-")
      if parts.count == 3 { return "\(parts[0])년 \(Int(parts[1]) ?? 0)월 \(Int(parts[2]) ?? 0)일" }
    }
    if let date = ExtractionValidator.timestamp(due) {
      let formatter = DateFormatter(); formatter.locale = Locale(identifier: "ko_KR")
      formatter.dateStyle = .medium; formatter.timeStyle = .short
      return formatter.string(from: date)
    }
    return "마감 확인 필요"
  }
  private func analyze(reanalyze: Bool = false, expected: CaptureReanalysisSnapshot? = nil) {
    guard !working else { return }; working = true; failure = nil; message = "이미지를 읽고 분석하고 있어요…"
    if purgeObserver == nil { purgeObserver = CapturePurgeObserver { discardCapture() } }
    // Keep the draft disabled while reading the image. If registration never
    // starts, a read failure must not discard edits to still-pending proposals.
    operation = Task {
      defer { working = false; operation = nil }
      do {
        let consent = try await Task.detached(priority: .userInitiated) {
          try SharedStore().hasLocalAIConsent()
        }.value
        try Task.checkCancellation()
        guard consent else { throw CaptureError.consentRequired }
        message = "공유한 이미지를 가져오고 있어요…"
        let input = try await CaptureImageInput.loadSingle(from: context())
        defer { withExtendedLifetime(input) {} }
        let file = input.url
        try Task.checkCancellation()
        message = "기기에서 글자를 읽고 할 일을 찾고 있어요…"
        preview = try autoreleasepool { UIImage(cgImage: try VisionOCR.thumbnail(fileURL: file, maximumDimension: 720)) }
        let result = try await CaptureProcessor.analyze(fileURL: file, messageDate: nil, channel: "share", retryFailed: true, reanalyzeUnstored: reanalyze, expected: expected, service: AppleTodoExtractionService())
        try Task.checkCancellation()
        if reanalyze { CaptureNotifications.clearAnalysis(result.id) }
        let store = try SharedStore()
        semiAutomatic = try store.querySQL("SELECT model_version FROM analyses WHERE id=?", params: [result.id]).first?["model_version"] as? String == "vision-ocr/manual-v1"
        let proposals = try store.captureReviewItems(id: result.id)
        analysisId = result.id; items = proposals; reviewUnavailable = false
        similar = try store.similarCaptures(id: result.id)
        hasSaved = !(try store.querySQL("SELECT id FROM extracted_tasks WHERE analysis_id=? AND review_status='saved' LIMIT 1", params: [result.id])).isEmpty
        let status = try store.querySQL("SELECT status FROM analyses WHERE id=?", params: [result.id]).first?["status"] as? String
        if status == "processing" || status == "queued" { message = "이 이미지는 이미 분석 중이에요. 잠시 후 앱 분석함에서 확인해 주세요." }
        else { message = proposals.isEmpty ? (result.duplicate ? "검토할 제안이 없어요. 이미 처리되었거나 보존 기간이 지난 결과는 앱 분석함에서 확인할 수 있어요." : "이 이미지에서 할 일을 찾지 못했어요.") : "제목·날짜·원문 근거를 확인하고 필요한 항목만 저장하세요." }
        if semiAutomatic { message = "기기 내 AI를 사용할 수 없어 글자만 읽었어요. 원하는 원문을 탭해 제목으로 선택하고 수정한 뒤 저장하세요. AI 제안이 아니에요." }
      } catch {
        guard !Task.isCancelled else { return }
        #if DEBUG
        if case StoreError.unavailable = error {
          needsLocalMode = true
          return
        }
        #endif
        let detail = (error as? LocalizedError)?.errorDescription ?? "기기 내 분석을 마치지 못했어요. 앱에서 AI 준비 상태를 확인하고 다시 시도해 주세요."
        // A failed replacement may already have removed old IDs. Reconcile
        // against storage rather than restoring a stale proposal snapshot.
        if analysisId != nil { _ = refreshReview() }
        message = "분석을 마치지 못했어요."
        failure = detail
      }
    }
  }
  private func save(expectedSimilar: [SimilarCapture]? = nil) {
    guard !working, let analysisId else { return }
    guard refreshReview() else { return }
    working = true; failure = nil
    let count: Int
    do {
      // Re-read before approval. A confirmation for older matches must not
      // silently acknowledge a newly discovered or changed similar capture.
      if let expectedSimilar, similar != expectedSimilar {
        working = false
        failure = "비슷한 분석 기록이 변경되었어요. 최신 내용을 확인한 뒤 다시 저장해 주세요."
        return
      }
      if !similar.isEmpty && expectedSimilar == nil {
        similarConfirmation = similar; working = false; confirmSimilar = true; return
      }
      guard items.contains(where: \.selected) else { throw CaptureError.reviewRequired }
      let edits = try items.filter(\.selected).map { item in
        let deadline = item.dateEdited ? try ExtractionValidator.localDeadline(day: item.dateText, time: item.timeText) : NativeDeadline(dueAt: item.dueAt, precision: item.duePrecision)
        return CaptureTaskEdit(id: item.id, title: item.title, description: item.description, dueAt: deadline.dueAt, duePrecision: deadline.precision, reminder: item.reminder)
      }
      count = try SharedStore().approveReviewedCapture(id: analysisId, edits: edits, expectedSimilar: similar)
    } catch {
      let detail = (error as? LocalizedError)?.errorDescription ?? "저장하지 못했어요. 다시 시도해 주세요."
      _ = refreshReview(); failure = detail; working = false; return
    }
    // Approval has committed. A later read must not turn it into a save failure.
    hasSaved = true; similar = []
    if !refreshReview() { items = []; failure = "저장은 완료됐어요. 최신 제안은 앱 분석함에서 확인해 주세요." }
    message = "\(count)개를 저장했어요. 앱과 잠금화면 목록에 갱신을 요청해요."
    Task {
      do {
        if !(try await CaptureNotifications.refreshReminders()) { failure = "할 일은 저장했어요. 알림을 받으려면 기기 설정에서 TTodo 알림을 허용해 주세요." }
      } catch { failure = "할 일은 저장했어요. 알림 예약은 앱 목록 갱신 때 다시 시도해요." }
    }
    working = false
  }
  var body: some View {
    #if DEBUG
    if needsLocalMode { LocalShareView(context: context, close: close) }
    else { reviewView }
    #else
    reviewView
    #endif
  }

  private var reviewView: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          Text("캡처 속 할 일").font(.largeTitle.bold()).accessibilityAddTraits(.isHeader)
            .accessibilityIdentifier("ttodo-share-review-entry")
          Text(message).foregroundStyle(.secondary)
          if analysisId == nil && !working {
            Text("앱에서 검토하려면 사진 공유 메뉴의 이미지 입력 단축어를 선택하세요. TTodo 설정의 ‘캡처 자동화’에서 연결 방법을 확인할 수 있어요.").font(.caption)
          }
          if let preview { Image(uiImage: preview).resizable().scaledToFit().frame(maxHeight: 220).accessibilityLabel("이번 분석 이미지 미리보기") }
          Text(semiAutomatic ? "OCR · 직접 선택" : "무료 기기 내 AI · 한국어 정확도 검증 전").font(.caption).foregroundStyle(.secondary)
          if let failure { Text(failure).foregroundStyle(.red) }
          if reviewUnavailable { Button("최신 상태 다시 확인") { failure = nil; _ = refreshReview() }.disabled(working) }
          if working { ProgressView("처리 중") }
          if !similar.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
              Text("비슷한 분석 기록이 있어요").font(.headline)
              Text("최근 7일의 원문 근거와 비교한 참고 안내예요. 서로 다른 일일 수 있으니 확인해 주세요. 자동으로 합치지 않아요.").font(.caption)
              ForEach(similar) { match in Text("\(match.saved ? "저장한 항목" : "검토 대기") · \(match.title)").font(.caption) }
            }
          }
          if analysisId == nil {
            Button(failure == nil ? "기기에서 분석" : "다시 시도") { analyze() }.buttonStyle(.borderedProminent).fixedSize(horizontal: false, vertical: true).disabled(working)
            Text("먼저 TTodo 앱 설정에서 기기 내 AI 분석에 동의해 주세요. 날짜 기준일을 모르는 ‘내일’ 같은 표현은 확정하지 않아요.").font(.caption).foregroundStyle(.secondary)
          }
          if analysisId != nil {
            Text(hasSaved ? "저장한 기록이 있는 캡처는 재분석하지 않아요. 저장한 할 일은 앱 목록에서 직접 수정해 주세요." : "저장 전에는 같은 캡처를 다시 분석할 수 있어요. 기존 미저장 제안과 수정 내용은 교체돼요.").font(.caption).foregroundStyle(.secondary)
            Button("이 사진 다시 분석") {
              guard let analysisId else { return }
              do {
                reanalysisSnapshot = try SharedStore().captureReanalysisSnapshot(id: analysisId)
                confirmReanalysis = true
              } catch { failure = "분석 상태를 확인하지 못했어요. 최신 상태를 다시 확인해 주세요." }
            }.disabled(working || hasSaved || reviewUnavailable)
          }
          ForEach($items) { $item in
            VStack(alignment: .leading, spacing: 12) {
              Toggle("이 할 일 선택", isOn: $item.selected).accessibilityLabel("선택: \(item.title)").accessibilityHint("저장할 제안을 선택하거나 해제해요")
              Toggle("마감 시각에 알림 (날짜·시각 필요)", isOn: $item.reminder)
              if item.needsConfirmation { Label("수행 주체나 내용을 확인해 주세요", systemImage: "questionmark.circle").font(.caption) }
              TextField("할 일 제목", text: $item.title, axis: .vertical).textFieldStyle(.roundedBorder).accessibilityLabel("제안 제목: \(item.title)").accessibilityHint("선택한 항목 저장 전까지는 할 일을 생성하지 않아요")
              Text("제안 마감: \(dueLabel(item))").font(.caption)
              TextField("날짜 수정 YYYY-MM-DD", text: $item.dateText).textFieldStyle(.roundedBorder).keyboardType(.numbersAndPunctuation).onChange(of: item.dateText) { _, _ in item.dateEdited = true }
              TextField("시각 수정 17:30 (선택)", text: $item.timeText).textFieldStyle(.roundedBorder).keyboardType(.numbersAndPunctuation).onChange(of: item.timeText) { _, _ in item.dateEdited = true }
              Text("시각을 비우면 날짜만 저장해요. 둘 다 비우면 마감을 해제해요. 시각은 현재 기기 시간대를 사용해요.").font(.caption).foregroundStyle(.secondary)
              Text("원문 근거").font(.caption.bold())
              if semiAutomatic {
                Button { item.selected = true } label: {
                  VStack(alignment: .leading) { Text(item.evidence); Text("탭해서 제목으로 선택").font(.caption.bold()) }
                }.accessibilityLabel("인식문을 제목으로 선택: \(item.title)")
              } else { Text(item.evidence.isEmpty ? "보존 정책 또는 삭제 요청으로 원문을 지웠어요." : item.evidence).font(.caption).textSelection(.enabled) }
            }.padding().background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16)).disabled(working || reviewUnavailable)
          }
          if !items.isEmpty {
            Button("선택한 \(items.filter(\.selected).count)개 저장") { save() }.buttonStyle(.borderedProminent).disabled(working || reviewUnavailable || !items.contains(where: \.selected))
              .alert("이미 있는 할 일인지 확인했나요?", isPresented: $confirmSimilar) {
                Button("다시 확인", role: .cancel) { similarConfirmation = nil }
                Button("확인하고 저장") {
                  guard let expected = similarConfirmation else { return }
                  similarConfirmation = nil
                  save(expectedSimilar: expected)
                }
              } message: { Text("최근 분석과 비슷한 내용이 있어요. 같은 일이면 선택을 해제하고, 서로 다른 일이라면 저장해 주세요.") }
            Button("남은 제안 모두 무시") {
              guard let analysisId else { return }
              let shownIds = items.map(\.id).sorted()
              guard refreshReview() else { return }
              guard shownIds == items.map(\.id).sorted() else { failure = "제안이 변경되었어요. 최신 항목을 확인한 뒤 다시 선택해 주세요."; return }
              do { try SharedStore().ignoreCapture(id: analysisId, expectedTaskIds: shownIds); items = []; message = "제안을 무시했어요. 원문 근거도 삭제했어요." }
              catch { _ = refreshReview(); failure = "처리하지 못했어요. 앱 분석함에서 다시 확인해 주세요." }
            }.disabled(working || reviewUnavailable)
          }
        }.padding(24)
      }.navigationTitle("TTodo").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("닫기") { operation?.cancel(); close() } } }
        .onDisappear { purgeObserver = nil; operation?.cancel() }
        .onReceive(NotificationCenter.default.publisher(for: .NSExtensionHostDidBecomeActive)) { _ in
          if let analysisId, let store = try? SharedStore(),
            (try? store.hasLocalAIConsent()) != true ||
              (try? store.querySQL("SELECT id FROM analyses WHERE id=?", params: [analysisId]).isEmpty) != false {
            discardCapture(); return
          }
          if !working && analysisId != nil { failure = nil; _ = refreshReview() }
        }
        .alert("다시 분석할까요?", isPresented: $confirmReanalysis) {
          Button("취소", role: .cancel) { reanalysisSnapshot = nil }
          Button("다시 분석", role: .destructive) {
            guard let snapshot = reanalysisSnapshot else { return }
            reanalysisSnapshot = nil
            analyze(reanalyze: true, expected: snapshot)
          }
        } message: { Text("이 캡처의 미저장 제안과 수정 내용을 지우고 새로 분석해요. 저장한 기록이 있으면 재분석하지 않아요.") }
    }
  }
}
