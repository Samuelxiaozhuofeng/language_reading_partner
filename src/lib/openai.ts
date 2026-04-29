import type {
  AnalysisDocumentContext,
  AnalysisJob,
  AnalysisResult,
  ApiConfig,
  BatchAnalysisJob,
  PromptConfig,
  JapaneseToken,
  VocabularyExplanation,
  VocabularyPromptConfig,
} from '../types'
import { sanitizeChunkAnalysis } from './analysisResult'
import { sanitizeHighlights } from './knowledge'

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

type ModelListResponse = {
  data?: Array<{
    id?: string
  }>
  error?: {
    message?: string
  }
}

type AnalysisCallbacks = {
  onStart?: (job: AnalysisJob) => void
  onSuccess?: (payload: { sentenceId: string; result: AnalysisResult }) => void
  onError?: (payload: { sentenceId: string; error: string }) => void
}

type RunConcurrentAnalysisOptions = {
  batchSize?: number
  signal?: AbortSignal
}

type VocabularyExplanationJob = {
  context: string
  word: string
}

type StructuredAnalysisValue = {
  grammar?: unknown
  meaning?: unknown
  content?: unknown
  chunkAnalysis?: unknown
  highlights?: unknown
}

const REQUEST_TIMEOUT_MS = 60_000
const DOCUMENT_PLACEHOLDERS = [
  '{documentMetadata}',
  '{documentType}',
  '{documentTitle}',
  '{documentAuthor}',
  '{chapterTitle}',
]

function toPromptValue(value?: string) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '（无）'
}

function getDocumentTypeLabel(documentContext?: AnalysisDocumentContext) {
  if (documentContext?.documentType === 'chapter') {
    return 'EPUB 章节'
  }

  if (documentContext?.documentType === 'article') {
    return '文章'
  }

  return '未知'
}

function buildDocumentMetadata(documentContext?: AnalysisDocumentContext) {
  if (!documentContext) {
    return '文档类型：未知\n标题：（无）\n作者：（无）\n章节：（无）'
  }

  return [
    `文档类型：${getDocumentTypeLabel(documentContext)}`,
    `标题：${toPromptValue(documentContext.title)}`,
    `作者：${toPromptValue(documentContext.author)}`,
    `章节：${toPromptValue(documentContext.chapterTitle)}`,
  ].join('\n')
}

function formatJapaneseTokens(tokens?: JapaneseToken[]) {
  if (!tokens?.length) {
    return '（无）'
  }

  return tokens
    .map((token) =>
      [
        token.surface,
        token.reading || '読みなし',
        token.baseForm || token.surface,
        token.pos || '品詞不明',
      ].join(' / '),
    )
    .join('｜')
}

function interpolatePrompt(
  template: string,
  job: AnalysisJob,
) {
  const interpolated = template
    .replaceAll('{previousSentence}', toPromptValue(job.previousSentence))
    .replaceAll('{sentence}', job.sentence)
    .replaceAll('{nextSentence}', toPromptValue(job.nextSentence))
    .replaceAll('{tokens}', formatJapaneseTokens(job.tokens))
    .replaceAll('{documentMetadata}', buildDocumentMetadata(job.documentContext))
    .replaceAll('{documentType}', getDocumentTypeLabel(job.documentContext))
    .replaceAll('{documentTitle}', toPromptValue(job.documentContext?.title))
    .replaceAll('{documentAuthor}', toPromptValue(job.documentContext?.author))
    .replaceAll('{chapterTitle}', toPromptValue(job.documentContext?.chapterTitle))

  if (DOCUMENT_PLACEHOLDERS.some((placeholder) => template.includes(placeholder))) {
    return interpolated
  }

  return `${buildDocumentMetadata(job.documentContext)}\n\n${interpolated}`
}

function interpolateVocabularyPrompt(template: string, job: VocabularyExplanationJob) {
  return template
    .replaceAll('{context}', job.context)
    .replaceAll('{word}', job.word)
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')

  if (trimmed.endsWith('/chat/completions')) {
    return trimmed
  }

  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/chat/completions`
  }

  return `${trimmed}/v1/chat/completions`
}

function normalizeModelsUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')

  if (trimmed.endsWith('/models')) {
    return trimmed
  }

  if (trimmed.endsWith('/chat/completions')) {
    return `${trimmed.slice(0, -'/chat/completions'.length)}/models`
  }

  if (trimmed.endsWith('/v1')) {
    return `${trimmed}/models`
  }

  return `${trimmed}/v1/models`
}

function extractTextContent(content: ChatCompletionResponse['choices']) {
  const raw = content?.[0]?.message?.content

  if (typeof raw === 'string') {
    return raw
  }

  if (Array.isArray(raw)) {
    return raw
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('\n')
      .trim()
  }

  return ''
}

function parseAnalysisValue(value: StructuredAnalysisValue, rawText: string): AnalysisResult {
  const grammar = typeof value.grammar === 'string' ? value.grammar.trim() : ''
  const meaningSource = typeof value.meaning === 'string' ? value.meaning : value.content
  const meaning = typeof meaningSource === 'string' ? meaningSource.trim() : ''
  const highlights = sanitizeHighlights(value.highlights)
  const chunkAnalysis = sanitizeChunkAnalysis(value.chunkAnalysis)

  if (!grammar && !meaning) {
    throw new Error('empty')
  }

  return {
    sentenceId: '',
    grammar,
    meaning,
    highlights,
    chunkAnalysis,
    isPartial: !grammar || !meaning,
    rawText,
  }
}

export function parseStructuredResult(text: string): AnalysisResult {
  const normalized = text.trim()

  if (!normalized) {
    throw new Error('模型未返回文本内容。')
  }

  const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonCandidate = fencedMatch?.[1] ?? normalized

  try {
    return parseAnalysisValue(JSON.parse(jsonCandidate) as StructuredAnalysisValue, normalized)
  } catch {
    const grammarMatch = normalized.match(/(?:语法|grammar)[:：]\s*([\s\S]*?)(?:\n(?:内容|meaning)[:：]|$)/i)
    const meaningMatch = normalized.match(/(?:内容|meaning)[:：]\s*([\s\S]*)$/i)

    const grammar = grammarMatch?.[1]?.trim() ?? ''
    const meaning = meaningMatch?.[1]?.trim() ?? ''

    if (!grammar && !meaning) {
      throw new Error('返回内容不是可解析的 JSON，也不包含语法/内容字段。')
    }

    return {
      sentenceId: '',
      grammar,
      meaning,
      highlights: [],
      isPartial: !grammar || !meaning,
      rawText: normalized,
    }
  }
}

function createMalformedBatchResult(rawText: string): AnalysisResult {
  return {
    sentenceId: '',
    grammar: '',
    meaning: '',
    highlights: [],
    isPartial: true,
    rawText,
  }
}

function buildJapaneseBatchRequestBody(config: ApiConfig, batchJob: BatchAnalysisJob) {
  const numberedSentences = batchJob.sentenceEntries
    .map(({ sentence, tokens }, index) =>
      [
        `句子 ${index + 1}: ${sentence}`,
        `语块 ${index + 1}: ${formatJapaneseTokens(tokens)}`,
      ].join('\n'),
    )
    .join('\n\n')

  const prompt = [
    '你是一位日语教师，帮助中文母语者阅读日语文本。',
    `本批次包含 ${batchJob.sentenceEntries.length} 个日语句子。请根据每个句子及其形态素分词结果，逐句处理所有句子。`,
    '不要跳过、合并或重排任何句子。',
    '必须只输出一个 JSON 数组，不要输出 Markdown，不要输出额外说明。',
    '',
    'JSON 数组中每一项都必须按顺序对应同编号句子，结构固定为：',
    '[',
    '  {',
    '    "grammar": "string",',
    '    "meaning": "string",',
    '    "chunkAnalysis": [',
    '      {"chunk": "string", "reading": "string", "pos": "string", "explanation": "string"}',
    '    ],',
    '    "highlights": [',
    '      {"text": "string", "kind": "grammar | phrase | vocabulary", "explanation": "string"}',
    '    ]',
    '  }',
    ']',
    '',
    '要求：',
    '1. 必须使用中文回答。',
    '2. grammar：解释句子中最值得学习的语法点、句型、助词用法、敬语层级等。',
    '3. meaning：用自然中文说明句意、语气和上下文作用。',
    '4. chunkAnalysis 的顺序和数量必须与对应输入语块完全一致。',
    '5. chunkAnalysis.reading 使用平假名，pos 使用日语词性名，explanation 用中文简要说明该词块在句中的含义和功能。',
    '6. highlights 返回 0-4 个最值得收藏的知识点，text 必须是日语原文。',
    `7. 必须返回 ${batchJob.sentenceEntries.length} 个数组元素，第 1 项对应句子 1，第 2 项对应句子 2，依此类推，顺序必须与句子编号完全一致。`,
    '',
    '文档元信息：',
    buildDocumentMetadata(batchJob.documentContext),
    '',
    `上文：${toPromptValue(batchJob.previousSentence)}`,
    '待解析句子与语块：',
    numberedSentences,
    `下文：${toPromptValue(batchJob.nextSentence)}`,
  ].join('\n')

  return {
    model: config.model,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  }
}

function createLanguageConsistentChunks(jobs: AnalysisJob[], batchSize: number) {
  const chunks: AnalysisJob[][] = []
  let currentChunk: AnalysisJob[] = []
  let currentLanguage: AnalysisJob['language'] | null = null

  for (const job of jobs) {
    if (
      currentChunk.length >= batchSize ||
      (currentChunk.length > 0 && currentLanguage !== job.language)
    ) {
      chunks.push(currentChunk)
      currentChunk = []
      currentLanguage = null
    }

    currentChunk.push(job)
    currentLanguage = job.language
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  return chunks
}

function parseStructuredBatchResult(text: string, count: number): AnalysisResult[] {
  const normalized = text.trim()

  if (!normalized) {
    throw new Error('模型未返回文本内容。')
  }

  const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonCandidate = fencedMatch?.[1] ?? normalized
  const parsed = JSON.parse(jsonCandidate) as unknown

  if (!Array.isArray(parsed)) {
    throw new Error('批量解析返回内容不是 JSON 数组。')
  }

  return Array.from({ length: count }, (_, index) => {
    const item = parsed[index]
    const rawText = item === undefined ? normalized : JSON.stringify(item)

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return createMalformedBatchResult(rawText)
    }

    try {
      return parseAnalysisValue(item as StructuredAnalysisValue, rawText)
    } catch {
      return createMalformedBatchResult(rawText)
    }
  })
}

function parseVocabularyExplanation(text: string, word: string): VocabularyExplanation {
  const normalized = text.trim()

  if (!normalized) {
    throw new Error('模型未返回文本内容。')
  }

  const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonCandidate = fencedMatch?.[1] ?? normalized

  try {
    const parsed = JSON.parse(jsonCandidate) as {
      explanation?: unknown
    }
    const explanation = typeof parsed.explanation === 'string' ? parsed.explanation.trim() : ''

    if (!explanation) {
      throw new Error('empty')
    }

    return {
      word,
      explanation,
      rawText: normalized,
    }
  } catch {
    throw new Error('词汇解释返回内容不是可解析的 JSON，或缺少 explanation 字段。')
  }
}

function buildRequestBody(config: ApiConfig, promptConfig: PromptConfig, job: AnalysisJob) {
  return {
    model: config.model,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: interpolatePrompt(promptConfig.template, job),
      },
    ],
  }
}

function buildBatchRequestBody(config: ApiConfig, batchJob: BatchAnalysisJob) {
  const hasJapaneseEntry = batchJob.sentenceEntries.some((entry) => entry.language === 'ja')
  const isJapaneseBatch =
    batchJob.sentenceEntries.length > 0 &&
    batchJob.sentenceEntries.every((entry) => entry.language === 'ja')

  if (isJapaneseBatch) {
    return buildJapaneseBatchRequestBody(config, batchJob)
  }

  if (hasJapaneseEntry) {
    throw new Error('批量解析不支持混合语言句子，请将不同语言分开解析。')
  }

  const numberedSentences = batchJob.sentenceEntries
    .map(({ sentence }, index) => `句子 ${index + 1}: ${sentence}`)
    .join('\n')

  const prompt = [
    '你是一名多语言阅读学习助手。你的任务是帮助学习者理解外语文本。',
    '',
    '请先根据输入句子自动判断待学习文本的主要语言、文本类型和大致难度，然后逐句解释。',
    '解释语言固定使用中文。',
    '必须只输出一个 JSON 数组，不要输出 Markdown，不要输出额外说明。',
    '',
    'JSON 数组中每一项都必须对应同序号句子，结构固定为：',
    '[',
    '  {',
    '    "grammar": "string",',
    '    "meaning": "string",',
    '    "highlights": [',
    '      {',
    '        "text": "string",',
    '        "kind": "grammar | phrase | vocabulary",',
    '        "explanation": "string"',
    '      }',
    '    ]',
    '  }',
    ']',
    '',
    '要求：',
    '1. 必须使用中文回答。',
    '2. grammar：解释对应句子中最值得学习的语法点、固定搭配、习语表达、句型结构或有学习价值的表达。应根据句子实际难度选择，不要强行只讲高级语法。',
    '3. meaning：用自然中文说明对应句子在上下文中的意思、语气、叙述作用或说话人意图。',
    '4. highlights：每个句子返回 0 到 4 个最值得收藏的知识点。',
    '5. highlights 里的 text 必须严格来自原句，保留原文语言，不要翻译、不要改写。',
    '6. kind 只能是 grammar、phrase、vocabulary 三选一。',
    '7. explanation 必须是简短中文解释，适合后续复习。',
    '8. 如果句子没有明显值得收藏的点，highlights 返回空数组 []。',
    '9. grammar 和 meaning 即使很短也要尽量给出，不要留空。',
    `10. 必须返回 ${batchJob.sentenceEntries.length} 个数组元素，顺序必须与句子编号完全一致。`,
    '11. 不要假设文本一定是某一种语言；请根据句子内容自动判断。',
    '12. 如果文本中混有多种语言，以当前句子的主要学习语言为准。',
    '13. 不要输出语言判断、难度判断或文本类型字段，只在内部判断后用于解释。',
    '',
    '文档元信息：',
    buildDocumentMetadata(batchJob.documentContext),
    '',
    `上文：${toPromptValue(batchJob.previousSentence)}`,
    '待解析句子：',
    numberedSentences,
    `下文：${toPromptValue(batchJob.nextSentence)}`,
  ].join('\n')

  return {
    model: config.model,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  }
}

function buildVocabularyRequestBody(
  config: ApiConfig,
  promptConfig: VocabularyPromptConfig,
  job: VocabularyExplanationJob,
) {
  return {
    model: config.model,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: interpolateVocabularyPrompt(promptConfig.template, job),
      },
    ],
  }
}

export function toUserFacingError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '发生未知错误，请稍后重试。'
}

export async function analyzeSentence(
  config: ApiConfig,
  promptConfig: PromptConfig,
  job: AnalysisJob,
  signal?: AbortSignal,
): Promise<AnalysisResult> {
  const controller = new AbortController()
  let didTimeout = false
  const handleExternalAbort = () => controller.abort()
  const timeoutId = window.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      signal.addEventListener('abort', handleExternalAbort, { once: true })
    }
  }

  try {
    const response = await fetch(normalizeBaseUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify(buildRequestBody(config, promptConfig, job)),
      signal: controller.signal,
    })

    if (response.status === 401 || response.status === 403) {
      throw new Error('鉴权失败，请检查 API Key 是否正确。')
    }

    if (response.status === 429) {
      throw new Error('请求过于频繁，可能触发了限流，请降低并发数后重试。')
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `接口请求失败（${response.status}）。${text ? `返回：${text.slice(0, 120)}` : ''}`,
      )
    }

    const payload = (await response.json()) as ChatCompletionResponse
    if (payload.error?.message) {
      throw new Error(payload.error.message)
    }

    const text = extractTextContent(payload.choices)
    const parsed = parseStructuredResult(text)

    return {
      ...parsed,
      sentenceId: job.sentenceId,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (!didTimeout && signal?.aborted) {
        throw error
      }

      throw new Error('请求超时，请检查网络或缩短单次处理内容。')
    }

    if (error instanceof TypeError) {
      throw new Error('网络请求失败，请检查 API URL、浏览器跨域设置或网络连通性。')
    }

    throw error
  } finally {
    if (signal) {
      signal.removeEventListener('abort', handleExternalAbort)
    }
    window.clearTimeout(timeoutId)
  }
}

export async function analyzeBatch(
  config: ApiConfig,
  batchJob: BatchAnalysisJob,
  signal?: AbortSignal,
): Promise<AnalysisResult[]> {
  const controller = new AbortController()
  let didTimeout = false
  const handleExternalAbort = () => controller.abort()
  const timeoutId = window.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS * Math.min(batchJob.sentenceEntries.length, 5))

  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      signal.addEventListener('abort', handleExternalAbort, { once: true })
    }
  }

  try {
    const response = await fetch(normalizeBaseUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify(buildBatchRequestBody(config, batchJob)),
      signal: controller.signal,
    })

    if (response.status === 401 || response.status === 403) {
      throw new Error('鉴权失败，请检查 API Key 是否正确。')
    }

    if (response.status === 429) {
      throw new Error('请求过于频繁，可能触发了限流，请降低并发数后重试。')
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `接口请求失败（${response.status}）。${text ? `返回：${text.slice(0, 120)}` : ''}`,
      )
    }

    const payload = (await response.json()) as ChatCompletionResponse
    if (payload.error?.message) {
      throw new Error(payload.error.message)
    }

    const text = extractTextContent(payload.choices)
    const parsed = parseStructuredBatchResult(text, batchJob.sentenceEntries.length)

    return parsed.map((result, index) => ({
      ...result,
      sentenceId: batchJob.sentenceEntries[index]?.sentenceId ?? '',
    }))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (!didTimeout && signal?.aborted) {
        throw error
      }

      throw new Error('请求超时，请检查网络或缩短单次处理内容。')
    }

    if (error instanceof TypeError) {
      throw new Error('网络请求失败，请检查 API URL、浏览器跨域设置或网络连通性。')
    }

    throw error
  } finally {
    if (signal) {
      signal.removeEventListener('abort', handleExternalAbort)
    }
    window.clearTimeout(timeoutId)
  }
}

export async function explainVocabulary(
  config: ApiConfig,
  promptConfig: VocabularyPromptConfig,
  job: VocabularyExplanationJob,
  signal?: AbortSignal,
): Promise<VocabularyExplanation> {
  if (!config.baseUrl.trim() || !config.apiKey.trim() || !config.model.trim()) {
    throw new Error('请先在设置里配置词汇解释 AI。')
  }

  if (!promptConfig.template.trim()) {
    throw new Error('请先在设置里填写词汇解释 Prompt。')
  }

  const controller = new AbortController()
  let didTimeout = false
  const handleExternalAbort = () => controller.abort()
  const timeoutId = window.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      signal.addEventListener('abort', handleExternalAbort, { once: true })
    }
  }

  try {
    const response = await fetch(normalizeBaseUrl(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      body: JSON.stringify(buildVocabularyRequestBody(config, promptConfig, job)),
      signal: controller.signal,
    })

    if (response.status === 401 || response.status === 403) {
      throw new Error('鉴权失败，请检查词汇解释 AI 的 API Key 是否正确。')
    }

    if (response.status === 429) {
      throw new Error('词汇解释请求过于频繁，可能触发了限流，请稍后再试。')
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `词汇解释接口请求失败（${response.status}）。${text ? `返回：${text.slice(0, 120)}` : ''}`,
      )
    }

    const payload = (await response.json()) as ChatCompletionResponse
    if (payload.error?.message) {
      throw new Error(payload.error.message)
    }

    return parseVocabularyExplanation(extractTextContent(payload.choices), job.word)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (!didTimeout && signal?.aborted) {
        throw error
      }

      throw new Error('词汇解释请求超时，请检查网络或换用更快的模型。')
    }

    if (error instanceof TypeError) {
      throw new Error('词汇解释网络请求失败，请检查 API URL、浏览器跨域设置或网络连通性。')
    }

    throw error
  } finally {
    if (signal) {
      signal.removeEventListener('abort', handleExternalAbort)
    }
    window.clearTimeout(timeoutId)
  }
}

export async function fetchAvailableModels(
  config: Pick<ApiConfig, 'baseUrl' | 'apiKey'>,
  signal?: AbortSignal,
): Promise<string[]> {
  try {
    const response = await fetch(normalizeModelsUrl(config.baseUrl), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.apiKey.trim()}`,
      },
      signal,
    })

    if (response.status === 401 || response.status === 403) {
      throw new Error('模型列表获取失败，请检查 API Key 是否正确。')
    }

    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `模型列表获取失败（${response.status}）。${text ? `返回：${text.slice(0, 120)}` : ''}`,
      )
    }

    const payload = (await response.json()) as ModelListResponse
    if (payload.error?.message) {
      throw new Error(payload.error.message)
    }

    return Array.from(
      new Set(payload.data?.map((item) => item.id).filter((id): id is string => Boolean(id)) ?? []),
    ).sort((left, right) => left.localeCompare(right))
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    if (error instanceof TypeError) {
      throw new Error('模型列表获取失败，请检查 API URL、浏览器跨域设置或网络连通性。')
    }

    throw error
  }
}

export async function runConcurrentAnalysis(
  config: ApiConfig,
  promptConfig: PromptConfig,
  jobs: AnalysisJob[],
  callbacks: AnalysisCallbacks,
  options: RunConcurrentAnalysisOptions = {},
) {
  const batchSize = Math.max(1, Math.round(options.batchSize ?? 1))
  const chunks =
    batchSize > 1
      ? createLanguageConsistentChunks(jobs, batchSize)
      : []
  const concurrency = Math.max(
    1,
    Math.min(config.concurrency, batchSize > 1 ? chunks.length || 1 : jobs.length || 1),
  )
  let cursor = 0
  const { signal } = options

  async function runSingleJob(job: AnalysisJob, shouldNotifyStart = true) {
    if (shouldNotifyStart) {
      callbacks.onStart?.(job)
    }

    try {
      const result = await analyzeSentence(config, promptConfig, job, signal)
      callbacks.onSuccess?.({ sentenceId: job.sentenceId, result })
    } catch (error) {
      if (signal?.aborted) {
        return
      }

      callbacks.onError?.({
        sentenceId: job.sentenceId,
        error: toUserFacingError(error),
      })
    }
  }

  async function worker() {
    while (cursor < jobs.length && !signal?.aborted) {
      const job = jobs[cursor]
      cursor += 1

      if (signal?.aborted) {
        return
      }

      await runSingleJob(job)
    }
  }

  async function batchWorker() {
    while (cursor < chunks.length && !signal?.aborted) {
      const chunk = chunks[cursor]
      cursor += 1

      if (signal?.aborted) {
        return
      }

      chunk.forEach((job) => callbacks.onStart?.(job))

      try {
        const batchResults = await analyzeBatch(
          config,
          {
            sentenceEntries: chunk.map(({ sentenceId, sentence, language, tokens }) => ({
              sentenceId,
              sentence,
              language,
              tokens,
            })),
            previousSentence: chunk[0]?.previousSentence,
            nextSentence: chunk[chunk.length - 1]?.nextSentence,
            documentContext: chunk[0]?.documentContext,
          },
          signal,
        )

        batchResults.forEach((result, index) => {
          const job = chunk[index]
          if (!job) {
            return
          }

          if (!result.grammar && !result.meaning) {
            callbacks.onError?.({
              sentenceId: job.sentenceId,
              error: '批量解析返回的对应结果缺少 grammar 和 meaning 字段。',
            })
            return
          }

          callbacks.onSuccess?.({ sentenceId: job.sentenceId, result })
        })
      } catch {
        for (const job of chunk) {
          if (signal?.aborted) {
            return
          }

          await runSingleJob(job, false)
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: concurrency }, () => (batchSize > 1 ? batchWorker() : worker())),
  )
}
