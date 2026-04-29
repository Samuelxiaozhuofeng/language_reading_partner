import type {
  AnalysisResult,
  BookLanguage,
  BookRecord,
  BookChapterRecord,
  ChapterAnalysisState,
  ChapterParagraphBlock,
  ChapterStats,
  SentenceItem,
} from '../types'
import { createSentenceItem } from './appState'
import { normalizeSentenceRange } from './chapterRange'
import { tokenizeJapanese } from './kuromoji'
import { segmentText } from './segment'

const PARAGRAPH_SEPARATOR = '\n\n'

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

export function createParagraphBlock(
  text: string,
  options?: Pick<
    ChapterParagraphBlock,
    'kind' | 'headingLevel' | 'html' | 'sentenceIds' | 'sentenceTexts' | 'sentenceHtml'
  >,
): ChapterParagraphBlock {
  return {
    id: crypto.randomUUID(),
    kind: options?.kind ?? 'paragraph',
    headingLevel: options?.headingLevel,
    text: normalizeWhitespace(text),
    html: options?.html,
    sentenceIds: options?.sentenceIds,
    sentenceTexts: options?.sentenceTexts,
    sentenceHtml: options?.sentenceHtml,
  }
}

export function paragraphsToText(paragraphs: ChapterParagraphBlock[]) {
  return paragraphs
    .map((paragraph) => normalizeWhitespace(paragraph.text))
    .filter(Boolean)
    .join(PARAGRAPH_SEPARATOR)
}

export function createChapterSentences(sourceText: string) {
  return createChapterSentenceItems(segmentText(sourceText, 'es'))
}

export function createChapterSentenceItems(sentences: string[]) {
  return sentences.map((sentence) => createSentenceItem(sentence))
}

export async function createSentenceItemsForLanguage(
  sentences: string[],
  language: BookLanguage,
) {
  if (language !== 'ja') {
    return createChapterSentenceItems(sentences)
  }

  return Promise.all(
    sentences.map(async (sentence) => createSentenceItem(sentence, await tokenizeJapanese(sentence))),
  )
}

export async function createChapterSentencesForLanguage(
  sourceText: string,
  language: BookLanguage,
) {
  return createSentenceItemsForLanguage(segmentText(sourceText, language), language)
}

export function summarizeSentenceStats(sentences: SentenceItem[]): ChapterStats {
  const total = sentences.length
  const success = sentences.filter((sentence) => sentence.status === 'success').length
  const error = sentences.filter((sentence) => sentence.status === 'error').length
  const queued = sentences.filter((sentence) => sentence.status === 'queued').length
  const running = sentences.filter((sentence) => sentence.status === 'running').length
  const finished = success + error
  const progressPercent = total === 0 ? 0 : Math.round((finished / total) * 100)

  return {
    total,
    success,
    error,
    queued,
    running,
    finished,
    progressPercent,
  }
}

export function deriveChapterAnalysisState(
  sentences: SentenceItem[],
  results: Record<string, AnalysisResult>,
): ChapterAnalysisState {
  if (sentences.some((sentence) => sentence.status === 'running' || sentence.status === 'queued')) {
    return 'running'
  }

  if (sentences.length === 0) {
    return 'idle'
  }

  const successCount = sentences.filter((sentence) => results[sentence.id]).length
  if (successCount === 0) {
    return 'idle'
  }

  if (successCount === sentences.length) {
    return 'analyzed'
  }

  return 'partial'
}

export function normalizeChapterRecord(
  chapter: BookChapterRecord,
  override?: Partial<BookChapterRecord>,
): BookChapterRecord {
  const nextChapter = {
    ...chapter,
    ...override,
  }

  return {
    ...nextChapter,
    activeRange: normalizeSentenceRange(nextChapter.activeRange, nextChapter.sentences.length),
    lastReadEnd:
      nextChapter.sentences.length === 0
        ? -1
        : Math.max(-1, Math.min(nextChapter.lastReadEnd ?? -1, nextChapter.sentences.length - 1)),
    resumeAnchor: nextChapter.resumeAnchor ?? null,
    analysisState: deriveChapterAnalysisState(nextChapter.sentences, nextChapter.results),
  }
}

export function deriveBookAnalysisState(chapters: BookChapterRecord[]): BookRecord['analysisState'] {
  if (chapters.some((chapter) => chapter.analysisState === 'running')) {
    return 'running'
  }

  if (chapters.length === 0) {
    return 'idle'
  }

  if (chapters.every((chapter) => chapter.analysisState === 'idle')) {
    return 'idle'
  }

  if (chapters.every((chapter) => chapter.analysisState === 'analyzed')) {
    return 'analyzed'
  }

  return 'partial'
}
