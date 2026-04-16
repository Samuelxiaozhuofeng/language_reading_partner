import type { SentenceItem } from '../../types'

export type ContextDirection = 'previous' | 'next'

export function collectContextSentences(
  sentences: SentenceItem[],
  sentenceIndex: number,
  count: number,
  direction: ContextDirection,
) {
  if (count <= 0) {
    return ''
  }

  const step = direction === 'previous' ? -1 : 1
  const collected: string[] = []
  let cursor = sentenceIndex + step

  while (cursor >= 0 && cursor < sentences.length && collected.length < count) {
    const text = sentences[cursor]?.editedText.trim()
    if (text) {
      collected.push(text)
    }
    cursor += step
  }

  const ordered = direction === 'previous' ? collected.reverse() : collected
  return ordered.length > 0 ? ordered.join('\n') : ''
}
