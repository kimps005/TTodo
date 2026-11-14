import UIKit
import SwiftUI
import UniformTypeIdentifiers
import WidgetKit

final class ShareViewController: UIViewController {
  override func viewDidLoad() {
    super.viewDidLoad()
    let items = extensionContext?.inputItems as? [NSExtensionItem] ?? []
    let providers = items.flatMap { $0.attachments ?? [] }.filter { $0.hasItemConformingToTypeIdentifier(UTType.image.identifier) }
    let host = UIHostingController(rootView: CaptureShareView(providers: providers) { [weak self] in
      self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    })
    addChild(host); host.view.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(host.view)
    NSLayoutConstraint.activate([host.view.topAnchor.constraint(equalTo: view.topAnchor), host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor), host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor), host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)])
    host.didMove(toParent: self)
  }
}
private enum ShareInputError: LocalizedError {
  case singleImage, unreadable
  var errorDescription: String? { self == .singleImage ? "이미지를 한 장씩 공유해 주세요." : "공유한 이미지를 읽지 못했어요. 다른 이미지를 선택해 주세요." }
}
private struct CaptureShareView: View {
  let providers: [NSItemProvider]
  let close: () -> Void
  @State private var working = false
  @State private var message = "공유한 이미지에서 기기 내 AI로 할 일을 찾아요. 원본은 영구 저장하지 않아요."
  @State private var failure: String?
  @State private var analysisId: String?
  @State private var items: [CaptureReviewItem] = []
  @State private var operation: Task<Void, Never>?
  @State private var preview: UIImage?
  @State private var confirmReanalysis = false
  @State private var hasSaved = false
  @State private var similar: [SimilarCapture] = []
  @State private var confirmSimilar = false
  @State private var reviewUnavailable = false
  @discardableResult private func refreshReview() -> Bool {
    guard let analysisId else { return true }
    do {
      let store = try SharedStore()
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
  private func readImage() async throws -> Data {
    guard providers.count == 1, let provider = providers.first else { throw ShareInputError.singleImage }
    return try await withCheckedThrowingContinuation { continuation in
      provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, _ in
        guard let url else { continuation.resume(throwing: ShareInputError.unreadable); return }
        do {
          let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
          guard size > 0, size <= VisionOCR.maximumBytes else { throw OCRFailure.tooLarge }
          continuation.resume(returning: try Data(contentsOf: url))
        } catch { continuation.resume(throwing: error) }
      }
    }
  }
  private func analyze(reanalyze: Bool = false) {
    guard !working else { return }; working = true; failure = nil; message = "이미지를 읽고 분석하고 있어요…"
    // Keep the draft disabled while reading the image. If registration never
    // starts, a read failure must not discard edits to still-pending proposals.
    if reanalyze, let analysisId { CaptureNotifications.clearAnalysis(analysisId) }
    operation = Task {
      defer { working = false; operation = nil }
      do {
        let data = try await readImage(); try Task.checkCancellation()
        preview = UIImage(cgImage: try VisionOCR.thumbnail(data, maximumDimension: 720))
        let result = try await CaptureProcessor.analyze(data: data, messageDate: nil, channel: "share", retryFailed: true, reanalyzeUnstored: reanalyze, extract: OnDeviceExtraction.extract)
        try Task.checkCancellation()
        let store = try SharedStore()
        let proposals = try store.captureReviewItems(id: result.id)
        analysisId = result.id; items = proposals; reviewUnavailable = false
        similar = try store.similarCaptures(id: result.id)
        hasSaved = !(try store.querySQL("SELECT id FROM extracted_tasks WHERE analysis_id=? AND review_status='saved' LIMIT 1", params: [result.id])).isEmpty
        let status = try store.querySQL("SELECT status FROM analyses WHERE id=?", params: [result.id]).first?["status"] as? String
        if status == "processing" || status == "queued" { message = "이 이미지는 이미 분석 중이에요. 잠시 후 앱 분석함에서 확인해 주세요." }
        else { message = proposals.isEmpty ? (result.duplicate ? "검토할 제안이 없어요. 이미 처리되었거나 보존 기간이 지난 결과는 앱 분석함에서 확인할 수 있어요." : "이 이미지에서 할 일을 찾지 못했어요.") : "제목·날짜·원문 근거를 확인하고 필요한 항목만 저장하세요." }
      } catch {
        guard !Task.isCancelled else { return }
        let detail = (error as? LocalizedError)?.errorDescription ?? "기기 내 분석을 마치지 못했어요. 앱에서 AI 준비 상태를 확인하고 다시 시도해 주세요."
        // A failed replacement may already have removed old IDs. Reconcile
        // against storage rather than restoring a stale proposal snapshot.
        if analysisId != nil { _ = refreshReview() }
        failure = detail
      }
    }
  }
  private func save(confirmedSimilar: Bool = false) {
    guard !working, let analysisId else { return }
    guard refreshReview() else { return }
    working = true; failure = nil
    let count: Int
    do {
      if !similar.isEmpty && !confirmedSimilar { working = false; confirmSimilar = true; return }
      guard items.contains(where: \.selected) else { throw CaptureError.reviewRequired }
      let edits = try items.filter(\.selected).map { item in
        let deadline = item.dateEdited ? try ExtractionValidator.localDeadline(day: item.dateText, time: item.timeText) : NativeDeadline(dueAt: item.dueAt, precision: item.duePrecision)
        return CaptureTaskEdit(id: item.id, title: item.title, description: item.description, dueAt: deadline.dueAt, duePrecision: deadline.precision)
      }
      count = try SharedStore().approveReviewedCapture(id: analysisId, edits: edits)
    } catch {
      let detail = (error as? LocalizedError)?.errorDescription ?? "저장하지 못했어요. 다시 시도해 주세요."
      _ = refreshReview(); failure = detail; working = false; return
    }
    // Approval has committed. A later read must not turn it into a save failure.
    hasSaved = true; similar = []
    if !refreshReview() { items = []; failure = "저장은 완료됐어요. 최신 제안은 앱 분석함에서 확인해 주세요." }
    message = "\(count)개를 저장했어요. 앱과 잠금화면 목록에 갱신을 요청해요."
    WidgetCenter.shared.reloadAllTimelines()
    Task { try? await TodoActivityManager.refresh() }
    working = false
  }
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          Text("캡처 속 할 일").font(.largeTitle.bold())
          Text(message).foregroundStyle(.secondary)
          if let preview { Image(uiImage: preview).resizable().scaledToFit().frame(maxHeight: 220).accessibilityLabel("이번 분석 이미지 미리보기") }
          Text("무료 기기 내 AI · 한국어 정확도 검증 전").font(.caption).foregroundStyle(.secondary)
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
            Button("기기에서 분석") { analyze() }.buttonStyle(.borderedProminent).disabled(working)
            Text("먼저 TTodo 앱 설정에서 기기 내 AI 분석에 동의해 주세요. 날짜 기준일을 모르는 ‘내일’ 같은 표현은 확정하지 않아요.").font(.caption).foregroundStyle(.secondary)
          }
          if analysisId != nil {
            Text(hasSaved ? "저장한 기록이 있는 캡처는 재분석하지 않아요. 저장한 할 일은 앱 목록에서 직접 수정해 주세요." : "저장 전에는 같은 캡처를 다시 분석할 수 있어요. 기존 미저장 제안과 수정 내용은 교체돼요.").font(.caption).foregroundStyle(.secondary)
            Button("이 사진 다시 분석") { confirmReanalysis = true }.disabled(working || hasSaved || reviewUnavailable)
          }
          ForEach($items) { $item in
            VStack(alignment: .leading, spacing: 12) {
              Toggle("이 할 일 선택", isOn: $item.selected)
              if item.needsConfirmation { Label("수행 주체나 내용을 확인해 주세요", systemImage: "questionmark.circle").font(.caption) }
              TextField("할 일 제목", text: $item.title, axis: .vertical).textFieldStyle(.roundedBorder).accessibilityLabel("제안 제목")
              Text("제안 마감: \(dueLabel(item))").font(.caption)
              TextField("날짜 수정 YYYY-MM-DD", text: $item.dateText).textFieldStyle(.roundedBorder).keyboardType(.numbersAndPunctuation).onChange(of: item.dateText) { _, _ in item.dateEdited = true }
              TextField("시각 수정 17:30 (선택)", text: $item.timeText).textFieldStyle(.roundedBorder).keyboardType(.numbersAndPunctuation).onChange(of: item.timeText) { _, _ in item.dateEdited = true }
              Text("시각을 비우면 날짜만 저장해요. 둘 다 비우면 마감을 해제해요. 시각은 현재 기기 시간대를 사용해요.").font(.caption).foregroundStyle(.secondary)
              Text("원문 근거").font(.caption.bold())
              Text(item.evidence.isEmpty ? "보존 정책 또는 삭제 요청으로 원문을 지웠어요." : item.evidence).font(.caption).textSelection(.enabled)
            }.padding().background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16)).disabled(working || reviewUnavailable)
          }
          if !items.isEmpty {
            Button("선택한 \(items.filter(\.selected).count)개 저장") { save() }.buttonStyle(.borderedProminent).disabled(working || reviewUnavailable || !items.contains(where: \.selected))
              .alert("이미 있는 할 일인지 확인했나요?", isPresented: $confirmSimilar) {
                Button("다시 확인", role: .cancel) { }
                Button("확인하고 저장") { save(confirmedSimilar: true) }
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
        .onDisappear { operation?.cancel() }
        .onReceive(NotificationCenter.default.publisher(for: .NSExtensionHostDidBecomeActive)) { _ in
          if !working && analysisId != nil { failure = nil; _ = refreshReview() }
        }
        .alert("다시 분석할까요?", isPresented: $confirmReanalysis) {
          Button("취소", role: .cancel) { }
          Button("다시 분석", role: .destructive) { analyze(reanalyze: true) }
        } message: { Text("이 캡처의 미저장 제안과 수정 내용을 지우고 새로 분석해요. 저장한 기록이 있으면 재분석하지 않아요.") }
    }
  }
}
