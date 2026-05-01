import type {
  AnalysisHighlight,
  AnalysisResult,
  BookChapterRecord,
  BookLanguage,
  BookRecord,
  PendingAnkiNote,
  SentenceItem,
} from '../../types'
import type { AnkiNotePayload } from './payload'

type CreatePendingAnkiNoteInput = {
  book: BookRecord | null
  chapter: BookChapterRecord | null
  highlight: AnalysisHighlight
  language: BookLanguage
  payload: AnkiNotePayload
  result: AnalysisResult
  sentence: SentenceItem
}

export function buildPendingAnkiDedupeKey(
  language: BookLanguage,
  sentence: SentenceItem,
  highlight: AnalysisHighlight,
) {
  return [language, sentence.id, highlight.kind, highlight.text.trim()].join(':')
}

export function createPendingAnkiNote({
  book,
  chapter,
  highlight,
  language,
  payload,
  result,
  sentence,
}: CreatePendingAnkiNoteInput): PendingAnkiNote {
  const sentenceText = sentence.editedText || sentence.text

  return {
    id: crypto.randomUUID(),
    dedupeKey: buildPendingAnkiDedupeKey(language, sentence, highlight),
    language,
    payload,
    text: highlight.text,
    kind: highlight.kind,
    explanation: highlight.explanation,
    sentenceId: result.sentenceId || sentence.id,
    sentenceText,
    createdAt: new Date().toISOString(),
    bookId: chapter?.bookId,
    bookTitle: book?.title,
    chapterId: chapter?.id,
    chapterTitle: chapter?.title,
  }
}
