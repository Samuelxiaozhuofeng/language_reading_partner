import {
  MAX_PROMPT_CONTEXT_SENTENCE_COUNT,
  type PromptConfigChangeHandler,
} from '../../lib/appState'
import type { PromptConfig } from '../../types'

type PromptSettingsTabProps = {
  onPromptChange: PromptConfigChangeHandler
  onResetPrompt: () => void
  promptConfig: PromptConfig
}

function PromptSettingsTab({
  onPromptChange,
  onResetPrompt,
  promptConfig,
}: PromptSettingsTabProps) {
  return (
    <div className="settings-panel prompt-panel">
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
          恢复默认 Prompt
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
      </div>

      <label className="field field-block">
        <span>统一 Prompt 模板</span>
        <textarea
          className="settings-textarea settings-textarea-large"
          value={promptConfig.template}
          onChange={(event) => onPromptChange('template', event.target.value)}
          placeholder="直接填写会完整发送给模型的唯一 Prompt 模板..."
        />
      </label>

      <p className="panel-tip">
        这里只有一个 Prompt 输入框。你在这里写的全部内容会原样作为单条用户消息发送给模型，请保留
        `{'{sentence}'}`、`{'{previousSentence}'}`、`{'{nextSentence}'}` 这些占位符；如果你想显式利用文档范围信息，也可以加入
        `{'{documentMetadata}'}`、`{'{documentType}'}`、`{'{documentTitle}'}`、`{'{documentAuthor}'}`、`{'{chapterTitle}'}`。
      </p>

      <p className="panel-tip">
        上文 / 下文句数会决定传给模型的上下文窗口大小。旧模板如果没有写文档元信息占位符，系统也会自动补上一段文档元信息，避免这个功能失效。
      </p>
    </div>
  )
}

export default PromptSettingsTab
