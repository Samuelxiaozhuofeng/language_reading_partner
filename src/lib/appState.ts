import type {
  AnalysisResult,
  ApiConfig,
  ChapterAnalysisState,
  PromptConfig,
  RunSession,
  SettingsTab,
  SentenceItem,
  SentenceStatus,
} from '../types'
import { segmentSpanishText } from './segment'

export const CONFIG_STORAGE_KEY = 'spanish-reading-assistant/config'
export const PROMPT_STORAGE_KEY = 'spanish-reading-assistant/prompt'
export const DRAFT_STORAGE_KEY = 'spanish-reading-assistant/draft'
export const HISTORY_STORAGE_KEY = 'spanish-reading-assistant/history'
export const MAX_HISTORY_ITEMS = 6

export const defaultConfig: ApiConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4.1-mini',
  concurrency: 4,
}

export const defaultPromptConfig: PromptConfig = {
  systemPrompt:
    '你是一名帮助中文母语者阅读西班牙语文学文本的老师。你必须使用中文回答，并始终输出 JSON 对象，字段固定为 grammar 和 meaning。不要输出 Markdown，不要输出额外字段。',
  userPromptTemplate: [
    '请严格围绕当前句子进行解释。',
    'grammar：解释关键语法、时态、搭配、从句结构、语气或修辞，尽量具体但不要冗长。',
    'meaning：用自然中文说明这句话在上下文中的含义、叙述作用或人物心理。',
    '如果信息不足，也要尽量根据上下文给出谨慎解释。',
    '',
    '上文：{previousSentence}',
    '当前句：{sentence}',
    '下文：{nextSentence}',
  ].join('\n'),
}

export const defaultSourceText = `La verdad es que muchas veces habia pensado y planeado minuciosamente mi actitud en caso de encontrarla.

Desgraciadamente, estuve condenado a permanecer ajeno a la vida de cualquier mujer.`

export type PersistedDraft = {
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

export type PromptChangeHandler = <Key extends keyof PromptConfig>(
  key: Key,
  value: PromptConfig[Key],
) => void

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

  return Math.min(8, Math.max(1, Math.round(numeric)))
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

export function restorePromptConfig(): PromptConfig {
  const saved = localStorage.getItem(PROMPT_STORAGE_KEY)
  if (!saved) {
    return defaultPromptConfig
  }

  try {
    const parsed = JSON.parse(saved) as Partial<PromptConfig>
    return {
      ...defaultPromptConfig,
      ...parsed,
    }
  } catch {
    return defaultPromptConfig
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
  localStorage.removeItem(PROMPT_STORAGE_KEY)
  localStorage.removeItem(DRAFT_STORAGE_KEY)
  localStorage.removeItem(HISTORY_STORAGE_KEY)
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
