# Phase 6 — AnkiConnect 集成

> **Codex Goal**：`完成 Phase 6：AnkiConnect 直连集成，参考 docs/01-data-models.md §AnkiConnect Wire Format 全部子节`
> **依赖**：`docs/01-data-models.md`
> **前置**：Phase 5 完成（有可添加到 Anki 的解析和查词内容）

## 目标

实现完整 AnkiConnect 客户端：连接检查、note type 管理、字段映射、单条添加、失败重试。

## 服务实现

### AnkiConnectClient (Services/)

统一请求外壳：`POST http://127.0.0.1:8765`，`{ "action": "...", "version": 6, "params": {} }`。

连接流程：
1. `version` → <6 提示升级。
2. `requestPermission` → 未授权提示用户在 AnkiConnect 中允许。
3. `deckNames` → 获取可用 deck 列表。
4. `modelNames` → 获取可用 note type。
5. `modelFieldNames` → 获取字段列表（用于字段映射）。

错误分类提示：
- Anki 未启动（网络错误）
- 插件未安装（连接拒绝或无响应）
- permission denied
- 字段映射错误
- 重复卡片
- 其他 AnkiConnect 错误

### AnkiPayloadBuilder (Domain/)

严格遵循 `01-data-models.md` §addNote Payload 契约。

输入：`KnowledgeResource` + 当前句 `AnalysisResult` + Anki 设置。
输出：`AnkiNotePayload`。

提交前校验：
- deck 不存在提示创建，用户确认后调用 `createDeck`。
- `sentence`、`knowledge`、`knowledgeExplanation` 不能为空。
- `knowledgeKind` 只允许 grammar/phrase/vocabulary。
- 字段全 trim。

### AnkiNoteTypeService (Services/)

默认 Note Type：**SRA General Foreign Language**。

创建/修复逻辑（严格遵循 §13.6）：
- note type 不存在 → `createModel` 创建（字段、CSS、card template 见 `01-data-models.md`）。
- note type 存在但缺字段 → 提示用户确认后 `modelFieldAdd`。
- 用户选择已有 note type → 用 `modelFieldNames` 做字段映射，不强制改用户 note type。
- 缺少 sentence / knowledge / knowledgeExplanation 时禁止提交。

### AnkiStore (Stores/)

- 持有 `AnkiConnectClient`、`AnkiPayloadBuilder`。
- `addToAnki(resource:analysisResult:)` → 构造 payload → `addNote` → 更新本地状态。
- 成功：`KnowledgeResource` 标记已添加，可选更新 `AnkiNoteDraft` status = imported。
- 失败（非重复）：写入 `AnkiNoteDraft` status = failed，存入 `lastError`。
- 失败（重复）：UI 显示 "该卡片已存在"，不写入失败重试队列。
- 失败重试：`retryFailedDrafts()` → 遍历 failed drafts 重新 `addNote`。

### Anki Settings UI

Settings → Anki tab：
- Endpoint（默认 `http://127.0.0.1:8765`）
- Deck name（下拉从 `deckNames` 获取）
- Note type（下拉从 `modelNames` 获取）
- 字段映射（grid：Anki 字段 ↔ 数据字段，自动匹配常见中英文字段名）
- 「创建 / 修复 SRA Note Type」按钮
- 「测试连接」按钮（调 `version` + `requestPermission`）

### Inspector Anki 操作

在 `SentenceInspectorView` 的操作区：
- 「添加到 Anki」按钮 → 触发 AnkiStore.addToAnki。
- 显示提交状态：pending → submitting → success/failed。
- 失败时显示具体错误信息。

## 验收

- [ ] Anki 启动时可连接并获取 deck/note type 列表。
- [ ] Anki 未启动时提示清晰（不是 generic error）。
- [ ] 可创建 "SRA General Foreign Language" note type。
- [ ] 可修复已有 note type（添加缺失字段）。
- [ ] 可选择已有 note type 并做字段映射。
- [ ] 单条 `addNote` 成功后可看到 Anki 中出现新卡片。
- [ ] 重复卡片提示 "已存在"，不进入失败队列。
- [ ] 添加失败时写入 `AnkiNoteDraft`，可重试。
- [ ] 不同错误（未启动、插件缺失、权限、字段映射）分开提示。
- [ ] Sandbox 下 `127.0.0.1:8765` 请求正常（需 outgoing network client entitlement）。

## 停止条件

- AnkiConnect 连接连续 3 次超时（Anki 未启动），不反复重试，提示用户后暂停。
- addNote 返回未知错误格式时，记录原始 response 但只对用户显示转译后消息。
