import type { AnalysisHighlight, KnowledgeKind, SavedKnowledgeResource } from '../types'

export const knowledgeKindLabelMap: Record<KnowledgeKind, string> = {
  grammar: '语法',
  phrase: '搭配',
  vocabulary: '词汇',
}

function normalizeKnowledgeText(text: string) {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
}

export function normalizeKnowledgeKind(kind: unknown): KnowledgeKind {
  if (typeof kind !== 'string') {
    return 'grammar'
  }

  const normalized = kind.trim().toLocaleLowerCase()
  if (normalized === 'vocabulary' || normalized === 'word' || normalized === 'vocab') {
    return 'vocabulary'
  }

  if (normalized === 'phrase' || normalized === 'expression' || normalized === 'collocation') {
    return 'phrase'
  }

  return 'grammar'
}

export function buildKnowledgeSignature(kind: KnowledgeKind, text: string) {
  return `${kind}:${normalizeKnowledgeText(text)}`
}

export function sanitizeHighlights(rawHighlights: unknown): AnalysisHighlight[] {
  if (!Array.isArray(rawHighlights)) {
    return []
  }

  const seen = new Set<string>()

  return rawHighlights.flatMap((item, index) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const candidate = item as {
      text?: unknown
      term?: unknown
      label?: unknown
      kind?: unknown
      explanation?: unknown
      note?: unknown
    }

    const textSource = candidate.text ?? candidate.term ?? candidate.label
    const explanationSource = candidate.explanation ?? candidate.note
    const text = typeof textSource === 'string' ? textSource.trim() : ''
    const explanation = typeof explanationSource === 'string' ? explanationSource.trim() : ''

    if (!text || !explanation) {
      return []
    }

    const kind = normalizeKnowledgeKind(candidate.kind)
    const signature = buildKnowledgeSignature(kind, text)
    if (seen.has(signature)) {
      return []
    }

    seen.add(signature)

    return [
      {
        id: `${signature}:${index}`,
        text,
        kind,
        explanation,
      },
    ]
  })
}

export function sortSavedResources(resources: SavedKnowledgeResource[]) {
  return [...resources].sort((left, right) => right.savedAt.localeCompare(left.savedAt))
}
