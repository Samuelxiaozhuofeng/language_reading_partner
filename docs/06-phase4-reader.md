# Phase 4 — 阅读器 + Inspector

> **Codex Goal**：`完成 Phase 4：SwiftUI 原生阅读流 + SentenceInspectorView，参考 docs/00-product-spec.md §主界面布局和§阅读文本渲染策略`
> **依赖**：`docs/00-product-spec.md`、`docs/01-data-models.md`
> **前置**：Phase 3 完成（需有可读的导入内容）

## 目标

实现完整阅读体验：从书架选书进入章节阅读，token 级文本交互，句子和词汇 inspector 联动，阅读进度记录。

## 阅读视图层级

```
ReaderContainerView
  ChapterReadingView
    ReadingParagraphView
      ReadingSentenceView
        WordTokenView / punctuation Text
```

### ReaderContainerView

- 顶部：书名 + 章节标题 + 阅读进度。
- 主体：`ChapterReadingView`。
- 键盘导航：`←/→` 翻页，`⌥←/⌥→` 切换章节，PageUp/PageDown 翻页。
- 连续滚动模式作为第二显示模式（toggle 放在 toolbar 或菜单）。
- 阅读器 toolbar：导入、解析、inspector toggle、字号调整、阅读模式切换。
- 字号、版心宽度、行距从 `SettingsStore` 读取。

### ChapterReadingView

- 加载 `ChapterSnapshot`。
- 遍历 `paragraphBlocks`，每个块生成 `ReadingParagraphView`。
- 翻页模式：根据字号和版心计算分页，一次显示一页。
- 连续滚动模式：`ScrollView` + `LazyVStack`。

### ReadingParagraphView

- 根据 `ParagraphBlock.kind` 选择视觉样式：
  - `heading`：字号 + 字重区分，`headingLevel` 控制层级。
  - `quote`：左侧竖线 + 缩进。
  - `listItem`：bullet 前缀。
  - `preformatted` / `code`：等宽字体 + 背景区分。
- 遍历 `sentenceIDs`，每个句子生成 `ReadingSentenceView`。

### ReadingSentenceView

- 显示一句完整的句子文本。
- 点击句子空白或标点区域 → 设置 `selectedSentenceID` → 打开 inspector 句子解释面板。
- 未解析句子显示 subtle 标记（灰色虚线底边或小图标）。

### WordTokenView

- 由 `TextTokenization.tokenizeWords(_:)` 生成 token 列表。
- 每个 token 是纯文本外观的 button，无边框。
- 点击 token → 设置 `selectedVocabularyText` → inspector 切换到词汇解释面板。
- hover：underline 或淡色背景。focus：Accessibility 可访问。
- token 不使用玻璃效果。

### TextTokenization (Domain/)

```swift
enum TextToken { case word(String); case punctuation(String); case whitespace(String) }
protocol TextTokenizer { func tokenize(_ text: String) -> [TextToken] }
```

- 区分 word、标点、空白。
- 西语重音字符正确保留。
- `Sentence.text` 拆分后所有 token 拼接等于原文。

## SentenceInspectorView

附着在 `ReaderContainerView` 上：
```swift
.inspector(isPresented: $inspectorPresented) { SentenceInspectorView(...) }
```

默认宽度 360pt，允许用户拖拽（300-480pt）。

根据 `selectedSentenceID` 和 `selectedVocabularyText` 显示不同内容：

### 句子模式（selectedSentenceID != nil）
- 原句文本。
- 状态标签：未解析 / 解析中 / 已完成 / 失败。
- 语法解释（`AnalysisResult.grammar`）。
- 内容理解（`AnalysisResult.meaning`）。
- 高亮知识点列表（`AnalysisResult.highlights`）。
- 「解析本句」按钮（句子未解析时显示）。
- 「重试」按钮（句子解析失败时显示）。

### 词汇模式（selectedVocabularyText != nil）
- 选中的词 / 短语。
- 查词状态：查询中 / 已完成 / 失败。
- 中文解释。
- 来源句子上下文（显示原句并高亮选中词）。
- 「收藏」按钮 → 创建 `KnowledgeResource`。
- 「添加到 Anki」按钮。

### 操作区（两种模式共用）
- Anki 操作：添加当前知识点到 Anki，显示提交状态和结果反馈。
- 收藏操作：保存到学习资源。

## 阅读进度

- 每翻页或滚动到新位置时更新 `Chapter.lastReadEnd` 和 `resumeAnchor`。
- `ReadingAnchor` 记录：`sentenceID`、`sentenceIndex`、`sentenceSnippet`、`paragraphID`、`updatedAt`。
- 回写 debounce（2 秒），避免频繁 SQLite 写入。

## 验收

- [ ] 从书架选书可进入第一章阅读。
- [ ] 章节内 Arrow/PageUp/PageDown 可翻页。
- [ ] 连续滚动模式可用。
- [ ] 点击句子后 inspector 稳定显示解释（或「未解析」状态）。
- [ ] 点击词汇后 inspector 显示词汇解释面板（或「未查询」状态）。
- [ ] heading / quote / list / preformatted 样式有视觉区分。
- [ ] inspector 不抢走阅读主视线（不是 popover/modal）。
- [ ] 阅读器正文安静、清晰——无玻璃背景，无大面积装饰。
- [ ] 关闭再打开 App 回到上次阅读位置。
- [ ] 字号调整后阅读区域稳定无明显跳动。

## 停止条件

- 如果 token 级点击在 5000 字章节上出现明显卡顿（>500ms 响应延迟），记录性能数据并停止。
- inspector 布局抖动导致阅读正文重排时，停止并修复。
