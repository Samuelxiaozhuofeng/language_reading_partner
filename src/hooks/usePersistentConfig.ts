import { useCallback, useEffect, useState } from 'react'
import type {
  AnalysisResult,
  AnkiConfig,
  ApiConfig,
  PromptConfig,
  ReadingPreferences,
  RunSession,
  SentenceItem,
  VocabularyPromptConfig,
} from '../types'
import {
  ANKI_STORAGE_KEY,
  clampConcurrency,
  clampPromptContextSentenceCount,
  clampReadingContentWidth,
  clampReadingFontSize,
  clearPersistedStorage,
  CONFIG_STORAGE_KEY,
  defaultAnkiConfig,
  defaultConfig,
  defaultPromptConfig,
  defaultReadingPreferences,
  defaultSourceText,
  defaultVocabularyConfig,
  defaultVocabularyPromptConfig,
  DRAFT_STORAGE_KEY,
  HISTORY_STORAGE_KEY,
  PROMPT_STORAGE_KEY,
  READING_PREFERENCES_STORAGE_KEY,
  restoreAnkiConfig,
  restoreConfig,
  restoreDraft,
  restoreHistory,
  restorePromptConfig,
  restoreReadingPreferences,
  restoreVocabularyAiShared,
  restoreVocabularyConfig,
  restoreVocabularyPromptConfig,
  type AnkiConfigChangeHandler,
  type AnkiFieldMappingChangeHandler,
  type ConfigChangeHandler,
  type PersistedDraft,
  type PromptConfigChangeHandler,
  type ReadingPreferencesChangeHandler,
  type VocabularyPromptConfigChangeHandler,
  VOCABULARY_AI_SHARED_STORAGE_KEY,
  VOCABULARY_CONFIG_STORAGE_KEY,
  VOCABULARY_PROMPT_STORAGE_KEY,
} from '../lib/appState'
import type { Dispatch, SetStateAction } from 'react'

type PersistentConfigState = {
  ankiConfig: AnkiConfig
  articleTitle: string
  apiConfig: ApiConfig
  handleAnkiConfigChange: AnkiConfigChangeHandler
  handleAnkiFieldMappingChange: AnkiFieldMappingChangeHandler
  handleConfigChange: ConfigChangeHandler
  handlePromptChange: PromptConfigChangeHandler
  hasSavedDraft: boolean
  history: RunSession[]
  initialNotice: string
  isVocabularyAiShared: boolean
  promptConfig: PromptConfig
  readingPreferences: ReadingPreferences
  resetAll: () => void
  resetPromptConfig: () => void
  resetVocabularyPromptConfig: () => void
  results: Record<string, AnalysisResult>
  handleReadingPreferencesChange: ReadingPreferencesChangeHandler
  handleVocabularyAiSharedChange: (value: boolean) => void
  handleVocabularyConfigChange: ConfigChangeHandler
  handleVocabularyPromptChange: VocabularyPromptConfigChangeHandler
  sentences: SentenceItem[]
  setHistory: Dispatch<SetStateAction<RunSession[]>>
  setArticleTitle: Dispatch<SetStateAction<string>>
  setResults: Dispatch<SetStateAction<Record<string, AnalysisResult>>>
  setSentences: Dispatch<SetStateAction<SentenceItem[]>>
  setSourceText: Dispatch<SetStateAction<string>>
  sourceText: string
  vocabularyApiConfig: ApiConfig
  vocabularyPromptConfig: VocabularyPromptConfig
}

export function usePersistentConfig(): PersistentConfigState {
  const [draft] = useState(restoreDraft)
  const [ankiConfig, setAnkiConfig] = useState<AnkiConfig>(restoreAnkiConfig)
  const [apiConfig, setApiConfig] = useState<ApiConfig>(restoreConfig)
  const [vocabularyApiConfig, setVocabularyApiConfig] =
    useState<ApiConfig>(restoreVocabularyConfig)
  const [isVocabularyAiShared, setIsVocabularyAiShared] = useState(restoreVocabularyAiShared)
  const [promptConfig, setPromptConfig] = useState<PromptConfig>(restorePromptConfig)
  const [vocabularyPromptConfig, setVocabularyPromptConfig] =
    useState<VocabularyPromptConfig>(restoreVocabularyPromptConfig)
  const [readingPreferences, setReadingPreferences] = useState<ReadingPreferences>(
    restoreReadingPreferences,
  )
  const [articleTitle, setArticleTitle] = useState(draft.articleTitle)
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
    localStorage.setItem(VOCABULARY_CONFIG_STORAGE_KEY, JSON.stringify(vocabularyApiConfig))
  }, [vocabularyApiConfig])

  useEffect(() => {
    localStorage.setItem(VOCABULARY_AI_SHARED_STORAGE_KEY, JSON.stringify(isVocabularyAiShared))
  }, [isVocabularyAiShared])

  useEffect(() => {
    localStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify(promptConfig))
  }, [promptConfig])

  useEffect(() => {
    localStorage.setItem(VOCABULARY_PROMPT_STORAGE_KEY, JSON.stringify(vocabularyPromptConfig))
  }, [vocabularyPromptConfig])

  useEffect(() => {
    localStorage.setItem(READING_PREFERENCES_STORAGE_KEY, JSON.stringify(readingPreferences))
  }, [readingPreferences])

  useEffect(() => {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ articleTitle, sourceText, sentences, results } satisfies PersistedDraft),
    )
  }, [articleTitle, results, sentences, sourceText])

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history))
  }, [history])

  const handleConfigChange: ConfigChangeHandler = useCallback((key, value) => {
    setApiConfig((current) => ({
      ...current,
      [key]: key === 'concurrency' ? clampConcurrency(value) : value,
    }))
  }, [])

  const handleVocabularyConfigChange: ConfigChangeHandler = useCallback((key, value) => {
    setVocabularyApiConfig((current) => ({
      ...current,
      [key]: key === 'concurrency' ? clampConcurrency(value) : value,
    }))
  }, [])

  const handleVocabularyAiSharedChange = useCallback((value: boolean) => {
    setIsVocabularyAiShared(value)
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

  const handlePromptChange: PromptConfigChangeHandler = useCallback((key, value) => {
    setPromptConfig((current) => ({
      ...current,
      [key]:
        key === 'previousSentenceCount' || key === 'nextSentenceCount'
          ? clampPromptContextSentenceCount(value)
          : value,
    }))
  }, [])

  const handleVocabularyPromptChange: VocabularyPromptConfigChangeHandler = useCallback(
    (key, value) => {
      setVocabularyPromptConfig((current) => ({
        ...current,
        [key]: value,
      }))
    },
    [],
  )

  const handleReadingPreferencesChange: ReadingPreferencesChangeHandler = useCallback(
    (key, value) => {
      setReadingPreferences((current) => ({
        ...current,
        [key]:
          key === 'contentWidth'
            ? clampReadingContentWidth(value)
            : clampReadingFontSize(value),
      }))
    },
    [],
  )

  const resetPromptConfig = useCallback(() => {
    setPromptConfig(defaultPromptConfig)
  }, [])

  const resetVocabularyPromptConfig = useCallback(() => {
    setVocabularyPromptConfig(defaultVocabularyPromptConfig)
  }, [])

  const resetAll = useCallback(() => {
    clearPersistedStorage()
    setAnkiConfig(defaultAnkiConfig)
    setApiConfig(defaultConfig)
    setVocabularyApiConfig(defaultVocabularyConfig)
    setIsVocabularyAiShared(true)
    setPromptConfig(defaultPromptConfig)
    setVocabularyPromptConfig(defaultVocabularyPromptConfig)
    setReadingPreferences(defaultReadingPreferences)
    setArticleTitle('')
    setSourceText('')
    setSentences([])
    setResults({})
    setHistory([])
  }, [])

  const hasSavedDraft =
    articleTitle.trim().length > 0 ||
    (sourceText.trim().length > 0 && sourceText !== defaultSourceText) ||
    Object.keys(results).length > 0

  const initialNotice =
    draft.sourceText === defaultSourceText ? '已加载示例文本，可以直接试跑。' : '已从本地恢复最近一次工作区。'

  return {
    ankiConfig,
    articleTitle,
    apiConfig,
    handleAnkiConfigChange,
    handleAnkiFieldMappingChange,
    handleConfigChange,
    handlePromptChange,
    handleReadingPreferencesChange,
    handleVocabularyAiSharedChange,
    handleVocabularyConfigChange,
    handleVocabularyPromptChange,
    hasSavedDraft,
    history,
    initialNotice,
    isVocabularyAiShared,
    promptConfig,
    readingPreferences,
    resetAll,
    resetPromptConfig,
    resetVocabularyPromptConfig,
    results,
    setArticleTitle,
    sentences,
    setHistory,
    setResults,
    setSentences,
    setSourceText,
    sourceText,
    vocabularyApiConfig,
    vocabularyPromptConfig,
  }
}
