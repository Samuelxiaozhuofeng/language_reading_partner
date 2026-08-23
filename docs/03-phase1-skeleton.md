# Phase 1 — 项目骨架 + Liquid Glass 基线

> **Codex Goal**：`完成 Phase 1：搭建 macOS 26 SwiftUI 项目骨架，参考 docs/00-product-spec.md §技术底座和§文件结构`
> **依赖**：`docs/00-product-spec.md`（Phase 0 spike-notes.md 已确认）
> **前置**：Phase 0 完成并经用户确认

## 目标

在 `/Users/samdagreat/Documents/vibe coding/MacReadingAssistant` 创建可 build/run 的 SwiftUI App，建立完整目录结构和 macOS 26 Liquid Glass 基线。

## 任务清单

### 1. 创建 Xcode 项目
- macOS App target，Swift 6，最低部署 macOS 26。
- App 入口使用 `@main struct MacReadingAssistantApp: App`。
- `WindowGroup("Reading Library", id: "library")` 作为主窗口。
- 独立 `Settings` scene。

### 2. 建目录结构
按 `00-product-spec.md` §文件结构创建所有目录和占位文件：

```
MacReadingAssistant/
  App/          MacReadingAssistantApp.swift, AppCommands.swift, AppEnvironment.swift
  Models/       （后续 Phase 填充）
  Stores/       （后续 Phase 填充）
  Services/     （后续 Phase 填充）
  Domain/       （后续 Phase 填充）
  Views/
    Library/    LibrarySidebarView.swift, BookOrChapterListView.swift（空占位）
    Reader/     ReaderContainerView.swift（空占位）
    Inspector/  SentenceInspectorView.swift（空占位）
    Resources/  KnowledgeResourcesView.swift（空占位）
    Settings/   SettingsView.swift（tabs 占位：General, Reading, AI, Vocabulary, Anki, Data）
    Shared/     （后续 Phase 填充）
  Support/      KeychainStore.swift, ErrorPresenter.swift, Formatters.swift（骨架）
```

### 3. 实现 AppCommands

在 `AppCommands.swift` 中定义所有菜单项：

- File: Import EPUB, Import Text/Markdown, Export Resources Markdown
- Reading: Previous/Next Page, Previous/Next Chapter, Remember Position, Toggle Inspector
- Analysis: Analyze Current Sentence, Analyze Current Page, Analyze Whole Chapter, Retry Failed, Cancel
- Anki: Add Selection to Anki, Retry Failed, Open Anki Settings

快捷键绑定：
- `⌘O` 导入 EPUB、`⌘,` Settings、`⌘I` toggle inspector
- `⌘R` 解析当前句、`⌘⇧R` 解析整章、`⌘⇧A` 添加到 Anki
- `←/→` 翻页、`⌥←/⌥→` 切换章节

### 4. macOS 26 Liquid Glass 基线

主窗口布局：
```swift
NavigationSplitView {
  LibrarySidebarView()    // sidebar: 系统 source-list 外观
} content: {
  BookOrChapterListView() // content: 空占位
} detail: {
  ReaderContainerView()   // detail: 空占位 + .inspector(isPresented:)
}
```

约束：
- **不做**：手写标题栏、伪 toolbar、伪 sidebar、自定义毛玻璃覆盖。
- **不做**：`Color.white`、深色遮罩、`ignoresSafeArea` 背景填充。
- **不做**：sidebar row 做成玻璃卡片。
- toolbar 使用系统 `toolbar`，分组用 `ToolbarSpacer`。所有 toolbar button 有 accessibility label。
- `.inspector(isPresented:)` 附着在 detail 上，作为后续 inspector 的基础。

### 5. AppEnvironment

创建 `AppEnvironment` 作为 app-wide dependency container（先用空壳，后续 Phase 注入具体 service）。

## 验收

- [ ] `xcodebuild` 或 `swift build` 成功（取决于项目格式）。
- [ ] App 启动后显示主窗口：sidebar + content + detail 三栏。
- [ ] `⌘,` 打开独立 Settings 窗口。
- [ ] 所有菜单项可见（功能留到后续 Phase 实现）。
- [ ] macOS 26 下 sidebar、toolbar、inspector 呈现原生 Liquid Glass 外观——无自定义背景与系统材料冲突。
- [ ] 深色/浅色模式切换后无硬编码颜色暴露。

## 停止条件

- 如果 macOS 26 SDK 不可用或 Swift 6 编译失败，记录错误并停止。
- Phase 1 完成后可继续 Phase 2，无需等待用户确认（Phase 0 已经确认过方向）。
