# 00 — 产品定位与架构总览

> **用途**：所有 Phase goal 的共享参考文档。每个 goal 开头都应引用本文。
> **阅读顺序**：先读本文和 `01-data-models.md`，再进入具体 Phase。

## 产品一句话定位

面向中文母语者的本地外语阅读 App：导入 EPUB、纯文本或 Markdown，在 macOS 上安静阅读，选词查义，整章解析，沉淀知识点，一键写入 Anki。第一版显式支持西语 / 通用外语。

## 十个核心决策

1. **产品心智**：阅读器优先，AI 和 Anki 是阅读时的右手工具。
2. **EPUB 还原**：中等还原，优先保留章节、标题、段落、引用、列表等结构。
3. **AI 解析**：章节列表旁提供「解析整章」入口，AI 设置允许调整并发、模型和 prompt。
4. **导入范围**：第一版支持 EPUB + 纯文本 / Markdown，PDF 暂缓。
5. **数据策略**：第一版本地，不做云同步，不为同步预留字段。
6. **持久化路线**：SQLite + 文件化章节快照。
7. **阅读渲染**：SwiftUI 原生阅读流，点击词汇后右侧 inspector 弹出解释面板。
8. **Anki**：完整 AnkiConnect 直连，包括 note type 创建/修复、字段映射、单条添加和失败重试。
9. **学习资源沉淀**：不自动保存 AI 结果，用户显式收藏或添加 Anki 才沉淀。
10. **语言范围**：第一版只做西语 / 通用外语，日语放到后续版本。

## 第一版非目标

- 不做 Web App 嵌壳、云端账户体系、移动端。
- 不做 iCloud、Supabase 或任何同步预留。
- 不做日语专用 token、furigana、chunk analysis。
- 不做 PDF 导入。
- 不追求完全还原当前 Web UI。

## 第一版主流程

1. 用户导入 EPUB、纯文本或 Markdown。
2. App 抽取书籍、章节、段落、句子。
3. 用户可在章节列表旁点击「解析整章」，也可直接打开章节阅读。
4. 用户在阅读器中点击句子、词汇或选中词组。
5. 右侧 inspector 显示句子解释、词汇解释、收藏与 Anki 操作。
6. 用户显式收藏某个词、短语、语法点，或直接添加到 Anki。
7. App 记录阅读进度、最近位置、已收藏知识点和 Anki 写入状态。

## 项目位置

```
/Users/samdagreat/Documents/vibe coding/MacReadingAssistant
```

当前仓库（西语阅读助手）只作为业务原型参考，不创建 macOS 源码工程。

## 技术底座

- **平台**：macOS 26+，Xcode 26 SDK，Swift 6 系列。
- **UI 基线**：Liquid Glass-native SwiftUI macOS App。
- **主窗口**：`WindowGroup` + `NavigationSplitView`（sidebar-content-detail-inspector）。
- **设置**：独立 `Settings` scene。
- **操作**：commands + 系统 toolbar。
- **持久化**：SQLite（索引）+ Application Support JSON 快照（大内容）。
- **安全**：API Key 存 Keychain，偏好存 `UserDefaults` 或 SQLite。
- **网络**：AnkiConnect 访问 `127.0.0.1:8765`，AI 走 OpenAI 兼容接口。
- **UI 语言**：简体中文，跟随系统浅色/深色模式和 Liquid Glass 材料。

## Liquid Glass 实现原则

- 优先使用系统 SwiftUI 结构和控件获得原生 Liquid Glass 外观。
- 不手写大面积 blur、半透明白底、暗色遮罩或自定义 sidebar / toolbar 背景。
- sidebar、toolbar、inspector、sheet 让系统材料接管；阅读正文区域保持安静和高可读性。
- 只有系统控件覆盖不到的 app-specific 浮动控制，才允许使用 `glassEffect`。
- 多个相邻自定义玻璃控件必须放在同一个 `GlassEffectContainer` 中。
- icon tint 只用于语义状态（主操作、警告、成功），不做装饰性色彩堆叠。
- 阅读器正文不使用玻璃材质，使用系统文本色。
- toolbar 使用系统 `toolbar`，不自建顶部操作栏。相关动作用 `ToolbarSpacer` 分组。
- 自定义 `glassEffect` 控件必须验证高对比度、减少透明度、VoiceOver 和键盘 focus 状态。

## 外部参考文档

- `NavigationSplitView`：https://developer.apple.com/documentation/swiftui/navigationsplitview
- SwiftUI Scenes / Settings：https://developer.apple.com/documentation/swiftui/scenes
- menus and commands：https://developer.apple.com/documentation/swiftui/menus-and-commands
- HIG：https://developer.apple.com/design/human-interface-guidelines
- Adopting Liquid Glass：https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- WWDC 2025 Build SwiftUI app：https://developer.apple.com/videos/play/wwdc2025/323/
- WWDC 2025 New design system：https://developer.apple.com/videos/play/wwdc2025/356/
- Icon Composer：https://developer.apple.com/icon-composer/
- WKWebView file loading：https://developer.apple.com/documentation/webkit/wkwebview/loadfileurl%28_%3Aallowingreadaccessto%3A%29
- Keychain：https://developer.apple.com/documentation/security/storing-keys-in-the-keychain
- network client entitlement：https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.network.client
- AnkiConnect 插件：https://ankiweb.net/shared/info/2055492159
- AnkiConnect API：https://github.com/FooSoft/anki-connect
- Readium Swift Toolkit：https://github.com/readium/swift-toolkit

## 主界面布局

### 主窗口结构

```
NavigationSplitView
  sidebar:   LibrarySidebarView      (集合、全部书籍、最近阅读、学习资源入口)
  content:   BookOrChapterListView   (书籍列表或章节列表)
  detail:    ReaderContainerView     (阅读器)
  inspector: SentenceInspectorView   (句子解释、查词、Anki)
```

- sidebar 使用系统 source-list / Liquid Glass 外观，不自定义大卡片侧栏。
- detail 阅读区不套玻璃卡片，正文应像纸面一样稳定、安静、清晰。
- inspector 首选 `.inspector(isPresented:)`，默认宽度 360pt（允许 300-480pt）。

### 阅读器要求

- 显示章节标题、书名、阅读进度。
- 支持上一章/下一章、上一页/下一页（键盘 Arrow/PageUp/PageDown）。
- 支持连续滚动模式作为第二显示模式。
- 点击句子打开 inspector，点击词汇显示词汇解释面板。
- 选中文本后可查词或添加自定义知识点。
- 记录 resume anchor。
- 正文版心不使用玻璃材质，顶部 toolbar 只放高频操作。

### 阅读文本渲染策略

直接采用「段落块 + 句子 + 词 token」的原生 SwiftUI 阅读流：

```
ReaderContainerView
  ChapterReadingView
    ReadingParagraphView
      ReadingSentenceView
        WordTokenView / punctuation Text
```

- `ReadingSentenceView` 负责句子级点击。
- `WordTokenView` 负责词汇点击，设置 `selectedVocabularyText`。
- token button 使用纯文本外观，不做按钮边框。
- 超长段落按句子换行。
- token button 不使用玻璃效果，hover/focus 反馈优先使用 underline 或淡色背景。

## 设置体系

Settings tabs：General / Reading / AI / Vocabulary / Anki / Data

存储位置：
- API key：Keychain
- base URL、model、prompt 等：UserDefaults 或 SQLite
- 书籍/章节索引、知识点、Anki 记录：SQLite
- 章节大内容：Application Support JSON 快照

## Commands 与快捷键

菜单：File（导入/导出）、Reading（翻页/章节/inspector）、Analysis（解析/重试/取消）、Anki（添加/重试/设置）

快捷键：
- `⌘O` 导入 EPUB、`⌘,` Settings、`⌘I` toggle inspector
- `⌘R` 解析当前句、`⌘⇧R` 解析整章、`⌘⇧A` 添加到 Anki
- `←/→` 翻页、`⌥←/⌥→` 切换章节

toolbar 使用系统 `toolbar`，不自建顶部操作栏。相关动作用 `ToolbarSpacer` 分组。有状态的 toolbar item 可使用 `badge`。所有 toolbar button 必须有 accessibility label。

## 文件结构

```text
MacReadingAssistant/
  MacReadingAssistant/
    App/          MacReadingAssistantApp.swift, AppCommands.swift, AppEnvironment.swift
    Models/       Book, Chapter, Sentence, ParagraphBlock, AnalysisResult, KnowledgeResource, AnkiNoteDraft, ReadingSelection
    Stores/       LibraryStore, ReaderStore, AnalysisRunStore, SettingsStore, AnkiStore
    Services/     LibraryService, SQLiteLibraryRepository, EpubImporter, TextMarkdownImporter,
                  SentenceSegmenter, AIAnalysisService, VocabularyLookupService,
                  AnkiConnectClient, AnkiNoteTypeService, FileStorageService
    Domain/       ReadingFlowBuilder, ChapterProgressResolver, KnowledgeResourceBuilder,
                  AnkiPayloadBuilder, PromptBuilder, ChapterSnapshotCodec, TextTokenization
    Views/        Library/, Reader/, Inspector/, Resources/, Settings/, Shared/
    Support/      KeychainStore, MarkdownExporter, ErrorPresenter, Formatters
  script/         build_and_run.sh
```

- App 只放 scene、commands、依赖注入。
- Views 只放 UI，Stores 负责状态编排，Services 负责平台能力。
- Domain 放纯逻辑，可单测。
- prompt、Anki payload、分句、阅读进度都要从 UI 文件中拆出。

## 第一版 Done Criteria

- 新项目位于当前仓库之外，最低目标系统 macOS 26+。
- App 使用原生 macOS 窗口、Settings、commands，Liquid Glass-native SwiftUI 基线。
- 可导入 EPUB、纯文本、Markdown 并建立本地书库。
- 可打开章节并稳定阅读，点击句子/词汇查看解释。
- 可在章节列表旁解析整章，可对未解析句子发起 AI 解析。
- 可保存知识点，连接 AnkiConnect，创建/修复 SRA note type，添加知识点到 Anki。
- API key 存 Keychain，书库与阅读进度重启后保留。
- 不自动保存 AI/查词结果到学习资源。
- 没有 Supabase 登录、云同步字段、日语专用主流程。
- 没有手写伪 Liquid Glass sidebar、toolbar 或 inspector。

## 关键风险

1. **EPUB 渲染**：追求学习链路用 SwiftUI 原生流，追求样式保真用 WebKit/Readium。第一版选前者。
2. **SwiftUI 文本交互**：token button 的排版抖动、VoiceOver、长段落性能需 Phase 0 验证。
3. **SQLite + 文件快照一致性**：导入、删除、解析时需要明确事务边界。
4. **AnkiConnect**：需区分「Anki 未启动」「插件未安装」「权限拒绝」「字段映射错误」。
5. **AI 输出稳定性**：保留结构化解析校验，失败时允许重试。
6. **日语扩展**：不进第一版，后续作为独立阶段。
7. **Liquid Glass 与可读性**：导航层用 Liquid Glass，阅读正文保持稳定低干扰。

## 开发阶段总览

| Phase | 内容 | 产出 |
|-------|------|------|
| 0 | 技术验证 spike | spike-notes.md |
| 1 | 项目骨架 + Liquid Glass 基线 | 可 build/run 的空 App |
| 2 | 本地书库持久化 | 重启后数据保留 |
| 3 | EPUB/文本/Markdown 导入器 | ≥3 EPUB + txt/md 可导入 |
| 4 | 阅读器 + inspector | 读书体验优先 |
| 5 | AI 解析 + 查词 | 单句+整章+缓存 |
| 6 | AnkiConnect 集成 | 添加+失败重试 |
| 7 | 学习资源 + 导出 | Markdown 导出 |
| 8 | 打磨（性能/暗色模式/签名） | 持续阅读一小时不卡 |

每个 Phase 的具体要求见对应的 `0X-phaseN-*.md` 文档。

## 下一步

先做 Phase 0，验证四件事：
1. SwiftUI 原生阅读流（token 点击 + inspector 联动）
2. SQLite + Application Support JSON 快照一致性
3. macOS 26 Liquid Glass 原生外观
4. AnkiConnect sandbox 行为

Phase 0 完成后必须先由用户确认，再进入 Phase 1。
