import { isNativeAndroid } from '../../lib/platform'
import type { ReadingPreferencesChangeHandler } from '../../lib/appState'
import type { ReadingPreferences } from '../../types'

type ReadingSettingsTabProps = {
  onReadingPreferencesChange: ReadingPreferencesChangeHandler
  readingPreferences: ReadingPreferences
}

function ReadingSettingsTab({
  onReadingPreferencesChange,
  readingPreferences,
}: ReadingSettingsTabProps) {
  const isAndroid = isNativeAndroid()
  const isScrollMode = readingPreferences.readingMode === 'scroll'
  return (
    <div className="settings-panel">
      <section className="prompt-config-section">
        <p className="panel-tip">翻页还是滚动、字号和版面都在这里改。阅读页只留正文。</p>

        <div className="form-grid">
          <div className="field field-block">
            <span>阅读模式</span>
            <div className="reading-mode-toggle" role="group" aria-label="阅读模式">
              <button
                className={`ghost-button${isScrollMode ? '' : ' is-selected'}`}
                type="button"
                onClick={() => onReadingPreferencesChange('readingMode', 'paged')}
              >
                翻页
              </button>
              <button
                className={`ghost-button${isScrollMode ? ' is-selected' : ''}`}
                type="button"
                onClick={() => onReadingPreferencesChange('readingMode', 'scroll')}
              >
                滚动
              </button>
            </div>
          </div>

          {isAndroid ? null : (
            <label className="field field-block">
              <span>阅读容器宽度 {readingPreferences.contentWidth}px</span>
              <input
                max="1180"
                min="720"
                step="20"
                type="range"
                value={readingPreferences.contentWidth}
                onChange={(event) =>
                  onReadingPreferencesChange('contentWidth', Number(event.currentTarget.value))
                }
              />
            </label>
          )}

          <label className="field field-block">
            <span>文字大小 {readingPreferences.fontSize}px</span>
            <input
              max="24"
              min="16"
              step="1"
              type="range"
              value={readingPreferences.fontSize}
              onChange={(event) =>
                onReadingPreferencesChange('fontSize', Number(event.currentTarget.value))
              }
            />
          </label>

          <label className="ai-share-toggle">
            <input
              checked={readingPreferences.showFurigana ?? true}
              type="checkbox"
              onChange={(event) =>
                onReadingPreferencesChange('showFurigana', event.currentTarget.checked)
              }
            />
            <span>日语显示振り仮名</span>
          </label>

        </div>
      </section>
    </div>
  )
}

export default ReadingSettingsTab
