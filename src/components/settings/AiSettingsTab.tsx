import type { ConfigChangeHandler, ModelFetchStatus } from '../../lib/appState'
import { MAX_CONCURRENCY } from '../../lib/appState'
import type { ApiConfig } from '../../types'

type AiSettingsTabProps = {
  apiConfig: ApiConfig
  availableModels: string[]
  currentModelPage: number
  filteredModelCount: number
  modelFetchMessage: string
  modelFetchStatus: ModelFetchStatus
  modelSearchTerm: string
  onConfigChange: ConfigChangeHandler
  onModelSearchTermChange: (value: string) => void
  onNextModelPage: () => void
  onPreviousModelPage: () => void
  onRefetchModels: () => void
  shouldPaginateModels: boolean
  totalModelPages: number
  visibleModels: string[]
}

const AVAILABLE_MODELS_DATALIST_ID = 'settings-available-models'

function AiSettingsTab({
  apiConfig,
  availableModels,
  currentModelPage,
  filteredModelCount,
  modelFetchMessage,
  modelFetchStatus,
  modelSearchTerm,
  onConfigChange,
  onModelSearchTermChange,
  onNextModelPage,
  onPreviousModelPage,
  onRefetchModels,
  shouldPaginateModels,
  totalModelPages,
  visibleModels,
}: AiSettingsTabProps) {
  return (
    <div className="settings-panel">
      <div className="panel-header settings-subheader">
        <div>
          <h3>接口与模型</h3>
        </div>
        <button
          className="ghost-button"
          type="button"
          disabled={
            modelFetchStatus === 'loading' || !apiConfig.baseUrl.trim() || !apiConfig.apiKey.trim()
          }
          onClick={onRefetchModels}
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
            list={AVAILABLE_MODELS_DATALIST_ID}
            value={apiConfig.model}
            onChange={(event) => onConfigChange('model', event.target.value)}
            placeholder="gpt-4.1-mini"
          />
          <datalist id={AVAILABLE_MODELS_DATALIST_ID}>
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
        可设置范围为 1-{MAX_CONCURRENCY}。这里控制的是同时发出的请求数，不是模型官方承诺的可用并发上限。值越大越快，但更容易触发服务商或中转站的
        RPM/TPM 限流；一般建议先从 4-8 开始，稳定后再逐步加大。
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
                  onChange={(event) => onModelSearchTermChange(event.target.value)}
                  placeholder="输入模型名筛选"
                />
              </label>

              <div className="model-picker-summary">
                <span>共 {availableModels.length} 个模型，当前显示 {filteredModelCount} 个结果</span>
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

          {shouldPaginateModels && filteredModelCount > 0 ? (
            <div className="model-pagination">
              <button
                className="ghost-button"
                type="button"
                disabled={currentModelPage <= 1}
                onClick={onPreviousModelPage}
              >
                上一页
              </button>
              <button
                className="ghost-button"
                type="button"
                disabled={currentModelPage >= totalModelPages}
                onClick={onNextModelPage}
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
  )
}

export default AiSettingsTab
