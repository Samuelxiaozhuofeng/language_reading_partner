import type { AnalysisResult, BookChapterRecord, BookRecord, SentenceItem } from '../../types'
import {
  createParagraphBlock,
  deriveBookAnalysisState,
  normalizeChapterRecord,
} from '../chapterText'

export type CreateManualDraftBookPayloadInput = {
  articleTitle: string
  results: Record<string, AnalysisResult>
  sentences: SentenceItem[]
  sourceText: string
}

export function buildManualBookTitle(
  articleTitle: string,
  sourceText: string,
  sentences: SentenceItem[],
) {
  const trimmedArticleTitle = articleTitle.trim()
  if (trimmedArticleTitle) {
    return trimmedArticleTitle
  }

  const firstLine = sourceText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  const fallbackSentence = sentences.find((sentence) => sentence.editedText.trim())?.editedText.trim()
  const seed = firstLine ?? fallbackSentence ?? '手动导入内容'
  return seed.length > 28 ? `${seed.slice(0, 28)}...` : seed
}

export function buildManualParagraphBlocks(sourceText: string) {
  return sourceText
    .split(/\n\s*\n+/)
    .map((paragraph) => createParagraphBlock(paragraph))
    .filter((paragraph) => paragraph.text.length > 0)
}

export function createManualDraftBookPayload({
  articleTitle,
  results,
  sentences,
  sourceText,
}: CreateManualDraftBookPayloadInput): {
  book: BookRecord
  chapters: BookChapterRecord[]
} {
  const timestamp = new Date().toISOString()
  const bookId = crypto.randomUUID()
  const chapterId = crypto.randomUUID()
  const title = buildManualBookTitle(articleTitle, sourceText, sentences)
  const normalizedChapter = normalizeChapterRecord({
    id: chapterId,
    bookId,
    title,
    order: 0,
    originalText: sourceText,
    sourceText,
    paragraphBlocks: buildManualParagraphBlocks(sourceText),
    sentences,
    results,
    analysisState: 'idle',
    activeRange: null,
    lastReadEnd: -1,
    lastOpenedAt: timestamp,
    resumeAnchor: null,
  })
  const book: BookRecord = {
    id: bookId,
    title,
    author: '手动导入',
    sourceType: 'manual',
    importedAt: timestamp,
    chapterCount: 1,
    lastReadChapterId: chapterId,
    lastOpenedAt: timestamp,
    analysisState: deriveBookAnalysisState([normalizedChapter]),
  }

  return {
    book,
    chapters: [normalizedChapter],
  }
}
