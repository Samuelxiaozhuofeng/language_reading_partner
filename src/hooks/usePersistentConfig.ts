import { useCallback, useEffect, useState } from 'react'
import type {
  AnalysisResult,
  AnkiConfig,
  ApiConfig,
  PromptConfig,
  RunSession,
  SentenceItem,
} from '../types'
import {
  ANKI_STORAGE_KEY,
  clampConcurrency,
  clearPersistedStorage,
  CONFIG_STORAGE_KEY,
  defaultAnkiConfig,
  defaultConfig,
  defaultPromptConfig,
  defaultSourceText,
  DRAFT_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  PROMPT_STORAGE_KEY,
  restoreAnkiConfig,
  restoreConfig,
  restoreDraft,
  restoreHistory,
  restorePromptConfig,
  type AnkiConfigChangeHandler,
  type AnkiFieldMappingChangeHandler,
  type ConfigChangeHandler,
  type PersistedDraft,
  type PromptChangeHandler,
} from '../lib/appState'
import type { Dispatch, SetStateAction } from 'react'

type PersistentConfigState = {
  ankiConfig: AnkiConfig
  apiConfig: ApiConfig
  handleAnkiConfigChange: AnkiConfigChangeHandler
  handleAnkiFieldMappingChange: AnkiFieldMappingChangeHandler
  handleConfigChange: ConfigChangeHandler
  handlePromptChange: PromptChangeHandler
  history: RunSession[]
  initialNotice: string
  promptConfig: PromptConfig
  resetAll: () => void
  resetPromptConfig: () => void
  results: Record<string, AnalysisResult>
  sentences: SentenceItem[]
  setHistory: Dispatch<SetStateAction<RunSession[]>>
  setResults: Dispatch<SetStateAction<Record<string, AnalysisResult>>>
  setSentences: Dispatch<SetStateAction<SentenceItem[]>>
  setSourceText: Dispatch<SetStateAction<string>>
  sourceText: string
}

export function usePersistentConfig(): PersistentConfigState {
  const [draft] = useState(restoreDraft)
  const [ankiConfig, setAnkiConfig] = useState<AnkiConfig>(restoreAnkiConfig)
  const [apiConfig, setApiConfig] = useState<ApiConfig>(restoreConfig)
  const [promptConfig, setPromptConfig] = useState<PromptConfig>(restorePromptConfig)
  const [sourceText, setSourceText] = useState(draft.sourceText)
  const [sentences, setSentences] = useState<SentenceItem[]>(draft.sentences)
  const [results, setResults] = useState<Record<string, AnalysisResult>>(draft.results)
  const [history, setHistory] = useState<RunSession[]>(restoreHistory)

  useEffect(() => {
    localStorage.setItem(ANKI_STORAGE_KEY, JSON.stringify(ankiConfig))
  }, [ankiConfig])

  useEffect(() => {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(apiConfig))
  }, [apiConfig])

  useEffect(() => {
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(promptConfig))
  }, [promptConfig])

  useEffect(() => {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ sourceText, sentences, results } satisfies PersistedDraft),
    )
  }, [results, sentences, sourceText])

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
  }, [history])

  const handleConfigChange: ConfigChangeHandler = useCallback((key, value) => {
    setApiConfig((current) => ({
      ...current,
      [key]: key === 'concurrency' ? clampConcurrency(value) : value,
    }))
  }, [])

  const handleAnkiConfigChange: AnkiConfigChangeHandler = useCallback((key, value) => {
    setAnkiConfig((current) => ({
      ...current,
      [key]: value,
    }))
  }, [])

  const handleAnkiFieldMappingChange: AnkiFieldMappingChangeHandler = useCallback((source, value) => {
    setAnkiConfig((current) => ({
      ...current,
      fieldMapping: {
        ...current.fieldMapping,
        [source]: value,
      },
    }))
  }, [])

  const handlePromptChange: PromptChangeHandler = useCallback((value) => {
    setPromptConfig({
      template: value,
    })
  }, [])

  const resetPromptConfig = useCallback(() => {
    setPromptConfig(defaultPromptConfig)
  }, [])

  const resetAll = useCallback(() => {
    clearPersistedStorage()
    setAnkiConfig(defaultAnkiConfig)
    setApiConfig(defaultConfig)
    setPromptConfig(defaultPromptConfig)
    setSourceText('')
    setSentences([])
    setResults({})
    setHistory([])
  }, [])

  const initialNotice =
    draft.sourceText === defaultSourceText ? '已加载示例文本，可以直接试跑。' : '已从本地恢复最近一次工作区。'

  return {
    ankiConfig,
    apiConfig,
    handleAnkiConfigChange,
    handleAnkiFieldMappingChange,
    handleConfigChange,
    handlePromptChange,
    history,
    initialNotice,
    promptConfig,
    resetAll,
    resetPromptConfig,
    results,
    sentences,
    setHistory,
    setResults,
    setSentences,
    setSourceText,
    sourceText,
  }
}
