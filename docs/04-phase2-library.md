# Phase 2 — 本地书库持久化

> **Codex Goal**：`完成 Phase 2：实现 SQLite 书库和 JSON 快照持久化，参考 docs/01-data-models.md 全部内容`
> **依赖**：`docs/01-data-models.md`（`docs/00-product-spec.md` 为背景参考）
> **前置**：Phase 1 完成

## 目标

实现完整的本地持久化层：SQLite 索引 + Application Support 文件快照。所有 model、repository、codec 就位，可通过 repository 接口读写数据，重启后数据保留。

## 任务清单

### 1. 实现所有 Swift Models

依据 `01-data-models.md` §类型别名与枚举 和 §Swift Struct 骨架，在 `Models/` 下创建：

- `Collection.swift`
- `Book.swift`
- `Chapter.swift`
- `ParagraphBlock.swift`（snapshot model）
- `Sentence.swift`（snapshot model）
- `AnalysisResult.swift`（snapshot model，含 `AnalysisHighlight`）
- `KnowledgeResource.swift`
- `AnkiNoteDraft.swift`（含 `AnkiNotePayload`）
- `ReadingAnchor.swift` + `SentenceRange.swift`

所有枚举（`BookLanguage`、`SourceType`、`AnalysisState`、`SentenceStatus`、`BlockKind`、`ResourceKind`、`AnkiDraftStatus`）放在各自的 model 文件或独立 `Types.swift` 中。

所有时间字段使用 `Date`，SQLite 存储时统一 ISO 8601。

### 2. 实现 ChapterSnapshot Codec

`Domain/ChapterSnapshotCodec.swift`：
- `ChapterSnapshot` struct 严格遵循 `01-data-models.md` §ChapterSnapshot JSON schema。
- 从 JSON 文件 decode / encode。
- 验证：`paragraphBlocks[].sentenceIDs` 指向 `sentences[].id`。
- 验证：`results` key 等于 `results[key].sentenceID`。

### 3. 实现 SQLiteLibraryRepository

`Services/SQLiteLibraryRepository.swift`，严格实现 `01-data-models.md` §LibraryRepository 接口。

SQLite schema 执行 `01-data-models.md` §SQLite Schema（含所有索引）。

约束：
- UUID 存为 TEXT。
- 枚举存为 rawValue TEXT。
- `ReadingAnchor` 存为 JSON TEXT column。
- `AnkiNoteDraft.payloadJSON` 就是 `AnkiNotePayload` JSON string。
- 所有写操作用 SQLite transaction。

### 4. 实现 FileStorageService

`Services/FileStorageService.swift`，严格实现 `01-data-models.md` §FileStorageService API。

文件结构遵循 §文件存储结构。

错误策略：
- 文件复制失败不写 SQLite。
- SQLite 写入失败清理 book directory。
- 保存 snapshot 先写临时文件再 atomic replace（用 `FileManager.replaceItemAt`）。
- 删除书籍先删 SQLite row 再尽力删目录。

### 5. 实现 LibraryStore

`Stores/LibraryStore.swift`：
- 持有 `LibraryRepository` 和 `FileStorageService`。
- 暴露 `@Published` 的 books、chapters、collections、knowledgeResources。
- 提供 CRUD action：addBook、deleteBook、updateProgress、saveKnowledge 等。

### 6. 数据一致性策略
- 导入书籍时先复制文件到 app data，再写 SQLite。
- 删除书籍级联清理章节、知识点、原文件、封面。
- 不添加 sync 字段、远端 ID 或账户字段。

## 验收

- [ ] SQLite 数据库在 Application Support 下创建成功。
- [ ] 可通过 repository 写入/读取 Book、Chapter、Collection、KnowledgeResource、AnkiNoteDraft。
- [ ] ChapterSnapshot JSON 文件可写入/读取，encode/decode 无字段丢失。
- [ ] 删除 Book 后所有关联数据清理干净。
- [ ] 关闭 App 再打开，数据仍在。
- [ ] `npm run build` 等效的 Swift 编译通过（本节会触发后续 lint 检查）。

## 停止条件

- SQLite 或文件系统操作抛出未处理异常导致 App crash 时停止并修复。
