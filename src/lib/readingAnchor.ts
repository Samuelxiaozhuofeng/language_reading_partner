import type { ReadingResumeAnchor, SentenceItem } from '../types'

type ResolvedReadingResumeAnchor = {
  index: number
  sentence: SentenceItem
}

const SNIPPET_LENGTH = 80

function normalizeSentenceText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function getSentenceContent(sentence: SentenceItem) {
  return normalizeSentenceText(sentence.editedText || sentence.text)
}

export function buildReadingResumeAnchor(
  sentence: SentenceItem,
  sentenceIndex: number,
): ReadingResumeAnchor {
  return {
    sentenceId: sentence.id,
    sentenceIndex,
    sentenceSnippet: getSentenceContent(sentence).slice(0, SNIPPET_LENGTH),
  }
}

export function resolveReadingResumeAnchor(
  sentences: SentenceItem[],
  anchor: ReadingResumeAnchor | null | undefined,
): ResolvedReadingResumeAnchor | null {
  if (!anchor || sentences.length === 0) {
    return null
  }

  const byIdIndex = sentences.findIndex((sentence) => sentence.id === anchor.sentenceId)
  if (byIdIndex >= 0) {
    return {
      index: byIdIndex,
      sentence: sentences[byIdIndex],
    }
  }

  const normalizedSnippet = normalizeSentenceText(anchor.sentenceSnippet)
  const byIndexSentence = sentences[anchor.sentenceIndex]
  if (byIndexSentence) {
    const byIndexContent = getSentenceContent(byIndexSentence)
    if (
      !normalizedSnippet ||
      byIndexContent.startsWith(normalizedSnippet) ||
      normalizedSnippet.startsWith(byIndexContent)
    ) {
      return {
        index: anchor.sentenceIndex,
        sentence: byIndexSentence,
      }
    }
  }

  if (normalizedSnippet) {
    const bySnippetIndex = sentences.findIndex((sentence) => {
      const content = getSentenceContent(sentence)
      return content.includes(normalizedSnippet) || normalizedSnippet.includes(content)
    })

    if (bySnippetIndex >= 0) {
      return {
        index: bySnippetIndex,
        sentence: sentences[bySnippetIndex],
      }
    }
  }

  return null
}
