export type VocabularyToken =
  | {
      kind: 'word'
      text: string
    }
  | {
      kind: 'text'
      text: string
    }

const SPANISH_WORD_PATTERN = /[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu

export function tokenizeSpanishWords(text: string): VocabularyToken[] {
  const tokens: VocabularyToken[] = []
  let cursor = 0

  for (const match of text.matchAll(SPANISH_WORD_PATTERN)) {
    const word = match[0]
    const index = match.index ?? 0

    if (cursor < index) {
      tokens.push({
        kind: 'text',
        text: text.slice(cursor, index),
      })
    }

    tokens.push({
      kind: 'word',
      text: word,
    })
    cursor = index + word.length
  }

  if (cursor < text.length) {
    tokens.push({
      kind: 'text',
      text: text.slice(cursor),
    })
  }

  return tokens
}
