const CLOSING_PUNCTUATION = new Set(['"', "'", '”', '’', ')', ']', '»'])
const SOFT_BREAKS = new Set([';', '…'])
const TITLE_ABBREVIATIONS = new Set([
  'dr.',
  'dra.',
  'mr.',
  'mrs.',
  'ms.',
  'prof.',
  'sr.',
  'sra.',
  'srta.',
])

const sentenceSegmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'sentence' })
    : null

function normalizeInput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeSentenceText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function hasMeaningfulContent(sentence: string) {
  return sentence.replace(/[¡¿!?.…;,]/g, '').trim().length > 0
}

function splitIntoParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function getNextWord(text: string) {
  const trimmed = text.trimStart()
  const match = trimmed.match(/^[("'“‘[]*([\p{L}\p{N}]+)/u)
  return match?.[1] ?? ''
}

function shouldMergeSegments(current: string, next: string) {
  const lastToken = current.match(/([\p{L}.]+)\s*$/u)?.[1]?.toLowerCase() ?? ''
  if (!TITLE_ABBREVIATIONS.has(lastToken)) {
    return false
  }

  const nextWord = getNextWord(next)
  return nextWord.length > 0 && /^[\p{Lu}\p{Lt}\p{N}]/u.test(nextWord)
}

function mergeFalseBreaks(sentences: string[]) {
  const merged: string[] = []

  for (const sentence of sentences) {
    if (merged.length === 0) {
      merged.push(sentence)
      continue
    }

    const previous = merged[merged.length - 1]
    if (shouldMergeSegments(previous, sentence)) {
      merged[merged.length - 1] = `${previous} ${sentence}`.trim()
      continue
    }

    merged.push(sentence)
  }

  return merged
}

function splitOnSoftBreaks(text: string) {
  const parts: string[] = []
  let buffer = ''

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    buffer += char

    if (!SOFT_BREAKS.has(char)) {
      continue
    }

    while (text[index + 1] && CLOSING_PUNCTUATION.has(text[index + 1])) {
      index += 1
      buffer += text[index]
    }

    const piece = normalizeSentenceText(buffer)
    if (piece) {
      parts.push(piece)
    }
    buffer = ''
  }

  const trailing = normalizeSentenceText(buffer)
  if (trailing) {
    parts.push(trailing)
  }

  return parts
}

function getTokenEndingAt(text: string, index: number) {
  let start = index
  while (start > 0 && !/\s/u.test(text[start - 1])) {
    start -= 1
  }

  return text.slice(start, index + 1)
}

function getNextNonWhitespaceIndex(text: string, start: number) {
  for (let index = start; index < text.length; index += 1) {
    if (!/\s/u.test(text[index])) {
      return index
    }
  }

  return -1
}

function shouldBreakAtPeriod(text: string, index: number) {
  const previous = text[index - 1] ?? ''
  const next = text[index + 1] ?? ''
  if (/\d/u.test(previous) && /\d/u.test(next)) {
    return false
  }

  const token = getTokenEndingAt(text, index)
  if (/^(?:[A-Za-z]\.){2,}$/u.test(token)) {
    const nextWord = getNextWord(text.slice(index + 1))
    return nextWord.length === 0 || /^[\p{Lu}\p{Lt}]/u.test(nextWord)
  }

  const nextIndex = getNextNonWhitespaceIndex(text, index + 1)
  if (
    /[A-Za-z]/u.test(previous) &&
    nextIndex !== -1 &&
    /[A-Za-z]/u.test(text[nextIndex]) &&
    text[nextIndex + 1] === '.'
  ) {
    return false
  }

  if (TITLE_ABBREVIATIONS.has(token.toLowerCase())) {
    const nextWord = getNextWord(text.slice(index + 1))
    return !(nextWord.length > 0 && /^[\p{Lu}\p{Lt}\p{N}]/u.test(nextWord))
  }

  return true
}

function segmentParagraphWithFallback(paragraph: string) {
  const sentences: string[] = []
  let buffer = ''

  for (let index = 0; index < paragraph.length; index += 1) {
    const char = paragraph[index]
    buffer += char

    const shouldBreak =
      char === '!' ||
      char === '?' ||
      char === ';' ||
      char === '…' ||
      (char === '.' && shouldBreakAtPeriod(paragraph, index))

    if (!shouldBreak) {
      continue
    }

    while (paragraph[index + 1] && CLOSING_PUNCTUATION.has(paragraph[index + 1])) {
      index += 1
      buffer += paragraph[index]
    }

    const piece = normalizeSentenceText(buffer)
    if (piece) {
      sentences.push(piece)
    }
    buffer = ''
  }

  const trailing = normalizeSentenceText(buffer)
  if (trailing) {
    sentences.push(trailing)
  }

  return sentences
}

function segmentParagraph(paragraph: string) {
  const rawSentences = sentenceSegmenter
    ? Array.from(sentenceSegmenter.segment(paragraph), (part) => normalizeSentenceText(part.segment)).filter(Boolean)
    : segmentParagraphWithFallback(paragraph)

  return mergeFalseBreaks(rawSentences).flatMap(splitOnSoftBreaks)
}

export function segmentSpanishText(text: string): string[] {
  const normalized = normalizeInput(text)
  if (!normalized) {
    return []
  }

  return splitIntoParagraphs(normalized)
    .flatMap(segmentParagraph)
    .filter(hasMeaningfulContent)
}
