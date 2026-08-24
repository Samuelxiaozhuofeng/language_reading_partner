import {
  MAX_BATCH_SIZE,
  MAX_PROMPT_CONTEXT_SENTENCE_COUNT,
  type PromptConfigChangeHandler,
  type VocabularyPromptConfigChangeHandler,
} from '../../lib/appState'
import type { PromptConfig, VocabularyPromptConfig } from '../../types'
import { isNativeAndroid } from '../../lib/platform'

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
  const isAndroid = isNativeAndroid()

  if (isAndroid) {
    const currentStyle = vocabularyPromptConfig.style || 'dictionary'

    return (
      <div className="settings-panel prompt-panel">
        <section className="prompt-config-section">
          <div className="form-grid">
            <label className="field">
              <span>上下文句子数量</span>
              <input
                type="number"
                min={0}
                max={MAX_PROMPT_CONTEXT_SENTENCE_COUNT}
                value={promptConfig.previousSentenceCount}
                onChange={(event) => {
                  const count = Math.max(
                    0,
                    Math.min(
                      MAX_PROMPT_CONTEXT_SENTENCE_COUNT,
                      Number(event.target.value) || 0,
                    ),
                  )
                  onPromptChange('previousSentenceCount', count)
                  onPromptChange('nextSentenceCount', count)
                }}
              />
            </label>

            <label className="ai-share-toggle">
              <input
                type="checkbox"
                checked={promptConfig.includeContextInExcerpt}
                onChange={(event) =>
                  onPromptChange('includeContextInExcerpt', event.target.checked)
                }
              />
              <span>把上下文写入查词和 Anki</span>
            </label>
            <p className="panel-tip">
              关闭后，解释仍带上下文，查词面板和 Anki 卡片只保留当前句。
            </p>
          </div>

          <div className="field field-block">
            <span>词汇讲解风格</span>
            <div className="prompt-style-options" style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="vocabularyStyle"
                  value="dictionary"
                  checked={currentStyle === 'dictionary'}
                  onChange={() => onVocabularyPromptChange('style', 'dictionary')}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>词典式</div>
                  <div className="panel-tip" style={{ margin: '2px 0 0' }}>先给中文意思，再补词性和本句用法</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="vocabularyStyle"
                  value="tutor"
                  checked={currentStyle === 'tutor'}
                  onChange={() => onVocabularyPromptChange('style', 'tutor')}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>老师讲解</div>
                  <div className="panel-tip" style={{ margin: '2px 0 0' }}>口语化讲这个词在本句里怎么理解，并给短记忆提示</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="vocabularyStyle"
                  value="custom"
                  checked={currentStyle === 'custom'}
                  onChange={() => onVocabularyPromptChange('style', 'custom')}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>自定义</div>
                  <div className="panel-tip" style={{ margin: '2px 0 0' }}>自定义词汇解释的提示词要求与风格</div>
                </div>
              </label>
            </div>
          </div>

          {currentStyle === 'custom' ? (
            <label className="field field-block">
              <span>自定义解释风格</span>
              <textarea
                className="settings-textarea"
                value={vocabularyPromptConfig.customStyle || ''}
                onChange={(event) => onVocabularyPromptChange('customStyle', event.target.value)}
                placeholder="填写自定义风格说明..."
                style={{ minHeight: '120px' }}
              />
            </label>
          ) : null}
        </section>
      </div>
    )
  }

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

          <label className="ai-share-toggle">
            <input
              type="checkbox"
              checked={promptConfig.includeContextInExcerpt}
              onChange={(event) =>
                onPromptChange('includeContextInExcerpt', event.target.checked)
              }
            />
            <span>把上下文写入查词和 Anki</span>
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
