import WidgetKit
import SwiftUI
import ActivityKit

struct TodoEntry: TimelineEntry {
  var date: Date
  var tasks: [LockTask]
  var count: Int
  var hidden: Bool
  var contentHidden = false
  var unavailable = false
}
struct TodoProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodoEntry { .init(date: Date(), tasks: [], count: 0, hidden: true) }
  func getSnapshot(in context: Context, completion: @escaping (TodoEntry) -> Void) { completion(entry()) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<TodoEntry>) -> Void) {
    completion(Timeline(entries: [entry()], policy: .after(Date().addingTimeInterval(900))))
  }
  private func entry() -> TodoEntry {
    do { let value = try SharedStore().snapshot(); return .init(date: Date(), tasks: value.tasks, count: value.count, hidden: value.hideTitles, contentHidden: value.hideContent) }
    catch { return .init(date: Date(), tasks: [], count: 0, hidden: true, unavailable: true) }
  }
}
struct TodoWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TTodoLock", provider: TodoProvider()) { entry in
      VStack(alignment: .leading, spacing: 4) {
        Label(entry.unavailable ? "앱에서 확인" : entry.contentHidden ? "내용 숨김" : "할 일 \(entry.count)개", systemImage: "checklist").font(.headline)
        if entry.hidden { Text("TTodo에서 확인하세요").font(.caption) }
        else { ForEach(entry.tasks.prefix(2), id: \.id) { task in Text(task.title).font(.caption).lineLimit(1).privacySensitive() } }
      }.containerBackground(.fill.tertiary, for: .widget).widgetURL(URL(string: "ttodo://today"))
    }.configurationDisplayName("오늘의 할 일").description("잠금화면에서 남은 할 일을 확인해요.")
      .supportedFamilies([.accessoryRectangular, .systemSmall])
  }
}
struct TodoLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TodoActivityAttributes.self) { context in
      VStack(alignment: .leading, spacing: 8) {
        Label(context.state.hideContent == true ? "내용 숨김" : "남은 할 일 \(context.state.count)개", systemImage: "checklist").font(.headline)
        if context.state.hideTitles { Text("앱에서 할 일을 확인하세요").font(.subheadline) }
        else { ForEach(context.state.tasks.prefix(5), id: \.id) { task in Text("○  \(task.title)").lineLimit(1).privacySensitive() } }
        if context.isStale { Text("최신 목록은 앱에서 확인하세요").font(.caption) }
      }.padding().activityBackgroundTint(Color(.secondarySystemBackground))
        .widgetURL(URL(string: "ttodo://today"))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) { Image(systemName: "checklist") }
        DynamicIslandExpandedRegion(.trailing) { Text(context.state.hideContent == true ? "내용 숨김" : "\(context.state.count)개") }
        DynamicIslandExpandedRegion(.bottom) { Text("TTodo · 오늘의 할 일") }
      } compactLeading: { Image(systemName: "checklist") }
        compactTrailing: { Text(context.state.hideContent == true ? "·" : "\(context.state.count)") }
        minimal: { Image(systemName: "checklist") }
    }
  }
}
@main struct TTodoWidgets: WidgetBundle {
  var body: some Widget { TodoWidget(); TodoLiveActivity() }
}
