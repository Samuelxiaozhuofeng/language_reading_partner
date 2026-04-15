import type { SentenceItem, SentenceRange } from '../types'

export const DEFAULT_CHAPTER_RANGE_SIZE = 100

export function normalizeSentenceRange(
  range: SentenceRange | null | undefined,
  sentenceCount: number,
): SentenceRange | null {
  if (!range || sentenceCount <= 0) {
    return null
  }

  const safeStart = Number.isFinite(range.start) ? Math.floor(range.start) : 0
  const safeEnd = Number.isFinite(range.end) ? Math.floor(range.end) : safeStart
  const start = Math.max(0, Math.min(safeStart, sentenceCount - 1))
  const end = Math.max(start, Math.min(safeEnd, sentenceCount - 1))

  return { start, end }
}

export function getDefaultSentenceRange(
  sentenceCount: number,
  activeRange: SentenceRange | null | undefined,
): SentenceRange | null {
  if (sentenceCount <= 0) {
    return null
  }

  const normalizedActiveRange = normalizeSentenceRange(activeRange, sentenceCount)
  if (normalizedActiveRange) {
    return normalizedActiveRange
  }

  return {
    start: 0,
    end: Math.min(sentenceCount - 1, DEFAULT_CHAPTER_RANGE_SIZE - 1),
  }
}

export function doesRangeContainSentenceIndex(
  range: SentenceRange | null | undefined,
  sentenceIndex: number,
  sentenceCount: number,
) {
  const normalizedRange = normalizeSentenceRange(range, sentenceCount)
  if (!normalizedRange) {
    return false
  }

  return sentenceIndex >= normalizedRange.start && sentenceIndex <= normalizedRange.end
}

export function getSentenceRangeAroundIndex(
  sentenceCount: number,
  sentenceIndex: number,
  size = DEFAULT_CHAPTER_RANGE_SIZE,
): SentenceRange | null {
  if (sentenceCount <= 0) {
    return null
  }

  const normalizedIndex = Math.max(0, Math.min(sentenceIndex, sentenceCount - 1))
  const normalizedSize = Math.max(1, Math.min(size, sentenceCount))
  const preferredStart = normalizedIndex - Math.floor(normalizedSize / 4)
  const start = Math.max(0, Math.min(preferredStart, sentenceCount - normalizedSize))

  return {
    start,
    end: Math.min(sentenceCount - 1, start + normalizedSize - 1),
  }
}

export function getNextSentenceRange(
  sentenceCount: number,
  lastReadEnd: number,
  activeRange: SentenceRange | null | undefined,
  size = DEFAULT_CHAPTER_RANGE_SIZE,
): SentenceRange | null {
  if (sentenceCount <= 0) {
    return null
  }

  const normalizedActiveRange = normalizeSentenceRange(activeRange, sentenceCount)
  const nextStartSeed = Math.max(lastReadEnd, normalizedActiveRange?.end ?? -1) + 1

  if (nextStartSeed < sentenceCount) {
    const start = Math.max(0, nextStartSeed)
    return {
      start,
      end: Math.min(sentenceCount - 1, start + Math.max(1, size) - 1),
    }
  }

  const start = Math.max(0, sentenceCount - Math.max(1, size))
  return {
    start,
    end: sentenceCount - 1,
  }
}

export function getAutoAdvanceSentenceRange(
  sentenceCount: number,
  currentRange: SentenceRange | null | undefined,
): SentenceRange | null {
  const normalizedCurrentRange = normalizeSentenceRange(currentRange, sentenceCount)
  if (!normalizedCurrentRange) {
    return getDefaultSentenceRange(sentenceCount, null)
  }

  const nextStart = normalizedCurrentRange.end + 1
  if (nextStart >= sentenceCount) {
    return normalizedCurrentRange
  }

  const currentSize = normalizedCurrentRange.end - normalizedCurrentRange.start + 1

  return {
    start: nextStart,
    end: Math.min(sentenceCount - 1, nextStart + currentSize - 1),
  }
}

export function getSentencesInRange(
  sentences: SentenceItem[],
  range: SentenceRange | null | undefined,
): SentenceItem[] {
  const normalizedRange = normalizeSentenceRange(range, sentences.length)
  if (!normalizedRange) {
    return []
  }

  return sentences.slice(normalizedRange.start, normalizedRange.end + 1)
}

export function getRangeSize(range: SentenceRange | null | undefined) {
  if (!range) {
    return 0
  }

  return range.end - range.start + 1
}

export function formatSentenceRange(range: SentenceRange | null | undefined) {
  if (!range) {
    return '未选择区间'
  }

  return `${range.start}-${range.end}`
}
