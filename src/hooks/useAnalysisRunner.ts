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
import { analyzeSentence, runConcurrentAnalysis, toUserFacingError } from '../lib/openai'
import { segmentSpanishText } from '../lib/segment'
import type {
  AnalysisResult,
  ApiConfig,
  PromptConfig,
  RunSession,
  SentenceItem,
  WorkspaceSource,
} from '../types'

type UseAnalysisRunnerArgs = {
  apiConfig: ApiConfig
  initialNotice: string
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
  initialNotice,
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

  const validateBeforeRun = () => {
    if (!apiConfig.baseUrl.trim() || !apiConfig.apiKey.trim() || !apiConfig.model.trim()) {
      setNotice('')
      setGlobalError('请先完整填写 API URL、API Key 和 Model。')
      return false
    }

    const usableSentences = cleanSentences(sentences)
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

    const sanitized = cleanSentences(sentences)
    const pendingSentences =
      workspaceSource === 'chapter'
        ? sanitized.filter((sentence) => !results[sentence.id])
        : sanitized

    if (workspaceSource === 'chapter' && pendingSentences.length === 0) {
      setGlobalError('')
      setNotice('这一章已经全部解析完成，可以直接进入阅读。')
      return 'reading' as const
    }

    const pendingIds = new Set(pendingSentences.map((sentence) => sentence.id))
    const nextResults: Record<string, AnalysisResult> =
      workspaceSource === 'chapter' ? { ...results } : {}

    runTokenRef.current += 1
    const runToken = runTokenRef.current
    setIsRunning(true)
    setGlobalError('')
    setNotice(`正在并发解析 ${pendingSentences.length} 句，结果会按原顺序回填。`)
    setSentences(
      sanitized.map((sentence) => {
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
    if (workspaceSource === 'draft') {
      setResults({})
    }

    try {
      await runConcurrentAnalysis(
        apiConfig,
        promptConfig,
        pendingSentences.map((sentence, index) => ({
          sentenceId: sentence.id,
          sentence: sentence.editedText,
          previousSentence: pendingSentences[index - 1]?.editedText,
          nextSentence: pendingSentences[index + 1]?.editedText,
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
        current.map((sentence) => {
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

      setNotice('本轮解析已完成，已自动切换到沉浸阅读页。')
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
