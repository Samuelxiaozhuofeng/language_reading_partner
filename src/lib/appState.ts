import type {
  AnalysisResult,
  AnkiConfig,
  AnkiFieldMapping,
  AnkiFieldSource,
  ApiConfig,
  BookLanguage,
  ChapterAnalysisState,
  JapaneseToken,
  PromptConfig,
  ReadingPreferences,
  RunSession,
  SettingsTab,
  SentenceItem,
  SentenceStatus,
  VocabularyPromptConfig,
} from '../types'
import { ankiFieldSourceOrder } from './anki/constants'
import { segmentSpanishText } from './segment'

export const CONFIG_STORAGE_KEY = 'spanish-reading-assistant/config'
export const VOCABULARY_CONFIG_STORAGE_KEY = 'spanish-reading-assistant/vocabulary-config'
export const VOCABULARY_AI_SHARED_STORAGE_KEY = 'spanish-reading-assistant/vocabulary-ai-shared'
export const PROMPT_STORAGE_KEY = 'spanish-reading-assistant/prompt'
export const VOCABULARY_PROMPT_STORAGE_KEY = 'spanish-reading-assistant/vocabulary-prompt'
export const ANKI_STORAGE_KEY = 'spanish-reading-assistant/anki'
export const JA_ANKI_STORAGE_KEY = 'spanish-reading-assistant/ja-anki'
export const DRAFT_STORAGE_KEY = 'spanish-reading-assistant/draft'
export const HISTORY_STORAGE_KEY = 'spanish-reading-assistant/history'
export const READING_PREFERENCES_STORAGE_KEY = 'spanish-reading-assistant/reading-preferences'
export const MAX_HISTORY_ITEMS = 6
export const MAX_CONCURRENCY = 99
export const MAX_PROMPT_CONTEXT_SENTENCE_COUNT = 10
export const MAX_BATCH_SIZE = 10
export const MIN_READING_CONTENT_WIDTH = 720
export const MAX_READING_CONTENT_WIDTH = 1180
export const MIN_READING_FONT_SIZE = 16
export const MAX_READING_FONT_SIZE = 24

export const defaultConfig: ApiConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4.1-mini',
  concurrency: 5,
}

export const defaultVocabularyConfig: ApiConfig = {
  ...defaultConfig,
}

export const defaultPromptConfig: PromptConfig = {
  template: [
    '你是一名帮助中文母语者阅读外语文本的多语言阅读老师。请先根据当前句子自动判断主要学习语言、文本类型和大致难度，再严格围绕当前句子进行解释，并且必须只输出一个 JSON 对象，不要输出 Markdown，不要输出额外说明。',
    '',
    'JSON 结构固定为：',
    '{',
    '  "grammar": "string",',
    '  "meaning": "string",',
    '  "highlights": [',
    '    {',
    '      "text": "string",',
    '      "kind": "grammar | phrase | vocabulary",',
    '      "explanation": "string"',
    '    }',
    '  ]',
    '}',
    '',
    '要求：',
    '1. 必须使用中文回答。',
    '2. grammar：解释当前句子里最值得学习的语法点、固定搭配、习语表达、句型结构或有学习价值的表达。应根据句子实际难度选择，不要强行只讲高级语法。',
    '3. meaning：用自然中文说明这句话在上下文中的意思、语气、叙述作用或说话人意图。',
    '4. highlights：返回 0 到 4 个最值得收藏的知识点。',
    '5. highlights 里的 text 必须严格来自原句，保留原文语言，不要翻译、不要改写。',
    '6. kind 只能是 grammar、phrase、vocabulary 三选一。',
    '7. explanation 必须是简短中文解释，适合后续复习。',
    '8. 如果句子没有明显值得收藏的点，highlights 返回空数组 []。',
    '9. grammar 和 meaning 即使很短也要尽量给出，不要留空。',
    '10. 不要假设文本一定是某一种语言；请根据当前句子内容和上下文判断。',
    '11. 如果文本中混有多种语言，以当前句子的主要学习语言为准。',
    '12. 不要输出语言判断、难度判断或文本类型字段，只在内部判断后用于解释。',
    '',
    '文档元信息：',
    '{documentMetadata}',
    '',
    '上文：{previousSentence}',
    '当前句：{sentence}',
    '下文：{nextSentence}',
  ].join('\n'),
  previousSentenceCount: 1,
  nextSentenceCount: 1,
  batchSize: 1,
}

export const defaultJapanesePromptConfig: PromptConfig = {
  template: [
    '你是一位日语教师，帮助中文母语者阅读日语文本。',
    '我会给你一个日语句子、上下文，以及由形态素解析器生成的原始 token 列表。',
    '你的任务不是逐个解释原始 token，而是基于原始 token 重新组合成更适合阅读理解的语法语块。',
    '',
    '重要规则：',
    '1. 原始 token 带有固定 index。每个语法语块必须通过 token_indices 精确对应原始 token。',
    '2. token_indices 必须使用输入 token 的 index，不允许自造 index。',
    '3. token_indices 必须按升序排列；每个语法语块只能覆盖连续 token。',
    '4. 所有原始 token 必须被覆盖一次且仅一次。',
    '5. 不要改写、增删、重排原句文字。',
    '6. chunk 字段必须等于 token_indices 对应 token.surface 直接拼接后的字符串。',
    '7. 如果助词、助动词、接尾词、补助动词与前后成分构成固定语法功能，应优先合并到同一语法语块。',
    '8. 如果标点符号存在，应作为独立语块或并入前一语块，但必须覆盖其 token index。',
    '',
    '请重点识别主语/主题、宾语/对象、谓语核心、连体修饰、连用修饰、补助动词结构、助动词结构、引用结构、条件/原因/让步/目的/结果等从句关系，以及固定表达和惯用搭配。',
    '',
    '必须只输出一个 JSON 对象，不要输出 Markdown，不要输出额外说明。',
    '',
    'JSON 结构固定为：',
    '{',
    '  "grammar": "string",',
    '  "meaning": "string",',
    '  "chunkAnalysis": [',
    '    {',
    '      "chunk": "string",',
    '      "reading": "string",',
    '      "pos": "string",',
    '      "grammar_role": "string",',
    '      "token_indices": [0],',
    '      "head_chunk_index": null,',
    '      "depends_on": null,',
    '      "explanation": "string"',
    '    }',
    '  ],',
    '  "highlights": [',
    '    {"text": "string", "kind": "grammar | phrase | vocabulary", "explanation": "string"}',
    '  ]',
    '}',
    '',
    '要求：',
    '1. 必须使用中文回答。',
    '2. grammar：用中文解释整句最重要的语法结构。不要只罗列词义，要说明结构关系。',
    '3. meaning：用自然中文说明句意、语气和上下文作用。',
    '4. chunkAnalysis：按原句顺序返回语法语块，不要求数量等于输入 token 数量。',
    '5. reading 使用平假名；多个 token 合并时，给出整个语块的自然读法。',
    '6. pos 不要只写机械词性，优先写教学标签，例如 名詞句、動詞句、形容詞句、連体修飾句、連用修飾句、助詞句、補助動詞句、引用句、接続表現、形式名詞句、慣用表現、句読点。',
    '7. grammar_role 说明语块功能，例如 主题、主语、宾语、时间状语、地点状语、连体修饰、连用修饰、谓语核心、补助说明、引用内容、条件从句、原因说明、转折连接、句末语气。',
    '8. head_chunk_index：如果该语块修饰、补充或依赖另一个语块，填写被修饰/依赖语块在 chunkAnalysis 中的 index；否则填 null。',
    '9. depends_on：用中文简短说明依赖关系，例如 修饰后面的名词、作为谓语核心、标记主题、连接前后分句、补充前一动词的结果状态；如果没有明确依赖关系，填 null。',
    '10. explanation：用中文简要说明该语块的意思和学习价值。重点解释语法功能，不要只翻译。',
    '11. highlights：0-4 个最值得收藏的知识点。',
    '12. highlights 的 text 必须严格来自原句，不能翻译、不能改写。',
    '13. kind 只能是 grammar、phrase、vocabulary 三选一。',
    '14. grammar 和 meaning 不要留空。',
    '15. 不确定时不要编造不存在的语法；如果某个关系有歧义，请在 explanation 中说明“这里更可能是……”。',
    '',
    '文档元信息：',
    '{documentMetadata}',
    '',
    '上文：{previousSentence}',
    '当前句：{sentence}',
    '原始 token 列表：',
    '{tokens}',
    '下文：{nextSentence}',
  ].join('\n'),
  previousSentenceCount: 1,
  nextSentenceCount: 1,
  batchSize: 1,
}

export const defaultVocabularyPromptConfig: VocabularyPromptConfig = {
  template: [
    '你是一名帮助中文母语者阅读外语文本的多语言词汇老师。请根据语境解释指定外语单词或短语，并且必须只输出一个 JSON 对象，不要输出 Markdown，不要输出额外说明。',
    '',
    'JSON 结构固定为：',
    '{',
    '  "explanation": "string"',
    '}',
    '',
    '要求：',
    '1. 必须使用中文回答。',
    '2. 解释要简短，说明这个词在当前句子里的含义、词性或常见用法。',
    '3. 不要脱离语境罗列过多词义。',
    '4. 如果有必要，可以补充一个很短的记忆提示。',
    '',
    '当前句：{context}',
    '目标词：{word}',
  ].join('\n'),
}

export const defaultReadingPreferences: ReadingPreferences = {
  contentWidth: 940,
  fontSize: 18,
  showFurigana: true,
}

function createDefaultAnkiFieldMapping(
  overrides: Partial<AnkiFieldMapping> = {},
): AnkiFieldMapping {
  return ankiFieldSourceOrder.reduce<AnkiFieldMapping>(
    (mapping, source) => ({
      ...mapping,
      [source]: overrides[source] ?? '',
    }),
    {} as AnkiFieldMapping,
  )
}

export const defaultAnkiConfig: AnkiConfig = {
  endpoint: 'http://127.0.0.1:8765',
  deck: '',
  noteType: '',
  fieldMapping: createDefaultAnkiFieldMapping(),
}

export const defaultJaAnkiConfig: AnkiConfig = {
  ...defaultAnkiConfig,
  deck: 'Japanese',
  fieldMapping: createDefaultAnkiFieldMapping({
    sentence: 'Sentence',
    sentenceFurigana: 'Reading',
  }),
}

export const defaultSourceText = `La verdad es que muchas veces habia pensado y planeado minuciosamente mi actitud en caso de encontrarla.

Desgraciadamente, estuve condenado a permanecer ajeno a la vida de cualquier mujer.`

export type PersistedDraft = {
  articleTitle: string
  language?: BookLanguage
  sourceText: string
  sentences: SentenceItem[]
  results: Record<string, AnalysisResult>
}

export type ModelFetchStatus = 'idle' | 'loading' | 'success' | 'error'
export type { SettingsTab }

export type ConfigChangeHandler = <Key extends keyof ApiConfig>(
  key: Key,
  value: ApiConfig[Key],
) => void

type EditableAnkiConfigKey = Exclude<keyof AnkiConfig, 'fieldMapping'>

export type AnkiConfigChangeHandler = <Key extends EditableAnkiConfigKey>(
  key: Key,
  value: AnkiConfig[Key],
) => void

export type AnkiFieldMappingChangeHandler = (
  source: AnkiFieldSource,
  value: string,
) => void

export type PromptChangeHandler = (value: string) => void
export type PromptConfigChangeHandler = <Key extends keyof PromptConfig>(
  key: Key,
  value: PromptConfig[Key],
) => void
export type VocabularyPromptConfigChangeHandler = <Key extends keyof VocabularyPromptConfig>(
  key: Key,
  value: VocabularyPromptConfig[Key],
) => void

export type ReadingPreferencesChangeHandler = <Key extends keyof ReadingPreferences>(
  key: Key,
  value: ReadingPreferences[Key],
) => void

function convertLegacyPromptConfig(parsed: Partial<PromptConfig> & {
  systemPrompt?: unknown
  userPromptTemplate?: unknown
}) {
  if (typeof parsed.template === 'string' && parsed.template.trim()) {
    return {
      template: parsed.template,
      previousSentenceCount: clampPromptContextSentenceCount(parsed.previousSentenceCount),
      nextSentenceCount: clampPromptContextSentenceCount(parsed.nextSentenceCount),
      batchSize: clampBatchSize(parsed.batchSize),
    } satisfies PromptConfig
  }

  const systemPrompt =
    typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt.trim() : ''
  const userPromptTemplate =
    typeof parsed.userPromptTemplate === 'string' ? parsed.userPromptTemplate.trim() : ''

  if (!systemPrompt && !userPromptTemplate) {
    return defaultPromptConfig
  }

  return {
    template: [systemPrompt, userPromptTemplate].filter(Boolean).join('\n\n'),
    previousSentenceCount: clampPromptContextSentenceCount(parsed.previousSentenceCount),
    nextSentenceCount: clampPromptContextSentenceCount(parsed.nextSentenceCount),
    batchSize: clampBatchSize(parsed.batchSize),
  } satisfies PromptConfig
}

export function createSentenceItem(text: string, tokens?: JapaneseToken[]): SentenceItem {
  return {
    id: crypto.randomUUID(),
    text,
    editedText: text,
    status: 'idle',
    tokens,
  }
}

export function createDefaultDraft(): PersistedDraft {
  return {
    articleTitle: '',
    language: 'es',
    sourceText: defaultSourceText,
    sentences: segmentSpanishText(defaultSourceText).map((sentence) => createSentenceItem(sentence)),
    results: {},
  }
}

export function clampConcurrency(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return defaultConfig.concurrency
  }

  return Math.min(MAX_CONCURRENCY, Math.max(1, Math.round(numeric)))
}

export function clampPromptContextSentenceCount(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return defaultPromptConfig.previousSentenceCount
  }

  return Math.min(MAX_PROMPT_CONTEXT_SENTENCE_COUNT, Math.max(0, Math.round(numeric)))
}

export function clampBatchSize(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return defaultPromptConfig.batchSize
  }

  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.round(numeric)))
}

export function clampReadingContentWidth(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return defaultReadingPreferences.contentWidth
  }

  return Math.min(
    MAX_READING_CONTENT_WIDTH,
    Math.max(MIN_READING_CONTENT_WIDTH, Math.round(numeric)),
  )
}

export function clampReadingFontSize(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return defaultReadingPreferences.fontSize
  }

  return Math.min(MAX_READING_FONT_SIZE, Math.max(MIN_READING_FONT_SIZE, Math.round(numeric)))
}

export function restoreConfig(): ApiConfig {
  const saved = localStorage.getItem(CONFIG_STORAGE_KEY)
  if (!saved) {
    return defaultConfig
  }

  try {
    const parsed = JSON.parse(saved) as Partial<ApiConfig>
    return {
      ...defaultConfig,
      ...parsed,
      concurrency: clampConcurrency(parsed.concurrency),
    }
  } catch {
    return defaultConfig
  }
}

export function restoreVocabularyConfig(): ApiConfig {
  const saved = localStorage.getItem(VOCABULARY_CONFIG_STORAGE_KEY)
  if (!saved) {
    return defaultVocabularyConfig
  }

  try {
    const parsed = JSON.parse(saved) as Partial<ApiConfig>
    return {
      ...defaultVocabularyConfig,
      ...parsed,
      concurrency: clampConcurrency(parsed.concurrency),
    }
  } catch {
    return defaultVocabularyConfig
  }
}

export function restoreVocabularyAiShared(): boolean {
  const saved = localStorage.getItem(VOCABULARY_AI_SHARED_STORAGE_KEY)
  if (!saved) {
    return true
  }

  try {
    return Boolean(JSON.parse(saved))
  } catch {
    return true
  }
}

export function restorePromptConfig(): PromptConfig {
  const saved = localStorage.getItem(PROMPT_STORAGE_KEY)
  if (!saved) {
    return defaultPromptConfig
  }

  try {
    const parsed = JSON.parse(saved) as Partial<PromptConfig> & {
      systemPrompt?: unknown
      userPromptTemplate?: unknown
    }
    const migrated = convertLegacyPromptConfig(parsed)
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(migrated))
    return migrated
  } catch {
    return defaultPromptConfig
  }
}

export function restoreVocabularyPromptConfig(): VocabularyPromptConfig {
  const saved = localStorage.getItem(VOCABULARY_PROMPT_STORAGE_KEY)
  if (!saved) {
    return defaultVocabularyPromptConfig
  }

  try {
    const parsed = JSON.parse(saved) as Partial<VocabularyPromptConfig>
    return typeof parsed.template === 'string' && parsed.template.trim()
      ? { template: parsed.template }
      : defaultVocabularyPromptConfig
  } catch {
    return defaultVocabularyPromptConfig
  }
}

export function restoreReadingPreferences(): ReadingPreferences {
  const saved = localStorage.getItem(READING_PREFERENCES_STORAGE_KEY)
  if (!saved) {
    return defaultReadingPreferences
  }

  try {
    const parsed = JSON.parse(saved) as Partial<ReadingPreferences>
    return {
      contentWidth: clampReadingContentWidth(parsed.contentWidth),
      fontSize: clampReadingFontSize(parsed.fontSize),
      showFurigana:
        typeof parsed.showFurigana === 'boolean'
          ? parsed.showFurigana
          : defaultReadingPreferences.showFurigana,
    }
  } catch {
    return defaultReadingPreferences
  }
}

function restoreAnkiConfigFromStorage(
  storageKey: string,
  fallbackConfig: AnkiConfig,
): AnkiConfig {
  const saved = localStorage.getItem(storageKey)
  if (!saved) {
    return fallbackConfig
  }

  try {
    const parsed = JSON.parse(saved) as Partial<AnkiConfig> & {
      fieldMapping?: Partial<Record<AnkiFieldSource, unknown>>
    }
    const fieldMapping = ankiFieldSourceOrder.reduce<AnkiFieldMapping>((mapping, source) => {
      const value = parsed.fieldMapping?.[source]
      return {
        ...mapping,
        [source]: typeof value === 'string' ? value : '',
      }
    }, createDefaultAnkiFieldMapping())

    return {
      endpoint:
        typeof parsed.endpoint === 'string' ? parsed.endpoint : fallbackConfig.endpoint,
      deck: typeof parsed.deck === 'string' ? parsed.deck : fallbackConfig.deck,
      noteType: typeof parsed.noteType === 'string' ? parsed.noteType : fallbackConfig.noteType,
      fieldMapping,
    }
  } catch {
    return fallbackConfig
  }
}

export function restoreAnkiConfig(): AnkiConfig {
  return restoreAnkiConfigFromStorage(ANKI_STORAGE_KEY, defaultAnkiConfig)
}

export function restoreJaAnkiConfig(): AnkiConfig {
  return restoreAnkiConfigFromStorage(JA_ANKI_STORAGE_KEY, defaultJaAnkiConfig)
}

export function restoreDraft(): PersistedDraft {
  const saved = localStorage.getItem(DRAFT_STORAGE_KEY)
  if (!saved) {
    return createDefaultDraft()
  }

  try {
    const parsed = JSON.parse(saved) as Partial<PersistedDraft>
    const results = parsed.results ?? {}
    const restoredSentences = Array.isArray(parsed.sentences)
      ? parsed.sentences.map((sentence) => ({
          ...sentence,
          status: (results[sentence.id] ? 'success' : 'idle') as SentenceStatus,
          error: undefined,
        }))
      : []

    return {
      articleTitle: typeof parsed.articleTitle === 'string' ? parsed.articleTitle : '',
      language: parsed.language === 'ja' ? 'ja' : 'es',
      sourceText: parsed.sourceText ?? defaultSourceText,
      sentences: restoredSentences,
      results,
    }
  } catch {
    return createDefaultDraft()
  }
}

export function restoreHistory(): RunSession[] {
  const saved = localStorage.getItem(HISTORY_STORAGE_KEY)
  if (!saved) {
    return []
  }

  try {
    const parsed = JSON.parse(saved) as RunSession[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function clearPersistedStorage() {
  localStorage.removeItem(CONFIG_STORAGE_KEY)
  localStorage.removeItem(VOCABULARY_CONFIG_STORAGE_KEY)
  localStorage.removeItem(VOCABULARY_AI_SHARED_STORAGE_KEY)
  localStorage.removeItem(PROMPT_STORAGE_KEY)
  localStorage.removeItem(VOCABULARY_PROMPT_STORAGE_KEY)
  localStorage.removeItem(ANKI_STORAGE_KEY)
  localStorage.removeItem(JA_ANKI_STORAGE_KEY)
  localStorage.removeItem(DRAFT_STORAGE_KEY)
  localStorage.removeItem(HISTORY_STORAGE_KEY)
  localStorage.removeItem(READING_PREFERENCES_STORAGE_KEY)
}

export function cleanSentences(sentences: SentenceItem[]): SentenceItem[] {
  return sentences
    .map((sentence) => ({
      ...sentence,
      editedText: sentence.editedText.trim(),
    }))
    .filter((sentence) => sentence.editedText.length > 0)
}

export function updateSentenceState(
  sentences: SentenceItem[],
  id: string,
  updater: (sentence: SentenceItem) => SentenceItem,
): SentenceItem[] {
  return sentences.map((sentence) =>
    sentence.id === id ? updater(sentence) : sentence,
  )
}

function buildSessionTitle(sentences: SentenceItem[]): string {
  const seed = sentences.find((sentence) => sentence.editedText.trim())?.editedText ?? '未命名章节'
  return seed.length > 40 ? `${seed.slice(0, 40)}...` : seed
}

type CollectSessionOptions = {
  language: BookLanguage
  sourceText: string
  sentences: SentenceItem[]
  results: Record<string, AnalysisResult>
}

export function collectSession({
  language,
  sourceText,
  sentences,
  results,
}: CollectSessionOptions): RunSession {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    title: buildSessionTitle(sentences),
    language,
    sourceText,
    sentences: sentences.map((sentence) => ({
      id: sentence.id,
      text: sentence.text,
      editedText: sentence.editedText,
      status: 'success',
      tokens: sentence.tokens,
    })),
    results,
  }
}

export function countByStatus(sentences: SentenceItem[], status: SentenceStatus): number {
  return sentences.filter((sentence) => sentence.status === status).length
}

export function formatTime(isoText: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoText))
  } catch {
    return isoText
  }
}

export const statusLabelMap: Record<SentenceStatus, string> = {
  idle: '待处理',
  queued: '排队中',
  running: '解析中',
  success: '已完成',
  error: '失败',
}

export const chapterStatusLabelMap: Record<ChapterAnalysisState, string> = {
  idle: '未开始',
  partial: '部分完成',
  running: '解析中',
  analyzed: '已完成',
}
