import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { toUserFacingAnkiError } from '../../lib/anki'
import type {
  AnalysisHighlight,
  AnalysisResult,
  SentenceItem,
  VocabularyExplanation,
} from '../../types'

export type VocabularyExplanationState = {
  ankiMessage: string
  ankiStatus: 'idle' | 'loading' | 'success' | 'error'
  errorMessage: string
  explanation: string
  requestKey: string
  status: 'loading' | 'success' | 'error'
  word: string
}

type UseVocabularyExplanationArgs = {
  onAddToAnki: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => Promise<void>
  onExplainVocabulary: (context: string, word: string) => Promise<VocabularyExplanation>
  result?: AnalysisResult
  sentence: SentenceItem
}

export type VocabularyExplanationInteraction = {
  detailRef: RefObject<HTMLDivElement | null>
  handleAddToAnki: () => Promise<void>
  handleClose: () => void
  handleWordClick: (word: string) => Promise<void>
  sentenceText: string
  state: VocabularyExplanationState | null
}

export function useVocabularyExplanation({
  onAddToAnki,
  onExplainVocabulary,
  result,
  sentence,
}: UseVocabularyExplanationArgs): VocabularyExplanationInteraction {
  const detailRef = useRef<HTMLDivElement | null>(null)
  const requestKeyRef = useRef('')
  const [state, setState] = useState<VocabularyExplanationState | null>(null)
  const sentenceText = sentence.editedText || sentence.text

  useEffect(() => {
    setState(null)
    requestKeyRef.current = ''
  }, [sentence.id])

  useEffect(() => {
    if (!state || state.status === 'loading' || !detailRef.current) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      })
      detailRef.current?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [state])

  const handleWordClick = async (word: string) => {
    const requestKey = `${sentence.id}:${word}:${Date.now()}`
    requestKeyRef.current = requestKey
    setState({
      ankiMessage: '',
      ankiStatus: 'idle',
      errorMessage: '',
      explanation: '',
      requestKey,
      status: 'loading',
      word,
    })

    try {
      const vocabularyExplanation = await onExplainVocabulary(sentenceText, word)
      if (requestKeyRef.current !== requestKey) {
        return
      }

      setState({
        ankiMessage: '',
        ankiStatus: 'idle',
        errorMessage: '',
        explanation: vocabularyExplanation.explanation,
        requestKey,
        status: 'success',
        word: vocabularyExplanation.word,
      })
    } catch (error) {
      if (requestKeyRef.current !== requestKey) {
        return
      }

      setState({
        ankiMessage: '',
        ankiStatus: 'idle',
        errorMessage: error instanceof Error ? error.message : '词汇解释失败，请稍后重试。',
        explanation: '',
        requestKey,
        status: 'error',
        word,
      })
    }
  }

  const handleAddToAnki = async () => {
    if (!state || state.status !== 'success' || !result) {
      return
    }

    const vocabularyHighlight: AnalysisHighlight = {
      id: `${sentence.id}:vocabulary:${state.word}`,
      explanation: state.explanation,
      kind: 'vocabulary',
      text: state.word,
    }

    setState((current) =>
      current
        ? {
            ...current,
            ankiMessage: '正在添加到 Anki...',
            ankiStatus: 'loading',
          }
        : current,
    )

    try {
      await onAddToAnki(sentence, result, vocabularyHighlight)
      setState((current) =>
        current
          ? {
              ...current,
              ankiMessage: `已将「${state.word}」添加到 Anki。`,
              ankiStatus: 'success',
            }
          : current,
      )
    } catch (error) {
      setState((current) =>
        current
          ? {
              ...current,
              ankiMessage: toUserFacingAnkiError(error),
              ankiStatus: 'error',
            }
          : current,
      )
    }
  }

  const handleClose = () => {
    setState(null)
    requestKeyRef.current = ''
  }

  return {
    detailRef,
    handleAddToAnki,
    handleClose,
    handleWordClick,
    sentenceText,
    state,
  }
}
