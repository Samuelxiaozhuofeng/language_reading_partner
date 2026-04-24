import type { AnalysisResult, SentenceItem, SentenceRange, WorkspaceSource } from '../../types'
import { getSentencesInRange } from '../chapterRange'

const MISSING_RESULT_ERROR = '模型未返回可解析结果，请检查接口兼容性后重试。'

export type PendingEntry = {
  absoluteIndex: number
  sentence: SentenceItem
}

export type ActiveRunState = {
  pendingIds: Set<string>
  previousResults: Record<string, AnalysisResult>
  previousSentenceState: Record<string, Pick<SentenceItem, 'status' | 'error'>>
}

type BuildPendingEntriesArgs = {
  chapterRange?: SentenceRange | null
  sentences: SentenceItem[]
  workspaceSource: WorkspaceSource
}

export function buildPendingEntries({
  chapterRange,
  sentences,
  workspaceSource,
}: BuildPendingEntriesArgs): PendingEntry[] {
  if (workspaceSource === 'chapter') {
    const selectedSentences = getSentencesInRange(sentences, chapterRange)
    const selectedRangeStart = chapterRange?.start ?? 0

    return selectedSentences
      .map((sentence, index) => ({
        absoluteIndex: selectedRangeStart + index,
        sentence,
      }))
      .filter(({ sentence }) => sentence.editedText.length > 0)
  }

  return sentences
    .map((sentence, index) => ({
      absoluteIndex: index,
      sentence,
    }))
    .filter(({ sentence }) => sentence.editedText.length > 0)
}

type BuildNextResultsArgs = {
  pendingEntries: PendingEntry[]
  results: Record<string, AnalysisResult>
  workspaceSource: WorkspaceSource
}

export function buildNextResults({
  pendingEntries,
  results,
  workspaceSource,
}: BuildNextResultsArgs): Record<string, AnalysisResult> {
  if (workspaceSource !== 'chapter') {
    return {}
  }

  const rerunIds = new Set(pendingEntries.map(({ sentence }) => sentence.id))
  return Object.fromEntries(
    Object.entries(results).filter(([sentenceId]) => !rerunIds.has(sentenceId)),
  )
}

type CollectFailedPendingEntriesArgs = {
  pendingEntries: PendingEntry[]
  results: Record<string, AnalysisResult>
}

export function collectFailedPendingEntries({
  pendingEntries,
  results,
}: CollectFailedPendingEntriesArgs) {
  return pendingEntries.filter(({ sentence }) => !results[sentence.id])
}

export function createActiveRunState(
  sentences: SentenceItem[],
  pendingIds: Set<string>,
  previousResults: Record<string, AnalysisResult>,
): ActiveRunState {
  return {
    pendingIds,
    previousResults,
    previousSentenceState: Object.fromEntries(
      sentences.map((sentence) => [
        sentence.id,
        {
          status: sentence.status,
          error: sentence.error,
        },
      ]),
    ),
  }
}

type BuildQueuedSentencesForRunArgs = {
  chapterRange?: SentenceRange | null
  nextResults: Record<string, AnalysisResult>
  pendingIds: Set<string>
  sentences: SentenceItem[]
  workspaceSource: WorkspaceSource
}

export function buildQueuedSentencesForRun({
  chapterRange,
  nextResults,
  pendingIds,
  sentences,
  workspaceSource,
}: BuildQueuedSentencesForRunArgs) {
  return sentences.map((sentence, index) => {
    if (workspaceSource === 'chapter') {
      const isInRange =
        chapterRange &&
        index >= chapterRange.start &&
        index <= chapterRange.end

      if (!isInRange) {
        return sentence
      }

      if (!sentence.editedText.length) {
        return {
          ...sentence,
          status: 'idle' as const,
          error: undefined,
        }
      }

      if (!pendingIds.has(sentence.id)) {
        return {
          ...sentence,
          status: nextResults[sentence.id] ? 'success' as const : sentence.status,
          error: undefined,
        }
      }

      return {
        ...sentence,
        status: 'queued' as const,
        error: undefined,
      }
    }

    if (!pendingIds.has(sentence.id)) {
      return {
        ...sentence,
        status: 'success' as const,
        error: undefined,
      }
    }

    return {
      ...sentence,
      status: 'queued' as const,
      error: undefined,
    }
  })
}

type FinalizeRunSentenceStatesArgs = {
  chapterRange?: SentenceRange | null
  nextResults: Record<string, AnalysisResult>
  pendingIds: Set<string>
  sentences: SentenceItem[]
  workspaceSource: WorkspaceSource
}

export function finalizeRunSentenceStates({
  chapterRange,
  nextResults,
  pendingIds,
  sentences,
  workspaceSource,
}: FinalizeRunSentenceStatesArgs) {
  return sentences.map((sentence, index) => {
    if (workspaceSource === 'chapter') {
      const isInRange =
        chapterRange &&
        index >= chapterRange.start &&
        index <= chapterRange.end

      if (!isInRange) {
        return sentence
      }

      if (!sentence.editedText.trim().length) {
        return {
          ...sentence,
          status: 'idle' as const,
          error: undefined,
        }
      }
    }

    if (!pendingIds.has(sentence.id)) {
      return {
        ...sentence,
        status: nextResults[sentence.id] ? 'success' as const : sentence.status,
        error: undefined,
      }
    }

    if (nextResults[sentence.id]) {
      return {
        ...sentence,
        status: 'success' as const,
        error: undefined,
      }
    }

    return sentence.status === 'error'
      ? sentence
      : {
          ...sentence,
          status: 'error' as const,
          error: MISSING_RESULT_ERROR,
        }
  })
}

export function restoreResultsAfterCancel(
  currentResults: Record<string, AnalysisResult>,
  activeRun: ActiveRunState,
) {
  const nextResults = { ...currentResults }

  activeRun.pendingIds.forEach((sentenceId) => {
    if (sentenceId in nextResults) {
      return
    }

    const previousResult = activeRun.previousResults[sentenceId]
    if (previousResult) {
      nextResults[sentenceId] = previousResult
    }
  })

  return nextResults
}

export function restoreSentencesAfterCancel(
  sentences: SentenceItem[],
  activeRun: ActiveRunState,
) {
  return sentences.map((sentence) => {
    if (!activeRun.pendingIds.has(sentence.id)) {
      return sentence
    }

    if (sentence.status !== 'queued' && sentence.status !== 'running') {
      return sentence
    }

    const previousState = activeRun.previousSentenceState[sentence.id]
    const previousResult = activeRun.previousResults[sentence.id]

    return {
      ...sentence,
      status: previousResult ? 'success' as const : previousState?.status === 'error' ? 'error' as const : 'idle' as const,
      error: previousResult ? undefined : previousState?.error,
    }
  })
}

export function buildRetryRunningSentence(sentence: SentenceItem) {
  return {
    ...sentence,
    status: 'running' as const,
    error: undefined,
  }
}

export function buildRetrySuccessSentence(sentence: SentenceItem) {
  return {
    ...sentence,
    status: 'success' as const,
    error: undefined,
  }
}

export function buildRetryErrorSentence(sentence: SentenceItem, error: string) {
  return {
    ...sentence,
    status: 'error' as const,
    error,
  }
}

export function buildQueuedRetrySentences(
  sentences: SentenceItem[],
  retryIds: Set<string>,
) {
  return sentences.map((sentence) =>
    retryIds.has(sentence.id)
      ? {
          ...sentence,
          status: 'queued' as const,
          error: undefined,
        }
      : sentence,
  )
}
