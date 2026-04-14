import { useCallback, useEffect, useState } from 'react'
import {
  type AnkiConfigChangeHandler,
  type AnkiFieldMappingChangeHandler,
  type ConfigChangeHandler,
  MAX_CONCURRENCY,
  type ModelFetchStatus,
  type PromptChangeHandler,
  type SettingsTab,
} from '../lib/appState'
import {
  ankiFieldSourceLabelMap,
  ankiFieldSourceOrder,
  fetchAnkiDeckNames,
  fetchAnkiNoteFields,
  fetchAnkiNoteTypes,
  fetchAnkiVersion,
  toUserFacingAnkiError,
} from '../lib/anki'
import { fetchAvailableModels, toUserFacingError } from '../lib/openai'
import type { AnkiConfig, ApiConfig, PromptConfig } from '../types'

type SettingsDialogProps = {
  activeSettingsTab: SettingsTab
  ankiConfig: AnkiConfig
  apiConfig: ApiConfig
  isOpen: boolean
  onAnkiConfigChange: AnkiConfigChangeHandler
  onAnkiFieldMappingChange: AnkiFieldMappingChangeHandler
  onClearLocalData: () => void
  onClose: () => void
  onConfigChange: ConfigChangeHandler
  onPromptChange: PromptChangeHandler
  onResetPrompt: () => void
  onSettingsTabChange: (tab: SettingsTab) => void
  promptConfig: PromptConfig
}

const MODEL_SEARCH_THRESHOLD = 30
const MODEL_PAGE_SIZE = 30
const settingsTabLabelMap: Record<SettingsTab, string> = {
  ai: 'AI 配置',
  prompt: 'Prompt',
  anki: 'Anki',
}

function SettingsDialog({
  activeSettingsTab,
  ankiConfig,
  apiConfig,
  isOpen,
  onAnkiConfigChange,
  onAnkiFieldMappingChange,
  onClearLocalData,
  onClose,
  onConfigChange,
  onPromptChange,
  onResetPrompt,
  onSettingsTabChange,
  promptConfig,
}: SettingsDialogProps) {
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [availableDecks, setAvailableDecks] = useState<string[]>([])
  const [availableNoteTypes, setAvailableNoteTypes] = useState<string[]>([])
  const [availableNoteFields, setAvailableNoteFields] = useState<string[]>([])
  const [modelFetchStatus, setModelFetchStatus] = useState<ModelFetchStatus>('idle')
  const [modelFetchMessage, setModelFetchMessage] = useState('填写 URL 和 API Key 后会自动获取模型列表。')
  const [modelSearchTerm, setModelSearchTerm] = useState('')
  const [modelPage, setModelPage] = useState(1)
  const [ankiFetchStatus, setAnkiFetchStatus] = useState<ModelFetchStatus>('idle')
  const [ankiFetchMessage, setAnkiFetchMessage] = useState('填写 AnkiConnect URL 后会自动检测连接并加载 deck / note type。')

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

  const runAnkiFetch = useCallback(async (signal?: AbortSignal) => {
    const endpoint = ankiConfig.endpoint.trim()

    if (!endpoint) {
      setAvailableDecks([])
      setAvailableNoteTypes([])
      setAvailableNoteFields([])
      setAnkiFetchStatus('idle')
      setAnkiFetchMessage('填写 AnkiConnect URL 后会自动检测连接并加载 deck / note type。')
      return
    }

    setAnkiFetchStatus('loading')
    setAnkiFetchMessage('正在连接 AnkiConnect...')

    try {
      const [version, decks, noteTypes] = await Promise.all([
        fetchAnkiVersion(endpoint, signal),
        fetchAnkiDeckNames(endpoint, signal),
        fetchAnkiNoteTypes(endpoint, signal),
      ])

      const nextDeck = ankiConfig.deck.trim() || decks[0] || ''
      const nextNoteType = ankiConfig.noteType.trim() || noteTypes[0] || ''

      if (nextDeck && nextDeck !== ankiConfig.deck) {
        onAnkiConfigChange('deck', nextDeck)
      }

      if (nextNoteType && nextNoteType !== ankiConfig.noteType) {
        onAnkiConfigChange('noteType', nextNoteType)
      }

      const fields = nextNoteType
        ? await fetchAnkiNoteFields(endpoint, nextNoteType, signal)
        : []

      for (const source of ankiFieldSourceOrder) {
        const mappedField = ankiConfig.fieldMapping[source]
        if (mappedField && !fields.includes(mappedField)) {
          onAnkiFieldMappingChange(source, '')
        }
      }

      setAvailableDecks(decks)
      setAvailableNoteTypes(noteTypes)
      setAvailableNoteFields(fields)
      setAnkiFetchStatus('success')
      setAnkiFetchMessage(
        `已连接到 AnkiConnect v${version}，找到 ${decks.length} 个 deck、${noteTypes.length} 个 note type。`,
      )
    } catch (error) {
      if (signal?.aborted) {
        return
      }

      setAvailableDecks([])
      setAvailableNoteTypes([])
      setAvailableNoteFields([])
      setAnkiFetchStatus('error')
      setAnkiFetchMessage(toUserFacingAnkiError(error))
    }
  }, [
    ankiConfig.deck,
    ankiConfig.endpoint,
    ankiConfig.fieldMapping,
    ankiConfig.noteType,
    onAnkiConfigChange,
    onAnkiFieldMappingChange,
  ])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || activeSettingsTab !== 'ai') {
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
  }, [activeSettingsTab, apiConfig.apiKey, apiConfig.baseUrl, isOpen, runModelFetch])

  useEffect(() => {
    if (!isOpen || activeSettingsTab !== 'anki') {
      return
    }

    const controller = new AbortController()
    const timerId = window.setTimeout(() => {
      void runAnkiFetch(controller.signal)
    }, 400)

    return () => {
      controller.abort()
      window.clearTimeout(timerId)
    }
  }, [activeSettingsTab, ankiConfig.endpoint, ankiConfig.noteType, isOpen, runAnkiFetch])

  if (!isOpen) {
    return null
  }

  return (
    <div className="settings-overlay" role="presentation" onClick={onClose}>
      <section
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header settings-header">
          <div className="settings-header-copy">
            <p className="section-kicker">Settings</p>
            <h2>设置</h2>
            <p className="panel-tip settings-header-tip">配置会自动保存在当前浏览器。</p>
          </div>
          <div className="panel-actions settings-header-actions">
            <button className="ghost-button danger-button" type="button" onClick={onClearLocalData}>
              清空本地数据
            </button>
            <button className="ghost-button" type="button" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div className="settings-status-strip">
          <span className="status-pill">当前标签 {settingsTabLabelMap[activeSettingsTab]}</span>
          <span className="status-pill">按 Esc 可关闭</span>
        </div>

        <div className="settings-tabs" role="tablist" aria-label="设置标签页">
          <button
            className={`settings-tab ${activeSettingsTab === 'ai' ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeSettingsTab === 'ai'}
            onClick={() => onSettingsTabChange('ai')}
          >
            AI 配置
          </button>
          <button
            className={`settings-tab ${activeSettingsTab === 'prompt' ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeSettingsTab === 'prompt'}
            onClick={() => onSettingsTabChange('prompt')}
          >
            Prompt
          </button>
          <button
            className={`settings-tab ${activeSettingsTab === 'anki' ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeSettingsTab === 'anki'}
            onClick={() => onSettingsTabChange('anki')}
          >
            Anki
          </button>
        </div>

        {activeSettingsTab === 'ai' ? (
          <div className="settings-panel">
            <div className="panel-header settings-subheader">
              <div>
                <h3>接口与模型</h3>
              </div>
              <button
                className="ghost-button"
                type="button"
                disabled={
                  modelFetchStatus === 'loading' ||
                  !apiConfig.baseUrl.trim() ||
                  !apiConfig.apiKey.trim()
                }
                onClick={() => void runModelFetch()}
              >
                {modelFetchStatus === 'loading' ? '获取中...' : '重新获取模型'}
              </button>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>API URL</span>
                <input
                  type="url"
                  value={apiConfig.baseUrl}
                  onChange={(event) => onConfigChange('baseUrl', event.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </label>

              <label className="field">
                <span>API Key</span>
                <input
                  type="password"
                  value={apiConfig.apiKey}
                  onChange={(event) => onConfigChange('apiKey', event.target.value)}
                  placeholder="sk-..."
                />
              </label>

              <label className="field">
                <span>Model</span>
                <input
                  type="text"
                  list="available-models"
                  value={apiConfig.model}
                  onChange={(event) => onConfigChange('model', event.target.value)}
                  placeholder="gpt-4.1-mini"
                />
                <datalist id="available-models">
                  {availableModels.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>
              </label>

              <label className="field">
                <span>并发数</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_CONCURRENCY}
                  value={apiConfig.concurrency}
                  onChange={(event) => onConfigChange('concurrency', Number(event.target.value))}
                />
              </label>
            </div>

            <p className="panel-tip">
              可设置范围为 1-{MAX_CONCURRENCY}。这里控制的是同时发出的请求数，不是模型官方承诺的可用并发上限。
              值越大越快，但更容易触发服务商或中转站的 RPM/TPM 限流；一般建议先从 4-8 开始，稳定后再逐步加大。
            </p>

            <div className={`fetch-status fetch-${modelFetchStatus}`}>
              <p>{modelFetchMessage}</p>
            </div>

            {availableModels.length > 0 ? (
              <div className="model-picker">
                {shouldPaginateModels ? (
                  <div className="model-picker-toolbar">
                    <label className="field field-compact model-search-field">
                      <span>搜索模型</span>
                      <input
                        type="search"
                        value={modelSearchTerm}
                        onChange={(event) => {
                          setModelSearchTerm(event.target.value)
                          setModelPage(1)
                        }}
                        placeholder="输入模型名筛选"
                      />
                    </label>

                    <div className="model-picker-summary">
                      <span>
                        共 {availableModels.length} 个模型，当前显示 {filteredModels.length} 个结果
                      </span>
                      <span>
                        第 {currentModelPage} / {totalModelPages} 页
                      </span>
                    </div>
                  </div>
                ) : null}

                {visibleModels.length > 0 ? (
                  <div className="model-chip-list">
                    {visibleModels.map((model) => (
                      <button
                        className={`model-chip ${apiConfig.model === model ? 'is-active' : ''}`}
                        key={model}
                        type="button"
                        onClick={() => onConfigChange('model', model)}
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="panel-tip model-picker-empty">没有匹配的模型，请换个关键词试试。</p>
                )}

                {shouldPaginateModels && filteredModels.length > 0 ? (
                  <div className="model-pagination">
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={currentModelPage <= 1}
                      onClick={() => setModelPage((page) => Math.max(1, page - 1))}
                    >
                      上一页
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={currentModelPage >= totalModelPages}
                      onClick={() => setModelPage((page) => Math.min(totalModelPages, page + 1))}
                    >
                      下一页
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <p className="panel-tip">
              兼容 OpenAI Chat Completions 协议。输入 URL 和 API Key 后会自动请求 `models`
              端点，并把返回的模型列表提供给你选择。
            </p>
          </div>
        ) : activeSettingsTab === 'prompt' ? (
          <div className="settings-panel prompt-panel">
            <div className="prompt-toolbar">
              <div className="prompt-hints">
                <span className="hint-chip">{'{sentence}'}</span>
                <span className="hint-chip">{'{previousSentence}'}</span>
                <span className="hint-chip">{'{nextSentence}'}</span>
              </div>
              <button className="secondary-button" type="button" onClick={onResetPrompt}>
                恢复默认 Prompt
              </button>
            </div>

            <label className="field field-block">
              <span>统一 Prompt 模板</span>
              <textarea
                className="settings-textarea settings-textarea-large"
                value={promptConfig.template}
                onChange={(event) => onPromptChange(event.target.value)}
                placeholder="直接填写会完整发送给模型的唯一 Prompt 模板..."
              />
            </label>

            <p className="panel-tip">
              这里只有一个 Prompt 输入框。你在这里写的全部内容会原样作为单条用户消息发送给模型，请保留
              `{'{sentence}'}`、`{'{previousSentence}'}`、`{'{nextSentence}'}` 这些占位符。
            </p>
          </div>
        ) : (
          <div className="settings-panel prompt-panel">
            <div className="panel-header settings-subheader">
              <div>
                <h3>AnkiConnect</h3>
              </div>
              <button
                className="ghost-button"
                type="button"
                disabled={ankiFetchStatus === 'loading' || !ankiConfig.endpoint.trim()}
                onClick={() => void runAnkiFetch()}
              >
                {ankiFetchStatus === 'loading' ? '连接中...' : '测试连接并刷新'}
              </button>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>AnkiConnect URL</span>
                <input
                  type="url"
                  value={ankiConfig.endpoint}
                  onChange={(event) => onAnkiConfigChange('endpoint', event.target.value)}
                  placeholder="http://127.0.0.1:8765"
                />
              </label>

              <label className="field">
                <span>Deck</span>
                <select
                  value={ankiConfig.deck}
                  onChange={(event) => onAnkiConfigChange('deck', event.target.value)}
                >
                  <option value="">请选择 deck</option>
                  {availableDecks.map((deck) => (
                    <option key={deck} value={deck}>
                      {deck}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Note Type</span>
                <select
                  value={ankiConfig.noteType}
                  onChange={(event) => onAnkiConfigChange('noteType', event.target.value)}
                >
                  <option value="">请选择 note type</option>
                  {availableNoteTypes.map((noteType) => (
                    <option key={noteType} value={noteType}>
                      {noteType}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className={`fetch-status fetch-${ankiFetchStatus}`}>
              <p>{ankiFetchMessage}</p>
            </div>

            <div className="anki-mapping-grid">
              {ankiFieldSourceOrder.map((source) => (
                <label className="field" key={source}>
                  <span>{ankiFieldSourceLabelMap[source]}</span>
                  <select
                    value={ankiConfig.fieldMapping[source]}
                    onChange={(event) => onAnkiFieldMappingChange(source, event.target.value)}
                    disabled={!ankiConfig.noteType.trim() || availableNoteFields.length === 0}
                  >
                    <option value="">
                      {ankiConfig.noteType.trim() ? '请选择字段' : '先选择 note type'}
                    </option>
                    {availableNoteFields.map((fieldName) => (
                      <option key={fieldName} value={fieldName}>
                        {fieldName}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <p className="panel-tip">
              当前会把 6 个内容源写进你映射的字段：句子、语法、内容、知识点、知识点类型、知识点解释。添加到
              Anki 时允许重复卡片，失败会直接提示，不会静默跳过。
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

export default SettingsDialog
