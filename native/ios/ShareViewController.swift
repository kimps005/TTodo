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
  private func analyze() {
    guard !working else { return }; working = true; failure = nil; message = "이미지를 읽고 분석하고 있어요…"
    operation = Task {
      defer { working = false; operation = nil }
      do {
        let data = try await readImage(); try Task.checkCancellation()
        let result = try await CaptureProcessor.analyze(data: data, messageDate: nil, channel: "share", extract: OnDeviceExtraction.extract)
        try Task.checkCancellation()
        let store = try SharedStore()
        let proposals = try store.captureReviewItems(id: result.id)
        analysisId = result.id; items = proposals
        message = proposals.isEmpty ? (result.duplicate ? "이미 저장하거나 무시한 이미지예요. 앱 분석함에서 내역을 확인할 수 있어요." : "이 이미지에서 할 일을 찾지 못했어요.") : "제목·날짜·원문 근거를 확인하고 필요한 항목만 저장하세요."
      } catch {
        guard !Task.isCancelled else { return }
        failure = (error as? LocalizedError)?.errorDescription ?? "기기 내 분석을 마치지 못했어요. 앱에서 AI 준비 상태를 확인하고 다시 시도해 주세요."
      }
    }
  }
  private func save() {
    guard !working, let analysisId else { return }
    working = true; failure = nil
    do {
      let edits = try items.filter(\.selected).map { item in
        let deadline = item.dateEdited ? try ExtractionValidator.localDeadline(day: item.dateText, time: item.timeText) : NativeDeadline(dueAt: item.dueAt, precision: item.duePrecision)
        return CaptureTaskEdit(id: item.id, title: item.title, description: item.description, dueAt: deadline.dueAt, duePrecision: deadline.precision)
      }
      let count = try SharedStore().approveReviewedCapture(id: analysisId, edits: edits)
      items = try SharedStore().captureReviewItems(id: analysisId)
      message = "\(count)개를 저장했어요. 앱과 잠금화면 목록에 갱신을 요청해요."
      WidgetCenter.shared.reloadAllTimelines()
      Task { try? await TodoActivityManager.refresh() }
    } catch { failure = (error as? LocalizedError)?.errorDescription ?? "저장하지 못했어요. 다시 시도해 주세요." }
    working = false
  }
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          Text("캡처 속 할 일").font(.largeTitle.bold())
          Text(message).foregroundStyle(.secondary)
          Text("무료 기기 내 AI · 한국어 정확도 검증 전").font(.caption).foregroundStyle(.secondary)
          if let failure { Text(failure).foregroundStyle(.red) }
          if working { ProgressView("처리 중") }
          if analysisId == nil {
            Button("기기에서 분석", action: analyze).buttonStyle(.borderedProminent).disabled(working)
            Text("먼저 TTodo 앱 설정에서 기기 내 AI 분석에 동의해 주세요. 날짜 기준일을 모르는 ‘내일’ 같은 표현은 확정하지 않아요.").font(.caption).foregroundStyle(.secondary)
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
            }.padding().background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
          }
          if !items.isEmpty {
            Button("선택한 \(items.filter(\.selected).count)개 저장", action: save).buttonStyle(.borderedProminent).disabled(working || !items.contains(where: \.selected))
            Button("남은 제안 모두 무시") {
              guard let analysisId else { return }
              do { try SharedStore().ignoreCapture(id: analysisId); items = []; message = "제안을 무시했어요. 원문 근거도 삭제했어요." }
              catch { failure = "처리하지 못했어요. 앱 분석함에서 다시 확인해 주세요." }
            }.disabled(working)
          }
        }.padding(24)
      }.navigationTitle("TTodo").navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("닫기") { operation?.cancel(); close() } } }
        .onDisappear { operation?.cancel() }
    }
  }
}
