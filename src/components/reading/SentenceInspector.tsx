import { SentenceDetailPanel } from './SentenceDetailPanel'
import {
  getSentenceDisplayText,
  type HighlightSelection,
  type InspectorMode,
} from './readingShared'
import type { AnalysisHighlight, AnalysisResult, SentenceItem } from '../../types'

type SentenceInspectorProps = {
  activeSelection: HighlightSelection | null
  activeSentence: SentenceItem | null
  activeSentenceIndex: number | null
  mode: InspectorMode
  onAddToAnki: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => Promise<void>
  onCloseSentence: () => void
  onOpenResources: () => void
  onRemoveHighlight: (signature: string) => void
  onSaveHighlight: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => void
  onSelectHighlight: (sentenceId: string, highlightId: string) => void
  onSetCurrentResumeAnchor: () => void
  resolveStatusLabel: (status: SentenceItem['status']) => string
  results: Record<string, AnalysisResult>
  resumeAnchorSentenceId: string | null
  savedHighlightSignatures: Set<string>
}

export function SentenceInspector({
  activeSelection,
  activeSentence,
  activeSentenceIndex,
  mode,
  onAddToAnki,
  onCloseSentence,
  onOpenResources,
  onRemoveHighlight,
  onSaveHighlight,
  onSelectHighlight,
  onSetCurrentResumeAnchor,
  resolveStatusLabel,
  results,
  resumeAnchorSentenceId,
  savedHighlightSignatures,
}: SentenceInspectorProps) {
  if (!activeSentence) {
    return (
      <aside aria-label="句子解释" className="reading-inspector is-docked">
        <div className="reading-inspector-empty">
          <p className="section-kicker">Sentence Note</p>
          <h3>句子解释</h3>
          <p>点击阅读页中的任意一句，解释会固定显示在这里，并和正文保持同一套节奏。</p>
        </div>
      </aside>
    )
  }

  const isPinned = activeSentence.id === resumeAnchorSentenceId
  const inspectorClassName =
    mode === 'docked' ? 'reading-inspector is-docked' : 'reading-inspector is-sheet'

  return (
    <section
      aria-label="句子解释"
      aria-modal={mode === 'sheet' ? 'true' : undefined}
      className={inspectorClassName}
      role={mode === 'sheet' ? 'dialog' : 'region'}
    >
      <div className="reading-inspector-header">
        <div>
          <p className="section-kicker">Sentence Note</p>
          <h3>句子解释</h3>
        </div>
        <div className="reading-inspector-actions">
          <button
            className={`ghost-button reading-resume-button ${isPinned ? 'is-pinned' : ''}`}
            type="button"
            onClick={onSetCurrentResumeAnchor}
          >
            {isPinned ? '已记住位置' : '记住位置'}
          </button>
          <button
            className="ghost-button reading-inspector-close"
            type="button"
            onClick={onCloseSentence}
          >
            {mode === 'docked' ? '清空' : '关闭'}
          </button>
        </div>
      </div>

      <div className="reading-inspector-meta">
        {activeSentenceIndex !== null ? <span>句子 #{activeSentenceIndex}</span> : null}
        <span className={`status-badge status-${activeSentence.status}`}>
          {resolveStatusLabel(activeSentence.status)}
        </span>
      </div>

      <p className="reading-inspector-sentence">{getSentenceDisplayText(activeSentence)}</p>

      <SentenceDetailPanel
        activeSelection={activeSelection}
        onAddToAnki={onAddToAnki}
        onOpenResources={onOpenResources}
        onRemoveHighlight={onRemoveHighlight}
        onSaveHighlight={onSaveHighlight}
        onSelectHighlight={onSelectHighlight}
        result={results[activeSentence.id]}
        savedHighlightSignatures={savedHighlightSignatures}
        sentence={activeSentence}
      />
    </section>
  )
}
