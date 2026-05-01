import type {
  AnalysisHighlight,
  AnalysisResult,
  AnkiConfig,
  AnkiFieldMapping,
  AnkiFieldSource,
  KnowledgeKind,
  SentenceItem,
} from '../../types'
import { doTokensMatchText, toHtmlRuby } from '../japaneseUtils'
import {
  ankiFieldSourceCandidateLabelsMap,
  ankiFieldSourceLabelMap,
  getAnkiFieldSourceOrder,
  type SraNoteTypeLanguage,
} from './constants'
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
    sentenceFurigana: '',
    grammar: '',
    meaning: '',
    knowledge: '',
    knowledgeFurigana: '',
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

function findTokenSliceBySurfaceText(
  tokens: SentenceItem['tokens'],
  text: string,
) {
  const target = text.replace(/\s+/g, '')
  if (!tokens?.length || !target) {
    return null
  }

  for (let startIndex = 0; startIndex < tokens.length; startIndex += 1) {
    let surfaceText = ''

    for (let endIndex = startIndex; endIndex < tokens.length; endIndex += 1) {
      surfaceText += tokens[endIndex].surface

      if (surfaceText === target) {
        return tokens.slice(startIndex, endIndex + 1)
      }

      if (surfaceText.length >= target.length) {
        break
      }
    }
  }

  return null
}

function buildSentenceFurigana(sentence: SentenceItem, sentenceText: string) {
  const tokens = sentence.tokens

  if (!tokens?.length || !doTokensMatchText(tokens, sentenceText)) {
    return escapeHtml(sentenceText.trim())
  }

  return toHtmlRuby(tokens)
}

function buildKnowledgeFurigana(sentence: SentenceItem, knowledge: string) {
  const tokenSlice = findTokenSliceBySurfaceText(sentence.tokens, knowledge)
  if (!tokenSlice) {
    return escapeHtml(knowledge.trim())
  }

  return toHtmlRuby(tokenSlice)
}

export function getAnkiFieldMappingIssues(
  config: AnkiConfig,
  language: SraNoteTypeLanguage = 'es',
) {
  const issues: string[] = []
  const fieldSourceOrder = getAnkiFieldSourceOrder(language)

  if (!config.endpoint.trim()) {
    issues.push('请先在设置的 Anki 标签页里填写 AnkiConnect URL。')
  }

  if (!config.deck.trim()) {
    issues.push('请先在设置的 Anki 标签页里选择要写入的 deck。')
  }

  if (!config.noteType.trim()) {
    issues.push('请先在设置的 Anki 标签页里选择 note type。')
  }

  const assignedFields = fieldSourceOrder
    .map((source) => ({
      source,
      field: config.fieldMapping[source].trim(),
    }))
    .filter((item) => item.field.length > 0)

  for (const source of fieldSourceOrder) {
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
  language: SraNoteTypeLanguage = 'es',
) {
  return getAnkiFieldSourceOrder(language).reduce<Record<string, string>>((fields, source) => {
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
  language: SraNoteTypeLanguage = 'es',
): AnkiFieldMapping {
  const normalizedFieldNames = new Set(fieldNames)

  return getAnkiFieldSourceOrder(language).reduce<AnkiFieldMapping>(
    (mapping, source) => ({
      ...mapping,
      [source]: ankiFieldSourceCandidateLabelsMap[source].find((fieldName) =>
        normalizedFieldNames.has(fieldName),
      ) ?? '',
    }),
    createEmptyAnkiFieldMapping(),
  )
}

export function buildAnkiNotePayload(
  sentence: SentenceItem,
  result: AnalysisResult,
  highlight: AnalysisHighlight,
  language: SraNoteTypeLanguage = 'es',
): AnkiNotePayload {
  const sentenceText = sentence.editedText || sentence.text
  const isJapanese = language === 'ja'

  return {
    sentence: isJapanese
      ? escapeHtml(sentenceText.trim())
      : highlightKnowledgeInSentence(sentenceText, highlight.text),
    sentenceFurigana: isJapanese ? buildSentenceFurigana(sentence, sentenceText) : '',
    grammar: result.grammar,
    meaning: result.meaning,
    knowledge: isJapanese ? escapeHtml(highlight.text.trim()) : highlight.text,
    knowledgeFurigana: isJapanese ? buildKnowledgeFurigana(sentence, highlight.text) : '',
    knowledgeKind: ankiKnowledgeKindLabelMap[highlight.kind],
    knowledgeExplanation: highlight.explanation,
  }
}

export async function addNoteToAnki(
  config: AnkiConfig,
  payload: AnkiNotePayload,
  language: SraNoteTypeLanguage = 'es',
) {
  const issue = getAnkiFieldMappingIssues(config, language)[0]
  if (issue) {
    throw new Error(issue)
  }

  try {
    return await invokeAnkiAction<number>(config.endpoint, 'addNote', {
      note: {
        deckName: config.deck,
        modelName: config.noteType,
        fields: buildFields(config, payload, language),
        options: {
          allowDuplicate: true,
        },
      },
    })
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}

export async function addNotesToAnki(
  config: AnkiConfig,
  payloads: readonly AnkiNotePayload[],
  language: SraNoteTypeLanguage = 'es',
) {
  const issue = getAnkiFieldMappingIssues(config, language)[0]
  if (issue) {
    throw new Error(issue)
  }

  if (payloads.length === 0) {
    return []
  }

  try {
    return await invokeAnkiAction<Array<number | null>>(config.endpoint, 'addNotes', {
      notes: payloads.map((payload) => ({
        deckName: config.deck,
        modelName: config.noteType,
        fields: buildFields(config, payload, language),
        options: {
          allowDuplicate: true,
        },
        tags: ['sra-mobile-queue'],
      })),
    })
  } catch (error) {
    throw new Error(toUserFacingAnkiError(error))
  }
}
