import type { JapaneseChunkExplanation, JapaneseToken } from '../types'
import { isJapaneseAnalysisPunctuation } from './japaneseUtils'

type ChunkCandidate = Partial<Record<keyof JapaneseChunkExplanation, unknown>> & {
  depends_on?: unknown
  grammar_role?: unknown
  head_chunk_index?: unknown
  token_indices?: unknown
}

function toTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseNullableString(value: unknown) {
  const text = toTrimmedString(value)
  return text || null
}

function parseNullableIndex(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN

  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw new Error('chunkAnalysis.head_chunk_index 必须是非负整数或 null。')
  }

  return numericValue
}

function parseTokenIndices(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined
  }

  const indices = value.map((item) => {
    const numericValue =
      typeof item === 'number'
        ? item
        : typeof item === 'string' && item.trim()
          ? Number(item)
          : Number.NaN

    if (!Number.isInteger(numericValue) || numericValue < 0) {
      throw new Error('chunkAnalysis.token_indices 必须只包含非负整数。')
    }

    return numericValue
  })

  if (indices.length === 0) {
    throw new Error('chunkAnalysis.token_indices 不能为空。')
  }

  for (let index = 1; index < indices.length; index += 1) {
    if (indices[index] !== indices[index - 1] + 1) {
      throw new Error('chunkAnalysis.token_indices 必须连续递增。')
    }
  }

  return indices
}

function validateChunkTokenCoverage(
  chunks: JapaneseChunkExplanation[],
  tokens: JapaneseToken[],
) {
  if (tokens.length === 0 || chunks.length === 0) {
    return
  }

  const flattenedIndices = chunks.flatMap((chunk) => chunk.tokenIndices ?? [])
  const expectedIndices = tokens
    .map((token, index) => (isJapaneseAnalysisPunctuation(token) ? null : index))
    .filter((index): index is number => index !== null)

  if (expectedIndices.length === 0) {
    return
  }

  if (flattenedIndices.length !== expectedIndices.length) {
    throw new Error('chunkAnalysis.token_indices 必须覆盖所有非标点 token。')
  }

  flattenedIndices.forEach((tokenIndex, flattenedIndex) => {
    if (tokenIndex !== expectedIndices[flattenedIndex]) {
      throw new Error('chunkAnalysis.token_indices 必须按原句顺序覆盖每个非标点 token 一次。')
    }
  })

  chunks.forEach((chunk, chunkIndex) => {
    const tokenIndices = chunk.tokenIndices
    if (!tokenIndices?.length) {
      throw new Error('chunkAnalysis.token_indices 缺失。')
    }

    if (tokenIndices.some((tokenIndex) => {
      const token = tokens[tokenIndex]
      return token ? isJapaneseAnalysisPunctuation(token) : false
    })) {
      throw new Error('chunkAnalysis.token_indices 不应包含标点 token。')
    }

    const expectedChunk = tokenIndices.map((tokenIndex) => tokens[tokenIndex]?.surface ?? '').join('')
    if (chunk.chunk !== expectedChunk) {
      throw new Error(`chunkAnalysis 第 ${chunkIndex + 1} 项的 chunk 与 token_indices 不一致。`)
    }

    if (
      chunk.headChunkIndex !== null &&
      chunk.headChunkIndex !== undefined &&
      chunk.headChunkIndex >= chunks.length
    ) {
      throw new Error('chunkAnalysis.head_chunk_index 超出 chunkAnalysis 范围。')
    }
  })
}

export function sanitizeChunkAnalysis(
  value: unknown,
  tokens?: JapaneseToken[],
): JapaneseChunkExplanation[] {
  if (!Array.isArray(value)) {
    if (tokens?.length) {
      throw new Error('日语解析返回缺少 chunkAnalysis 数组。')
    }

    return []
  }

  const chunks = value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return []
    }

    const candidate = item as ChunkCandidate
    const chunk = toTrimmedString(candidate.chunk)
    const reading = toTrimmedString(candidate.reading)
    const pos = toTrimmedString(candidate.pos)
    const grammarRole = toTrimmedString(candidate.grammarRole ?? candidate.grammar_role)
    const tokenIndices = parseTokenIndices(candidate.tokenIndices ?? candidate.token_indices)
    const headChunkIndex = parseNullableIndex(
      candidate.headChunkIndex ?? candidate.head_chunk_index,
    )
    const dependsOn = parseNullableString(candidate.dependsOn ?? candidate.depends_on)
    const explanation = toTrimmedString(candidate.explanation)

    if (!chunk || !explanation) {
      return []
    }

    const sanitized: JapaneseChunkExplanation = {
      chunk,
      reading,
      pos,
      explanation,
    }

    if (grammarRole) {
      sanitized.grammarRole = grammarRole
    }

    if (tokenIndices) {
      sanitized.tokenIndices = tokenIndices
    }

    if (headChunkIndex !== null) {
      sanitized.headChunkIndex = headChunkIndex
    }

    if (dependsOn) {
      sanitized.dependsOn = dependsOn
    }

    return [sanitized]
  })

  if (tokens?.length) {
    const hasAnalysisTokens = tokens.some((token) => !isJapaneseAnalysisPunctuation(token))

    if (chunks.length === 0 && hasAnalysisTokens) {
      throw new Error('日语解析返回缺少有效语块。')
    }

    validateChunkTokenCoverage(chunks, tokens)
  }

  return chunks
}
