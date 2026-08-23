import type {
  AnkiConfigChangeHandler,
  AnkiFieldMappingChangeHandler,
  ModelFetchStatus,
} from '../../lib/appState'
import {
  ankiFieldSourceLabelMap,
  getAnkiFieldSourceOrder,
  getSraNoteTypeName,
  shouldUseAnkiDroid,
  type AnkiCompatibilityIssue,
} from '../../lib/anki'
import type { AnkiConfig, BookLanguage } from '../../types'

type AnkiSettingsTabProps = {
  activeAnkiLanguage: BookLanguage
  ankiCompatibilityIssue: AnkiCompatibilityIssue | null
  ankiConfig: AnkiConfig
  ankiFetchMessage: string
  ankiFetchStatus: ModelFetchStatus
  availableDecks: string[]
  availableNoteFields: string[]
  availableNoteTypes: string[]
  isAndroid?: boolean
  onAnkiConfigChange: AnkiConfigChangeHandler
  onAnkiFieldMappingChange: AnkiFieldMappingChangeHandler
  onAnkiLanguageChange: (language: BookLanguage) => void
  onCreateSraNoteType: () => void
  onRequestPermission?: () => void
  onRunAnkiFetch: () => void
}

function AnkiSettingsTab({
  activeAnkiLanguage,
  ankiCompatibilityIssue,
  ankiConfig,
  ankiFetchMessage,
  ankiFetchStatus,
  availableDecks,
  availableNoteFields,
  availableNoteTypes,
  isAndroid: isAndroidProp,
  onAnkiConfigChange,
  onAnkiFieldMappingChange,
  onAnkiLanguageChange,
  onCreateSraNoteType,
  onRequestPermission,
  onRunAnkiFetch,
}: AnkiSettingsTabProps) {
  const isAndroid = isAndroidProp ?? shouldUseAnkiDroid()
  const deckOptions = ankiConfig.deck.trim() && !availableDecks.includes(ankiConfig.deck)
    ? [ankiConfig.deck, ...availableDecks]
    : availableDecks
  const noteTypeOptions =
    ankiConfig.noteType.trim() && !availableNoteTypes.includes(ankiConfig.noteType)
      ? [ankiConfig.noteType, ...availableNoteTypes]
      : availableNoteTypes
  const sraNoteTypeName = getSraNoteTypeName(activeAnkiLanguage)
  const fieldSourceOrder = getAnkiFieldSourceOrder(activeAnkiLanguage)
  const isJapaneseAnki = activeAnkiLanguage === 'ja'

  return (
    <div className="settings-panel prompt-panel">
      <div className="panel-header settings-subheader">
        <div>
          <h3>{isAndroid ? 'AnkiDroid' : 'AnkiConnect'}</h3>
        </div>
        <div className="panel-actions">
          {isAndroid && onRequestPermission ? (
            <button
              className="ghost-button"
              type="button"
              disabled={ankiFetchStatus === 'loading'}
              onClick={onRequestPermission}
            >
              {ankiFetchStatus === 'loading' ? '处理中...' : '授权 AnkiDroid'}
            </button>
          ) : null}
          <button
            className="ghost-button"
            type="button"
            disabled={
              ankiFetchStatus === 'loading' ||
              (!isAndroid && (!ankiConfig.endpoint.trim() || Boolean(ankiCompatibilityIssue)))
            }
            onClick={onRunAnkiFetch}
          >
            {ankiFetchStatus === 'loading'
              ? '连接中...'
              : ankiCompatibilityIssue
                ? 'Safari 当前不可直连'
                : isAndroid
                  ? '测试连接'
                  : '测试连接并刷新'}
          </button>
          <button
            className="ghost-button"
            type="button"
            disabled={
              ankiFetchStatus === 'loading' ||
              (!isAndroid && (!ankiConfig.endpoint.trim() || Boolean(ankiCompatibilityIssue)))
            }
            onClick={onCreateSraNoteType}
          >
            {ankiFetchStatus === 'loading'
              ? '处理中...'
              : isAndroid
                ? `创建 / 就绪 ${sraNoteTypeName}`
                : `创建 / 修复 ${sraNoteTypeName}`}
          </button>
        </div>
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Anki 配置语言">
        <button
          className={`settings-tab ${activeAnkiLanguage === 'es' ? 'is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeAnkiLanguage === 'es'}
          onClick={() => onAnkiLanguageChange('es')}
        >
          通用/西语
        </button>
        <button
          className={`settings-tab ${activeAnkiLanguage === 'ja' ? 'is-active' : ''}`}
          type="button"
          role="tab"
          aria-selected={activeAnkiLanguage === 'ja'}
          onClick={() => onAnkiLanguageChange('ja')}
        >
          日语
        </button>
      </div>

      {!isAndroid && ankiCompatibilityIssue ? (
        <div className="compatibility-callout" role="status" aria-live="polite">
          <p className="compatibility-callout-title">Safari 兼容说明</p>
          <p>{ankiCompatibilityIssue.summary}</p>
          {ankiCompatibilityIssue.details.map((detail) => (
            <p key={detail}>{detail}</p>
          ))}
        </div>
      ) : null}

      <div className="form-grid">
        {!isAndroid ? (
          <label className="field">
            <span>AnkiConnect URL</span>
            <input
              type="url"
              value={ankiConfig.endpoint}
              onChange={(event) => onAnkiConfigChange('endpoint', event.target.value)}
              placeholder="http://127.0.0.1:8765"
            />
          </label>
        ) : null}

        <label className="field">
          <span>Deck</span>
          <select value={ankiConfig.deck} onChange={(event) => onAnkiConfigChange('deck', event.target.value)}>
            <option value="">请选择 deck</option>
            {deckOptions.map((deck) => (
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
            {noteTypeOptions.map((noteType) => (
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
        {fieldSourceOrder.map((source) => (
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
        {isJapaneseAnki
          ? '当前会把 8 个内容源写进你映射的字段：句子、句子振假名、语法、内容、知识点、知识点振假名、知识点类型、知识点解释。'
          : '当前会把 6 个内容源写进你映射的字段：句子、语法、内容、知识点、知识点类型、知识点解释。'}
        添加到 Anki 时允许重复卡片，失败会直接提示，不会静默跳过。
      </p>

      {isAndroid ? (
        <p className="panel-tip">
          安卓版直连本地 AnkiDroid 官方 API，点击“创建 / 就绪 {sraNoteTypeName}”会自动在 AnkiDroid 中建立专属模板并自动完成字段映射。
        </p>
      ) : (
        <>
          <p className="panel-tip">
            “创建 / 修复 {sraNoteTypeName}”会先请求当前页面访问 AnkiConnect 的权限，再自动创建或更新当前语言模板，并把
            {isJapaneseAnki ? '8 个字段映射到同名字段。日语模板会在背面显示自动生成的振假名字段。' : '6 个字段映射到同名字段。'}
          </p>

          <p className="panel-tip">
            如果你在 Safari 中使用线上 HTTPS 页面，浏览器会拦截它直接访问本机 HTTP 版
            AnkiConnect。这个限制来自浏览器安全策略，不是 Anki 配置错误。
          </p>
        </>
      )}
    </div>
  )
}

export default AnkiSettingsTab
