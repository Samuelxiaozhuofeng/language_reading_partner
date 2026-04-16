import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  cleanSentences,
  collectSession,
  createSentenceItem,
  formatTime,
  MAX_HISTORY_ITEMS,
  updateSentenceState,
} from '../lib/appState'
import { collectContextSentences } from '../lib/analysis/runContext'
import {
  buildNextResults,
  buildPendingEntries,
  buildQueuedSentencesForRun,
  buildRetryErrorSentence,
  buildRetryRunningSentence,
  buildRetrySuccessSentence,
  createActiveRunState,
  finalizeRunSentenceStates,
  restoreResultsAfterCancel,
  restoreSentencesAfterCancel,
  type ActiveRunState,
} from '../lib/analysis/runState'
import { validateApiConfig, validateRunStart } from '../lib/analysis/runValidation'
import { analyzeSentence, runConcurrentAnalysis, toUserFacingError } from '../lib/openai'
import { segmentSpanishText } from '../lib/segment'
import type {
  AnalysisDocumentContext,
  AnalysisResult,
  ApiConfig,
  PromptConfig,
  RunSession,
  SentenceItem,
  SentenceRange,
  WorkspaceSource,
} from '../types'

type UseAnalysisRunnerArgs = {
  apiConfig: ApiConfig
  documentContext?: AnalysisDocumentContext
  onChapterAnalysisCompleted?: (range: SentenceRange) => void | Promise<unknown>
  chapterRange?: SentenceRange | null
  initialNotice: string
  onChapterRangeCommitted?: (range: SentenceRange) => void | Promise<unknown>
  onChapterSegmentReset?: (sentenceCount: number) => void
  promptConfig: PromptConfig
  results: Record<string, AnalysisResult>
  sentences: SentenceItem[]
  setHistory?: Dispatch<SetStateAction<RunSession[]>>
  setResults: Dispatch<SetStateAction<Record<string, AnalysisResult>>>
  setSentences: Dispatch<SetStateAction<SentenceItem[]>>
  setSourceText: Dispatch<SetStateAction<string>>
  sourceText: string
  workspaceSource: WorkspaceSource
}

export function useAnalysisRunner({
  apiConfig,
  documentContext,
  chapterRange,
  initialNotice,
  onChapterAnalysisCompleted,
  onChapterRangeCommitted,
  onChapterSegmentReset,
  promptConfig,
  results,
  sentences,
  setHistory,
  setResults,
  setSentences,
  setSourceText,
  sourceText,
  workspaceSource,
}: UseAnalysisRunnerArgs) {
  const [globalError, setGlobalError] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [notice, setNotice] = useState(initialNotice)
  const runTokenRef = useRef(0)
  const runAbortControllerRef = useRef<AbortController | null>(null)
  const activeRunRef = useRef<ActiveRunState | null>(null)

  useEffect(() => {
    setNotice(initialNotice)
  }, [initialNotice])

  const trimmedSentences = useMemo(
    () =>
      sentences.map((sentence) => ({
        ...sentence,
        editedText: sentence.editedText.trim(),
      })),
    [sentences],
  )

  const saveRunToHistory = (
    nextSourceText: string,
    nextSentences: SentenceItem[],
    nextResults: Record<string, AnalysisResult>,
  ) => {
    if (!setHistory || Object.keys(nextResults).length === 0) {
      return
    }

    const session = collectSession(nextSourceText, nextSentences, nextResults)
    setHistory((current) => [session, ...current].slice(0, MAX_HISTORY_ITEMS))
  }

  const handleSegment = () => {
    const pieces = segmentSpanishText(sourceText)

    if (pieces.length === 0) {
      setNotice('')
      setGlobalError('当前内容无法切分成有效句子，请先粘贴一段完整的原文。')
      setSentences([])
      setResults({})
      return
    }

    const nextSentences = pieces.map(createSentenceItem)
    setSentences(nextSentences)
    setResults({})
    if (workspaceSource === 'chapter') {
      onChapterSegmentReset?.(nextSentences.length)
    }
    setGlobalError('')
    setNotice(
      workspaceSource === 'chapter'
        ? `已按当前章节文本重新生成 ${nextSentences.length} 句，原有句子解析结果已清空。`
        : `已生成 ${nextSentences.length} 句，你可以先微调再启动 AI。`,
    )
  }

  const handleSentenceChange = (id: string, value: string) => {
    setResults((current) => {
      if (!current[id]) {
        return current
      }

      const nextResults = { ...current }
      delete nextResults[id]
      return nextResults
    })

    setSentences((current) =>
      updateSentenceState(current, id, (sentence) => ({
        ...sentence,
        editedText: value,
        status: 'idle',
        error: undefined,
      })),
    )
  }

  const runAnalysis = async () => {
    const validation = validateRunStart({
      apiConfig,
      chapterRange,
      sentences: trimmedSentences,
      workspaceSource,
    })

    if (!validation.ok) {
      setNotice('')
      setGlobalError(validation.errorMessage)
      return
    }

    const sanitized =
      workspaceSource === 'chapter' ? trimmedSentences : cleanSentences(trimmedSentences)
    const pendingEntries = buildPendingEntries({
      chapterRange,
      sentences: trimmedSentences,
      workspaceSource,
    })
    const pendingIds = new Set(pendingEntries.map(({ sentence }) => sentence.id))
    const nextResults = buildNextResults({
      pendingEntries,
      results,
      workspaceSource,
    })

    if (workspaceSource === 'chapter' && pendingEntries.length === 0) {
      setGlobalError('')
      if (chapterRange) {
        await onChapterRangeCommitted?.(chapterRange)
        setNotice(`当前区间 ${chapterRange.start}-${chapterRange.end} 没有可解析句子，请调整范围或补全文本后重试。`)
      } else {
        setNotice('当前章节没有可解析句子，请补全文本后重试。')
      }
      return
    }

    runTokenRef.current += 1
    const runToken = runTokenRef.current
    const abortController = new AbortController()
    runAbortControllerRef.current = abortController
    activeRunRef.current = createActiveRunState(sanitized, pendingIds, results)
    setIsRunning(true)
    setGlobalError('')
    setNotice(
      workspaceSource === 'chapter' && chapterRange
        ? `正在解析区间 ${chapterRange.start}-${chapterRange.end}，共 ${pendingEntries.length} 句。`
        : `正在并发解析 ${pendingEntries.length} 句，结果会按原顺序回填。`,
    )
    setSentences(buildQueuedSentencesForRun({
      chapterRange,
      nextResults,
      pendingIds,
      sentences: sanitized,
      workspaceSource,
    }))
    if (workspaceSource === 'chapter') {
      setResults(nextResults)
    }
    if (workspaceSource === 'draft') {
      setResults({})
    }

    try {
      await runConcurrentAnalysis(
        apiConfig,
        promptConfig,
        pendingEntries.map(({ absoluteIndex, sentence }) => ({
          sentenceId: sentence.id,
          sentence: sentence.editedText,
          previousSentence: collectContextSentences(
            trimmedSentences,
            absoluteIndex,
            promptConfig.previousSentenceCount,
            'previous',
          ),
          nextSentence: collectContextSentences(
            trimmedSentences,
            absoluteIndex,
            promptConfig.nextSentenceCount,
            'next',
          ),
          documentContext,
        })),
        {
          onStart: ({ sentenceId }) => {
            if (runTokenRef.current !== runToken) {
              return
            }

            setSentences((current) =>
              updateSentenceState(current, sentenceId, (sentence) => ({
                ...sentence,
                status: 'running',
                error: undefined,
              })),
            )
          },
          onSuccess: ({ sentenceId, result }) => {
            if (runTokenRef.current !== runToken) {
              return
            }

            nextResults[sentenceId] = result
            setResults((current) => ({
              ...current,
              [sentenceId]: result,
            }))
            setSentences((current) =>
              updateSentenceState(current, sentenceId, (sentence) => ({
                ...sentence,
                status: 'success',
                error: undefined,
              })),
            )
          },
          onError: ({ sentenceId, error }) => {
            if (runTokenRef.current !== runToken) {
              return
            }

            setSentences((current) =>
              updateSentenceState(current, sentenceId, (sentence) => ({
                ...sentence,
                status: 'error',
                error,
              })),
            )
          },
        },
        {
          signal: abortController.signal,
        },
      )

      if (runTokenRef.current !== runToken) {
        return
      }

      setSentences((current) =>
        finalizeRunSentenceStates({
          chapterRange,
          nextResults,
          pendingIds,
          sentences: current,
          workspaceSource,
        }),
      )

      if (workspaceSource === 'chapter' && chapterRange) {
        await onChapterRangeCommitted?.(chapterRange)
        await onChapterAnalysisCompleted?.(chapterRange)
      }

      setNotice(
        workspaceSource === 'chapter' && chapterRange
          ? `区间 ${chapterRange.start}-${chapterRange.end} 解析完成，已切换到沉浸阅读页。`
          : '本轮解析已完成，已自动切换到沉浸阅读页。',
      )
      if (workspaceSource === 'draft') {
        saveRunToHistory(sourceText, sanitized, nextResults)
      }
      return 'reading' as const
    } catch (error) {
      if (runTokenRef.current !== runToken) {
        return
      }

      setNotice('')
      setGlobalError(toUserFacingError(error))
      return
    } finally {
      if (runAbortControllerRef.current === abortController) {
        runAbortControllerRef.current = null
      }
      if (runTokenRef.current === runToken) {
        activeRunRef.current = null
      }
      if (runTokenRef.current === runToken) {
        setIsRunning(false)
      }
    }
  }

  const cancelAnalysis = () => {
    if (!isRunning) {
      return
    }

    const activeRun = activeRunRef.current

    runTokenRef.current += 1
    runAbortControllerRef.current?.abort()
    runAbortControllerRef.current = null
    activeRunRef.current = null
    setIsRunning(false)
    setGlobalError('')
    setNotice(
      workspaceSource === 'chapter'
        ? '已停止当前区间解析，未完成的句子已恢复为可重新解析状态。'
        : '已停止当前解析，未完成的句子已恢复为可重新解析状态。',
    )

    if (!activeRun) {
      return
    }

    setResults((current) => restoreResultsAfterCancel(current, activeRun))
    setSentences((current) => restoreSentencesAfterCancel(current, activeRun))
  }

  const retrySingleSentence = async (sentenceId: string) => {
    const target = sentences.find((sentence) => sentence.id === sentenceId)
    if (!target) {
      return
    }

    const validation = validateApiConfig(apiConfig)
    if (!validation.ok) {
      setNotice('')
      setGlobalError(validation.errorMessage)
      return
    }

    const sentenceIndex = sentences.findIndex((sentence) => sentence.id === sentenceId)
    setGlobalError('')
    setNotice(`正在重试第 ${sentenceIndex + 1} 句。`)
    setSentences((current) =>
      updateSentenceState(current, sentenceId, buildRetryRunningSentence),
    )

    try {
      const result = await analyzeSentence(apiConfig, promptConfig, {
        sentenceId,
        sentence: target.editedText.trim(),
        previousSentence: collectContextSentences(
          trimmedSentences,
          sentenceIndex,
          promptConfig.previousSentenceCount,
          'previous',
        ),
        nextSentence: collectContextSentences(
          trimmedSentences,
          sentenceIndex,
          promptConfig.nextSentenceCount,
          'next',
        ),
        documentContext,
      })

      setResults((current) => ({
        ...current,
        [sentenceId]: result,
      }))
      setSentences((current) =>
        updateSentenceState(current, sentenceId, buildRetrySuccessSentence),
      )
      setNotice(`第 ${sentenceIndex + 1} 句已成功重试。`)
    } catch (error) {
      const message = toUserFacingError(error)
      setSentences((current) =>
        updateSentenceState(current, sentenceId, (sentence) =>
          buildRetryErrorSentence(sentence, message),
        ),
      )
      setNotice('')
      setGlobalError(`第 ${sentenceIndex + 1} 句重试失败：${message}`)
    }
  }

  const restoreSession = (session: RunSession) => {
    setSourceText(session.sourceText)
    setSentences(
      session.sentences.map((sentence) => ({
        ...sentence,
        status: session.results[sentence.id] ? 'success' : 'idle',
        error: undefined,
      })),
    )
    setResults(session.results)
    setGlobalError('')
    setNotice(`已恢复 ${formatTime(session.createdAt)} 的解析记录。`)
  }

  const clearStatus = () => {
    runTokenRef.current += 1
    setIsRunning(false)
    setGlobalError('')
    setNotice('')
  }

  return {
    clearStatus,
    cancelAnalysis,
    globalError,
    handleSegment,
    handleSentenceChange,
    isRunning,
    notice,
    restoreSession,
    retrySingleSentence,
    runAnalysis,
    setNotice,
  }
}
