import type { ChapterReadingParagraph } from '../../lib/readingFlow'
import type { SentenceItem } from '../../types'

export type HighlightSelection = {
  sentenceId: string
  highlightId: string
}

export type InspectorMode = 'docked' | 'sheet'

export type ChapterReadingPage = {
  id: string
  paragraphs: ChapterReadingParagraph[]
}

export type ChapterPageLayout = {
  bodyHeight: number
  bodyWidth: number
}

export const DOCKED_READING_BREAKPOINT = 960
export const CHAPTER_PAGE_GAP = 56
export const READING_DESKTOP_BREAKPOINT = 960
export const CHAPTER_PAGE_BOTTOM_SAFE_LINES = 1.2

export const FALLBACK_CHAPTER_PAGE_LAYOUT: ChapterPageLayout = {
  bodyHeight: 0,
  bodyWidth: 0,
}

export function getViewportSize() {
  if (typeof window === 'undefined') {
    return {
      width: 0,
      height: 0,
    }
  }

  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  }
}

export function getInspectorMode(): InspectorMode {
  const { width } = getViewportSize()
  if (width <= DOCKED_READING_BREAKPOINT) {
    return 'sheet'
  }

  return 'docked'
}

export function buildSelectionKey(sentenceId: string, highlightId: string) {
  return `${sentenceId}:${highlightId}`
}

export function getSentenceDisplayText(sentence: SentenceItem) {
  return sentence.editedText || sentence.text
}

export function normalizeSentenceText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

export function buildParagraphText(sentences: SentenceItem[]) {
  return sentences
    .map((sentence) => normalizeSentenceText(getSentenceDisplayText(sentence)))
    .filter(Boolean)
    .join(' ')
}

export function getChapterParagraphGap(fontSize: number) {
  return Math.max(16, Math.round(fontSize * 1.1))
}

export function getReadingBlockClassName(paragraph: Pick<ChapterReadingParagraph, 'kind' | 'headingLevel'>) {
  const baseClassName = 'reading-paragraph'

  if (paragraph.kind === 'heading') {
    return `${baseClassName} is-heading is-heading-${paragraph.headingLevel ?? 2}`
  }

  if (paragraph.kind === 'quote') {
    return `${baseClassName} is-quote`
  }

  if (paragraph.kind === 'list-item') {
    return `${baseClassName} is-list-item`
  }

  if (paragraph.kind === 'preformatted') {
    return `${baseClassName} is-preformatted`
  }

  return baseClassName
}
