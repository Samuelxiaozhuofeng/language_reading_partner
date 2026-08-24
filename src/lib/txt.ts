import type { BookChapterRecord, BookLanguage, BookRecord } from '../types'
import {
  createParagraphBlock,
  createSentenceItemsForLanguage,
  deriveBookAnalysisState,
  deriveChapterAnalysisState,
} from './chapterText'
import { segmentText, splitSourceParagraphs } from './segment'

export function isTxtFile(file: File) {
  return /\.txt$/i.test(file.name) || file.type === 'text/plain'
}

export function decodeTxtBuffer(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  return new TextDecoder('utf-8').decode(hasBom ? bytes.subarray(3) : bytes)
}

export function titleFromTxtFileName(fileName: string) {
  const title = fileName.replace(/\.txt$/i, '').trim()
  return title || '未命名文本'
}

export async function importTxtBook(file: File, language: BookLanguage) {
  const fileData = await file.arrayBuffer()
  const sourceText = decodeTxtBuffer(fileData).trim()
  if (!sourceText) {
    throw new Error('这个 TXT 文件是空的。')
  }

  const title = titleFromTxtFileName(file.name)
  const paragraphTexts = splitSourceParagraphs(sourceText, language)
  if (paragraphTexts.length === 0) {
    throw new Error('这个 TXT 文件没有可阅读的正文。')
  }

  const paragraphBlocks = []
  const sentences = []

  for (const paragraphText of paragraphTexts) {
    const sentenceTexts = segmentText(paragraphText, language)
    const paragraphSentences = await createSentenceItemsForLanguage(sentenceTexts, language)
    paragraphBlocks.push(
      createParagraphBlock(paragraphText, {
        sentenceIds: paragraphSentences.map((sentence) => sentence.id),
        sentenceTexts,
      }),
    )
    sentences.push(...paragraphSentences)
  }

  const timestamp = new Date().toISOString()
  const bookId = crypto.randomUUID()
  const chapterId = crypto.randomUUID()
  const chapter: BookChapterRecord = {
    id: chapterId,
    bookId,
    title,
    order: 0,
    originalText: sourceText,
    sourceText,
    paragraphBlocks,
    sentences,
    results: {},
    analysisState: deriveChapterAnalysisState(sentences, {}),
    activeRange: null,
    lastReadEnd: -1,
    lastOpenedAt: timestamp,
    resumeAnchor: null,
  }
  const book: BookRecord = {
    id: bookId,
    title,
    author: 'TXT 导入',
    language,
    sourceType: 'manual',
    importedAt: timestamp,
    chapterCount: 1,
    lastReadChapterId: chapterId,
    lastOpenedAt: timestamp,
    analysisState: deriveBookAnalysisState([chapter]),
  }

  return {
    book,
    chapters: [chapter],
    fileData,
  }
}
