import { SentenceDetailPanel } from './SentenceDetailPanel'
import {
  type HighlightSelection,
  type InspectorMode,
} from './readingShared'
import type {
  AnalysisHighlight,
  AnalysisResult,
  SentenceItem,
  VocabularyExplanation,
} from '../../types'
import { ClickableSentenceWords } from './ClickableSentenceWords'
import { useVocabularyExplanation } from './useVocabularyExplanation'

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
  onExplainVocabulary: (context: string, word: string) => Promise<VocabularyExplanation>
  onOpenResources: () => void
  onRemoveHighlight: (signature: string) => void
  onRetrySentence?: (sentenceId: string) => void
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
  activeSentence,
  ...props
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

  return <ActiveSentenceInspector activeSentence={activeSentence} {...props} />
}

type ActiveSentenceInspectorProps = Omit<SentenceInspectorProps, 'activeSentence'> & {
  activeSentence: SentenceItem
}

function ActiveSentenceInspector({
  activeSelection,
  activeSentence,
  activeSentenceIndex,
  mode,
  onAddToAnki,
  onCloseSentence,
  onExplainVocabulary,
  onOpenResources,
  onRemoveHighlight,
  onRetrySentence,
  onSaveHighlight,
  onSelectHighlight,
  onSetCurrentResumeAnchor,
  resolveStatusLabel,
  results,
  resumeAnchorSentenceId,
  savedHighlightSignatures,
}: ActiveSentenceInspectorProps) {
  const result = results[activeSentence.id]
  const vocabularyInteraction = useVocabularyExplanation({
    onAddToAnki,
    onExplainVocabulary,
    result,
    sentence: activeSentence,
  })
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

      <p className="reading-inspector-sentence">
        <ClickableSentenceWords
          activeWord={vocabularyInteraction.state?.word}
          disabled={!result || vocabularyInteraction.state?.status === 'loading'}
          text={vocabularyInteraction.sentenceText}
          onWordClick={(word) => void vocabularyInteraction.handleWordClick(word)}
        />
      </p>

      <SentenceDetailPanel
        activeSelection={activeSelection}
        onAddToAnki={onAddToAnki}
        onExplainVocabulary={onExplainVocabulary}
        onOpenResources={onOpenResources}
        onRemoveHighlight={onRemoveHighlight}
        onRetrySentence={onRetrySentence}
        onSaveHighlight={onSaveHighlight}
        onSelectHighlight={onSelectHighlight}
        renderVocabularySource={false}
        result={result}
        savedHighlightSignatures={savedHighlightSignatures}
        sentence={activeSentence}
        vocabularyInteraction={vocabularyInteraction}
      />
    </section>
  )
}
