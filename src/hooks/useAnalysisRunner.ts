import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  cleanSentences,
  collectSession,
  createSentenceItem,
  formatTime,
  MAX_HISTORY_ITEMS,
  updateSentenceState,
} from '../lib/appState'
import { getSentencesInRange } from '../lib/chapterRange'
import { analyzeSentence, runConcurrentAnalysis, toUserFacingError } from '../lib/openai'
import { segmentSpanishText } from '../lib/segment'
import type {
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

  useEffect(() => {
    setNotice(initialNotice)
  }, [initialNotice])

  const trimmedSentences = sentences.map((sentence) => ({
    ...sentence,
    editedText: sentence.editedText.trim(),
  }))

  const validateBeforeRun = () => {
    if (!apiConfig.baseUrl.trim() || !apiConfig.apiKey.trim() || !apiConfig.model.trim()) {
      setNotice('')
      setGlobalError('请先完整填写 API URL、API Key 和 Model。')
      return false
    }

    if (workspaceSource === 'chapter') {
      const rangedSentences = getSentencesInRange(trimmedSentences, chapterRange)
      if (!chapterRange || rangedSentences.length === 0) {
        setNotice('')
        setGlobalError('请先选择一个有效的句子区间。')
        return false
      }

      if (rangedSentences.every((sentence) => !sentence.editedText.length)) {
        setNotice('')
        setGlobalError('当前区间内没有可解析的句子，请调整范围或补全文本后再试。')
        return false
      }

      return true
    }

    const usableSentences = cleanSentences(trimmedSentences)
    if (usableSentences.length === 0) {
      setNotice('')
      setGlobalError('请先分句，或确保至少保留一句非空内容。')
      return false
    }

    return true
  }

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
      setGlobalError('当前内容无法切分成有效句子，请先粘贴一段完整的西语文本。')
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
    if (!validateBeforeRun()) {
      return
    }

    const sanitized =
      workspaceSource === 'chapter' ? trimmedSentences : cleanSentences(trimmedSentences)
    const selectedSentences =
      workspaceSource === 'chapter' ? getSentencesInRange(sanitized, chapterRange) : sanitized
    const selectedRangeStart = workspaceSource === 'chapter' ? chapterRange?.start ?? 0 : 0
    const rerunIds =
      workspaceSource === 'chapter'
        ? new Set(
            selectedSentences
              .filter((sentence) => sentence.editedText.length > 0)
              .map((sentence) => sentence.id),
          )
        : null
    const pendingEntries =
      workspaceSource === 'chapter'
        ? selectedSentences
            .map((sentence, index) => ({
              absoluteIndex: selectedRangeStart + index,
              sentence,
            }))
            .filter(({ sentence }) => sentence.editedText.length > 0)
        : sanitized.map((sentence, index) => ({
            absoluteIndex: index,
            sentence,
          }))
    const pendingIds = new Set(pendingEntries.map(({ sentence }) => sentence.id))
    const nextResults: Record<string, AnalysisResult> =
      workspaceSource === 'chapter'
        ? Object.fromEntries(
            Object.entries(results).filter(([sentenceId]) => !rerunIds?.has(sentenceId)),
          )
        : {}

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
    setIsRunning(true)
    setGlobalError('')
    setNotice(
      workspaceSource === 'chapter' && chapterRange
        ? `正在解析区间 ${chapterRange.start}-${chapterRange.end}，共 ${pendingEntries.length} 句。`
        : `正在并发解析 ${pendingEntries.length} 句，结果会按原顺序回填。`,
    )
    setSentences(
      sanitized.map((sentence, index) => {
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
              status: 'idle',
              error: undefined,
            }
          }

          if (!pendingIds.has(sentence.id)) {
            return {
              ...sentence,
              status: nextResults[sentence.id] ? 'success' : sentence.status,
              error: undefined,
            }
          }

          return {
            ...sentence,
            status: 'queued',
            error: undefined,
          }
        }

        if (!pendingIds.has(sentence.id)) {
          return {
            ...sentence,
            status: 'success',
            error: undefined,
          }
        }

        return {
          ...sentence,
          status: 'queued',
          error: undefined,
        }
      }),
    )
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
          previousSentence: sanitized[absoluteIndex - 1]?.editedText,
          nextSentence: sanitized[absoluteIndex + 1]?.editedText,
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
      )

      if (runTokenRef.current !== runToken) {
        return
      }

      setSentences((current) =>
        current.map((sentence, index) => {
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
                status: 'idle',
                error: undefined,
              }
            }
          }

          if (!pendingIds.has(sentence.id)) {
            return {
              ...sentence,
              status: nextResults[sentence.id] ? 'success' : sentence.status,
              error: undefined,
            }
          }

          if (nextResults[sentence.id]) {
            return {
              ...sentence,
              status: 'success',
              error: undefined,
            }
          }

          return sentence.status === 'error'
            ? sentence
            : {
                ...sentence,
                status: 'error',
                error: '模型未返回可解析结果，请检查接口兼容性后重试。',
              }
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
      if (runTokenRef.current === runToken) {
        setIsRunning(false)
      }
    }
  }

  const retrySingleSentence = async (sentenceId: string) => {
    const target = sentences.find((sentence) => sentence.id === sentenceId)
    if (!target) {
      return
    }

    if (!apiConfig.baseUrl.trim() || !apiConfig.apiKey.trim() || !apiConfig.model.trim()) {
      setNotice('')
      setGlobalError('请先完整填写 API URL、API Key 和 Model。')
      return
    }

    const sentenceIndex = sentences.findIndex((sentence) => sentence.id === sentenceId)
    setGlobalError('')
    setNotice(`正在重试第 ${sentenceIndex + 1} 句。`)
    setSentences((current) =>
      updateSentenceState(current, sentenceId, (sentence) => ({
        ...sentence,
        status: 'running',
        error: undefined,
      })),
    )

    try {
      const result = await analyzeSentence(apiConfig, promptConfig, {
        sentenceId,
        sentence: target.editedText.trim(),
        previousSentence: sentences[sentenceIndex - 1]?.editedText.trim(),
        nextSentence: sentences[sentenceIndex + 1]?.editedText.trim(),
      })

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
      setNotice(`第 ${sentenceIndex + 1} 句已成功重试。`)
    } catch (error) {
      setSentences((current) =>
        updateSentenceState(current, sentenceId, (sentence) => ({
          ...sentence,
          status: 'error',
          error: toUserFacingError(error),
        })),
      )
      setNotice('')
      setGlobalError(`第 ${sentenceIndex + 1} 句重试失败：${toUserFacingError(error)}`)
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
