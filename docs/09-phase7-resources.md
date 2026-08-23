# Phase 7 — 学习资源 + 导出

> **Codex Goal**：`完成 Phase 7：学习资源管理页 + Markdown 导出，参考 docs/00-product-spec.md §ResourcesView 和 docs/01-data-models.md §KnowledgeResource`
> **依赖**：`docs/00-product-spec.md`、`docs/01-data-models.md`
> **前置**：Phase 6 完成

## 目标

实现学习资源列表页面和 Markdown 导出功能。第一版轻量，不做复杂后台。

## KnowledgeResourcesView

位置：sidebar 导航入口或独立 tab。第一版作为 sidebar 中的一个列表项。

### 功能
- 列表展示所有 `KnowledgeResource`，每行显示：
  - `text`（知识点文本）
  - `kind` 标签（语法 / 搭配 / 词汇，用不同图标或颜色）
  - `bookTitle` + `chapterTitle`（来源信息）
  - `savedAt`（保存时间）
- 筛选：按 `kind` 过滤（grammar / phrase / vocabulary）。
- 搜索：按 `text` 或 `explanation` 搜索。
- 删除：swipe 或右键菜单删除。
- 重新添加到 Anki：点击后触发 `AnkiStore.addToAnki`。

### 状态
- 从 `LibraryStore.knowledgeResources` 读取（`@Published`）。
- 筛选和搜索在 Store 层或 ViewModel 层做。

## Markdown 导出

### ResourceExporter (Services/)

`MarkdownExporter.swift`（放在 Support/）：
- 输入：选中的 `[KnowledgeResource]`。
- 输出：Markdown 文件。
- 格式：

```markdown
# 学习资源导出 — {date}

## {bookTitle} — {chapterTitle}

### {text}（{kind}）
- 解释：{explanation}
- 语法：{grammarText}
- 含义：{meaning}
- 来源句子：{sentenceText}

---
```

- 用户选择导出路径（`NSSavePanel`）。
- 全文或按筛选结果导出。
- 导出数据不包含 API key。

## 验收

- [ ] 从阅读中收藏的知识点能在资源页看到。
- [ ] 按 grammar/phrase/vocabulary 可筛选。
- [ ] 搜索可用。
- [ ] 可删除知识点。
- [ ] 可从资源页重新添加到 Anki。
- [ ] Markdown 导出包含来源句子、书名、章节、解释。
- [ ] 导出文件不含 API key。

## 停止条件

- 无阻塞条件。此 Phase 独立，不依赖外部服务。
