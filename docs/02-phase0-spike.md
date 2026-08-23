# Phase 0 — 技术验证 Spike

> **Codex Goal**：`完成 Phase 0 技术验证，产出 spike-notes.md，参考 docs/00-product-spec.md 和 docs/01-data-models.md`
> **依赖**：`docs/00-product-spec.md`、`docs/01-data-models.md`
> **产出**：`spike-notes.md`（写入新项目根目录）

## 目标

在 `/Users/samdagreat/Documents/vibe coding/MacReadingAssistant` 新建 macOS 项目，验证四项核心技术可行性。每个 spike 必须有明确结论：通过 / 失败 / 需要替代方案。

## Spike 1：SQLite + Application Support JSON 快照

- 创建 SQLite 数据库，建 `books` 和 `chapters` 表（参考 `01-data-models.md` §SQLite Schema）。
- 创建 Application Support 下的 `Books/{bookID}/chapters/{chapterID}.json` 目录结构。
- 写入一个 `ChapterSnapshot` JSON，包含 2 个 `ParagraphBlock`、4 个 `Sentence`、1 个 `AnalysisResult`。
- 从 SQLite 读 chapter 后用 `snapshotPath` 加载 JSON 快照并 decode。
- 验证：删除 SQLite row 后能 clean up 对应的 JSON 文件目录。

## Spike 2：EPUB 自研导入

- 解压一个真实 EPUB（至少 3 章）。
- 解析 container.xml → OPF → manifest → spine → nav/toc。
- 提取 XHTML，清洗 script/style/nav/aside 标签。
- 识别 heading、paragraph、quote、list item、preformatted。
- 抽取段落块并按 §10 分句策略分句（处理 `Sr.`、`Dra.`、`;`、`…`）。
- 生成 `ChapterSnapshot` JSON。
- 记录：哪些 EPUB 结构成功保留，哪些丢失或降级。

## Spike 3：文本 / Markdown 导入

- 导入一个 `.txt`，按空行分段，生成章节。
- 导入一个 `.md`，保留标题层级、引用、列表、代码块结构。
- 分句并生成 `ChapterSnapshot`。

## Spike 4：SwiftUI Token 阅读流 + Inspector 联动

- 构建阅读视图层级：`ChapterReadingView → ReadingParagraphView → ReadingSentenceView → WordTokenView`。
- 对一段 500+ 字的西语文段做 word tokenization。
- 点击 WordToken 时设置 `selectedVocabularyText`，右侧 inspector 弹出显示该词。
- 点击句子空白/标点时选中整句，inspector 切换到句子解释视图。
- 验证：长段落 token button 排版与原文一致；VoiceOver 顺序正确。
- 记录 tokenization 性能（500 字、2000 字、5000 字）。

## Spike 5：macOS 26 Liquid Glass 基线

- 创建一个最小 SwiftUI App：`WindowGroup` + `NavigationSplitView` + `Settings` scene。
- sidebar 使用系统 source-list 外观，不做自定义背景。
- toolbar 使用系统 `toolbar`，分组使用 `ToolbarSpacer`。
- 验证 `.inspector(isPresented:)` 附着在 detail 上的行为和宽度调整。
- 截图：sidebar、toolbar、inspector、Settings 在 macOS 26 下的默认外观。
- 尝试在阅读视图中加一个浮动页码控件使用 `glassEffect` + `GlassEffectContainer`。

## Spike 6：AnkiConnect 请求

- 对 `http://127.0.0.1:8765` 发送 `version` 请求。
- 发送 `requestPermission`。
- 读取 `deckNames`、`modelNames`。
- 创建 "SRA General Foreign Language" note type（字段、CSS、card template 见 §13.6）。
- 发送 `addNote` 添加一条测试 note。
- 处理异常场景：Anki 未启动时的网络错误、版本不匹配时的错误提示。
- 如果开启 App Sandbox，验证 outgoing network client entitlement 是否足够。

## Spike 7：Keychain 存取

- 写入一个模拟 API key。
- 读回。
- 删除。
- 验证：数据不进入 plist、UserDefaults 或日志。

## Gate 条件

**spike-notes.md 必须写入新项目根目录**，内容必须包含：
- 每个 spike 的验证步骤和结果（通过/失败/替代方案）。
- SQLite + snapshot 一致性结论。
- EPUB 导入样本结果（哪个 EPUB，哪些结构保留/丢失）。
- 文本/Markdown 导入样本结果。
- SwiftUI token 阅读流截图或行为描述 + tokenization 性能数据。
- Liquid Glass toolbar/sidebar/inspector 截图或描述。
- AnkiConnect 完整请求链结果 + 异常场景处理记录。
- Keychain 读写结果。

## 停止条件

- Phase 0 完成后**必须先停下**，由用户确认 spike 结论后再进入 Phase 1。
- 如果 SwiftUI token 阅读流在 Phase 0 被证明**明确不可行**，不允许 agent 自行切换到 WebKit/Readium——必须记录原因并等待用户决策。
