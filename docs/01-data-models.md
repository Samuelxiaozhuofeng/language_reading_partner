# 01 — 数据模型与契约参考

> **用途**：所有 Phase 共享的完整类型定义、数据库 schema、wire format 和 API 契约。
> **依赖**：先读 `00-product-spec.md` 了解产品定位。

---

## Swift 类型别名与枚举

```swift
typealias BookID = UUID
typealias ChapterID = UUID
typealias SentenceID = UUID
typealias CollectionID = UUID

enum BookLanguage: String, Codable, CaseIterable { case es; case general }
enum SourceType: String, Codable, CaseIterable { case epub; case text; case markdown }
enum AnalysisState: String, Codable, CaseIterable { case idle; case partial; case running; case analyzed }
enum SentenceStatus: String, Codable, CaseIterable { case idle; case queued; case running; case success; case error }
enum BlockKind: String, Codable, CaseIterable { case paragraph; case heading; case quote; case listItem; case preformatted; case code }
enum ResourceKind: String, Codable, CaseIterable { case grammar; case phrase; case vocabulary }
enum AnkiDraftStatus: String, Codable, CaseIterable { case pending; case submitting; case imported; case failed }
```

---

## SQLite Row Models（存数据库索引）

### Collection
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| name | String | |
| createdAt | Date | |
| sortOrder | Int | |

删除 Collection 不删书籍，只把 `Book.collectionID` 置空。

### Book
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| title | String | |
| author | String | 默认空串 |
| language | BookLanguage | 第一版 es 或 general |
| sourceType | SourceType | epub / text / markdown |
| coverImagePath | String? | 封面缓存路径 |
| originalFilePath | String? | EPUB/文本原文件路径 |
| snapshotDirectoryPath | String | 章节快照目录 |
| collectionID | UUID? | FK → Collection |
| importedAt | Date | |
| chapterCount | Int | |
| lastReadChapterID | UUID? | |
| lastOpenedAt | Date? | |
| analysisState | AnalysisState | |

### Chapter
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| bookID | UUID FK → Book | |
| title | String | |
| orderIndex | Int | |
| epubHref | String? | EPUB 内部路径 |
| snapshotPath | String | JSON 快照文件路径 |
| analysisState | AnalysisState | |
| lastReadEnd | Int | 默认 -1 |
| lastOpenedAt | Date? | |
| resumeAnchor | ReadingAnchor? | 存 JSON string |

`originalText` 和 `plainText` 不进入 Chapter row model，属于 `ChapterSnapshot`。

### KnowledgeResource
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| signature | String UNIQUE | `{kind}:{normalizedText}` |
| text | String | |
| kind | ResourceKind | |
| explanation | String | |
| grammarText | String | 默认空 |
| meaning | String? | |
| sentenceID | UUID | |
| sentenceText | String | |
| savedAt | Date | |
| bookID | UUID? | |
| bookTitle | String? | |
| chapterID | UUID? | |
| chapterTitle | String? | |

### AnkiNoteDraft
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID PK | |
| language | BookLanguage | |
| payloadJSON | String | `AnkiNotePayload` 的 JSON |
| sourceResourceID | UUID? | FK → KnowledgeResource |
| status | AnkiDraftStatus | |
| createdAt | Date | |
| submittedAt | Date? | |
| lastError | String? | |

---

## JSON Snapshot Models（存文件）

### ChapterSnapshot（根结构）
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
  "paragraphBlocks": [ /* ParagraphBlock[] */ ],
  "sentences": [ /* Sentence[] */ ],
  "results": { "UUID": /* AnalysisResult */ },
  "activeRange": { "start": 0, "end": 99 },
  "lastReadEnd": -1,
  "resumeAnchor": null,
  "updatedAt": "ISO-8601"
}
```

### ParagraphBlock
```json
{
  "id": "UUID",
  "kind": "paragraph | heading | quote | listItem | preformatted | code",
  "headingLevel": null,
  "text": "string",
  "html": "string or null",
  "sentenceIDs": ["UUID"],
  "sentenceTexts": ["string"],
  "sentenceHTML": ["string"]
}
```

约束：`sentenceIDs` 指向同快照内的 `sentences[].id`，`sentenceTexts` 与 `sentenceIDs` 数量一致。

### Sentence
```json
{
  "id": "UUID",
  "text": "string",
  "editedText": "string or null",
  "status": "idle | queued | running | success | error",
  "error": null
}
```

### AnalysisResult
```json
{
  "sentenceID": "UUID",
  "grammar": "string",
  "meaning": "string",
  "highlights": [
    { "id": "string", "text": "string", "kind": "vocabulary | grammar | phrase", "explanation": "string" }
  ],
  "isPartial": false,
  "rawText": "string or null"
}
```

约束：`results` 是以 sentence id 为 key 的字典，`results[key].sentenceID` 必须等于 key。

### ReadingAnchor
```swift
struct ReadingAnchor: Codable, Equatable {
  var sentenceID: SentenceID?
  var sentenceIndex: Int?
  var sentenceSnippet: String?
  var paragraphID: UUID?
  var updatedAt: Date
}
```

恢复规则：1) 优先用 `sentenceID` → 2) 找不到用 `sentenceIndex` → 3) index 内容变化时用 `sentenceSnippet` fuzzy fallback → 4) 全部失败回到章节开头。

### Swift Struct 骨架
```swift
struct Collection: Identifiable, Codable, Equatable {
  var id: CollectionID; var name: String; var createdAt: Date; var sortOrder: Int
}
struct Book: Identifiable, Codable, Equatable {
  var id: BookID; var title: String; var author: String; var language: BookLanguage
  var sourceType: SourceType; var coverImagePath: String?; var originalFilePath: String?
  var snapshotDirectoryPath: String; var importedAt: Date; var chapterCount: Int
  var lastReadChapterID: ChapterID?; var lastOpenedAt: Date?; var analysisState: AnalysisState
  var collectionID: CollectionID?
}
struct Chapter: Identifiable, Codable, Equatable {
  var id: ChapterID; var bookID: BookID; var title: String; var orderIndex: Int
  var epubHref: String?; var snapshotPath: String; var analysisState: AnalysisState
  var activeRange: SentenceRange?; var lastReadEnd: Int; var lastOpenedAt: Date?
  var resumeAnchor: ReadingAnchor?
}
struct SentenceRange: Codable, Equatable { var start: Int; var end: Int }
```

所有时间字段存 ISO 8601 string 或 Date。

---

## SQLite Schema

```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  created_at TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE books (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, author TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL, source_type TEXT NOT NULL,
  cover_image_path TEXT, original_file_path TEXT,
  snapshot_directory_path TEXT NOT NULL,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  imported_at TEXT NOT NULL, chapter_count INTEGER NOT NULL DEFAULT 0,
  last_read_chapter_id TEXT, last_opened_at TEXT,
  analysis_state TEXT NOT NULL DEFAULT 'idle'
);

CREATE TABLE chapters (
  id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL, order_index INTEGER NOT NULL, epub_href TEXT,
  snapshot_path TEXT NOT NULL, analysis_state TEXT NOT NULL DEFAULT 'idle',
  active_range_start INTEGER, active_range_end INTEGER,
  last_read_end INTEGER NOT NULL DEFAULT -1, last_opened_at TEXT,
  resume_anchor_sentence_id TEXT, resume_anchor_sentence_index INTEGER,
  resume_anchor_snippet TEXT, resume_anchor_paragraph_id TEXT,
  resume_anchor_updated_at TEXT
);

CREATE TABLE knowledge_resources (
  id TEXT PRIMARY KEY, signature TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL, kind TEXT NOT NULL, explanation TEXT NOT NULL,
  grammar_text TEXT NOT NULL DEFAULT '', meaning TEXT,
  sentence_id TEXT NOT NULL, sentence_text TEXT NOT NULL, saved_at TEXT NOT NULL,
  book_id TEXT REFERENCES books(id) ON DELETE SET NULL,
  book_title TEXT, chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL, chapter_title TEXT
);

CREATE TABLE anki_note_drafts (
  id TEXT PRIMARY KEY, language TEXT NOT NULL, payload_json TEXT NOT NULL,
  source_resource_id TEXT REFERENCES knowledge_resources(id) ON DELETE SET NULL,
  status TEXT NOT NULL, created_at TEXT NOT NULL, submitted_at TEXT, last_error TEXT
);

CREATE INDEX idx_books_collection ON books(collection_id);
CREATE INDEX idx_books_last_opened ON books(last_opened_at);
CREATE INDEX idx_chapters_book_order ON chapters(book_id, order_index);
CREATE INDEX idx_resources_kind ON knowledge_resources(kind);
CREATE INDEX idx_resources_saved_at ON knowledge_resources(saved_at);
CREATE INDEX idx_anki_drafts_status ON anki_note_drafts(status);
```

---

## 文件存储结构

```text
Application Support/MacReadingAssistant/
  Books/{bookID}/
    original.epub / cover.jpg / chapters/{chapterID}.json
  TextImports/{bookID}/
    original.txt 或 original.md / chapters/{chapterID}.json
  Exports/
  Logs/
```

---

## FileStorageService API

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
- 文件复制失败不写 SQLite。
- SQLite 写入失败清理刚复制的 book directory。
- 保存 snapshot 先写临时文件再 atomic replace。
- 删除书籍先删 SQLite row 再尽力删目录。

---

## LibraryRepository 接口

```swift
protocol LibraryRepository {
  func fetchCollections() async throws -> [Collection]
  func saveCollection(_ collection: Collection) async throws
  func deleteCollection(id: CollectionID) async throws
  func fetchBooks() async throws -> [Book]
  func fetchChapters(bookID: BookID) async throws -> [Chapter]
  func saveImportedBook(_ book: Book, chapters: [Chapter], originalFile: URL?) async throws
  func loadChapterSnapshot(chapterID: ChapterID) async throws -> ChapterSnapshot
  func saveChapterSnapshot(_ snapshot: ChapterSnapshot, for chapterID: ChapterID) async throws
  func updateReadingProgress(bookID: BookID, chapterID: ChapterID, anchor: ReadingAnchor?) async throws
  func saveKnowledgeResource(_ resource: KnowledgeResource) async throws
  func fetchKnowledgeResources() async throws -> [KnowledgeResource]
  func saveAnkiNoteDraft(_ draft: AnkiNoteDraft) async throws
}
```

---

## AI Wire Format

请求（OpenAI 兼容 `chat/completions`）：
```json
{
  "model": "gpt-4.1-mini", "temperature": 0.2,
  "messages": [{ "role": "user", "content": "interpolated prompt" }]
}
```

`PromptBuilder` 输入：
```swift
struct AnalysisPromptInput {
  let sentence: String; let previousSentence: String?; let nextSentence: String?
  let documentTitle: String?; let chapterTitle: String?
}
```

AI 响应必须解析为：
```json
{
  "grammar": "string", "meaning": "string",
  "highlights": [{ "text": "string", "kind": "grammar | phrase | vocabulary", "explanation": "string" }]
}
```

解析规则：
- `grammar` 和 `meaning` 至少有一个非空。
- `kind` 不在允许值中默认归为 `grammar`。
- `text` 或 `explanation` 为空的 highlight 丢弃。
- 同 `{kind}:{lowercased text}` 的 highlight 只保留第一个。
- 解析失败不写入 `results`，句子状态置为 `error`。

词汇解释响应：
```json
{ "explanation": "string" }
```

Prompt 规则：
- 面向中文母语者，描述为多语言阅读助手。
- highlights 最多 4 个。

---

## AnalysisRunStore 状态机

枚举：
```swift
enum AnalysisRunPhase: Equatable {
  case idle; case validating
  case running(scope: AnalysisScope, total: Int, finished: Int)
  case cancelling; case completed(scope: AnalysisScope, succeeded: Int, failed: Int)
  case failed(message: String)
}
enum AnalysisScope: Equatable {
  case sentence(SentenceID); case page(chapterID: ChapterID, sentenceIDs: [SentenceID])
  case chapter(ChapterID)
}
```

合法转换：
```
idle → validating → running | failed
running → completed | failed | cancelling
cancelling → idle
completed → idle
failed → idle
```

约束：
- 同一时间一个 chapter 只允许一个整章解析任务。
- 单句重试不能与整章解析并行。
- cancel 后 queued/running 句子恢复到开始前状态。
- 每成功一批句子，debounce 保存 chapter snapshot。

---

## AnkiConnect Wire Format

统一请求外壳：
```json
{ "action": "addNote", "version": 6, "params": {} }
```

响应：`{ "result": "any", "error": null }`

连接流程：
1. 调用 `version`，<6 提示升级。
2. 调用 `requestPermission`，未授权提示用户允许。
3. 之后调用 `deckNames`、`modelNames`、`modelFieldNames`。

### 默认 Note Type：SRA General Foreign Language

字段顺序：sentence, grammar, meaning, knowledge, knowledgeKind, knowledgeExplanation

创建 `createModel` payload：
```json
{
  "action": "createModel", "version": 6,
  "params": {
    "modelName": "SRA General Foreign Language",
    "inOrderFields": ["sentence","grammar","meaning","knowledge","knowledgeKind","knowledgeExplanation"],
    "css": ".card { font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 18px; line-height: 1.5; }",
    "cardTemplates": [{
      "Name": "Recognition",
      "Front": "{{knowledge}}<hr>{{sentence}}",
      "Back": "{{FrontSide}}<hr>{{knowledgeExplanation}}<br><br>{{grammar}}<br><br>{{meaning}}"
    }]
  }
}
```

修复规则：不存在时创建；存在但缺字段时提示用户确认修复。字段映射缺 sentence/knowledge/knowledgeExplanation 禁止提交。

### addNote Payload
```json
{
  "action": "addNote", "version": 6,
  "params": {
    "note": {
      "deckName": "Spanish", "modelName": "SRA General Foreign Language",
      "fields": {
        "sentence": "...", "grammar": "...", "meaning": "...",
        "knowledge": "...", "knowledgeKind": "vocabulary", "knowledgeExplanation": "..."
      },
      "options": { "allowDuplicate": false, "duplicateScope": "deck" },
      "tags": ["mac-reading-assistant","sra","es"]
    }
  }
}
```

提交前校验：
- deck 不存在提示创建。
- `sentence`、`knowledge`、`knowledgeExplanation` 不能为空。
- `knowledgeKind` 只允许 grammar/phrase/vocabulary。
- 重复卡不写入失败重试队列。
- 不同错误分开提示：Anki 未启动、插件未安装、权限拒绝、字段映射错误。

### AnkiPayloadBuilder

只接收 `KnowledgeResource`、当前句解析结果和 Anki 设置，不直接读 UI state。

内部 payload → `AnkiNotePayload` → SQLite `payload_json`。

---

## 错误处理

```swift
enum AppError: Error {
  case importFailed(String); case storageFailed(String); case databaseFailed(String)
  case analysisFailed(String); case vocabularyFailed(String); case ankiFailed(String)
  case configurationMissing(String)
}
```

展示策略：
- 导入/解析/Anki 失败：inline banner。
- 删除/清空：确认 alert。
- API key 缺失：跳转 Settings AI tab。
- API key、完整 prompt、完整原文不写入日志。
- 日志只记录时间、错误类别、短消息、ID。

## 本地化与无障碍基线

- 第一版 UI 文案简体中文。
- 颜色跟随系统浅色/深色模式，使用 semantic color。
- 所有 toolbar button、行动作、token button 有 accessibility label。
- 阅读器字号设置不破坏 VoiceOver 顺序。
- 不对 macOS 26 系统材料做自定义半透明替代。
