import type { ReactNode } from 'react'
import { buildKnowledgeSignature } from '../../lib/knowledge'
import type { AnalysisHighlight } from '../../types'
import { buildSelectionKey, type HighlightSelection } from './readingShared'

export function findInlineHighlightRanges(text: string, highlights: AnalysisHighlight[]) {
  const candidateRanges = highlights
    .map((highlight) => ({
      highlight,
      start: text.indexOf(highlight.text),
      end: text.indexOf(highlight.text) + highlight.text.length,
    }))
    .filter((range) => range.start >= 0)
    .sort((left, right) => {
      if (left.start !== right.start) {
        return left.start - right.start
      }

      return right.highlight.text.length - left.highlight.text.length
    })

  const acceptedRanges: typeof candidateRanges = []
  let cursor = -1

  for (const range of candidateRanges) {
    if (range.start < cursor) {
      continue
    }

    acceptedRanges.push(range)
    cursor = range.end
  }

  return acceptedRanges
}

export function renderGrammarText(
  text: string,
  highlights: AnalysisHighlight[],
  activeSelection: HighlightSelection | null,
  sentenceId: string,
  savedHighlightSignatures: Set<string>,
  onSelect: (highlightId: string) => void,
) {
  const ranges = findInlineHighlightRanges(text, highlights)

  if (ranges.length === 0) {
    return text
  }

  const segments: ReactNode[] = []
  let cursor = 0

  ranges.forEach((range) => {
    if (cursor < range.start) {
      segments.push(
        <span key={`text:${cursor}`}>
          {text.slice(cursor, range.start)}
        </span>,
      )
    }

    const signature = buildKnowledgeSignature(range.highlight.kind, range.highlight.text)
    const isSaved = savedHighlightSignatures.has(signature)
    const isActive =
      activeSelection?.sentenceId === sentenceId &&
      activeSelection.highlightId === range.highlight.id

    segments.push(
      <button
        className={`inline-knowledge-link ${isActive ? 'is-active' : ''} ${isSaved ? 'is-saved' : ''}`}
        key={buildSelectionKey(sentenceId, range.highlight.id)}
        type="button"
        onClick={() => onSelect(range.highlight.id)}
      >
        {range.highlight.text}
      </button>,
    )
    cursor = range.end
  })

  if (cursor < text.length) {
    segments.push(
      <span key={`text:${cursor}`}>
        {text.slice(cursor)}
      </span>,
    )
  }

  return segments
}
