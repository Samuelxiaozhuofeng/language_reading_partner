import { toUserFacingAnkiError } from './errors'

type AnkiResponse<Result> = {
  error?: string | null
  result?: Result
}

type AnkiPermissionResult = {
  permission: 'granted' | 'denied'
  requireApiKey?: boolean
  version?: number
}

export type AnkiCompatibilityIssue = {
  code: 'safari-secure-loopback-http'
  summary: string
  details: string[]
}

export function normalizeAnkiEndpoint(endpoint: string) {
  return endpoint.trim().replace(/\/+$/, '')
}

export function parseEndpoint(endpoint: string) {
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

export async function invokeAnkiAction<Result>(
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

export async function ensureAnkiPermission(endpoint: string, signal?: AbortSignal) {
  try {
    const permissionResult = await invokeAnkiAction<AnkiPermissionResult>(
      endpoint,
      'requestPermission',
      {},
      signal,
    )

    if (permissionResult.permission !== 'granted') {
      throw new Error('AnkiConnect 拒绝了当前页面的访问请求。请在 Anki 弹窗中允许后再重试。')
    }

    if (permissionResult.requireApiKey) {
      throw new Error(
        '当前 AnkiConnect 已开启 API Key，本应用暂不支持填写 API Key。请在 AnkiConnect 配置里关闭 requireApiKey 后重试。',
      )
    }

    return permissionResult
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
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
