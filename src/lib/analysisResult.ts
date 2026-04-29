import type { JapaneseChunkExplanation } from '../types'

export function sanitizeChunkAnalysis(value: unknown): JapaneseChunkExplanation[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return []
    }

    const candidate = item as Partial<Record<keyof JapaneseChunkExplanation, unknown>>
    const chunk = typeof candidate.chunk === 'string' ? candidate.chunk.trim() : ''
    const reading = typeof candidate.reading === 'string' ? candidate.reading.trim() : ''
    const pos = typeof candidate.pos === 'string' ? candidate.pos.trim() : ''
    const explanation =
      typeof candidate.explanation === 'string' ? candidate.explanation.trim() : ''

    if (!chunk || !explanation) {
      return []
    }

    return [{
      chunk,
      reading,
      pos,
      explanation,
    }]
  })
}
