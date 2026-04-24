import type { ConfigChangeHandler, ModelFetchStatus } from '../../lib/appState'
import { MAX_CONCURRENCY } from '../../lib/appState'
import type { ApiConfig } from '../../types'

type ModelPickerProps = {
  apiConfig: ApiConfig
  availableModels: string[]
  currentModelPage: number
  datalistId: string
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
  showConcurrency: boolean
  title: string
  totalModelPages: number
  visibleModels: string[]
}

type AiSettingsTabProps = {
  apiConfig: ApiConfig
  availableModels: string[]
  currentModelPage: number
  filteredModelCount: number
  isVocabularyAiShared: boolean
  modelFetchMessage: string
  modelFetchStatus: ModelFetchStatus
  modelSearchTerm: string
  onConfigChange: ConfigChangeHandler
  onModelSearchTermChange: (value: string) => void
  onNextModelPage: () => void
  onPreviousModelPage: () => void
  onRefetchModels: () => void
  onVocabularyAiSharedChange: (value: boolean) => void
  onVocabularyConfigChange: ConfigChangeHandler
  onVocabularyModelSearchTermChange: (value: string) => void
  onVocabularyNextModelPage: () => void
  onVocabularyPreviousModelPage: () => void
  onVocabularyRefetchModels: () => void
  shouldPaginateModels: boolean
  totalModelPages: number
  visibleModels: string[]
  vocabularyApiConfig: ApiConfig
  vocabularyAvailableModels: string[]
  vocabularyCurrentModelPage: number
  vocabularyFilteredModelCount: number
  vocabularyModelFetchMessage: string
  vocabularyModelFetchStatus: ModelFetchStatus
  vocabularyModelSearchTerm: string
  vocabularyShouldPaginateModels: boolean
  vocabularyTotalModelPages: number
  vocabularyVisibleModels: string[]
}

const SENTENCE_MODELS_DATALIST_ID = 'settings-sentence-available-models'
const VOCABULARY_MODELS_DATALIST_ID = 'settings-vocabulary-available-models'

function AiConfigForm({
  apiConfig,
  availableModels,
  currentModelPage,
  datalistId,
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
  showConcurrency,
  title,
  totalModelPages,
  visibleModels,
}: ModelPickerProps) {
  return (
    <section className="ai-config-section">
      <div className="panel-header settings-subheader">
        <div>
          <h3>{title}</h3>
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
            list={datalistId}
            value={apiConfig.model}
            onChange={(event) => onConfigChange('model', event.target.value)}
            placeholder="gpt-4.1-mini"
          />
          <datalist id={datalistId}>
            {availableModels.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </label>

        {showConcurrency ? (
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
        ) : null}
      </div>

      {showConcurrency ? (
        <p className="panel-tip">
          可设置范围为 1-{MAX_CONCURRENCY}。这里控制的是句子批量解析时同时发出的请求数。
        </p>
      ) : null}

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
    </section>
  )
}

function AiSettingsTab({
  apiConfig,
  availableModels,
  currentModelPage,
  filteredModelCount,
  isVocabularyAiShared,
  modelFetchMessage,
  modelFetchStatus,
  modelSearchTerm,
  onConfigChange,
  onModelSearchTermChange,
  onNextModelPage,
  onPreviousModelPage,
  onRefetchModels,
  onVocabularyAiSharedChange,
  onVocabularyConfigChange,
  onVocabularyModelSearchTermChange,
  onVocabularyNextModelPage,
  onVocabularyPreviousModelPage,
  onVocabularyRefetchModels,
  shouldPaginateModels,
  totalModelPages,
  visibleModels,
  vocabularyApiConfig,
  vocabularyAvailableModels,
  vocabularyCurrentModelPage,
  vocabularyFilteredModelCount,
  vocabularyModelFetchMessage,
  vocabularyModelFetchStatus,
  vocabularyModelSearchTerm,
  vocabularyShouldPaginateModels,
  vocabularyTotalModelPages,
  vocabularyVisibleModels,
}: AiSettingsTabProps) {
  return (
    <div className="settings-panel ai-settings-panel">
      <AiConfigForm
        apiConfig={apiConfig}
        availableModels={availableModels}
        currentModelPage={currentModelPage}
        datalistId={SENTENCE_MODELS_DATALIST_ID}
        filteredModelCount={filteredModelCount}
        modelFetchMessage={modelFetchMessage}
        modelFetchStatus={modelFetchStatus}
        modelSearchTerm={modelSearchTerm}
        onConfigChange={onConfigChange}
        onModelSearchTermChange={onModelSearchTermChange}
        onNextModelPage={onNextModelPage}
        onPreviousModelPage={onPreviousModelPage}
        onRefetchModels={onRefetchModels}
        shouldPaginateModels={shouldPaginateModels}
        showConcurrency
        title="句子解释 AI"
        totalModelPages={totalModelPages}
        visibleModels={visibleModels}
      />

      <label className="ai-share-toggle">
        <input
          type="checkbox"
          checked={isVocabularyAiShared}
          onChange={(event) => onVocabularyAiSharedChange(event.target.checked)}
        />
        <span>词汇解释 AI 共用句子解释 AI</span>
      </label>

      {isVocabularyAiShared ? (
        <p className="panel-tip">
          当前点击词汇时会直接使用上方句子解释 AI；关闭共用后，可以给词汇解释单独配置更快的模型。
        </p>
      ) : (
        <AiConfigForm
          apiConfig={vocabularyApiConfig}
          availableModels={vocabularyAvailableModels}
          currentModelPage={vocabularyCurrentModelPage}
          datalistId={VOCABULARY_MODELS_DATALIST_ID}
          filteredModelCount={vocabularyFilteredModelCount}
          modelFetchMessage={vocabularyModelFetchMessage}
          modelFetchStatus={vocabularyModelFetchStatus}
          modelSearchTerm={vocabularyModelSearchTerm}
          onConfigChange={onVocabularyConfigChange}
          onModelSearchTermChange={onVocabularyModelSearchTermChange}
          onNextModelPage={onVocabularyNextModelPage}
          onPreviousModelPage={onVocabularyPreviousModelPage}
          onRefetchModels={onVocabularyRefetchModels}
          shouldPaginateModels={vocabularyShouldPaginateModels}
          showConcurrency={false}
          title="词汇解释 AI"
          totalModelPages={vocabularyTotalModelPages}
          visibleModels={vocabularyVisibleModels}
        />
      )}

      <p className="panel-tip">
        兼容 OpenAI Chat Completions 协议。输入 URL 和 API Key 后会自动请求 `models`
        端点，并把返回的模型列表提供给你选择。
      </p>
    </div>
  )
}

export default AiSettingsTab
