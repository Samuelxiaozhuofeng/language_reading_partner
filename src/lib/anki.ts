import type {
  AnalysisHighlight,
  AnalysisResult,
  AnkiConfig,
  AnkiFieldSource,
  KnowledgeKind,
  SentenceItem,
} from '../types'

type AnkiResponse<Result> = {
  error?: string | null
  result?: Result
}

type AnkiNotePayload = Record<AnkiFieldSource, string>

export type AnkiCompatibilityIssue = {
  code: 'safari-secure-loopback-http'
  summary: string
  details: string[]
}

export const ankiFieldSourceOrder: AnkiFieldSource[] = [
  'sentence',
  'grammar',
  'meaning',
  'knowledge',
  'knowledgeKind',
  'knowledgeExplanation',
]

export const ankiFieldSourceLabelMap: Record<AnkiFieldSource, string> = {
  sentence: '句子',
  grammar: '语法',
  meaning: '内容',
  knowledge: '知识点',
  knowledgeKind: '知识点类型',
  knowledgeExplanation: '知识点解释',
}

const ankiKnowledgeKindLabelMap: Record<KnowledgeKind, string> = {
  grammar: '语法',
  phrase: '搭配',
  vocabulary: '词汇',
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function highlightKnowledgeInSentence(sentence: string, knowledge: string) {
  const source = sentence.trim()
  const target = knowledge.trim()

  if (!source || !target) {
    return escapeHtml(source)
  }

  const startIndex = source.indexOf(target)
  if (startIndex < 0) {
    return escapeHtml(source)
  }

  const endIndex = startIndex + target.length
  return [
    escapeHtml(source.slice(0, startIndex)),
    '<strong>',
    escapeHtml(source.slice(startIndex, endIndex)),
    '</strong>',
    escapeHtml(source.slice(endIndex)),
  ].join('')
}

function normalizeAnkiEndpoint(endpoint: string) {
  return endpoint.trim().replace(/\/+$/, '')
}

function parseEndpoint(endpoint: string) {
  try {
    return new URL(normalizeAnkiEndpoint(endpoint))
  } catch {
    return null
  }
}

function isLoopbackHostname(hostname: string) {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1'
}

function isLikelySafariBrowser() {
  if (typeof navigator === 'undefined') {
    return false
  }

  const userAgent = navigator.userAgent
  const vendor = navigator.vendor

  return (
    /Safari/i.test(userAgent) &&
    /Apple/i.test(vendor) &&
    !/Chrome|Chromium|CriOS|EdgiOS|FxiOS|OPiOS|DuckDuckGo/i.test(userAgent)
  )
}

function isSecureHttpsPage() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.isSecureContext && window.location.protocol === 'https:'
}

export function getAnkiCompatibilityIssue(endpoint: string): AnkiCompatibilityIssue | null {
  const parsed = parseEndpoint(endpoint)
  if (!parsed) {
    return null
  }

  if (
    isLikelySafariBrowser() &&
    isSecureHttpsPage() &&
    parsed.protocol === 'http:' &&
    isLoopbackHostname(parsed.hostname)
  ) {
    return {
      code: 'safari-secure-loopback-http',
      summary:
        'Safari 会阻止当前 HTTPS 页面直接访问本机 HTTP 版 AnkiConnect，这不是你的 Anki 配置错误。',
      details: [
        `当前页面来源是 ${window.location.origin}，AnkiConnect 地址是 ${parsed.origin}。`,
        '请改用 Chrome 打开当前线上页面，或者改为在本地通过 HTTP 打开本应用后再连接 Anki。',
      ],
    }
  }

  return null
}

async function invokeAnkiAction<Result>(
  endpoint: string,
  action: string,
  params: Record<string, unknown> = {},
  signal?: AbortSignal,
) {
  const compatibilityIssue = getAnkiCompatibilityIssue(endpoint)
  if (compatibilityIssue) {
    throw new Error(compatibilityIssue.summary)
  }

  const response = await fetch(normalizeAnkiEndpoint(endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      version: 6,
      params,
    }),
    signal,
  })

  if (!response.ok) {
    throw new Error(`AnkiConnect 请求失败（${response.status}）。`)
  }

  const payload = (await response.json()) as AnkiResponse<Result>
  if (payload.error) {
    throw new Error(payload.error)
  }

  if (typeof payload.result === 'undefined') {
    throw new Error(`AnkiConnect 没有返回 ${action} 的结果。`)
  }

  return payload.result
}

function getAnkiFieldMappingIssues(config: AnkiConfig) {
  const issues: string[] = []

  if (!config.endpoint.trim()) {
    issues.push('请先在设置的 Anki 标签页里填写 AnkiConnect URL。')
  }

  if (!config.deck.trim()) {
    issues.push('请先在设置的 Anki 标签页里选择要写入的 deck。')
  }

  if (!config.noteType.trim()) {
    issues.push('请先在设置的 Anki 标签页里选择 note type。')
  }

  const assignedFields = ankiFieldSourceOrder
    .map((source) => ({
      source,
      field: config.fieldMapping[source].trim(),
    }))
    .filter((item) => item.field.length > 0)

  for (const source of ankiFieldSourceOrder) {
    if (!config.fieldMapping[source].trim()) {
      issues.push(`请先为「${ankiFieldSourceLabelMap[source]}」选择字段映射。`)
      break
    }
  }

  const fieldSet = new Set<string>()
  for (const assignment of assignedFields) {
    if (fieldSet.has(assignment.field)) {
      issues.push('字段映射里存在重复目标字段，请为每个内容选择不同的 Anki 字段。')
      break
    }

    fieldSet.add(assignment.field)
  }

  return issues
}

function buildFields(
  config: AnkiConfig,
  payload: AnkiNotePayload,
) {
  return ankiFieldSourceOrder.reduce<Record<string, string>>((fields, source) => {
    const targetField = config.fieldMapping[source].trim()
    if (!targetField) {
      return fields
    }

    return {
      ...fields,
      [targetField]: payload[source],
    }
  }, {})
}

export function toUserFacingAnkiError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '连接 AnkiConnect 超时，请确认 Anki 已打开后重试。'
  }

  if (error instanceof TypeError) {
    return '无法连接到 AnkiConnect。请确认 Anki 已打开、AnkiConnect 已启用，并允许当前页面来源访问 127.0.0.1:8765。'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Anki 添加失败，请稍后重试。'
}

export function buildAnkiNotePayload(
  sentence: SentenceItem,
  result: AnalysisResult,
  highlight: AnalysisHighlight,
): AnkiNotePayload {
  const sentenceText = sentence.editedText || sentence.text

  return {
    sentence: highlightKnowledgeInSentence(sentenceText, highlight.text),
    grammar: result.grammar,
    meaning: result.meaning,
    knowledge: highlight.text,
    knowledgeKind: ankiKnowledgeKindLabelMap[highlight.kind],
    knowledgeExplanation: highlight.explanation,
  }
}

export async function fetchAnkiVersion(endpoint: string, signal?: AbortSignal) {
  try {
    return await invokeAnkiAction<number>(endpoint, 'version', {}, signal)
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

export async function fetchAnkiDeckNames(endpoint: string, signal?: AbortSignal) {
  try {
    return await invokeAnkiAction<string[]>(endpoint, 'deckNames', {}, signal)
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

export async function fetchAnkiNoteTypes(endpoint: string, signal?: AbortSignal) {
  try {
    return await invokeAnkiAction<string[]>(endpoint, 'modelNames', {}, signal)
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

export async function fetchAnkiNoteFields(
  endpoint: string,
  noteType: string,
  signal?: AbortSignal,
) {
  try {
    return await invokeAnkiAction<string[]>(
      endpoint,
      'modelFieldNames',
      { modelName: noteType },
      signal,
    )
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

export async function addNoteToAnki(
  config: AnkiConfig,
  payload: AnkiNotePayload,
) {
  const issue = getAnkiFieldMappingIssues(config)[0]
  if (issue) {
    throw new Error(issue)
  }

  try {
    return await invokeAnkiAction<number>(config.endpoint, 'addNote', {
      note: {
        deckName: config.deck,
        modelName: config.noteType,
        fields: buildFields(config, payload),
        options: {
          allowDuplicate: true,
        },
      },
    })
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}
