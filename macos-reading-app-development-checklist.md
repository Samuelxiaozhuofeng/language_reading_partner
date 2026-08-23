# macOS Reading App 开发细节清单

生成日期：2026-07-04  
来源项目：`/Users/samdagreat/Documents/vibe coding/西语阅读助手`  
目标：新建一个本地优先的 macOS 阅读 App，重点打通「导入 EPUB / 纯文本 / Markdown、阅读、查词、整章解析、收藏、添加到 Anki」链路。  
边界：避免 1:1 搬运当前 Web App。当前仓库只作为业务原型和领域模型参考，新 macOS 项目应放在当前文件夹之外。

## 0. 已确认的十个核心决策

1. 产品心智：阅读器优先，AI 和 Anki 是阅读时的右手工具。
2. EPUB 还原：中等还原，优先保留章节、标题、段落、引用、列表等结构。
3. AI 解析：章节列表旁提供「解析整章」入口，AI 设置允许调整并发、模型和 prompt。
4. 导入范围：第一版支持 EPUB + 纯文本 / Markdown，PDF 暂缓。
5. 数据策略：第一版本地，不做云同步，也不为同步预留字段。
6. 持久化路线：SQLite + 文件化章节快照。
7. 阅读渲染：SwiftUI 原生阅读流优先，必须保留点击词汇后右侧 inspector 弹出解释面板的体验。
8. Anki：完整 AnkiConnect 直连，包括 note type 创建/修复、字段映射、单条添加和失败重试，不做云队列。
9. 学习资源沉淀：不自动保存 AI 结果，用户显式收藏或添加 Anki 才沉淀。
10. 语言范围：第一版只做西语 / 通用外语，日语专用 token、chunk、furigana 放到后续版本。

## 1. 当前 App 扫描结论

### 1.1 技术与分层

当前项目是 Vite + React + TypeScript 前端，入口为：

- `src/main.tsx`：React root 装载。
- `src/App.tsx`：页面装配层，组合 persistent config、Supabase auth、library store、workspace binding、analysis runner 和页面组件。
- `src/components/`：页面与子组件。
- `src/hooks/`：应用状态编排。
- `src/lib/`：EPUB、分句、AI、Anki、书库、Supabase 等业务逻辑。
- `src/types.ts`：共享领域类型。

这个分层值得继承为 macOS 版的模块边界，但实现技术要换成 SwiftUI、SQLite、Application Support 文件快照、AppKit/WebKit 的少量互操作。

### 1.2 当前产品能力

当前 App 已经具备这些核心能力：

- 导入 EPUB，读取 metadata、TOC、spine、cover。
- 抽取章节段落块 `ChapterParagraphBlock`，保留部分 inline HTML 和句子级 HTML。
- 支持 `es` 和 `ja` 两条语言路径，日语使用 kuromoji token。
- 对文本分句，按句子或批量调用 OpenAI 兼容接口。
- 输出结构化解析结果：`grammar`、`meaning`、`highlights`、日语 `chunkAnalysis`。
- 阅读页中点击句子，右侧显示句子解释 inspector。
- 点击西语词汇触发 AI 查词。
- 保存知识点到学习资源。
- 将知识点组装成 Anki note，通过 AnkiConnect 写入 Anki。
- 支持 SRA-ES / SRA-JA 两套 note type 和字段映射。

### 1.3 当前 App 中应降级或移除的部分

macOS 本地 App 的第一版不建议继承这些复杂度：

- Supabase 登录、云端书架、RLS、Storage。
- Android / Capacitor 打包链路。
- 移动端 Anki 云端待导入队列。
- Web 式页面切换：library / workspace / reading / resources。
- 浏览器 `localStorage` / IndexedDB 兼容逻辑。
- 大面积响应式移动布局。

这些能力可以作为后续独立方向或旧数据导入任务，不应进入第一版主路径，也不应影响第一版本地模型设计。

第一版还应暂缓日语专用能力。当前 Web App 的 `ja` 路径很有价值，但它会牵涉 tokenizer、furigana、chunk analysis、Anki 字段和 prompt 校验。macOS 第一版先把西语 / 通用外语阅读链路做稳。

## 2. macOS 版产品定位

### 2.1 一句话定位

面向中文母语者的本地外语阅读 App：导入 EPUB、纯文本或 Markdown，在 macOS 上安静阅读，选词查义，整章解析，沉淀知识点，一键写入 Anki。第一版显式支持西语 / 通用外语，后续再扩展日语等专用语言路径。

### 2.2 第一版主流程

1. 用户导入 EPUB、纯文本或 Markdown。
2. App 抽取书籍、章节、段落、句子。
3. 用户可以在章节列表旁点击「解析整章」，也可以直接打开章节阅读。
4. 用户在阅读器中点击句子、词汇或选中词组。
5. 右侧 inspector 显示句子解释、词汇解释、收藏与 Anki 操作。
6. 用户显式收藏某个词、短语、语法点，或直接添加到 Anki。
7. App 记录阅读进度、最近位置、已收藏知识点和 Anki 写入状态。

### 2.3 第一版非目标

- 不做 Web App 嵌壳。
- 不做云端账户体系。
- 不做移动端。
- 不做完整学习资源管理后台。
- 不做复杂社区分享或同步。
- 不做 iCloud、Supabase 或任何同步预留。
- 不做日语专用 token、furigana、chunk analysis。
- 不做 PDF 导入。
- 不追求完全还原当前 Web UI。

## 3. 建议新项目形态

### 3.1 项目位置

建议在当前项目同级目录新建：

```text
/Users/samdagreat/Documents/vibe coding/MacReadingAssistant
```

当前仓库继续作为参考资料，不在里面创建 macOS 源码工程。

### 3.2 技术底座

建议路线：

- 目标平台：macOS 26+，Xcode 26 SDK，Swift 6 系列。
- UI 基线：Liquid Glass-native SwiftUI macOS App。
- SwiftUI App，主窗口使用 `WindowGroup`。
- 主界面使用 `NavigationSplitView`，符合 macOS 26 的 sidebar-detail-inspector 心智。
- 设置使用独立 `Settings` scene。
- 重要操作进入 `commands` 和系统 toolbar，利用系统自动提供的 Liquid Glass toolbar surface。
- 本地结构化索引使用 SQLite。
- 章节正文、段落块、句子、AI 结果等大快照保存为 Application Support 下的 JSON 文件。
- API Key 存 Keychain，普通偏好存 `UserDefaults` 或 SQLite。
- AnkiConnect 通过本机 HTTP 请求访问 `http://127.0.0.1:8765`。
- 如果启用 App Sandbox，需要开启 outgoing network client entitlement。
- 第一版 UI 语言为简体中文，跟随系统浅色 / 深色模式和 Liquid Glass 动态材料，不做英文本地化。

Liquid Glass 实现原则：

- 优先使用系统 SwiftUI 结构和控件获得原生 Liquid Glass 外观。
- 不手写大面积 blur、半透明白底、暗色遮罩或自定义 sidebar / toolbar 背景。
- sidebar、toolbar、inspector、sheet 让系统材料接管；阅读正文区域保持安静和高可读性。
- 只有系统控件覆盖不到的 app-specific 浮动控制，才允许使用 `glassEffect`。
- 多个相邻自定义玻璃控件必须放在同一个 `GlassEffectContainer` 中。
- icon tint 只用于语义状态，例如主操作、警告、成功，不做装饰性色彩堆叠。

### 3.3 外部文档依据

- Apple `NavigationSplitView`：https://developer.apple.com/documentation/swiftui/navigationsplitview
- Apple SwiftUI Scenes / Settings：https://developer.apple.com/documentation/swiftui/scenes
- Apple menus and commands：https://developer.apple.com/documentation/swiftui/menus-and-commands
- Apple Human Interface Guidelines：https://developer.apple.com/design/human-interface-guidelines
- Apple Adopting Liquid Glass：https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- Apple WWDC 2025 Build a SwiftUI app with the new design：https://developer.apple.com/videos/play/wwdc2025/323/
- Apple WWDC 2025 Get to know the new design system：https://developer.apple.com/videos/play/wwdc2025/356/
- Apple Icon Composer：https://developer.apple.com/icon-composer/
- Apple WKWebView file loading：https://developer.apple.com/documentation/webkit/wkwebview/loadfileurl%28_%3Aallowingreadaccessto%3A%29
- Apple Keychain：https://developer.apple.com/documentation/security/storing-keys-in-the-keychain
- Apple network client entitlement：https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.network.client
- AnkiConnect 插件：https://ankiweb.net/shared/info/2055492159
- AnkiConnect API 迁移入口：https://github.com/FooSoft/anki-connect
- Readium Swift Toolkit 候选调研：https://github.com/readium/swift-toolkit

## 4. 现有源码到 macOS 模块的映射

| 当前代码 | 当前职责 | macOS 版建议落点 | 处理方式 |
| --- | --- | --- | --- |
| `src/types.ts` | 领域类型 | `Models/` | 保留概念，改写为 Swift model |
| `src/lib/epub.ts` | EPUB 解析、章节抽取 | `Services/EpubImporter` | 重新实现 |
| `src/lib/segment.ts` | 西语/通用外语分句，含日语参考实现 | `Services/SentenceSegmenter` | 第一版迁移通用外语算法，日语逻辑留作后续参考 |
| `src/lib/chapterText.ts` | 段落、句子、章节状态 | `Models` + `Domain/ChapterText` | 迁移领域逻辑 |
| `src/lib/readingFlow.ts` | 段落到阅读流 | `Domain/ReadingFlowBuilder` | 保留核心思想 |
| `src/components/ReadingPage.tsx` | 阅读状态与 inspector | `Views/Reader/ReaderRootView` | 重做 UI |
| `src/components/reading/SentenceInspector.tsx` | 句子解释栏 | `Views/Inspector/SentenceInspectorView` | 重做 UI |
| `src/lib/openai.ts` | AI 请求、prompt、JSON 解析 | `Services/AIAnalysisService` | 重写请求与解析 |
| `src/hooks/useAnalysisRunner.ts` | 并发解析与重试 | `Stores/AnalysisRunStore` | 迁移状态机 |
| `src/lib/anki/*` | AnkiConnect、payload、note type | `Services/AnkiConnectClient` + `Domain/AnkiPayloadBuilder` | 迁移通用外语字段，日语字段后续再启用 |
| `src/lib/knowledge.ts` | 知识点规范化 | `Domain/KnowledgeResourceBuilder` | 迁移 |
| `src/lib/resourceExport.ts` | Markdown 导出 | `Services/ResourceExporter` | 迁移 |
| `src/hooks/useLibraryStore.ts` | 书库状态编排 | `Stores/LibraryStore` | 换成本地 repository |
| `src/lib/library/service.ts` | 云端书库编排 | `Services/LibraryService` | 只保留导入、删除、打开、保存进度等业务语义 |
| `src/lib/libraryDb.ts` | 旧 IndexedDB | `Persistence/SQLiteLibraryRepository` | 参考 schema，不迁移 IndexedDB 兼容层 |
| `src/components/SettingsDialog.tsx` | 设置弹窗 | `Views/Settings/SettingsView` | 改成 native Settings |

## 5. 推荐 macOS 文件结构

```text
MacReadingAssistant/
  MacReadingAssistant.xcodeproj 或 Package.swift
  MacReadingAssistant/
    App/
      MacReadingAssistantApp.swift
      AppCommands.swift
      AppEnvironment.swift
    Models/
      Book.swift
      Chapter.swift
      Sentence.swift
      ParagraphBlock.swift
      AnalysisResult.swift
      KnowledgeResource.swift
      AnkiNoteDraft.swift
      ReadingSelection.swift
    Stores/
      LibraryStore.swift
      ReaderStore.swift
      AnalysisRunStore.swift
      SettingsStore.swift
      AnkiStore.swift
    Services/
      LibraryService.swift
      SQLiteLibraryRepository.swift
      EpubImporter.swift
      TextMarkdownImporter.swift
      SentenceSegmenter.swift
      AIAnalysisService.swift
      VocabularyLookupService.swift
      AnkiConnectClient.swift
      AnkiNoteTypeService.swift
      FileStorageService.swift
    Domain/
      ReadingFlowBuilder.swift
      ChapterProgressResolver.swift
      KnowledgeResourceBuilder.swift
      AnkiPayloadBuilder.swift
      PromptBuilder.swift
      ChapterSnapshotCodec.swift
      TextTokenization.swift
    Views/
      Library/
      Reader/
      Inspector/
      Resources/
      Settings/
      Shared/
    Support/
      KeychainStore.swift
      MarkdownExporter.swift
      ErrorPresenter.swift
      Formatters.swift
  script/
    build_and_run.sh
  .codex/
    environments/environment.toml
```

要求：

- `App` 只放 scene、commands、依赖注入。
- `Views` 只放 UI。
- `Stores` 负责状态编排，不直接写文件或网络请求。
- `Services` 负责平台能力、文件、网络、外部进程或持久化。
- `Domain` 放纯逻辑，可单测。
- 大模型 prompt、Anki payload、分句、阅读进度都要从 UI 文件中拆出。

## 6. Scene 与窗口清单

### 6.1 主窗口

使用：

```swift
WindowGroup("Reading Library", id: "library") {
  LibraryRootView()
}
```

主窗口结构：

- 左侧 sidebar：集合、全部书籍、最近阅读、学习资源入口。
- 中间 content：书籍列表或章节列表。章节行必须提供「阅读」和「解析整章」两个一眼可见的动作。
- 右侧 detail：阅读器。
- 可展开 inspector：句子解释、查词、Anki。
- sidebar 使用系统 source-list / Liquid Glass 外观，不自定义大卡片侧栏。
- detail 阅读区不套玻璃卡片，正文应像纸面一样稳定、安静、清晰。

### 6.2 设置窗口

使用独立 `Settings` scene：

- AI 设置：base URL、model、concurrency、prompt。
- 查词设置：是否共用 AI 配置、独立 prompt。
- Anki 设置：endpoint、deck、note type、字段映射、创建/修复 SRA note type。
- 阅读设置：字号、行距、版心宽度。
- 数据设置：本地数据目录、导出、清空本地库。

### 6.3 可选辅助窗口

第一版可先不做。后续可加：

- `Window("Anki Log", id: "anki-log")`：查看 Anki 写入历史和失败重试。
- `Window("Import Report", id: "import-report")`：EPUB 导入问题报告。

### 6.4 macOS 26 Liquid Glass 窗口规则

第一版按 macOS 26 的系统设计来做，而不是把旧 Web UI 迁移成半透明皮肤：

- 主窗口使用系统 toolbar 和 split view，不手写标题栏、伪 toolbar 或伪 sidebar。
- `NavigationSplitView` 的 sidebar 保持系统背景，避免 `Color.white`、深色遮罩或自定义毛玻璃覆盖。
- toolbar item 让系统自动分组到浮动 Liquid Glass surface 上，必要时用 `ToolbarSpacer` 表达动作组。
- sheet、popover、inspector 优先使用系统 presentation，不为了“玻璃感”额外叠加自定义 blur。
- 阅读正文区域是内容舞台，只做排版和选中反馈，不做大面积玻璃容器。
- 自定义浮动控件只用于阅读器局部工具，例如页码浮层、临时查词控制；必须克制、可键盘访问。
- 如果某个自定义控件使用 `glassEffect`，相邻玻璃控件要放入同一个 `GlassEffectContainer`，避免材料采样不一致。

## 7. 主界面布局细节

### 7.1 LibraryRootView

推荐使用 `NavigationSplitView`：

- `sidebar`：LibrarySidebarView
- `content`：BookOrChapterListView
- `detail`：ReaderContainerView

状态模型：

- `selectedCollectionID`
- `selectedBookID`
- `selectedChapterID`
- `selectedSentenceID`
- `selectedVocabularyText`
- `inspectorPresented`

要避免：

- 把所有视图塞进一个 `ContentView.swift`。
- 使用 iOS 式 push-only navigation。
- 用 modal sheet 承载主流程。
- 给 `NavigationSplitView` 根层、sidebar 或 toolbar 人工加 opaque background。
- 把 sidebar row 做成一排玻璃卡片；macOS 26 下优先使用原生 source-list 密度。

### 7.2 ReaderContainerView

阅读器应成为第一屏核心，而非列表工具页。

必备能力：

- 显示章节标题、书名、阅读进度。
- 支持上一章、下一章。
- 支持上一页、下一页，键盘左右键或 PageUp/PageDown。
- 支持连续滚动模式，作为第二显示模式。
- 点击句子打开 inspector。
- 点击词汇后在右侧 inspector 显示词汇解释面板。
- 选中文本后可查词或添加自定义知识点。
- 记录 resume anchor。
- 可调整字号、版心、行距。

Liquid Glass 下的阅读器要求：

- 正文版心不使用玻璃材质，使用系统文本色和阅读设置保证长时间阅读舒适。
- 顶部 toolbar 只放高频操作：导入、解析、查词、Anki、toggle inspector；低频操作进菜单或 inspector。
- 阅读进度、页码等辅助信息可以做轻量浮层，但不能遮挡正文。
- 选中句子和词汇使用克制高亮，不使用发光、厚重描边或装饰性 tint。
- 滚动到 toolbar 边缘时依赖系统 scroll-edge 效果，不自建顶部渐变遮罩。

### 7.3 SentenceInspectorView

inspector 是阅读链路的核心，不应做成临时弹窗。

第一版形态必须明确：

- 首选 SwiftUI `.inspector(isPresented:)` 附着在 `ReaderContainerView` 上。
- inspector 默认宽度 360 pt，允许用户拖拽调整，建议范围 300-480 pt。
- 如果 `.inspector` 在具体布局里无法满足稳定常驻需求，使用 `HSplitView` 自建 trailing column。
- 不允许把核心解释区做成 popover、toast 或临时 sheet。
- inspector 的显示状态属于窗口级阅读状态，可用 `@SceneStorage` 记住是否展开。
- inspector 使用系统 inspector / Liquid Glass 关联当前选择，不给它更重的自定义背景。
- inspector 内部控件使用 `controlSize(.small)` 或 `.regular`，保持 macOS 信息密度。
- 主操作按钮可使用系统 prominent / glass prominent 风格，但不能把每个小按钮都做成彩色主按钮。

必备区域：

- 原句。
- 状态：未解析、解析中、已完成、失败。
- 语法解释。
- 内容理解。
- 高亮知识点列表。
- 查词解释。
- Anki 操作区。
- 收藏操作区。
- 单句重试。

状态设计：

- `selectedSentenceID`
- `selectedHighlightID`
- `selectedVocabularyText`
- `vocabularyLookupState`
- `ankiSubmitState`

交互要求：

- 点击句子时，inspector 显示整句解析。
- 点击词汇时，inspector 切换到词汇解释，但仍保留来源句子上下文。
- 如果该句尚未解析，inspector 提供「解析本句」入口。
- 从章节列表触发的整章解析进行中时，阅读器可以继续打开，句子状态应实时更新或在刷新后更新。

### 7.4 阅读文本渲染策略

第一版直接采用「段落块 + 句子 + 词 token」的原生 SwiftUI 阅读流，不再先尝试整段 `Text` 加手势。

渲染层级：

```text
ReaderContainerView
  ChapterReadingView
    ReadingParagraphView
      ReadingSentenceView
        WordTokenView / punctuation Text
```

交互规则：

- `ReadingSentenceView` 负责句子级点击，点击句子背景或标点时选中句子。
- `WordTokenView` 负责词汇点击，点击词汇时设置 `selectedVocabularyText` 并打开 inspector。
- 词 token 由 `TextTokenization.tokenizeWords(_:)` 生成，标点和空白保留为 non-word token，确保阅读文本不丢字符。
- token button 要使用纯文本外观，不做按钮边框，不破坏阅读排版。
- 对超长段落可以按句子换行，不强求 EPUB 原 CSS 行内排版。
- 第一版不做复杂文本选择标注；系统选中文本查词作为增强项，可在 Phase 8 以后补。
- token button 不使用玻璃效果。词汇点击是文本交互，不应让每个词变成可见控件。
- 词汇 hover / focus 反馈要轻，优先使用 underline、foregroundStyle 或背景淡色。

### 7.5 ResourcesView

第一版建议轻量化：

- 只做本地已收藏知识点列表。
- 支持按语法、搭配、词汇筛选。
- 支持搜索。
- 支持再次添加到 Anki。
- 支持 Markdown 导出。

不建议第一版复刻当前 Web 的资源管理大页。

## 8. 数据模型清单

### 8.1 Book

字段：

- `id`
- `title`
- `author`
- `language`
- `sourceType`
- `coverImagePath`
- `originalFilePath`
- `snapshotDirectoryPath`
- `importedAt`
- `chapterCount`
- `lastReadChapterID`
- `lastOpenedAt`
- `analysisState`
- `collectionID`

说明：

- EPUB 原文件存文件系统，数据库只存路径。
- cover 可缓存为图片文件，避免把大图塞进结构化表。
- `sourceType` 第一版取值建议为 `epub`、`text`、`markdown`。
- 不加入 sync 字段，第一版模型保持纯本地。

### 8.2 Chapter

字段：

- `id`
- `bookID`
- `title`
- `orderIndex`
- `epubHref`
- `snapshotPath`
- `analysisState`
- `activeRange`
- `lastReadEnd`
- `lastOpenedAt`
- `resumeAnchor`

注意：

- SQLite 只保存章节索引和状态字段。
- `paragraphBlocks`、`sentences`、`results` 放在 `snapshotPath` 指向的 JSON 快照中。
- 章节快照写入需要 debounce，避免解析整章时频繁落盘。
- `originalText` 和 `plainText` 属于 `ChapterSnapshot`，不进入 `Chapter` SQLite row model。
- `originalText` 表示导入时从 EPUB / 文本 / Markdown 抽出的初始正文。
- `plainText` 表示供分句和解析使用的当前正文，后续如果提供编辑功能，只改 `plainText` 和 snapshot，不改 `originalText`。

### 8.3 ParagraphBlock

字段：

- `id`
- `kind`
- `headingLevel`
- `text`
- `html`
- `sentenceIDs`
- `sentenceTexts`
- `sentenceHTML`

用途：

- 让阅读器保留 EPUB 结构。
- 让句子点击能映射回原文位置。

### 8.4 Sentence

字段：

- `id`
- `text`
- `editedText`
- `status`
- `error`

说明：

- 第一版不存日语 token。
- 后续做日语时再增加 token snapshot，避免提前污染通用外语模型。

### 8.5 AnalysisResult

字段：

- `sentenceID`
- `grammar`
- `meaning`
- `highlights`
- `isPartial`
- `rawText`

说明：

- 第一版不要求 `chunkAnalysis`。
- 如果保留该字段，也应放在后续语言扩展结构里，不参与第一版 UI。

### 8.6 KnowledgeResource

字段：

- `id`
- `signature`
- `text`
- `kind`
- `explanation`
- `grammarText`
- `meaning`
- `sentenceID`
- `sentenceText`
- `savedAt`
- `bookID`
- `bookTitle`
- `chapterID`
- `chapterTitle`

签名规则可沿用当前：

```text
{kind}:{normalizedText}
```

### 8.7 AnkiNoteDraft

字段：

- `id`
- `language`
- `payload`
- `sourceResourceID`
- `status`
- `createdAt`
- `submittedAt`
- `lastError`

macOS 版可以把它作为本地失败重试队列，而非移动端云队列。

### 8.8 Collection

字段：

- `id`
- `name`
- `createdAt`
- `sortOrder`

说明：

- `Book.collectionID` 可为空，为空表示在「全部」中。
- 删除 collection 时不删除书籍，只把关联书籍的 `collectionID` 置空。

### 8.9 ReadingAnchor

字段：

- `sentenceID`
- `sentenceIndex`
- `sentenceSnippet`
- `paragraphID`
- `updatedAt`

恢复规则：

1. 优先用 `sentenceID` 找句子。
2. 找不到时用 `sentenceIndex`。
3. index 对应内容变化时，用 `sentenceSnippet` 做 fuzzy fallback。
4. 恢复成功后滚动到该句，并短暂高亮。
5. 三种方式都失败时回到章节开头，不报错阻断阅读。

### 8.10 Swift 类型契约

后续 agent 应优先按下面类型落文件，避免在 UI 文件里临时定义：

```swift
typealias BookID = UUID
typealias ChapterID = UUID
typealias SentenceID = UUID
typealias CollectionID = UUID

enum BookLanguage: String, Codable, CaseIterable {
  case es
  case general
}

enum SourceType: String, Codable, CaseIterable {
  case epub
  case text
  case markdown
}

enum AnalysisState: String, Codable, CaseIterable {
  case idle
  case partial
  case running
  case analyzed
}

enum SentenceStatus: String, Codable, CaseIterable {
  case idle
  case queued
  case running
  case success
  case error
}

enum BlockKind: String, Codable, CaseIterable {
  case paragraph
  case heading
  case quote
  case listItem
  case preformatted
  case code
}

enum ResourceKind: String, Codable, CaseIterable {
  case grammar
  case phrase
  case vocabulary
}

enum AnkiDraftStatus: String, Codable, CaseIterable {
  case pending
  case submitting
  case imported
  case failed
}
```

Swift struct 要求：

- `Book`、`Chapter`、`Collection` 是 SQLite row model。
- `ChapterSnapshot`、`ParagraphBlock`、`Sentence`、`AnalysisResult` 是 Codable snapshot model。
- `KnowledgeResource` 和 `AnkiNoteDraft` 存 SQLite，必要时 payload 可存 JSON string。
- 所有时间字段使用 ISO 8601 string 或 `Date`，SQLite 落库时统一转 ISO 8601。
- `Collection` 必须进入 Models 和 repository，不允许只在 UI 层临时拼 sidebar 项。

#### 8.10.1 最小 Swift struct 骨架

后续 agent 可以在此基础上按文件拆分，不要在 View 里临时重建这些类型。

```swift
struct Collection: Identifiable, Codable, Equatable {
  var id: CollectionID
  var name: String
  var createdAt: Date
  var sortOrder: Int
}

struct Book: Identifiable, Codable, Equatable {
  var id: BookID
  var title: String
  var author: String
  var language: BookLanguage
  var sourceType: SourceType
  var coverImagePath: String?
  var originalFilePath: String?
  var snapshotDirectoryPath: String
  var importedAt: Date
  var chapterCount: Int
  var lastReadChapterID: ChapterID?
  var lastOpenedAt: Date?
  var analysisState: AnalysisState
  var collectionID: CollectionID?
}

struct Chapter: Identifiable, Codable, Equatable {
  var id: ChapterID
  var bookID: BookID
  var title: String
  var orderIndex: Int
  var epubHref: String?
  var snapshotPath: String
  var analysisState: AnalysisState
  var activeRange: SentenceRange?
  var lastReadEnd: Int
  var lastOpenedAt: Date?
  var resumeAnchor: ReadingAnchor?
}

struct ParagraphBlock: Identifiable, Codable, Equatable {
  var id: UUID
  var kind: BlockKind
  var headingLevel: Int?
  var text: String
  var html: String?
  var sentenceIDs: [SentenceID]
  var sentenceTexts: [String]
  var sentenceHTML: [String]?
}

struct Sentence: Identifiable, Codable, Equatable {
  var id: SentenceID
  var text: String
  var editedText: String?
  var status: SentenceStatus
  var error: String?
}

struct AnalysisHighlight: Identifiable, Codable, Equatable {
  var id: String
  var text: String
  var kind: ResourceKind
  var explanation: String
}

struct AnalysisResult: Codable, Equatable {
  var sentenceID: SentenceID
  var grammar: String
  var meaning: String
  var highlights: [AnalysisHighlight]
  var isPartial: Bool
  var rawText: String?
}

struct KnowledgeResource: Identifiable, Codable, Equatable {
  var id: UUID
  var signature: String
  var text: String
  var kind: ResourceKind
  var explanation: String
  var grammarText: String
  var meaning: String?
  var sentenceID: SentenceID
  var sentenceText: String
  var savedAt: Date
  var bookID: BookID?
  var bookTitle: String?
  var chapterID: ChapterID?
  var chapterTitle: String?
}

struct AnkiNotePayload: Codable, Equatable {
  var deckName: String
  var modelName: String
  var fields: [String: String]
  var tags: [String]
  var allowDuplicate: Bool
}

struct AnkiNoteDraft: Identifiable, Codable, Equatable {
  var id: UUID
  var language: BookLanguage
  var payload: AnkiNotePayload
  var sourceResourceID: UUID?
  var status: AnkiDraftStatus
  var createdAt: Date
  var submittedAt: Date?
  var lastError: String?
}

struct ReadingAnchor: Codable, Equatable {
  var sentenceID: SentenceID?
  var sentenceIndex: Int?
  var sentenceSnippet: String?
  var paragraphID: UUID?
  var updatedAt: Date
}
```

### 8.11 ChapterSnapshot JSON schema

章节大内容只存 JSON 文件，不塞进 SQLite。快照根结构固定如下：

```json
{
  "schemaVersion": 1,
  "chapterID": "UUID",
  "bookID": "UUID",
  "title": "string",
  "language": "es",
  "sourceType": "epub",
  "originalText": "string",
  "plainText": "string",
  "paragraphBlocks": [
    {
      "id": "UUID",
      "kind": "paragraph",
      "headingLevel": null,
      "text": "string",
      "html": "string or null",
      "sentenceIDs": ["UUID"],
      "sentenceTexts": ["string"],
      "sentenceHTML": ["string"]
    }
  ],
  "sentences": [
    {
      "id": "UUID",
      "text": "string",
      "editedText": "string",
      "status": "idle",
      "error": null
    }
  ],
  "results": {
    "UUID": {
      "sentenceID": "UUID",
      "grammar": "string",
      "meaning": "string",
      "highlights": [
        {
          "id": "string",
          "text": "string",
          "kind": "vocabulary",
          "explanation": "string"
        }
      ],
      "isPartial": false,
      "rawText": "string or null"
    }
  },
  "activeRange": {
    "start": 0,
    "end": 99
  },
  "lastReadEnd": -1,
  "resumeAnchor": null,
  "updatedAt": "ISO-8601"
}
```

Swift 结构最小契约：

```swift
struct ChapterSnapshot: Codable {
  var schemaVersion: Int
  var chapterID: ChapterID
  var bookID: BookID
  var title: String
  var language: BookLanguage
  var sourceType: SourceType
  var originalText: String
  var plainText: String
  var paragraphBlocks: [ParagraphBlock]
  var sentences: [Sentence]
  var results: [SentenceID: AnalysisResult]
  var activeRange: SentenceRange?
  var lastReadEnd: Int
  var resumeAnchor: ReadingAnchor?
  var updatedAt: Date
}

struct SentenceRange: Codable, Equatable {
  var start: Int
  var end: Int
}
```

关系约束：

- `paragraphBlocks[].sentenceIDs` 指向同一快照内的 `sentences[].id`。
- `paragraphBlocks[].sentenceTexts` 与 `sentenceIDs` 数量一致。
- `sentenceHTML` 可以为空；存在时数量必须与 `sentenceIDs` 一致。
- `results` 是以 sentence id 为 key 的字典。
- `results[key].sentenceID` 必须等于 key。
- `activeRange` 是句子数组的闭区间 index，空章节为 `null`。
- `lastReadEnd` 是已经读完的最后一句 index，初始值 `-1`。

### 8.12 SQLite schema 契约

第一版 SQLite 表建议如下。字段命名使用 snake_case，Swift model 做映射。

```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL,
  source_type TEXT NOT NULL,
  cover_image_path TEXT,
  original_file_path TEXT,
  snapshot_directory_path TEXT NOT NULL,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  imported_at TEXT NOT NULL,
  chapter_count INTEGER NOT NULL DEFAULT 0,
  last_read_chapter_id TEXT,
  last_opened_at TEXT,
  analysis_state TEXT NOT NULL DEFAULT 'idle'
);

CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  epub_href TEXT,
  snapshot_path TEXT NOT NULL,
  analysis_state TEXT NOT NULL DEFAULT 'idle',
  active_range_start INTEGER,
  active_range_end INTEGER,
  last_read_end INTEGER NOT NULL DEFAULT -1,
  last_opened_at TEXT,
  resume_anchor_sentence_id TEXT,
  resume_anchor_sentence_index INTEGER,
  resume_anchor_snippet TEXT,
  resume_anchor_paragraph_id TEXT,
  resume_anchor_updated_at TEXT
);

CREATE TABLE knowledge_resources (
  id TEXT PRIMARY KEY,
  signature TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,
  kind TEXT NOT NULL,
  explanation TEXT NOT NULL,
  grammar_text TEXT NOT NULL DEFAULT '',
  meaning TEXT,
  sentence_id TEXT NOT NULL,
  sentence_text TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
  book_title TEXT,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  chapter_title TEXT
);

CREATE TABLE anki_note_drafts (
  id TEXT PRIMARY KEY,
  language TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  source_resource_id TEXT REFERENCES knowledge_resources(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  submitted_at TEXT,
  last_error TEXT
);
```

索引：

```sql
CREATE INDEX idx_books_collection ON books(collection_id);
CREATE INDEX idx_books_last_opened ON books(last_opened_at);
CREATE INDEX idx_chapters_book_order ON chapters(book_id, order_index);
CREATE INDEX idx_resources_kind ON knowledge_resources(kind);
CREATE INDEX idx_resources_saved_at ON knowledge_resources(saved_at);
CREATE INDEX idx_anki_drafts_status ON anki_note_drafts(status);
```

### 8.13 FileStorageService API

文件系统职责不要散落到 repository 和 importer 中。建议接口：

```swift
protocol FileStorageService {
  func appSupportRoot() throws -> URL
  func createBookDirectory(bookID: BookID, sourceType: SourceType) throws -> URL
  func copyOriginalFile(from sourceURL: URL, bookID: BookID, sourceType: SourceType) throws -> URL
  func saveCoverImage(_ data: Data, bookID: BookID) throws -> URL
  func chapterSnapshotURL(bookID: BookID, chapterID: ChapterID) throws -> URL
  func loadChapterSnapshot(at url: URL) throws -> ChapterSnapshot
  func saveChapterSnapshot(_ snapshot: ChapterSnapshot, to url: URL) throws
  func deleteBookDirectory(bookID: BookID, sourceType: SourceType) throws
}
```

错误策略：

- 文件复制失败时，不写 SQLite。
- SQLite 写入失败时，清理刚复制的 book directory。
- 保存 snapshot 先写临时文件，再 atomic replace。
- 删除书籍时，先删 SQLite row，再尽力删除目录；目录删除失败写日志并提示用户。

### 8.14 AI wire format

AI 服务使用 OpenAI 兼容 `chat/completions`。

请求：

```json
{
  "model": "gpt-4.1-mini",
  "temperature": 0.2,
  "messages": [
    {
      "role": "user",
      "content": "interpolated prompt"
    }
  ]
}
```

PromptBuilder 输入：

```swift
struct AnalysisPromptInput {
  let sentence: String
  let previousSentence: String?
  let nextSentence: String?
  let documentTitle: String?
  let chapterTitle: String?
}
```

AI 响应中 `choices[0].message.content` 必须能解析为：

```json
{
  "grammar": "string",
  "meaning": "string",
  "highlights": [
    {
      "text": "string",
      "kind": "grammar | phrase | vocabulary",
      "explanation": "string"
    }
  ]
}
```

解析规则：

- `grammar` 和 `meaning` 至少有一个非空，否则视为解析失败。
- `highlights` 不是数组时按空数组处理。
- `kind` 不在允许值中时默认归为 `grammar`。
- `text` 或 `explanation` 为空的 highlight 丢弃。
- 同一句中重复 `{kind}:{lowercased text}` 的 highlight 只保留第一个。
- 解析失败不写入 `results`，句子状态置为 `error`。

词汇解释请求同样走 `chat/completions`，响应内容必须解析为：

```json
{
  "explanation": "string"
}
```

### 8.15 AnalysisRunStore 状态机

状态枚举：

```swift
enum AnalysisRunPhase: Equatable {
  case idle
  case validating
  case running(scope: AnalysisScope, total: Int, finished: Int)
  case cancelling
  case completed(scope: AnalysisScope, succeeded: Int, failed: Int)
  case failed(message: String)
}

enum AnalysisScope: Equatable {
  case sentence(SentenceID)
  case page(chapterID: ChapterID, sentenceIDs: [SentenceID])
  case chapter(ChapterID)
}
```

合法转换：

```text
idle -> validating
validating -> running
validating -> failed
running -> completed
running -> failed
running -> cancelling
cancelling -> idle
completed -> idle
failed -> idle
```

约束：

- 同一时间一个 chapter 只允许一个整章解析任务。
- 单句重试可以复用同一个队列机制，但不能与该章节整章解析并行。
- cancel 后，`queued` / `running` 句子恢复到开始前状态。
- 每成功一批句子，debounce 保存 chapter snapshot。

## 9. 导入与渲染策略

### 9.1 导入范围

第一版导入器分两条：

- `EpubImporter`：导入 EPUB，抽取 metadata、cover、TOC/spine、章节、段落块、句子。
- `TextMarkdownImporter`：导入纯文本或 Markdown，把文件转换为一本本地书，并按标题或分隔规则生成章节。

PDF 暂缓，不进入第一版技术验证。

### 9.2 需要先做的技术 spike

必须在正式开发前验证 SwiftUI 原生阅读流，同时把 WebKit / Readium 作为失败备选做轻量风险评估：

1. 自研导入器：
   - 解压 EPUB。
   - 解析 container.xml、OPF、manifest、spine、nav/toc。
   - 提取 XHTML。
   - 清洗 HTML。
   - 抽段落块与句子。
   - SwiftUI 原生渲染。

2. Readium / WebKit 失败备选评估：
   - Readium Swift Toolkit 可作为候选，但它主要以移动阅读器为核心，macOS 适配需要单独验证。
   - WKWebView 可加载本地 HTML，并用 `loadFileURL(_:allowingReadAccessTo:)` 限定读权限。
   - 通过注入 sentence span 和 JS bridge 实现句子点击、选词、定位。
   - 只有 SwiftUI token 阅读流在 Phase 0 被证明不可行时，才允许提交切换建议。
   - 切换到 WebKit / Readium 必须经过用户确认，不能由 agent 自行改路线。

### 9.3 推荐第一版方案

优先做自研导入器 + SwiftUI 原生阅读流，理由：

- 当前 App 已经有段落块、句子、解析结果映射的业务经验。
- 查词、句子 inspector、Anki 操作都需要强交互，原生 SwiftUI 更容易管理状态。
- EPUB 完整排版还原可以放到后续增强，不挡住核心学习链路。

纯文本 / Markdown 走同一套阅读流：

- `.txt` 按空行分段。
- `.md` 保留标题层级、引用、列表、代码块的结构语义。
- 导入后同样生成章节、段落块、句子和快照文件。

### 9.4 必备导入验收

- 能导入常见 reflowable EPUB。
- 能导入纯文本和 Markdown。
- 能读取 title、author、language、cover。
- TOC 有效时按 TOC 导入章节。
- TOC 缺失时按 spine 导入章节。
- 能过滤 script、style、nav、aside、媒体标签。
- 能识别 heading、paragraph、quote、list item、preformatted。
- 能保持段落到句子的映射。
- 能保存原 EPUB 文件。
- 导入失败时保留明确错误，生成可读报告。

## 10. 分句与语言路线

### 10.1 第一版语言范围

当前 Web 代码中 `BookLanguage` 有 `es` 和 `ja`，但 macOS 第一版只启用西语 / 通用外语路径。

第一版建议：

- 数据模型中保留 `language` 字段，但 UI 第一版只提供 `es` 或 `general` 这类通用外语入口。
- 默认 prompt 描述为帮助中文母语者阅读外语文本，不写死成西语教师。
- 日语的 kuromoji、furigana、chunk analysis、日语 Anki 字段全部进入后续版本。

### 10.2 分句策略

西语 / 通用外语：

- 输入：`String`。
- 输出：`[String]`，每个元素是一句，保留句末标点。
- 空字符串、纯标点片段、纯空白片段必须过滤。
- 段落边界由 `ParagraphBlock` 负责，分句器本身不返回段落信息。
- 缩写列表第一版写成常量，不做设置项。
- 参考 `src/lib/segment.ts` 的规则。
- 继续处理常见缩写，如 `Sr.`、`Dra.`、`Prof.`。
- 处理 `;` 和 `…` 作为软断句。
- 过滤只有标点的片段。

Text / Markdown 导入器负责先生成段落块，再对每个段落调用分句器。这样 `ParagraphBlock.sentenceIDs` 可以稳定映射到同一快照内的 `Sentence.id`。

### 10.3 语言扩展约束

新增语言时必须同时扩展：

- `BookLanguage`
- EPUB language detection
- sentence segmenter
- prompt router
- Anki payload
- UI labels
- chapter snapshot schema

日语进入后续版本时，再单独验证 tokenizer、furigana 渲染、chunk selection 和 SRA-JA note type。

## 11. AI 解析链路

### 11.1 服务拆分

建议拆成：

- `AIAnalysisService`
- `PromptBuilder`
- `StructuredResultParser`
- `AnalysisRunStore`
- `VocabularyLookupService`

### 11.2 AnalysisRunStore 状态机

沿用当前 `useAnalysisRunner.ts` 的状态思想：

- validate config
- build pending entries
- mark queued
- start concurrent workers
- per sentence success / error
- cancel and restore previous state
- retry single sentence
- chapter range commit
- auto retry failed entries

第一版入口：

- 章节列表行：`解析整章`。
- 阅读 inspector：`解析本句`。
- 阅读 toolbar 或菜单：`解析当前页 / 当前可见范围`，作为辅助入口。

整章解析不应阻塞阅读。解析任务启动后，章节列表显示进度，阅读器中句子状态可以实时更新或在下一次进入章节时恢复。

### 11.3 Prompt 规则

默认 prompt：

- 面向中文母语者。
- 描述为多语言阅读助手。
- 输出 JSON。
- 字段固定为 `grammar`、`meaning`、`highlights`。
- highlights 最多 4 个。

后续日语 prompt：

- 日语放到第二阶段再启用。
- 到时再加入 token 列表、`chunkAnalysis` 和 token index 校验。

### 11.4 API 配置

设置项：

- base URL
- API key
- model
- concurrency
- batch size
- previous sentence count
- next sentence count
- vocabulary model 是否共用解析模型

安全：

- API key 存 Keychain。
- 不写进普通 plist、日志、导出文件。
- 错误提示不得回显完整 key。

## 12. 查词链路

### 12.1 西语 / 通用外语

流程：

1. 用户在阅读器中点击一个词，或选中一个短语。
2. 右侧 inspector 打开词汇解释面板。
3. 调用 `VocabularyLookupService`。
4. 生成中文解释。
5. 用户可收藏或添加到 Anki。

实现细节：

- 选词可以来自系统 text selection，也可以来自点击 token。
- 当前 Web 的 `tokenizeSpanishWords` 可迁移为轻量 tokenizer。
- 查词结果应缓存到本地，key 为 `{sentenceID}:{word}`。
- 查词结果不自动进入学习资源，用户点击收藏或添加 Anki 后才沉淀。

### 12.2 后续日语查词

日语进入后续版本时再增加：

- token / chunk 点击。
- furigana 显示。
- chunk explanation。
- 日语专用 Anki payload。

## 13. Anki 链路

### 13.1 第一版主能力

- 检查 AnkiConnect endpoint。
- 请求 permission。
- 读取 deckNames。
- 读取 modelNames。
- 读取 modelFieldNames。
- 创建或修复 SRA 通用外语 note type。
- 根据字段映射构造 fields。
- `addNote` 单条添加。
- 本地记录成功和失败。
- 失败条目可重试。

### 13.2 字段设计

第一版通用外语字段：

- sentence
- grammar
- meaning
- knowledge
- knowledgeKind
- knowledgeExplanation

后续日语字段：

- sentence
- sentenceFurigana
- grammar
- meaning
- knowledge
- knowledgeFurigana
- knowledgeKind
- knowledgeExplanation

### 13.3 macOS 版可删除的复杂度

- `shouldQueueAnkiOnThisDevice`
- 云端 pending Anki notes
- 手机端导入提示

保留一个本地失败重试队列即可。

添加规则：

- 点击「添加到 Anki」成功后，可以同时创建或更新本地 `KnowledgeResource`。
- 仅展示 AI 解析或查词结果时，不自动写入学习资源。
- Anki 添加失败时写入 `AnkiNoteDraft` 本地失败记录，用户可重试。

### 13.4 Sandbox 注意事项

- 访问 OpenAI 兼容接口和 `127.0.0.1:8765` 都属于 outgoing network。
- 如果开启 App Sandbox，需要打开 outgoing network client entitlement。
- 本地文件导入 EPUB 时需要使用用户选择文件后的 security-scoped access。

### 13.5 AnkiConnect wire format

AnkiConnectClient 统一使用下面外壳发请求，所有 action 都走 `POST http://127.0.0.1:8765`：

```json
{
  "action": "addNote",
  "version": 6,
  "params": {}
}
```

统一响应格式：

```json
{
  "result": "any",
  "error": null
}
```

解析规则：

- `error` 非空时抛出 `AppError.ankiFailed`，不把原始 payload 打进普通日志。
- 首次连接先调用 `version`，低于 6 时提示用户升级 AnkiConnect。
- 再调用 `requestPermission`，未授权时提示用户在 AnkiConnect 中允许访问。
- 之后按需调用 `deckNames`、`modelNames`、`modelFieldNames`。

### 13.6 默认 note type 契约

第一版默认创建：

```text
SRA General Foreign Language
```

必需字段顺序：

```text
sentence
grammar
meaning
knowledge
knowledgeKind
knowledgeExplanation
```

创建 note type 时使用 `createModel`：

```json
{
  "action": "createModel",
  "version": 6,
  "params": {
    "modelName": "SRA General Foreign Language",
    "inOrderFields": [
      "sentence",
      "grammar",
      "meaning",
      "knowledge",
      "knowledgeKind",
      "knowledgeExplanation"
    ],
    "css": ".card { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 18px; line-height: 1.5; }",
    "cardTemplates": [
      {
        "Name": "Recognition",
        "Front": "{{knowledge}}<hr>{{sentence}}",
        "Back": "{{FrontSide}}<hr>{{knowledgeExplanation}}<br><br>{{grammar}}<br><br>{{meaning}}"
      }
    ]
  }
}
```

修复规则：

- note type 不存在时创建。
- note type 存在但缺字段时，优先提示用户确认修复，再调用 `modelFieldAdd`。
- 用户选择已有 note type 时，通过 `modelFieldNames` 做字段映射，不强制改用户 note type。
- 字段映射缺少 `sentence`、`knowledge`、`knowledgeExplanation` 时，禁止提交并提示设置。

### 13.7 addNote payload 契约

`AnkiPayloadBuilder` 只接收 `KnowledgeResource`、当前句解析结果和 Anki 设置，不直接读 UI state。

内部 payload 沿用 §8.10.1 的 `AnkiNotePayload`，SQLite 中存为 `payload_json`。

发送到 AnkiConnect：

```json
{
  "action": "addNote",
  "version": 6,
  "params": {
    "note": {
      "deckName": "Spanish",
      "modelName": "SRA General Foreign Language",
      "fields": {
        "sentence": "source sentence",
        "grammar": "grammar explanation",
        "meaning": "sentence meaning",
        "knowledge": "selected word or phrase",
        "knowledgeKind": "vocabulary",
        "knowledgeExplanation": "Chinese explanation"
      },
      "options": {
        "allowDuplicate": false,
        "duplicateScope": "deck"
      },
      "tags": [
        "mac-reading-assistant",
        "sra",
        "es"
      ]
    }
  }
}
```

提交前校验：

- deck 不存在时提示创建 deck，用户确认后调用 `createDeck`。
- 字段值全部 trim；`sentence`、`knowledge`、`knowledgeExplanation` 不能为空。
- `knowledgeKind` 只允许 `grammar`、`phrase`、`vocabulary`。
- 重复卡由 AnkiConnect 返回错误时，UI 显示为可理解的重复提示，不写入失败重试队列。
- 网络连接失败、Anki 未启动、插件缺失、权限拒绝、字段映射错误要分成不同错误文案。

## 14. 设置体系

### 14.1 SettingsView tabs

建议 tabs：

- General
- Reading
- AI
- Vocabulary
- Anki
- Data

### 14.2 存储位置

- API key：Keychain。
- base URL、model、concurrency、prompt：UserDefaults 或 SQLite。
- 书籍、章节索引、知识点、Anki 失败记录：SQLite。
- 章节正文、段落块、句子、AI 结果：Application Support 下的 JSON 快照文件。
- EPUB 原文件、封面、导出文件：Application Support。

### 14.3 设置验收

- 修改设置后立即影响新请求。
- prompt 可恢复默认值。
- Anki 字段映射能自动匹配常见中英文字段名。
- 清空本地库前必须二次确认。
- 导出数据不包含 API key。

## 15. Commands、Toolbar 与快捷键

### 15.1 App commands

建议菜单：

- File
  - Import EPUB
  - Import Text / Markdown
  - Export Resources Markdown
- Reading
  - Previous Page
  - Next Page
  - Previous Chapter
  - Next Chapter
  - Remember Position
  - Toggle Inspector
- Analysis
  - Analyze Current Sentence
  - Analyze Current Page
  - Analyze Whole Chapter
  - Retry Failed Sentences
  - Cancel Analysis
- Anki
  - Add Selection to Anki
  - Retry Failed Anki Notes
  - Open Anki Settings

### 15.2 快捷键建议

- `⌘O`：导入 EPUB。
- `⌘,`：打开 Settings。
- `⌘I`：toggle inspector。
- `⌘R`：解析当前句。
- `⌘⇧R`：解析整章。
- `⌘⇧A`：添加当前知识点到 Anki。
- `← / →`：上一页 / 下一页。
- `⌥← / ⌥→`：上一章 / 下一章。

注意：

- commands 不能成为关键操作的唯一入口，toolbar 或 inspector 中也要可见。
- 同一个快捷键只注册一次。

### 15.3 macOS 26 toolbar 规则

- toolbar 使用系统 SwiftUI `toolbar`，不自建顶部操作栏。
- 相关动作使用 `ToolbarSpacer` 分组，例如阅读导航一组、AI/Anki 一组、窗口/inspector 一组。
- toolbar icon 默认接受系统单色渲染；只有警告、成功、主操作等语义状态才使用 tint。
- 有状态的 toolbar item 可使用 `badge`，例如待重试 Anki 数量或整章解析失败数。
- 搜索如果作用于整套书库，`searchable` 应挂在 `NavigationSplitView` 层级；如果只搜索学习资源，则挂在资源页容器。
- 不做自定义玻璃背景、阴影条或固定渐变遮罩来模仿 toolbar。
- 工具栏按钮必须同时有 tooltip / accessibility label，图标含义不清时使用 `Label`。

## 16. 本地持久化设计

### 16.1 推荐 repository 接口

```swift
protocol LibraryRepository {
  func fetchCollections() async throws -> [Collection]
  func saveCollection(_ collection: Collection) async throws
  func deleteCollection(id: CollectionID) async throws
  func fetchBooks() async throws -> [Book]
  func fetchChapters(bookID: Book.ID) async throws -> [Chapter]
  func saveImportedBook(_ book: Book, chapters: [Chapter], originalFile: URL?) async throws
  func loadChapterSnapshot(chapterID: Chapter.ID) async throws -> ChapterSnapshot
  func saveChapterSnapshot(_ snapshot: ChapterSnapshot, for chapterID: Chapter.ID) async throws
  func updateReadingProgress(bookID: Book.ID, chapterID: Chapter.ID, anchor: ReadingAnchor?) async throws
  func saveKnowledgeResource(_ resource: KnowledgeResource) async throws
  func fetchKnowledgeResources() async throws -> [KnowledgeResource]
  func saveAnkiNoteDraft(_ draft: AnkiNoteDraft) async throws
}
```

### 16.2 文件存储规则

```text
Application Support/
  MacReadingAssistant/
    Books/
      {bookID}/
        original.epub
        cover.jpg
        chapters/
          {chapterID}.json
    TextImports/
      {bookID}/
        original.txt 或 original.md
        chapters/
          {chapterID}.json
    Exports/
    Logs/
```

### 16.3 数据一致性

- 导入书籍时先复制 EPUB 到 app data，再写数据库。
- 写入章节 snapshot 时做 debounce。
- 删除书籍要级联删除章节索引、章节快照、知识点、原文件、封面。
- Anki 添加成功不应自动删除知识点。
- 不添加 sync 状态、远端 ID 或账户字段。

### 16.4 错误处理与日志

定义统一错误类型，UI 层只展示转译后的中文消息：

```swift
enum AppError: Error {
  case importFailed(String)
  case storageFailed(String)
  case databaseFailed(String)
  case analysisFailed(String)
  case vocabularyFailed(String)
  case ankiFailed(String)
  case configurationMissing(String)
}
```

展示策略：

- 导入、解析、Anki 失败：在相关面板中显示 inline banner。
- 删除书籍、清空数据：使用确认 alert。
- API key 缺失：跳转或提示打开 Settings 的 AI tab。
- API key、完整 prompt 请求体、完整原文不写入日志。
- `Logs/` 只记录时间、错误类别、短消息、bookID、chapterID、sentenceID。

### 16.5 本地化、暗色模式与无障碍基线

- 第一版 UI 文案使用简体中文。
- 颜色跟随系统浅色 / 深色模式，优先使用 semantic color 和系统材料，不硬编码纯白背景。
- macOS 26 下不要自定义替代系统 Liquid Glass 的半透明背景。
- 所有 toolbar button、章节行动作、词汇 token button 要有 accessibility label。
- 阅读器字号设置不能破坏 VoiceOver 顺序。
- 不做英文 UI 本地化，但新增文案要集中到可替换位置，避免散落在复杂逻辑中。
- 自定义 `glassEffect` 控件必须验证高对比度、减少透明度、VoiceOver 和键盘 focus 状态。
- App icon 后续使用 Icon Composer 路线制作 Liquid Glass 分层图标；第一版可先使用简洁占位图标，但不能提交低清位图。

## 17. 阅读体验验收清单

第一版必须满足：

- 打开 App 后能看到书库和最近阅读。
- 导入 EPUB、纯文本或 Markdown 后可直接进入第一章阅读。
- 章节列表旁可以直接触发整章解析，并显示解析进度。
- 阅读界面不被工具按钮压住。
- 点击句子后 inspector 稳定显示解释。
- 点击词汇后 inspector 稳定显示词汇解释面板。
- 没有解析结果的句子能触发单句解析。
- 已解析句子能显示语法、内容、知识点。
- 选词查义不会打断阅读位置。
- AI 解析和查词结果不会自动污染学习资源。
- Anki 添加结果有明确成功/失败反馈。
- 关闭 App 再打开能回到上次书籍和章节。
- 字号调整后阅读区域稳定，没有明显跳动。
- macOS 26 下 sidebar、toolbar、inspector 呈现系统原生 Liquid Glass 气质，正文保持清晰克制。

## 18. 开发阶段拆分

### Phase 0：技术验证

- 新建独立 macOS 项目。
- 验证 SQLite + Application Support 章节 JSON 快照。
- 验证 EPUB 自研导入路线。
- 验证 Markdown / 纯文本导入规则。
- 验证 SwiftUI 原生阅读流中的句子点击、词汇点击和右侧 inspector 联动。
- 验证 macOS 26 Liquid Glass 基础外观：系统 toolbar、sidebar、inspector、Settings 均没有被自定义背景破坏。
- 验证 AnkiConnect 请求。
- 验证 Keychain 存取 API key。

产出：

- spike notes。
- 最终 EPUB 导入与 SwiftUI 阅读流细节决策。

Phase 0 gate：

- `spike-notes.md` 必须写入新项目根目录。
- 必须包含：SQLite + snapshot 验证结果、EPUB 导入样本结果、文本 / Markdown 导入样本结果、SwiftUI token 阅读流截图或描述、Liquid Glass toolbar/sidebar/inspector 截图或描述、AnkiConnect 请求结果、Keychain 读写结果。
- 必须明确每个 spike 的结论：通过、失败、需要替代方案。
- Phase 0 完成后先停下，由用户确认后再进入 Phase 1。
- 未经过确认，不允许直接创建完整业务模块。

### Phase 1：项目骨架

- 建 SwiftUI App。
- 建 folder structure。
- 接 `WindowGroup`、`Settings`、`commands`。
- 实现空书库、空阅读器、空 inspector。
- 建立 macOS 26 Liquid Glass 基线，不手写 sidebar / toolbar / inspector 背景。
- 接入 app-wide dependency container。

验收：

- App 可 build/run。
- 主窗口、Settings、commands 都能打开。
- 系统 toolbar、sidebar、inspector 在 macOS 26 上呈现原生 Liquid Glass 外观。

### Phase 2：本地书库

- 实现 Models。
- 实现 SQLiteLibraryRepository。
- 实现 ChapterSnapshotCodec。
- 实现 LibraryStore。
- 保存/读取 Book、Chapter 索引、ChapterSnapshot、KnowledgeResource、AnkiNoteDraft。
- 文件复制到 Application Support。

验收：

- 重启后数据仍在。
- 删除书籍能清理关联数据。

### Phase 3：导入器

- 实现 EpubImporter。
- 实现 TextMarkdownImporter。
- 抽 metadata、cover、toc/spine。
- 抽 paragraph blocks。
- 分句并建立 sentence mapping。
- 导入报告。

验收：

- 至少 3 本 EPUB 可导入。
- 至少 1 个 `.txt` 和 1 个 `.md` 可导入并生成章节。
- TOC 和 spine fallback 都覆盖。

### Phase 4：阅读器

- 实现 ReaderRootView。
- 实现章节阅读流。
- 实现句子点击。
- 实现 inspector。
- 实现阅读位置记录。

验收：

- 读书体验优先，界面少干扰。
- Arrow / PageUp / PageDown 可翻页。
- inspector 不抢走阅读主视线。

### Phase 5：AI 解析与查词

- 实现 Settings 中 AI 配置。
- 实现 PromptBuilder。
- 实现 AIAnalysisService。
- 实现 AnalysisRunStore。
- 实现 VocabularyLookupService。
- 支持章节列表整章解析。
- 支持阅读 inspector 单句解析。
- 支持当前页解析。
- 支持取消、重试、错误展示。

验收：

- 单句解析可用。
- 整章解析可用，且不阻塞阅读器打开。
- 当前页解析可用。
- 查词结果可缓存。
- AI 结果只在用户收藏或添加 Anki 时进入学习资源。

### Phase 6：Anki

- 实现 AnkiConnectClient。
- 实现 AnkiPayloadBuilder。
- 实现 note type 创建/修复。
- 实现字段映射。
- 实现添加当前知识点到 Anki。
- 实现失败重试。

验收：

- Anki 打开时可直接添加。
- Anki 未打开时提示清楚。
- 字段缺失时提示设置路径。

### Phase 7：学习资源与导出

- 实现 KnowledgeResourcesView。
- 支持筛选、搜索、删除、重新添加到 Anki。
- 支持 Markdown 导出。

验收：

- 从阅读中保存的知识点能在资源页看到。
- Markdown 导出包含来源句子、书名、章节、解释。

### Phase 8：打磨与测试

- 键盘可达性。
- 错误信息统一。
- 暗色模式与 Liquid Glass。
- 大章节性能。
- 多窗口状态。
- 打包签名。
- Icon Composer / app icon 最小可交付方案。

验收：

- App 可持续阅读一小时不明显卡顿。
- 大章节切换、重启恢复、Anki 失败重试都稳定。
- macOS 26 下 sidebar、toolbar、inspector、Settings 没有自定义背景与系统材料冲突。

## 19. 关键风险

### 19.1 EPUB 渲染

如果追求高度还原 EPUB 样式，WebKit/Readium 更有优势。  
如果追求句子点击、查词、Anki 链路，SwiftUI 原生阅读流更可控。

建议先把学习链路做顺，再增加 EPUB 样式保真。

### 19.2 SwiftUI 原生阅读流的文本交互

第一版要求点击词汇后在右侧 inspector 显示解释，因此阅读流从一开始就采用 token button / text run 组合。  
主要风险是排版抖动、VoiceOver 顺序、长段落性能和 token button 的视觉克制，需要在 Phase 0 专门验证。

### 19.3 SQLite + 文件快照一致性

SQLite 负责索引，章节 JSON 负责大内容。  
风险在于两者写入时机不一致。导入、删除、解析整章、取消解析时，需要明确事务边界和失败恢复策略。

### 19.4 AnkiConnect

AnkiConnect 是本机插件，用户环境差异较大。  
需要把「Anki 未启动」「插件未安装」「permission denied」「字段映射错误」分开提示。

### 19.5 AI 输出稳定性

当前 Web 版已经做了 JSON fallback。  
macOS 版需要继续保留结构化解析校验，失败时允许用户重试，不要把坏结果静默存入数据库。

### 19.6 后续日语扩展

日语不进第一版，但当前 Web 版已经证明它会牵涉 tokenizer、furigana、chunkAnalysis、Anki 字段和 prompt 校验。  
后续扩展日语时应作为独立阶段处理，避免挤进通用外语阅读器的第一版地基。

### 19.7 Liquid Glass 与阅读可读性

macOS 26 的 Liquid Glass 应服务于导航和操作层，不应变成阅读正文的装饰层。  
主要风险是过度透明、过度浮动、过多 tint 和过密 toolbar 让阅读器失去安静感。第一版应坚持系统控件优先，阅读正文区域保持稳定、低干扰、可长时间阅读。

## 20. 第一版 Done Criteria

达到下面标准，才算 macOS 本地阅读 App 第一版完成：

- 新项目位于当前仓库之外。
- 最低目标系统为 macOS 26+。
- App 使用原生 macOS 窗口、Settings、commands。
- App 使用 macOS 26 Liquid Glass-native SwiftUI 基线。
- 可导入 EPUB、纯文本、Markdown 并建立本地书库。
- 可打开章节并稳定阅读。
- 可在章节列表旁解析整章。
- 可点击句子查看解释。
- 可点击词汇，在右侧 inspector 查看词汇解释。
- 可对未解析句子发起 AI 解析。
- 可对词或知识点发起查词。
- 可保存知识点。
- 可连接 AnkiConnect。
- 可创建或修复 SRA 通用外语 note type。
- 可添加知识点到 Anki。
- API key 存 Keychain。
- 书库与阅读进度重启后保留。
- 数据使用 SQLite + Application Support 文件快照。
- 不自动保存 AI / 查词结果到学习资源。
- 没有依赖 Supabase 登录。
- 没有云同步字段或远端账户假设。
- 没有日语专用 token / furigana / chunk analysis 主流程。
- 没有复用当前 Web app 作为壳。
- 没有手写伪 Liquid Glass sidebar、toolbar 或 inspector。

## 21. 下一步建议

先做 Phase 0。  
最先要验证的四件事：

1. SwiftUI 原生阅读流：段落、句子点击、词汇点击和右侧 inspector 联动。
2. 本地持久化：SQLite 索引 + Application Support 章节 JSON 快照的一致性。
3. macOS 26 Liquid Glass：系统 toolbar、sidebar、inspector、Settings 的原生外观是否稳定。
4. AnkiConnect：sandbox 下访问 `127.0.0.1:8765` 的打包行为。

这四件事像地基的四根桩，先打稳，后面的阅读体验才不会在中途返工。
