import { useState } from 'react'
import { ClickableSentenceWords } from './ClickableSentenceWords'
import { JapaneseChunkView } from './JapaneseChunkView'
import { ReadingDisplaySettings } from './ReadingDisplaySettings'
import { SentenceDetailPanel } from './SentenceDetailPanel'
import { WordLookupPopover } from './WordLookupPopover'
import { getSentenceDisplayText, type HighlightSelection } from './readingShared'
import { isNativeAndroid } from '../../lib/platform'
import type { JapaneseChunkSelection } from '../../lib/japaneseUtils'
import type {
  AddToAnkiResult,
  AnalysisHighlight,
  AnalysisResult,
  BookLanguage,
  ReadingPreferences,
  SentenceItem,
  VocabularyExplanation,
} from '../../types'
import { statusLabelMap } from '../../lib/appState'
type DraftReadingViewProps = {
  activeSelection: HighlightSelection | null
  activeChunkSelection: JapaneseChunkSelection | null
  areAllSentencesExpanded: boolean
  bookLanguage: BookLanguage
  expandedSentenceIds: Set<string>
  contextSentenceCount?: number
  isReadingSettingsOpen: boolean
  onAddToAnki: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => Promise<AddToAnkiResult>
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
  onSelectChunk: (sentenceId: string, chunkIndex: number) => void
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
  activeChunkSelection,
  areAllSentencesExpanded,
  bookLanguage,
  contextSentenceCount = 1,
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
  onSelectChunk,
  onToggleAllSentences,
  onToggleReadingSettings,
  onToggleSentence,
  readingPreferences,
  readingTitle,
  results,
  savedHighlightSignatures,
  sentences,
}: DraftReadingViewProps) {
  const [wordLookup, setWordLookup] = useState<{
    word: string
    context: string
    sentence: SentenceItem
    explanation: string | null
    loading: boolean
    error: string | null
    ankiStatus?: 'idle' | 'loading' | 'success' | 'error'
    ankiMessage?: string
  } | null>(null)

  const handleWordClick = async (sentence: SentenceItem, word: string) => {
    const sentenceIndex = sentences.findIndex((s) => s.id === sentence.id)
    let context = getSentenceDisplayText(sentence)
    if (sentenceIndex >= 0 && typeof contextSentenceCount === 'number' && contextSentenceCount > 0) {
      const start = Math.max(0, sentenceIndex - contextSentenceCount)
      const end = Math.min(sentences.length, sentenceIndex + contextSentenceCount + 1)
      context = sentences
        .slice(start, end)
        .map((s) => getSentenceDisplayText(s))
        .join(' ')
    }

    setWordLookup({
      word,
      context,
      sentence,
      explanation: null,
      loading: true,
      error: null,
      ankiStatus: 'idle',
      ankiMessage: '',
    })

    try {
      const res = await onExplainVocabulary(context, word)
      setWordLookup((prev) =>
        prev && prev.word === word
          ? {
              ...prev,
              explanation: res.explanation,
              loading: false,
            }
          : prev,
      )
    } catch (err) {
      setWordLookup((prev) =>
        prev && prev.word === word
          ? {
              ...prev,
              loading: false,
              error: err instanceof Error ? err.message : '词汇解释失败，请稍后重试。',
            }
          : prev,
      )
    }
  }

  const handleWordLookupAddToAnki = async () => {
    if (!wordLookup || !wordLookup.explanation || !onAddToAnki) {
      return
    }

    setWordLookup((prev) => (prev ? { ...prev, ankiStatus: 'loading', ankiMessage: '' } : prev))

    const targetSentence: SentenceItem = {
      id: wordLookup.sentence?.id || 'lookup',
      text: wordLookup.context,
      editedText: wordLookup.context,
      status: 'success',
    }

    const targetResult: AnalysisResult = {
      sentenceId: targetSentence.id,
      grammar: '',
      meaning: wordLookup.explanation,
    }

    const targetHighlight: AnalysisHighlight = {
      id: `${targetSentence.id}:vocabulary:${wordLookup.word}`,
      text: wordLookup.word,
      kind: 'vocabulary',
      explanation: wordLookup.explanation,
    }

    try {
      const addResult = await onAddToAnki(targetSentence, targetResult, targetHighlight)
      setWordLookup((prev) =>
        prev
          ? {
              ...prev,
              ankiStatus: 'success',
              ankiMessage: addResult.message,
            }
          : prev,
      )
    } catch (err) {
      setWordLookup((prev) =>
        prev
          ? {
              ...prev,
              ankiStatus: 'error',
              ankiMessage: err instanceof Error ? err.message : '添加到 Anki 失败，请稍后重试。',
            }
          : prev,
      )
    }
  }

  if (isNativeAndroid()) {
    return (
      <div className="reading-result-list reading-android-draft">
        {sentences.length === 0 ? (
          <div className="empty-state reading-empty">
            <p>这一段暂时还没有可供阅读的正文内容。</p>
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
                  bookLanguage={bookLanguage}
                  readingPreferences={readingPreferences}
                />
                <button className="ghost-button" type="button" onClick={onBackToWorkspace}>
                  退出
                </button>
              </div>
            </div>

            <div className="reading-book-page reading-android-draft-page">
              <div className="reading-flow is-continuous">
                <p className="reading-paragraph">
                  {sentences.map((sentence) =>
                    bookLanguage === 'ja' ? (
                      <span className="reading-inline-sentence-ja" key={sentence.id}>
                        <JapaneseChunkView
                          sentenceId={sentence.id}
                          showFurigana={readingPreferences.showFurigana}
                          text={getSentenceDisplayText(sentence)}
                          tokens={sentence.tokens}
                          onChunkClick={(chunkIndex) => {
                            const token = sentence.tokens?.[chunkIndex]
                            if (token?.surface) {
                              void handleWordClick(sentence, token.surface)
                            }
                          }}
                        />
                      </span>
                    ) : (
                      <span className="reading-inline-sentence" key={sentence.id}>
                        <ClickableSentenceWords
                          activeWord={wordLookup?.word}
                          disabled={wordLookup?.loading}
                          text={getSentenceDisplayText(sentence)}
                          onWordClick={(word) => void handleWordClick(sentence, word)}
                        />
                        {' '}
                      </span>
                    ),
                  )}
                </p>
              </div>
            </div>

            {wordLookup ? (
              <WordLookupPopover
                ankiMessage={wordLookup.ankiMessage}
                ankiStatus={wordLookup.ankiStatus}
                context={wordLookup.context}
                error={wordLookup.error}
                explanation={wordLookup.explanation}
                loading={wordLookup.loading}
                onAddToAnki={handleWordLookupAddToAnki}
                onClose={() => setWordLookup(null)}
                word={wordLookup.word}
              />
            ) : null}
          </>
        )}
      </div>
    )
  }

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
                bookLanguage={bookLanguage}
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

                {bookLanguage === 'ja' ? (
                  <div
                    aria-expanded={isExpanded}
                    className={`reading-sentence-toggle ${isExpanded ? 'is-expanded' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggleSentence(sentence.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        onToggleSentence(sentence.id)
                      }
                    }}
                  >
                    <span className="reading-sentence-quote">
                      <JapaneseChunkView
                        activeChunkSelection={activeChunkSelection}
                        chunks={results[sentence.id]?.chunkAnalysis}
                        sentenceId={sentence.id}
                        showFurigana={readingPreferences.showFurigana}
                        text={getSentenceDisplayText(sentence)}
                        tokens={sentence.tokens}
                        onChunkClick={(chunkIndex) => onSelectChunk(sentence.id, chunkIndex)}
                      />
                    </span>
                    <span className="reading-sentence-toggle-hint">
                      {isExpanded ? '收起解释' : '点击展开解释'}
                    </span>
                  </div>
                ) : (
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
                )}

                {isExpanded ? (
                  <SentenceDetailPanel
                    activeSelection={activeSelection}
                    activeChunkSelection={activeChunkSelection}
                    bookLanguage={bookLanguage}
                    onAddToAnki={onAddToAnki}
                    onExplainVocabulary={onExplainVocabulary}
                    onOpenResources={onOpenResources}
                    onRemoveHighlight={onRemoveHighlight}
                    onRetrySentence={onRetrySentence}
                    onSaveHighlight={onSaveHighlight}
                    onSelectHighlight={onSelectHighlight}
                    onSelectChunk={onSelectChunk}
                    result={results[sentence.id]}
                    savedHighlightSignatures={savedHighlightSignatures}
                    sentence={sentence}
                    showFurigana={readingPreferences.showFurigana}
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
