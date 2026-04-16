import { useEffect, useRef } from 'react'
import type { ReadingPreferences } from '../../types'

type ReadingDisplaySettingsProps = {
  isOpen: boolean
  onClose: () => void
  onReadingPreferencesChange: <Key extends keyof ReadingPreferences>(
    key: Key,
    value: ReadingPreferences[Key],
  ) => void
  onToggle: () => void
  readingPreferences: ReadingPreferences
}

function ReadingSettingsIcon() {
  return (
    <svg aria-hidden="true" className="reading-display-icon" viewBox="0 0 24 24">
      <path
        d="M4 7h10M18 7h2M4 17h3M11 17h9M14 7a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm-4 12a2 2 0 1 0 0-4a2 2 0 0 0 0 4Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function ReadingDisplaySettings({
  isOpen,
  onClose,
  onReadingPreferencesChange,
  onToggle,
  readingPreferences,
}: ReadingDisplaySettingsProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        panelRef.current &&
        event.target instanceof Node &&
        !panelRef.current.contains(event.target)
      ) {
        onClose()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, onClose])

  return (
    <div className={`reading-display-settings ${isOpen ? 'is-open' : ''}`} ref={panelRef}>
      <button
        aria-expanded={isOpen}
        aria-label="阅读设置"
        className="ghost-button reading-display-trigger"
        type="button"
        onClick={onToggle}
      >
        <ReadingSettingsIcon />
        <span>阅读设置</span>
      </button>

      {isOpen ? (
        <section className="reading-display-popover" aria-label="阅读偏好">
          <div className="reading-display-popover-header">
            <div>
              <p className="section-kicker">Reader</p>
              <h3>版面与字号</h3>
            </div>
            <button className="ghost-button reading-display-close" type="button" onClick={onClose}>
              收起
            </button>
          </div>

          <label className="reading-display-field">
            <span>阅读容器宽度</span>
            <strong>{readingPreferences.contentWidth}px</strong>
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

          <label className="reading-display-field">
            <span>文字大小</span>
            <strong>{readingPreferences.fontSize}px</strong>
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
        </section>
      ) : null}
    </div>
  )
}
