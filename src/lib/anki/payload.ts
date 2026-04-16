import type {
  AnalysisHighlight,
  AnalysisResult,
  AnkiConfig,
  AnkiFieldMapping,
  AnkiFieldSource,
  KnowledgeKind,
  SentenceItem,
} from '../../types'
import { ankiFieldSourceLabelMap, ankiFieldSourceOrder } from './constants'
import { invokeAnkiAction } from './client'
import { toUserFacingAnkiError } from './errors'

export type AnkiNotePayload = Record<AnkiFieldSource, string>

const ankiKnowledgeKindLabelMap: Record<KnowledgeKind, string> = {
  grammar: '语法',
  phrase: '搭配',
  vocabulary: '词汇',
}

function createEmptyAnkiFieldMapping(): AnkiFieldMapping {
  return {
    sentence: '',
    grammar: '',
    meaning: '',
    knowledge: '',
    knowledgeKind: '',
    knowledgeExplanation: '',
  }
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function highlightKnowledgeInSentence(sentence: string, knowledge: string) {
  const source = sentence.trim()
  const target = knowledge.trim()

  if (!source || !target) {
    return escapeHtml(source)
  }

  const startIndex = source.indexOf(target)
  if (startIndex < 0) {
    return escapeHtml(source)
  }

  const endIndex = startIndex + target.length
  return [
    escapeHtml(source.slice(0, startIndex)),
    '<strong>',
    escapeHtml(source.slice(startIndex, endIndex)),
    '</strong>',
    escapeHtml(source.slice(endIndex)),
  ].join('')
}

export function getAnkiFieldMappingIssues(config: AnkiConfig) {
  const issues: string[] = []

  if (!config.endpoint.trim()) {
    issues.push('请先在设置的 Anki 标签页里填写 AnkiConnect URL。')
  }

  if (!config.deck.trim()) {
    issues.push('请先在设置的 Anki 标签页里选择要写入的 deck。')
  }

  if (!config.noteType.trim()) {
    issues.push('请先在设置的 Anki 标签页里选择 note type。')
  }

  const assignedFields = ankiFieldSourceOrder
    .map((source) => ({
      source,
      field: config.fieldMapping[source].trim(),
    }))
    .filter((item) => item.field.length > 0)

  for (const source of ankiFieldSourceOrder) {
    if (!config.fieldMapping[source].trim()) {
      issues.push(`请先为「${ankiFieldSourceLabelMap[source]}」选择字段映射。`)
      break
    }
  }

  const fieldSet = new Set<string>()
  for (const assignment of assignedFields) {
    if (fieldSet.has(assignment.field)) {
      issues.push('字段映射里存在重复目标字段，请为每个内容选择不同的 Anki 字段。')
      break
    }

    fieldSet.add(assignment.field)
  }

  return issues
}

export function buildFields(
  config: AnkiConfig,
  payload: AnkiNotePayload,
) {
  return ankiFieldSourceOrder.reduce<Record<string, string>>((fields, source) => {
    const targetField = config.fieldMapping[source].trim()
    if (!targetField) {
      return fields
    }

    return {
      ...fields,
      [targetField]: payload[source],
    }
  }, {})
}

export function createAnkiFieldMappingFromFieldNames(
  fieldNames: readonly string[],
): AnkiFieldMapping {
  const normalizedFieldNames = new Set(fieldNames)

  return ankiFieldSourceOrder.reduce<AnkiFieldMapping>(
    (mapping, source) => ({
      ...mapping,
      [source]: normalizedFieldNames.has(ankiFieldSourceLabelMap[source])
        ? ankiFieldSourceLabelMap[source]
        : '',
    }),
    createEmptyAnkiFieldMapping(),
  )
}

export function buildAnkiNotePayload(
  sentence: SentenceItem,
  result: AnalysisResult,
  highlight: AnalysisHighlight,
): AnkiNotePayload {
  const sentenceText = sentence.editedText || sentence.text

  return {
    sentence: highlightKnowledgeInSentence(sentenceText, highlight.text),
    grammar: result.grammar,
    meaning: result.meaning,
    knowledge: highlight.text,
    knowledgeKind: ankiKnowledgeKindLabelMap[highlight.kind],
    knowledgeExplanation: highlight.explanation,
  }
}

export async function addNoteToAnki(
  config: AnkiConfig,
  payload: AnkiNotePayload,
) {
  const issue = getAnkiFieldMappingIssues(config)[0]
  if (issue) {
    throw new Error(issue)
  }

  try {
    return await invokeAnkiAction<number>(config.endpoint, 'addNote', {
      note: {
        deckName: config.deck,
        modelName: config.noteType,
        fields: buildFields(config, payload),
        options: {
          allowDuplicate: true,
        },
      },
    })
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}
