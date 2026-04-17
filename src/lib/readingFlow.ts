import { segmentSpanishText } from './segment'
import type { ChapterParagraphBlock, SentenceItem, SentenceRange } from '../types'

export type ChapterReadingParagraph = {
  id: string
  kind?: ChapterParagraphBlock['kind']
  headingLevel?: number
  sentences: SentenceItem[]
  sentenceHtmlById?: Record<string, string>
}

export function buildChapterReadingParagraphs(
  paragraphBlocks: ChapterParagraphBlock[],
  sentences: SentenceItem[],
  activeRange: SentenceRange | null | undefined,
): ChapterReadingParagraph[] {
  if (!activeRange || paragraphBlocks.length === 0 || sentences.length === 0) {
    return []
  }

  let globalSentenceIndex = 0
  const paragraphs: ChapterReadingParagraph[] = []
  const sentenceById = new Map(sentences.map((sentence) => [sentence.id, sentence]))

  for (const paragraph of paragraphBlocks) {
    if (paragraph.sentenceIds?.length) {
      const visibleSentences: SentenceItem[] = []
      const sentenceHtmlById: Record<string, string> = {}

      for (let sentenceIndex = 0; sentenceIndex < paragraph.sentenceIds.length; sentenceIndex += 1) {
        const sentenceId = paragraph.sentenceIds[sentenceIndex]
        if (
          globalSentenceIndex >= activeRange.start &&
          globalSentenceIndex <= activeRange.end
        ) {
          const sentence =
            sentenceById.get(sentenceId) ?? sentences[globalSentenceIndex - activeRange.start]
          if (sentence) {
            visibleSentences.push(sentence)
            const sentenceHtml = paragraph.sentenceHtml?.[sentenceIndex]
            if (sentenceHtml) {
              sentenceHtmlById[sentence.id] = sentenceHtml
            }
          }
        }

        globalSentenceIndex += 1
      }

      if (visibleSentences.length > 0) {
        paragraphs.push({
          id: paragraph.id,
          kind: paragraph.kind,
          headingLevel: paragraph.headingLevel,
          sentences: visibleSentences,
          sentenceHtmlById:
            Object.keys(sentenceHtmlById).length > 0 ? sentenceHtmlById : undefined,
        })
      }

      continue
    }

    const paragraphSentences = segmentSpanishText(paragraph.text)
    const visibleSentences: SentenceItem[] = []

    for (let sentenceIndex = 0; sentenceIndex < paragraphSentences.length; sentenceIndex += 1) {
      if (
        globalSentenceIndex >= activeRange.start &&
        globalSentenceIndex <= activeRange.end
      ) {
        const sentence = sentences[globalSentenceIndex - activeRange.start]
        if (sentence) {
          visibleSentences.push(sentence)
        }
      }

      globalSentenceIndex += 1
    }

    if (visibleSentences.length > 0) {
      paragraphs.push({
        id: paragraph.id,
        kind: paragraph.kind,
        headingLevel: paragraph.headingLevel,
        sentences: visibleSentences,
      })
    }
  }

  const mappedSentenceCount = paragraphs.reduce(
    (count, paragraph) => count + paragraph.sentences.length,
    0,
  )

  if (mappedSentenceCount !== sentences.length) {
    return [
      {
        id: 'fallback-reading-paragraph',
        kind: 'paragraph',
        sentences,
      },
    ]
  }

  return paragraphs
}
