import { useEffect } from 'react'

type WordLookupPopoverProps = {
  ankiMessage?: string
  ankiStatus?: 'idle' | 'loading' | 'success' | 'error'
  context?: string
  error?: string | null
  explanation?: string | null
  loading?: boolean
  onAddToAnki?: () => Promise<void>
  onClose: () => void
  word: string
}

export function WordLookupPopover({
  ankiMessage,
  ankiStatus = 'idle',
  context,
  error,
  explanation,
  loading = false,
  onAddToAnki,
  onClose,
  word,
}: WordLookupPopoverProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!word) {
    return null
  }
  const canAddToAnki = Boolean(
    explanation && !loading && !error && onAddToAnki && ankiStatus !== 'loading',
  )

  return (
    <div
      aria-modal="true"
      className="reading-overlay is-sheet word-lookup-overlay"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="reading-sheet-frame word-lookup-frame"
        onClick={(event) => event.stopPropagation()}
      >
        <section className="reading-inspector is-sheet word-lookup-card">
          <div className="sheet-pull-handle" />
          <div className="reading-inspector-header word-lookup-header">
            <div>
              <p className="section-kicker">Word Lookup</p>
              <h3 className="word-lookup-title">{word}</h3>
            </div>
            <div className="reading-inspector-actions">
              <button
                className="ghost-button reading-inspector-close"
                type="button"
                onClick={onClose}
              >
                关闭
              </button>
            </div>
          </div>

          {context ? (
            <div className="word-lookup-context">
              <p className="word-lookup-context-text">{context}</p>
            </div>
          ) : null}

          <div className="word-lookup-body">
            {loading ? (
              <p className="notice">正在请求词汇解释...</p>
            ) : error ? (
              <p className="notice error">{error}</p>
            ) : explanation ? (
              <>
                <div className="word-lookup-explanation">
                  <p>{explanation}</p>
                </div>
                {onAddToAnki ? (
                  <div className="panel-actions knowledge-detail-actions">
                    <button
                      className="secondary-button"
                      disabled={!canAddToAnki}
                      type="button"
                      onClick={() => void onAddToAnki()}
                    >
                      {ankiStatus === 'loading' ? '添加到 Anki 中...' : '添加到 Anki'}
                    </button>
                  </div>
                ) : null}
                {ankiStatus !== 'idle' && ankiMessage ? (
                  <p
                    className={`notice ${
                      ankiStatus === 'success'
                        ? 'success'
                        : ankiStatus === 'error'
                          ? 'error'
                          : ''
                    }`}
                  >
                    {ankiMessage}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="notice">暂无解释</p>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
