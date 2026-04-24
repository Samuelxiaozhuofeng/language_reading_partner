import type {
  AnalysisResult,
  AnkiConfig,
  AnkiFieldMapping,
  AnkiFieldSource,
  ApiConfig,
  ChapterAnalysisState,
  PromptConfig,
  ReadingPreferences,
  RunSession,
  SettingsTab,
  SentenceItem,
  SentenceStatus,
  VocabularyPromptConfig,
} from '../types'
import { segmentSpanishText } from './segment'

export const CONFIG_STORAGE_KEY = 'spanish-reading-assistant/config'
export const VOCABULARY_CONFIG_STORAGE_KEY = 'spanish-reading-assistant/vocabulary-config'
export const VOCABULARY_AI_SHARED_STORAGE_KEY = 'spanish-reading-assistant/vocabulary-ai-shared'
export const PROMPT_STORAGE_KEY = 'spanish-reading-assistant/prompt'
export const VOCABULARY_PROMPT_STORAGE_KEY = 'spanish-reading-assistant/vocabulary-prompt'
export const ANKI_STORAGE_KEY = 'spanish-reading-assistant/anki'
export const DRAFT_STORAGE_KEY = 'spanish-reading-assistant/draft'
export const HISTORY_STORAGE_KEY = 'spanish-reading-assistant/history'
export const READING_PREFERENCES_STORAGE_KEY = 'spanish-reading-assistant/reading-preferences'
export const MAX_HISTORY_ITEMS = 6
export const MAX_CONCURRENCY = 99
export const MAX_PROMPT_CONTEXT_SENTENCE_COUNT = 10
export const MIN_READING_CONTENT_WIDTH = 720
export const MAX_READING_CONTENT_WIDTH = 1180
export const MIN_READING_FONT_SIZE = 16
export const MAX_READING_FONT_SIZE = 24

export const defaultConfig: ApiConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4.1-mini',
  concurrency: 4,
}

export const defaultVocabularyConfig: ApiConfig = {
  ...defaultConfig,
}

export const defaultPromptConfig: PromptConfig = {
  template: [
    '你是一名帮助中文母语者阅读西班牙语文学文本的老师。请严格围绕当前句子进行解释，并且必须只输出一个 JSON 对象，不要输出 Markdown，不要输出额外说明。',
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
    '2. grammar：只解释当前句子里最值得讲的 B1 及以上语法点、固定搭配、习语表达或有学习价值的结构。要简洁，不要长篇大论。',
    '3. meaning：用自然中文说明这句话在上下文中的含义、叙述作用或人物心理。',
    '4. highlights：返回 0 到 4 个最值得收藏的知识点。',
    '5. highlights 里的 text 必须是西语原词、短语或结构片段，例如 "Has pronunciado"、"tan... como..."。',
    '6. kind 只能是 grammar、phrase、vocabulary 三选一。',
    '7. explanation 必须是简短中文解释，适合后续复习。',
    '8. 如果句子没有明显值得收藏的点，highlights 返回空数组 []。',
    '9. grammar 和 meaning 即使很短也要尽量给出，不要留空。',
    '',
    '参考风格：',
    '- había pensado（过去完成时）表示在见到她之前，这些念头早已存在。',
    '- en caso de 表示“万一……；如果发生……”。',
    '- estar condenado a 表示“注定……；被迫一直……”。',
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
}

export const defaultVocabularyPromptConfig: VocabularyPromptConfig = {
  template: [
    '你是一名帮助中文母语者阅读西班牙语文学文本的词汇老师。请根据语境解释指定西语单词，并且必须只输出一个 JSON 对象，不要输出 Markdown，不要输出额外说明。',
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
}

const ankiFieldSources: AnkiFieldSource[] = [
  'sentence',
  'grammar',
  'meaning',
  'knowledge',
  'knowledgeKind',
  'knowledgeExplanation',
]

function createDefaultAnkiFieldMapping(): AnkiFieldMapping {
  return {
    sentence: '',
    grammar: '',
    meaning: '',
    knowledge: '',
    knowledgeKind: '',
    knowledgeExplanation: '',
  }
}

export const defaultAnkiConfig: AnkiConfig = {
  endpoint: 'http://127.0.0.1:8765',
  deck: '',
  noteType: '',
  fieldMapping: createDefaultAnkiFieldMapping(),
}

export const defaultSourceText = `La verdad es que muchas veces habia pensado y planeado minuciosamente mi actitud en caso de encontrarla.

Desgraciadamente, estuve condenado a permanecer ajeno a la vida de cualquier mujer.`

export type PersistedDraft = {
  articleTitle: string
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
  } satisfies PromptConfig
}

export function createSentenceItem(text: string): SentenceItem {
  return {
    id: crypto.randomUUID(),
    text,
    editedText: text,
    status: 'idle',
  }
}

export function createDefaultDraft(): PersistedDraft {
  return {
    articleTitle: '',
    sourceText: defaultSourceText,
    sentences: segmentSpanishText(defaultSourceText).map(createSentenceItem),
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
    }
  } catch {
    return defaultReadingPreferences
  }
}

export function restoreAnkiConfig(): AnkiConfig {
  const saved = localStorage.getItem(ANKI_STORAGE_KEY)
  if (!saved) {
    return defaultAnkiConfig
  }

  try {
    const parsed = JSON.parse(saved) as Partial<AnkiConfig> & {
      fieldMapping?: Partial<Record<AnkiFieldSource, unknown>>
    }
    const fieldMapping = ankiFieldSources.reduce<AnkiFieldMapping>((mapping, source) => {
      const value = parsed.fieldMapping?.[source]
      return {
        ...mapping,
        [source]: typeof value === 'string' ? value : '',
      }
    }, createDefaultAnkiFieldMapping())

    return {
      endpoint:
        typeof parsed.endpoint === 'string' ? parsed.endpoint : defaultAnkiConfig.endpoint,
      deck: typeof parsed.deck === 'string' ? parsed.deck : '',
      noteType: typeof parsed.noteType === 'string' ? parsed.noteType : '',
      fieldMapping,
    }
  } catch {
    return defaultAnkiConfig
  }
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

export function collectSession(
  sourceText: string,
  sentences: SentenceItem[],
  results: Record<string, AnalysisResult>,
): RunSession {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    title: buildSessionTitle(sentences),
    sourceText,
    sentences: sentences.map((sentence) => ({
      id: sentence.id,
      text: sentence.text,
      editedText: sentence.editedText,
      status: 'success',
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
