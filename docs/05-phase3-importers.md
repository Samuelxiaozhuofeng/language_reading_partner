# Phase 3 — 导入器

> **Codex Goal**：`完成 Phase 3：EPUB + 纯文本 + Markdown 导入器，参考 docs/00-product-spec.md §导入与渲染策略 和 docs/01-data-models.md`
> **依赖**：`docs/00-product-spec.md`、`docs/01-data-models.md`
> **前置**：Phase 2 完成

## 目标

实现 `EpubImporter` 和 `TextMarkdownImporter`，能从文件导入书籍并生成完整的 `ChapterSnapshot`（含段落块、分句、句子映射）。

## EpubImporter

### 流程
1. 用户选择 `.epub` 文件（`NSOpenPanel`，security-scoped access）。
2. 复制原文件到 `Application Support/Books/{bookID}/original.epub`。
3. 解压 EPUB，解析 `META-INF/container.xml` → OPF → manifest → spine → nav/toc。
4. 提取 metadata：title、author、language、cover image。
5. 遍历 spine items，提取 XHTML。
6. 清洗 HTML：过滤 script、style、nav、aside、媒体标签。
7. 抽段落块：识别 heading、paragraph、quote、list item、preformatted。
8. 分句：对每个段落调用 `SentenceSegmenter`，生成 `Sentence` 数组，建立 `ParagraphBlock.sentenceIDs` 映射。
9. 组装 `ChapterSnapshot` 写入 JSON。
10. 写入 SQLite：Book + Chapters。
11. 封面缓存为图片文件。

### 验收
- [ ] 至少 3 本不同来源的 reflowable EPUB 可导入。
- [ ] metadata 完整（title、author、language）。
- [ ] TOC 有效时按 TOC 分章。
- [ ] TOC 缺失时按 spine 分章。
- [ ] heading/paragraph/quote/list item/preformatted 正确识别。
- [ ] `paragraphBlocks[].sentenceIDs` 与同快照 `sentences[].id` 一致。
- [ ] 原 EPUB 文件保存在 `original.epub`。
- [ ] 导入失败时有明确错误信息。

## TextMarkdownImporter

### 流程
1. 用户选择 `.txt` 或 `.md` 文件。
2. 复制原文件到 `Application Support/TextImports/{bookID}/`。
3. 解析文本：
   - `.txt`：按空行分段，所有段落同属一个章节。
   - `.md`：保留标题层级、引用、列表、代码块结构。`# ` 和 `## ` 标题作为章节边界。
4. 分句并生成 `ChapterSnapshot`。

### 验收
- [ ] 至少 1 个 `.txt` 文件可导入。
- [ ] 至少 1 个 `.md` 文件可导入，标题层级决定章节。
- [ ] 引用、列表、代码块保留语义。

## SentenceSegmenter

`Services/SentenceSegmenter.swift`：

- 输入：`String`。输出：`[String]`，每个元素一句，保留句末标点。
- 缩写列表常量化：`Sr.`、`Dra.`、`Prof.` 等。
- 处理 `;` 和 `…` 作为软断句。
- 过滤空字符串、纯标点、纯空白片段。
- 段落边界由调用方（importer）管理，分句器不返回段落信息。

## 导入 UI

在 `LibrarySidebarView` 或 `BookOrChapterListView` 中提供导入入口：
- "Import EPUB" 按钮/菜单项 → `NSOpenPanel`（过滤 `.epub`）。
- "Import Text / Markdown" 按钮/菜单项 → `NSOpenPanel`（过滤 `.txt`、`.md`）。
- 导入完成后刷新书架列表。

## 验收

- [ ] 至少 3 本 EPUB 可导入，TOC 和 spine fallback 都覆盖。
- [ ] 至少 1 个 `.txt` 和 1 个 `.md` 可导入并生成章节。
- [ ] 导入后书架列表立即显示新书。
- [ ] 导入失败时错误信息可读。
- [ ] 原文件保留在 Application Support。

## 停止条件

- 连续 2 次不同 EPUB 导入失败（非同一原因），停止并修复导入器。
