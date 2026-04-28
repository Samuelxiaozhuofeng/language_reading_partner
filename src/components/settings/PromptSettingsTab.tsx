import {
  MAX_BATCH_SIZE,
  MAX_PROMPT_CONTEXT_SENTENCE_COUNT,
  type PromptConfigChangeHandler,
  type VocabularyPromptConfigChangeHandler,
} from '../../lib/appState'
import type { PromptConfig, VocabularyPromptConfig } from '../../types'

type PromptSettingsTabProps = {
  onPromptChange: PromptConfigChangeHandler
  onResetPrompt: () => void
  onResetVocabularyPrompt: () => void
  onVocabularyPromptChange: VocabularyPromptConfigChangeHandler
  promptConfig: PromptConfig
  vocabularyPromptConfig: VocabularyPromptConfig
}

function PromptSettingsTab({
  onPromptChange,
  onResetPrompt,
  onResetVocabularyPrompt,
  onVocabularyPromptChange,
  promptConfig,
  vocabularyPromptConfig,
}: PromptSettingsTabProps) {
  return (
    <div className="settings-panel prompt-panel">
      <section className="prompt-config-section">
        <div className="prompt-toolbar">
          <div className="prompt-hints">
            <span className="hint-chip">{'{documentMetadata}'}</span>
            <span className="hint-chip">{'{documentType}'}</span>
            <span className="hint-chip">{'{documentTitle}'}</span>
            <span className="hint-chip">{'{documentAuthor}'}</span>
            <span className="hint-chip">{'{chapterTitle}'}</span>
            <span className="hint-chip">{'{sentence}'}</span>
            <span className="hint-chip">{'{previousSentence}'}</span>
            <span className="hint-chip">{'{nextSentence}'}</span>
          </div>
          <button className="secondary-button" type="button" onClick={onResetPrompt}>
            恢复句子 Prompt
          </button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>上文句数</span>
            <input
              type="number"
              min={0}
              max={MAX_PROMPT_CONTEXT_SENTENCE_COUNT}
              value={promptConfig.previousSentenceCount}
              onChange={(event) => onPromptChange('previousSentenceCount', Number(event.target.value))}
            />
          </label>

          <label className="field">
            <span>下文句数</span>
            <input
              type="number"
              min={0}
              max={MAX_PROMPT_CONTEXT_SENTENCE_COUNT}
              value={promptConfig.nextSentenceCount}
              onChange={(event) => onPromptChange('nextSentenceCount', Number(event.target.value))}
            />
          </label>

          <label className="field">
            <span>每次解析句数</span>
            <input
              type="number"
              min={1}
              max={MAX_BATCH_SIZE}
              value={promptConfig.batchSize}
              onChange={(event) => onPromptChange('batchSize', Number(event.target.value))}
            />
          </label>
        </div>

        <label className="field field-block">
          <span>句子解释 Prompt 模板</span>
          <textarea
            className="settings-textarea settings-textarea-large"
            value={promptConfig.template}
            onChange={(event) => onPromptChange('template', event.target.value)}
            placeholder="直接填写会完整发送给模型的唯一 Prompt 模板..."
          />
        </label>

        <p className="panel-tip">
          句子解释 Prompt 会作为单条用户消息发送给模型，请保留
          `{'{sentence}'}`、`{'{previousSentence}'}`、`{'{nextSentence}'}` 这些占位符；如果你想显式利用文档范围信息，也可以加入
          `{'{documentMetadata}'}`、`{'{documentType}'}`、`{'{documentTitle}'}`、`{'{documentAuthor}'}`、`{'{chapterTitle}'}`。
          每次解析句数大于 1 时会使用内置批量 Prompt，以保证模型按顺序返回 JSON 数组。
        </p>
      </section>

      <section className="prompt-config-section">
        <div className="prompt-toolbar">
          <div className="prompt-hints">
            <span className="hint-chip">{'{context}'}</span>
            <span className="hint-chip">{'{word}'}</span>
          </div>
          <button className="secondary-button" type="button" onClick={onResetVocabularyPrompt}>
            恢复词汇 Prompt
          </button>
        </div>

        <label className="field field-block">
          <span>词汇解释 Prompt 模板</span>
          <textarea
            className="settings-textarea"
            value={vocabularyPromptConfig.template}
            onChange={(event) => onVocabularyPromptChange('template', event.target.value)}
            placeholder="填写词汇解释 Prompt 模板..."
          />
        </label>

        <p className="panel-tip">
          词汇解释 Prompt 会收到 `{'{context}'}` 和 `{'{word}'}`。建议要求模型只返回 JSON，并包含
          `explanation` 字段，方便弹窗和 Anki 复用。
        </p>
      </section>
    </div>
  )
}

export default PromptSettingsTab
