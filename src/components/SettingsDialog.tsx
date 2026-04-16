import { useEffect } from 'react'
import type {
  AnkiConfigChangeHandler,
  AnkiFieldMappingChangeHandler,
  ConfigChangeHandler,
  PromptConfigChangeHandler,
  SettingsTab,
} from '../lib/appState'
import type { AnkiConfig, ApiConfig, PromptConfig } from '../types'
import AiSettingsTab from './settings/AiSettingsTab'
import AnkiSettingsTab from './settings/AnkiSettingsTab'
import PromptSettingsTab from './settings/PromptSettingsTab'
import { settingsTabLabelMap } from './settings/settingsShared'
import { useAnkiConnection } from './settings/useAnkiConnection'
import { useModelFetch } from './settings/useModelFetch'

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
  onPromptChange: PromptConfigChangeHandler
  onResetPrompt: () => void
  onSettingsTabChange: (tab: SettingsTab) => void
  promptConfig: PromptConfig
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
  const modelFetch = useModelFetch({
    apiConfig,
    isActive: activeSettingsTab === 'ai',
    isOpen,
    onConfigChange,
  })

  const ankiConnection = useAnkiConnection({
    ankiConfig,
    isActive: activeSettingsTab === 'anki',
    isOpen,
    onAnkiConfigChange,
    onAnkiFieldMappingChange,
  })

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
          <AiSettingsTab
            apiConfig={apiConfig}
            availableModels={modelFetch.availableModels}
            currentModelPage={modelFetch.currentModelPage}
            filteredModelCount={modelFetch.filteredModels.length}
            modelFetchMessage={modelFetch.modelFetchMessage}
            modelFetchStatus={modelFetch.modelFetchStatus}
            modelSearchTerm={modelFetch.modelSearchTerm}
            onConfigChange={onConfigChange}
            onModelSearchTermChange={modelFetch.setModelSearchTerm}
            onNextModelPage={modelFetch.goToNextModelPage}
            onPreviousModelPage={modelFetch.goToPreviousModelPage}
            onRefetchModels={() => void modelFetch.runModelFetch()}
            shouldPaginateModels={modelFetch.shouldPaginateModels}
            totalModelPages={modelFetch.totalModelPages}
            visibleModels={modelFetch.visibleModels}
          />
        ) : activeSettingsTab === 'prompt' ? (
          <PromptSettingsTab
            onPromptChange={onPromptChange}
            onResetPrompt={onResetPrompt}
            promptConfig={promptConfig}
          />
        ) : (
          <AnkiSettingsTab
            ankiCompatibilityIssue={ankiConnection.ankiCompatibilityIssue}
            ankiConfig={ankiConfig}
            ankiFetchMessage={ankiConnection.ankiFetchMessage}
            ankiFetchStatus={ankiConnection.ankiFetchStatus}
            availableDecks={ankiConnection.availableDecks}
            availableNoteFields={ankiConnection.availableNoteFields}
            availableNoteTypes={ankiConnection.availableNoteTypes}
            onAnkiConfigChange={onAnkiConfigChange}
            onAnkiFieldMappingChange={onAnkiFieldMappingChange}
            onCreateSraNoteType={() => void ankiConnection.handleCreateSraNoteType()}
            onRunAnkiFetch={() => void ankiConnection.runAnkiFetch()}
          />
        )}
      </section>
    </div>
  )
}

export default SettingsDialog
