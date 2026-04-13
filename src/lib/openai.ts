import type { AnalysisJob, AnalysisResult, ApiConfig, PromptConfig } from '../types'
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

const REQUEST_TIMEOUT_MS = 60_000

function interpolatePrompt(
  template: string,
  job: AnalysisJob,
) {
  return template
    .replaceAll('{previousSentence}', job.previousSentence ?? '（无）')
    .replaceAll('{sentence}', job.sentence)
    .replaceAll('{nextSentence}', job.nextSentence ?? '（无）')
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

function parseStructuredResult(text: string): AnalysisResult {
  const normalized = text.trim()

  if (!normalized) {
    throw new Error('模型未返回文本内容。')
  }

  const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonCandidate = fencedMatch?.[1] ?? normalized

  try {
    const parsed = JSON.parse(jsonCandidate) as {
      grammar?: unknown
      meaning?: unknown
      content?: unknown
      highlights?: unknown
    }

    const grammar = typeof parsed.grammar === 'string' ? parsed.grammar.trim() : ''
    const meaningSource = typeof parsed.meaning === 'string' ? parsed.meaning : parsed.content
    const meaning = typeof meaningSource === 'string' ? meaningSource.trim() : ''
    const highlights = sanitizeHighlights(parsed.highlights)

    if (!grammar && !meaning) {
      throw new Error('empty')
    }

    return {
      sentenceId: '',
      grammar,
      meaning,
      highlights,
      isPartial: !grammar || !meaning,
      rawText: normalized,
    }
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
): Promise<AnalysisResult> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

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
      throw new Error('请求超时，请检查网络或缩短单次处理内容。')
    }

    if (error instanceof TypeError) {
      throw new Error('网络请求失败，请检查 API URL、浏览器跨域设置或网络连通性。')
    }

    throw error
  } finally {
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
) {
  const concurrency = Math.max(1, Math.min(config.concurrency, jobs.length || 1))
  let cursor = 0

  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor]
      cursor += 1

      callbacks.onStart?.(job)

      try {
        const result = await analyzeSentence(config, promptConfig, job)
        callbacks.onSuccess?.({ sentenceId: job.sentenceId, result })
      } catch (error) {
        callbacks.onError?.({
          sentenceId: job.sentenceId,
          error: toUserFacingError(error),
        })
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
}
