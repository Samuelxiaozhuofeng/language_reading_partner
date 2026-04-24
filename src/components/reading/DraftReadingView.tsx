import { ReadingDisplaySettings } from './ReadingDisplaySettings'
import { SentenceDetailPanel } from './SentenceDetailPanel'
import type { HighlightSelection } from './readingShared'
import type {
  AnalysisHighlight,
  AnalysisResult,
  ReadingPreferences,
  SentenceItem,
  VocabularyExplanation,
} from '../../types'
import { statusLabelMap } from '../../lib/appState'

type DraftReadingViewProps = {
  activeSelection: HighlightSelection | null
  areAllSentencesExpanded: boolean
  expandedSentenceIds: Set<string>
  isReadingSettingsOpen: boolean
  onAddToAnki: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => Promise<void>
  onBackToWorkspace: () => void
  onCloseReadingSettings: () => void
  onExplainVocabulary: (context: string, word: string) => Promise<VocabularyExplanation>
  onOpenResources: () => void
  onReadingPreferencesChange: <Key extends keyof ReadingPreferences>(
    key: Key,
    value: ReadingPreferences[Key],
  ) => void
  onRemoveHighlight: (signature: string) => void
  onRetrySentence?: (sentenceId: string) => void
  onSaveHighlight: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => void
  onSelectHighlight: (sentenceId: string, highlightId: string) => void
  onToggleAllSentences: () => void
  onToggleReadingSettings: () => void
  onToggleSentence: (sentenceId: string) => void
  readingPreferences: ReadingPreferences
  readingTitle: string
  results: Record<string, AnalysisResult>
  savedHighlightSignatures: Set<string>
  sentences: SentenceItem[]
}

export function DraftReadingView({
  activeSelection,
  areAllSentencesExpanded,
  expandedSentenceIds,
  isReadingSettingsOpen,
  onAddToAnki,
  onBackToWorkspace,
  onCloseReadingSettings,
  onExplainVocabulary,
  onOpenResources,
  onReadingPreferencesChange,
  onRemoveHighlight,
  onRetrySentence,
  onSaveHighlight,
  onSelectHighlight,
  onToggleAllSentences,
  onToggleReadingSettings,
  onToggleSentence,
  readingPreferences,
  readingTitle,
  results,
  savedHighlightSignatures,
  sentences,
}: DraftReadingViewProps) {
  return (
    <div className="reading-result-list">
      {sentences.length === 0 ? (
        <div className="empty-state reading-empty">
          <p>先准备一个章节或手动草稿并启动解析，这里会自动显示阅读结果。</p>
        </div>
      ) : (
        <>
          <div className="reading-book-toolbar is-draft-toolbar">
            <div className="reading-book-toolbar-left">
              <span className="reading-page-indicator">{readingTitle}</span>
            </div>
            <div className="reading-book-toolbar-actions">
              <ReadingDisplaySettings
                isOpen={isReadingSettingsOpen}
                onClose={onCloseReadingSettings}
                onReadingPreferencesChange={onReadingPreferencesChange}
                onToggle={onToggleReadingSettings}
                readingPreferences={readingPreferences}
              />
              <button className="ghost-button" type="button" onClick={onOpenResources}>
                学习资源
              </button>
              <button className="ghost-button" type="button" onClick={onBackToWorkspace}>
                退出
              </button>
              <button
                className="ghost-button reading-toggle-all-button"
                type="button"
                onClick={onToggleAllSentences}
              >
                {areAllSentencesExpanded ? '全部收起' : '全部展开'}
              </button>
            </div>
          </div>
          {sentences.map((sentence, index) => {
            const isExpanded = expandedSentenceIds.has(sentence.id)

            return (
              <article className="result-card reading-result-card" key={sentence.id}>
                <div className="result-card-header">
                  <span className="sentence-index">#{index + 1}</span>
                  <span className={`status-badge status-${sentence.status}`}>
                    {statusLabelMap[sentence.status]}
                  </span>
                </div>

                <button
                  aria-expanded={isExpanded}
                  className={`reading-sentence-toggle ${isExpanded ? 'is-expanded' : ''}`}
                  type="button"
                  onClick={() => onToggleSentence(sentence.id)}
                >
                  <span className="reading-sentence-quote">
                    {sentence.editedText || sentence.text}
                  </span>
                  <span className="reading-sentence-toggle-hint">
                    {isExpanded ? '收起解释' : '点击展开解释'}
                  </span>
                </button>

                {isExpanded ? (
                  <SentenceDetailPanel
                    activeSelection={activeSelection}
                    onAddToAnki={onAddToAnki}
                    onExplainVocabulary={onExplainVocabulary}
                    onOpenResources={onOpenResources}
                    onRemoveHighlight={onRemoveHighlight}
                    onRetrySentence={onRetrySentence}
                    onSaveHighlight={onSaveHighlight}
                    onSelectHighlight={onSelectHighlight}
                    result={results[sentence.id]}
                    savedHighlightSignatures={savedHighlightSignatures}
                    sentence={sentence}
                  />
                ) : null}
              </article>
            )
          })}
        </>
      )}
    </div>
  )
}
