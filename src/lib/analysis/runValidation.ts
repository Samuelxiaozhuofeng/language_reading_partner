import { cleanSentences } from '../appState'
import { getSentencesInRange } from '../chapterRange'
import type { ApiConfig, SentenceItem, SentenceRange, WorkspaceSource } from '../../types'

export type RunValidationResult =
  | { ok: true }
  | { ok: false; errorMessage: string }

export function validateApiConfig(apiConfig: ApiConfig): RunValidationResult {
  if (!apiConfig.baseUrl.trim() || !apiConfig.apiKey.trim() || !apiConfig.model.trim()) {
    return {
      ok: false,
      errorMessage: '请先完整填写 API URL、API Key 和 Model。',
    }
  }

  return { ok: true }
}

type ValidateRunStartArgs = {
  apiConfig: ApiConfig
  chapterRange?: SentenceRange | null
  sentences: SentenceItem[]
  workspaceSource: WorkspaceSource
}

export function validateRunStart({
  apiConfig,
  chapterRange,
  sentences,
  workspaceSource,
}: ValidateRunStartArgs): RunValidationResult {
  const apiValidation = validateApiConfig(apiConfig)
  if (!apiValidation.ok) {
    return apiValidation
  }

  if (workspaceSource === 'chapter') {
    const rangedSentences = getSentencesInRange(sentences, chapterRange)
    if (!chapterRange || rangedSentences.length === 0) {
      return {
        ok: false,
        errorMessage: '请先选择一个有效的句子区间。',
      }
    }

    if (rangedSentences.every((sentence) => !sentence.editedText.length)) {
      return {
        ok: false,
        errorMessage: '当前区间内没有可解析的句子，请调整范围或补全文本后再试。',
      }
    }

    return { ok: true }
  }

  const usableSentences = cleanSentences(sentences)
  if (usableSentences.length === 0) {
    return {
      ok: false,
      errorMessage: '请先分句，或确保至少保留一句非空内容。',
    }
  }

  return { ok: true }
}
