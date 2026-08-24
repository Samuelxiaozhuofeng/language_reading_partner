const ARABIC_SENTENCE_TERMINATORS = new Set([
  '.',
  '۔',
  '．',
  '。',
  '؟',
  '?',
  '!',
  '！',
  '؛',
  ';',
  '…',
])

const ARABIC_TRAILING_MARKS = new Set([
  '"',
  "'",
  '”',
  '’',
  ')',
  ']',
  '»',
  '‹',
  '›',
  '\u061C',
  '\u200E',
  '\u200F',
  '\u202A',
  '\u202B',
  '\u202C',
  '\u202D',
  '\u202E',
  '\u2066',
  '\u2067',
  '\u2068',
  '\u2069',
])

const TRAILING_NOTE_MARK = /(?:\s*[([]\s*[\p{N}]+\s*[)\]])+\s*$/u
const PAGE_NUMBER_LINE = /^\(?[\p{N}]+\)?\.?$/u
const BRACKET_HEADING_LINE = /^\[[^\]]+\]?$/u
const NUMBERED_ITEM_START = /^[\p{N}]{1,3}\s*[-–—.،)]\s+\S/u

function normalizeInput(text: string) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeSentenceText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

export function hasMeaningfulArabicContent(sentence: string) {
  return sentence.replace(/[۔．。؟?！!;؛…,.،¡¿\s]/g, '').trim().length > 0
}

function isArabicDecimalDot(text: string, index: number) {
  const previous = text[index - 1] ?? ''
  const next = text[index + 1] ?? ''
  return /\p{Nd}/u.test(previous) && /\p{Nd}/u.test(next)
}

export function shouldBreakArabicAt(text: string, index: number, char: string) {
  if (!ARABIC_SENTENCE_TERMINATORS.has(char)) {
    return false
  }

  if ((char === '.' || char === '．') && isArabicDecimalDot(text, index)) {
    return false
  }

  return true
}

export function isArabicStandaloneLine(line: string) {
  const trimmed = line.trim()
  if (!trimmed) {
    return false
  }

  if (PAGE_NUMBER_LINE.test(trimmed) || BRACKET_HEADING_LINE.test(trimmed)) {
    return true
  }

  if (!hasMeaningfulArabicContent(trimmed)) {
    return true
  }

  if (isArabicSentenceComplete(trimmed) || /[:：،,=«]$/u.test(trimmed) || /[:：«»]/.test(trimmed)) {
    return false
  }

  const words = trimmed.split(/\s+/).filter((word) => /\p{L}/u.test(word))
  return words.length >= 2 && words.length <= 4
}

export function isArabicStructuralStart(line: string) {
  const trimmed = line.trim()
  return NUMBERED_ITEM_START.test(trimmed) || BRACKET_HEADING_LINE.test(trimmed)
}


export function isArabicSentenceComplete(line: string) {
  const stripped = line
    .trim()
    .replace(TRAILING_NOTE_MARK, '')
    .replace(/[=]+\s*$/u, '')
    .trim()

  if (!stripped) {
    return true
  }

  return ARABIC_SENTENCE_TERMINATORS.has(stripped[stripped.length - 1] ?? '')
}

export function joinArabicSoftBrokenLines(text: string) {
  const normalized = normalizeInput(text)
  if (!normalized) {
    return ''
  }

  const lines = normalized.split('\n').map((line) => line.trim())
  const paragraphs: string[] = []
  let buffer = ''

  const flush = () => {
    if (buffer) {
      paragraphs.push(buffer)
      buffer = ''
    }
  }

  for (const line of lines) {
    if (!line) {
      if (buffer && (isArabicSentenceComplete(buffer) || isArabicStandaloneLine(buffer))) {
        flush()
      }
      continue
    }

    if (!buffer) {
      buffer = line
      continue
    }

    if (
      isArabicStandaloneLine(buffer) ||
      isArabicStandaloneLine(line) ||
      isArabicStructuralStart(line) ||
      isArabicSentenceComplete(buffer)
    ) {
      flush()
      buffer = line
      continue
    }

    buffer = `${buffer} ${line}`
  }

  flush()
  return paragraphs.join('\n\n')
}

export function splitArabicParagraphs(text: string) {
  const joined = joinArabicSoftBrokenLines(text)
  if (!joined) {
    return []
  }

  return joined
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

export function segmentArabicParagraph(paragraph: string) {
  const sentences: string[] = []
  let buffer = ''

  for (let index = 0; index < paragraph.length; index += 1) {
    const char = paragraph[index]
    buffer += char

    if (!shouldBreakArabicAt(paragraph, index, char)) {
      continue
    }

    while (paragraph[index + 1] && ARABIC_TRAILING_MARKS.has(paragraph[index + 1])) {
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

export function segmentArabicText(text: string): string[] {
  return splitArabicParagraphs(text)
    .flatMap(segmentArabicParagraph)
    .filter(hasMeaningfulArabicContent)
}
