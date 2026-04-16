import { useCallback, useEffect, useState } from 'react'
import type { ConfigChangeHandler, ModelFetchStatus } from '../../lib/appState'
import { fetchAvailableModels, toUserFacingError } from '../../lib/openai'
import type { ApiConfig } from '../../types'
import { MODEL_PAGE_SIZE, MODEL_SEARCH_THRESHOLD } from './settingsShared'

type UseModelFetchOptions = {
  apiConfig: ApiConfig
  isActive: boolean
  isOpen: boolean
  onConfigChange: ConfigChangeHandler
}

type UseModelFetchResult = {
  availableModels: string[]
  currentModelPage: number
  filteredModels: string[]
  modelFetchMessage: string
  modelFetchStatus: ModelFetchStatus
  modelSearchTerm: string
  runModelFetch: (signal?: AbortSignal) => Promise<void>
  setModelSearchTerm: (value: string) => void
  shouldPaginateModels: boolean
  totalModelPages: number
  visibleModels: string[]
  goToNextModelPage: () => void
  goToPreviousModelPage: () => void
}

export function useModelFetch({
  apiConfig,
  isActive,
  isOpen,
  onConfigChange,
}: UseModelFetchOptions): UseModelFetchResult {
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [modelFetchStatus, setModelFetchStatus] = useState<ModelFetchStatus>('idle')
  const [modelFetchMessage, setModelFetchMessage] = useState(
    '填写 URL 和 API Key 后会自动获取模型列表。',
  )
  const [modelSearchTerm, setModelSearchTermState] = useState('')
  const [modelPage, setModelPage] = useState(1)

  const shouldPaginateModels = availableModels.length > MODEL_SEARCH_THRESHOLD
  const normalizedModelSearchTerm = modelSearchTerm.trim().toLowerCase()
  const filteredModels = availableModels.filter((model) =>
    normalizedModelSearchTerm ? model.toLowerCase().includes(normalizedModelSearchTerm) : true,
  )
  const totalModelPages = shouldPaginateModels
    ? Math.max(1, Math.ceil(filteredModels.length / MODEL_PAGE_SIZE))
    : 1
  const currentModelPage = Math.min(modelPage, totalModelPages)
  const visibleModels = shouldPaginateModels
    ? filteredModels.slice(
        (currentModelPage - 1) * MODEL_PAGE_SIZE,
        currentModelPage * MODEL_PAGE_SIZE,
      )
    : filteredModels

  const runModelFetch = useCallback(async (signal?: AbortSignal) => {
    const baseUrl = apiConfig.baseUrl.trim()
    const apiKey = apiConfig.apiKey.trim()

    if (!baseUrl || !apiKey) {
      setAvailableModels([])
      setModelPage(1)
      setModelFetchStatus('idle')
      setModelFetchMessage('填写 URL 和 API Key 后会自动获取模型列表。')
      return
    }

    setModelFetchStatus('loading')
    setModelFetchMessage('正在获取模型列表...')

    try {
      const models = await fetchAvailableModels(
        { baseUrl: apiConfig.baseUrl, apiKey: apiConfig.apiKey },
        signal,
      )

      setAvailableModels(models)
      setModelPage(1)
      setModelFetchStatus('success')
      setModelFetchMessage(
        models.length > 0
          ? `已获取 ${models.length} 个模型，可直接点击下方推荐模型。`
          : '接口已响应，但没有返回模型列表。',
      )

      if (models[0] && !apiConfig.model.trim()) {
        onConfigChange('model', models[0])
      }
    } catch (error) {
      if (signal?.aborted) {
        return
      }

      setAvailableModels([])
      setModelPage(1)
      setModelFetchStatus('error')
      setModelFetchMessage(toUserFacingError(error))
    }
  }, [apiConfig.apiKey, apiConfig.baseUrl, apiConfig.model, onConfigChange])

  useEffect(() => {
    if (!isOpen || !isActive) {
      return
    }

    const controller = new AbortController()
    const timerId = window.setTimeout(() => {
      void runModelFetch(controller.signal)
    }, 600)

    return () => {
      controller.abort()
      window.clearTimeout(timerId)
    }
  }, [apiConfig.apiKey, apiConfig.baseUrl, isActive, isOpen, runModelFetch])

  const setModelSearchTerm = useCallback((value: string) => {
    setModelSearchTermState(value)
    setModelPage(1)
  }, [])

  const goToPreviousModelPage = useCallback(() => {
    setModelPage((page) => Math.max(1, page - 1))
  }, [])

  const goToNextModelPage = useCallback(() => {
    setModelPage((page) => Math.min(totalModelPages, page + 1))
  }, [totalModelPages])

  return {
    availableModels,
    currentModelPage,
    filteredModels,
    modelFetchMessage,
    modelFetchStatus,
    modelSearchTerm,
    runModelFetch,
    setModelSearchTerm,
    shouldPaginateModels,
    totalModelPages,
    visibleModels,
    goToNextModelPage,
    goToPreviousModelPage,
  }
}
