# Phase 5 — AI 解析与查词

> **Codex Goal**：`完成 Phase 5：AI 句子解析 + 词汇查词，参考 docs/01-data-models.md §AI Wire Format 和§AnalysisRunStore 状态机`
> **依赖**：`docs/01-data-models.md`
> **前置**：Phase 4 完成（阅读器和 inspector 已就位）

## 目标

实现完整的 AI 服务层：句子解析、词汇查词、并发控制、结果缓存、inspector 联调。

## 服务实现

### PromptBuilder (Domain/)

```swift
struct AnalysisPromptInput {
  let sentence: String; let previousSentence: String?; let nextSentence: String?
  let documentTitle: String?; let chapterTitle: String?
}
```

- 面向中文母语者，描述为多语言阅读助手。
- 输出 JSON，字段：`grammar`、`meaning`、`highlights`（最多 4 个）。

### AIAnalysisService (Services/)

- 调用 OpenAI 兼容 `chat/completions` 接口。
- 配置项从 Settings 读取：base URL、API key（Keychain）、model、temperature 0.2。
- `StructuredResultParser` 解析响应内容为 `AnalysisResult`。
- 解析规则（详见 `01-data-models.md`）：
  - `grammar` 和 `meaning` 至少一个非空。
  - `highlights` 非数组按空数组处理。
  - `kind` 不在允许值默认归 `grammar`。
  - `text`/`explanation` 为空 highlight 丢弃。
  - 同 `{kind}:{lowercased text}` 只保留第一个。
  - 解析失败句子状态置 `error`，不写 `results`。

### StructuredResultParser (Domain/)

- 输入：raw JSON string。
- 输出：validated `AnalysisResult` 或 throw。
- JSON 修复：处理常见的 AI 输出问题（多余逗号、未闭合引号、markdown code fence 包裹）。

### AnalysisRunStore (Stores/)

严格遵循 `01-data-models.md` §AnalysisRunStore 状态机。

状态枚举：`AnalysisRunPhase`（idle → validating → running → completed/failed/cancelling → idle）
Scope：`AnalysisScope`（sentence / page / chapter）

入口和约束：
- 同一时间一个 chapter 只允许一个整章解析任务。
- 单句重试不与整章解析并行。
- cancel 后 queued/running 句子恢复到开始前状态。
- 每完成一批句子，debounce 保存 chapter snapshot（2 秒）。

并发控制：
- 全局 concurrency 配置，每个 chapter 解析最多 N 个并发请求。
- auto retry：单个句子失败后自动重试 1 次，仍失败则标记 error。

UI 入口：
- **解析整章**：章节列表行按钮 → 对 chapter 所有 idle/error 句子发起批量解析。
- **解析本句**：inspector 按钮 → 对当前句子发起解析。
- **解析当前页**：toolbar/菜单 → 对当前可见页句子发起解析。

### VocabularyLookupService (Services/)

- 输入：word/phrase string。
- 调用 AI 接口（可共用或独立 model），响应格式 `{ "explanation": "string" }`。
- 结果缓存：本地字典 `[String: String]`，key 为 `{sentenceID}:{word}`。
- 查词结果不自动进入学习资源。

## Settings UI

Settings → AI tab：
- base URL（默认 `https://api.openai.com/v1`）
- API key（SecureField，存 Keychain）
- Model（默认 `gpt-4.1-mini`）
- Concurrency（默认 3）
- Batch size（默认 10）
- Previous/Next sentence count（默认 1）
- Prompt 文本（可编辑，可恢复默认值）
- 「恢复默认 Prompt」按钮

Settings → Vocabulary tab：
- 是否共用解析模型（默认是）
- 独立 model（如果不共用）
- 独立 prompt

## 验收

- [ ] Settings 中配置 AI endpoint 和 key 后，单句解析可用。
- [ ] 章节列表「解析整章」可用，进度实时显示。
- [ ] 整章解析不阻塞阅读器打开。
- [ ] 「解析当前页」可用。
- [ ] 解析失败句子可单独重试。
- [ ] Cancel 分析后句子状态恢复。
- [ ] 查词结果缓存（同一句同一词不重复请求）。
- [ ] 查词结果在 inspector 中显示，用户收藏后才进入学习资源。
- [ ] AI 解析和查词结果不会自动污染学习资源。
- [ ] API key 不出现于日志、plist 或导出文件中。
- [ ] 改设置后立即影响新请求。

## 停止条件

- AI 接口连续 3 次返回无法解析的响应时，停止并检查 prompt/parser。
- API key 缺失时不做请求，直接提示用户配置。
