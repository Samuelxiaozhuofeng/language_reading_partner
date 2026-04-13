import { useCallback, useEffect, useState } from 'react'
import {
  type ConfigChangeHandler,
  type ModelFetchStatus,
  type PromptChangeHandler,
  type SettingsTab,
} from '../lib/appState'
import { fetchAvailableModels, toUserFacingError } from '../lib/openai'
import type { ApiConfig, PromptConfig } from '../types'

type SettingsDialogProps = {
  activeSettingsTab: SettingsTab
  apiConfig: ApiConfig
  isOpen: boolean
  onClearLocalData: () => void
  onClose: () => void
  onConfigChange: ConfigChangeHandler
  onPromptChange: PromptChangeHandler
  onResetPrompt: () => void
  onSettingsTabChange: (tab: SettingsTab) => void
  promptConfig: PromptConfig
}

function SettingsDialog({
  activeSettingsTab,
  apiConfig,
  isOpen,
  onClearLocalData,
  onClose,
  onConfigChange,
  onPromptChange,
  onResetPrompt,
  onSettingsTabChange,
  promptConfig,
}: SettingsDialogProps) {
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [modelFetchStatus, setModelFetchStatus] = useState<ModelFetchStatus>('idle')
  const [modelFetchMessage, setModelFetchMessage] = useState('填写 URL 和 API Key 后会自动获取模型列表。')

  const runModelFetch = useCallback(async (signal?: AbortSignal) => {
    const baseUrl = apiConfig.baseUrl.trim()
    const apiKey = apiConfig.apiKey.trim()

    if (!baseUrl || !apiKey) {
      setAvailableModels([])
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
      setModelFetchStatus('error')
      setModelFetchMessage(toUserFacingError(error))
    }
  }, [apiConfig.apiKey, apiConfig.baseUrl, apiConfig.model, onConfigChange])

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
          <div>
            <p className="section-kicker">Settings</p>
            <h2>设置</h2>
          </div>
          <div className="panel-actions">
            <button className="ghost-button" type="button" onClick={onClearLocalData}>
              清空本地数据
            </button>
            <button className="ghost-button" type="button" onClick={onClose}>
              关闭
            </button>
          </div>
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
                  max={8}
                  value={apiConfig.concurrency}
                  onChange={(event) => onConfigChange('concurrency', Number(event.target.value))}
                />
              </label>
            </div>

            <div className={`fetch-status fetch-${modelFetchStatus}`}>
              <p>{modelFetchMessage}</p>
            </div>

            {availableModels.length > 0 ? (
              <div className="model-chip-list">
                {availableModels.slice(0, 24).map((model) => (
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
            ) : null}

            <p className="panel-tip">
              兼容 OpenAI Chat Completions 协议。输入 URL 和 API Key 后会自动请求 `models`
              端点，并把返回的模型列表提供给你选择。
            </p>
          </div>
        ) : (
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
              <span>System Prompt</span>
              <textarea
                className="settings-textarea"
                value={promptConfig.systemPrompt}
                onChange={(event) => onPromptChange('systemPrompt', event.target.value)}
                placeholder="定义模型的角色与输出约束..."
              />
            </label>

            <label className="field field-block">
              <span>User Prompt Template</span>
              <textarea
                className="settings-textarea settings-textarea-large"
                value={promptConfig.userPromptTemplate}
                onChange={(event) => onPromptChange('userPromptTemplate', event.target.value)}
                placeholder="使用占位符拼接每一句的上下文..."
              />
            </label>

            <p className="panel-tip">
              可以通过修改 Prompt 来优化解释风格、细节密度或输出约束。模板会在每句请求前自动替换占位符。
            </p>
          </div>
        )}
      </section>
    </div>
  )
}

export default SettingsDialog
