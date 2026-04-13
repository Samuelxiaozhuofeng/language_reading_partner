const CLOSING_PUNCTUATION = new Set(['"', "'", '”', '’', ')', ']', '»'])
const HARD_BREAKS = new Set(['.', '!', '?', ';', '…'])

function normalizeInput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function shouldBreak(current: string, next: string | undefined) {
  if (HARD_BREAKS.has(current)) {
    return true
  }

  if (current === '\n' && next === '\n') {
    return true
  }

  return false
}

export function segmentSpanishText(text: string): string[] {
  const normalized = normalizeInput(text)
  if (!normalized) {
    return []
  }

  const sentences: string[] = []
  let buffer = ''

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    const next = normalized[index + 1]
    buffer += char

    if (shouldBreak(char, next)) {
      while (normalized[index + 1] && CLOSING_PUNCTUATION.has(normalized[index + 1])) {
        index += 1
        buffer += normalized[index]
      }

      const piece = buffer.replace(/\s+/g, ' ').trim()
      if (piece) {
        sentences.push(piece)
      }
      buffer = ''
    }
  }

  const trailing = buffer.replace(/\s+/g, ' ').trim()
  if (trailing) {
    sentences.push(trailing)
  }

  return sentences.filter((sentence) => sentence.replace(/[¡¿!?.…;,]/g, '').trim().length > 0)
}
