import type { RefObject } from 'react'
import type { VocabularyExplanationState } from './useVocabularyExplanation'

type VocabularyExplanationPanelProps = {
  detailRef: RefObject<HTMLDivElement | null>
  onAddToAnki: () => Promise<void>
  onClose: () => void
  state: VocabularyExplanationState | null
}

export function VocabularyExplanationPanel({
  detailRef,
  onAddToAnki,
  onClose,
  state,
}: VocabularyExplanationPanelProps) {
  if (!state) {
    return null
  }

  const canAddToAnki = state.status === 'success' && state.ankiStatus !== 'loading'

  return (
    <section
      className="vocabulary-detail-card"
      ref={detailRef}
      tabIndex={-1}
    >
      <div className="knowledge-detail-header">
        <div>
          <p className="section-kicker">Vocabulary Note</p>
          <h4>{state.word}</h4>
        </div>
        <button className="ghost-button" type="button" onClick={onClose}>
          关闭
        </button>
      </div>

      {state.status === 'loading' ? (
        <p className="notice">正在请求词汇解释...</p>
      ) : state.status === 'error' ? (
        <p className="notice error">{state.errorMessage}</p>
      ) : (
        <p>{state.explanation}</p>
      )}

      <div className="panel-actions knowledge-detail-actions">
        <button
          className="secondary-button"
          disabled={!canAddToAnki}
          type="button"
          onClick={() => void onAddToAnki()}
        >
          {state.ankiStatus === 'loading' ? '添加到 Anki 中...' : '添加到 Anki'}
        </button>
      </div>

      {state.ankiStatus !== 'idle' ? (
        <p className={`notice ${state.ankiStatus === 'success' ? 'success' : state.ankiStatus === 'error' ? 'error' : ''}`}>
          {state.ankiMessage}
        </p>
      ) : null}
    </section>
  )
}
