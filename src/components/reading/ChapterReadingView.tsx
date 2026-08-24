import { useState } from 'react'
import type { RefObject } from 'react'
import {
  getReadingBlockClassName,
  getSentenceDisplayText,
  type ChapterReadingPage,
} from './readingShared'
import { ClickableSentenceWords } from './ClickableSentenceWords'
import { JapaneseChunkView } from './JapaneseChunkView'
import { ReadingDisplaySettings } from './ReadingDisplaySettings'
import { WordLookupPopover } from './WordLookupPopover'
import { isNativeAndroid } from '../../lib/platform'
import type { JapaneseChunkSelection } from '../../lib/japaneseUtils'
import type { ChapterReadingParagraph } from '../../lib/readingFlow'
import type {
  AddToAnkiResult,
  AnalysisHighlight,
  AnalysisResult,
  BookLanguage,
  ReadingPreferences,
  SentenceItem,
  VocabularyExplanation,
} from '../../types'

type ChapterReadingViewProps = {
  chapterParagraphs: ChapterReadingParagraph[]
  chapterBodyRef: RefObject<HTMLDivElement | null>
  chapterPageCount: number
  contextSentenceCount?: number
  includeContextInExcerpt?: boolean
  currentChapterPage: number
  currentChapterPageData: ChapterReadingPage | null
  effectiveActiveSentenceId: string | null
  activeChunkSelection: JapaneseChunkSelection | null
  bookLanguage: BookLanguage
  isReadingSettingsOpen: boolean
  onAddToAnki?: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => Promise<AddToAnkiResult>
  onBackToWorkspace: () => void
  onCloseReadingSettings: () => void
  onExplainVocabulary?: (context: string, word: string) => Promise<VocabularyExplanation>
  onChangeChapterPage: (direction: 'previous' | 'next') => void
  onSelectChunk: (sentenceId: string, chunkIndex: number) => void
  onOpenSentence: (sentenceId: string) => void
  onReadingPreferencesChange: <Key extends keyof ReadingPreferences>(
    key: Key,
    value: ReadingPreferences[Key],
  ) => void
  onToggleReadingSettings: () => void
  readingPreferences: ReadingPreferences
  readingTitle: string
  results: Record<string, AnalysisResult>
  resumeHighlightSentenceId: string | null
  showReadingSettings: boolean
}

export function ChapterReadingView({
  chapterParagraphs,
  chapterBodyRef,
  chapterPageCount,
  contextSentenceCount = 1,
  includeContextInExcerpt = false,
  currentChapterPage,
  currentChapterPageData,
  effectiveActiveSentenceId,
  activeChunkSelection,
  bookLanguage,
  isReadingSettingsOpen,
  onAddToAnki,
  onBackToWorkspace,
  onCloseReadingSettings,
  onExplainVocabulary,
  onChangeChapterPage,
  onSelectChunk,
  onOpenSentence,
  onReadingPreferencesChange,
  onToggleReadingSettings,
  readingPreferences,
  readingTitle,
  results,
  resumeHighlightSentenceId,
  showReadingSettings,
}: ChapterReadingViewProps) {
  const isAndroid = isNativeAndroid()
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
    if (!onExplainVocabulary) {
      return
    }

    const allSentences = chapterParagraphs.flatMap((p) => p.sentences)
    const sentenceIndex = allSentences.findIndex((s) => s.id === sentence.id)
    const currentText = getSentenceDisplayText(sentence)
    let explanationContext = currentText
    if (sentenceIndex >= 0 && typeof contextSentenceCount === 'number' && contextSentenceCount > 0) {
      const start = Math.max(0, sentenceIndex - contextSentenceCount)
      const end = Math.min(allSentences.length, sentenceIndex + contextSentenceCount + 1)
      explanationContext = allSentences
        .slice(start, end)
        .map((s) => getSentenceDisplayText(s))
        .join(' ')
    }
    const excerptText = includeContextInExcerpt ? explanationContext : currentText

    setWordLookup({
      word,
      context: excerptText,
      sentence,
      explanation: null,
      loading: true,
      error: null,
      ankiStatus: 'idle',
      ankiMessage: '',
    })

    try {
      const res = await onExplainVocabulary(explanationContext, word)
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

  const visiblePageProgressCount = Math.min(chapterPageCount, 12)
  const visiblePageProgressActiveIndex =
    visiblePageProgressCount === chapterPageCount
      ? currentChapterPage
      : Math.round(
          (currentChapterPage / Math.max(1, chapterPageCount - 1)) *
            Math.max(0, visiblePageProgressCount - 1),
        )

  if (chapterParagraphs.length === 0) {
    return (
      <div className="empty-state reading-empty">
        <p>
          {isAndroid
            ? '这一段暂时还没有可供阅读的正文内容。'
            : '这一段暂时还没有可供阅读的正文内容，请先回工作区完成解析。'}
        </p>
      </div>
    )
  }

  return (
    <div className="reading-page-stack">
      <div className="reading-book-viewport">
        <div className="reading-book-page">
          <div className="reading-book-page-header">
            <h2>{readingTitle}</h2>
          </div>

          <div className="reading-book-body" ref={chapterBodyRef}>
            <div className="reading-flow is-paged">
              {(currentChapterPageData?.paragraphs ?? []).map((paragraph) => (
                <div className={getReadingBlockClassName(paragraph)} key={paragraph.id}>
                  {paragraph.sentences.map((sentence) => {
                    const sentenceClassName = `reading-inline-sentence ${
                      effectiveActiveSentenceId === sentence.id ? 'is-active' : ''
                    } ${resumeHighlightSentenceId === sentence.id ? 'is-resumed' : ''}`

                    return bookLanguage === 'ja' ? (
                      isAndroid ? (
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
                        <span
                          className="reading-inline-sentence-ja"
                          key={sentence.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpenSentence(sentence.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onOpenSentence(sentence.id)
                            }
                          }}
                        >
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
                      )
                    ) : (
                      <span className={sentenceClassName} key={sentence.id}>
                        <ClickableSentenceWords
                          activeWord={wordLookup?.word}
                          disabled={wordLookup?.loading}
                          text={getSentenceDisplayText(sentence)}
                          onWordClick={(word) => void handleWordClick(sentence, word)}
                        />
                      </span>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="reading-book-toolbar" aria-label="阅读工具">
            <div className="reading-book-toolbar-left">
              <span className="reading-page-indicator">
                第 {currentChapterPage + 1} / {chapterPageCount} 页
              </span>
              <div className="reading-page-progress" aria-hidden="true">
                {Array.from({ length: visiblePageProgressCount }).map((_, index) => {
                  const isActive = index === visiblePageProgressActiveIndex
                  return (
                    <span
                      className={`reading-page-progress-segment ${isActive ? 'is-active' : ''}`}
                      key={`page-progress-${index}`}
                    />
                  )
                })}
              </div>
            </div>

            <div className="reading-book-toolbar-actions">
              {showReadingSettings ? (
                <ReadingDisplaySettings
                  bookLanguage={bookLanguage}
                  isOpen={isReadingSettingsOpen}
                  onClose={onCloseReadingSettings}
                  onReadingPreferencesChange={onReadingPreferencesChange}
                  onToggle={onToggleReadingSettings}
                  readingPreferences={readingPreferences}
                />
              ) : null}
              <button
                className="ghost-button"
                disabled={currentChapterPage <= 0}
                type="button"
                onClick={() => onChangeChapterPage('previous')}
              >
                上一页
              </button>
              <button
                className="ghost-button"
                disabled={currentChapterPage >= chapterPageCount - 1}
                type="button"
                onClick={() => onChangeChapterPage('next')}
              >
                下一页
              </button>
              <button className="ghost-button" type="button" onClick={onBackToWorkspace}>
                退出
              </button>
            </div>
          </div>
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
          onAddToAnki={onAddToAnki ? handleWordLookupAddToAnki : undefined}
          onClose={() => setWordLookup(null)}
          word={wordLookup.word}
        />
      ) : null}
    </div>
  )
}
