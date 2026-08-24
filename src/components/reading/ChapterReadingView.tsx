import { useState } from 'react'
import type { RefObject } from 'react'
import {
  getReadingBlockClassName,
  getSentenceDisplayText,
  type ChapterReadingPage,
} from './readingShared'
import { ChapterInlineSentences } from './ChapterInlineSentences'
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
  lookupSentences?: SentenceItem[]
  onAddToAnki?: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => Promise<AddToAnkiResult>
  onBackToWorkspace: () => void
  onExplainVocabulary?: (context: string, word: string) => Promise<VocabularyExplanation>
  onChangeChapterPage: (direction: 'previous' | 'next') => void
  onSelectChunk: (sentenceId: string, chunkIndex: number) => void
  onOpenSentence: (sentenceId: string) => void
  readingPreferences: ReadingPreferences
  results: Record<string, AnalysisResult>
  resumeHighlightSentenceId: string | null
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
  lookupSentences,
  onAddToAnki,
  onBackToWorkspace,
  onExplainVocabulary,
  onChangeChapterPage,
  onSelectChunk,
  onOpenSentence,
  readingPreferences,
  results,
  resumeHighlightSentenceId,
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

    const allSentences = lookupSentences ?? chapterParagraphs.flatMap((p) => p.sentences)
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

  const isScrollMode = readingPreferences.readingMode === 'scroll'
  const visibleParagraphs = isScrollMode
    ? chapterParagraphs
    : currentChapterPageData?.paragraphs ?? []

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
        <div className="reading-book-page is-immersive">
          <div className={`reading-book-body${isScrollMode ? ' is-scroll' : ''}`} ref={chapterBodyRef}>
            <div className={`reading-flow ${isScrollMode ? 'is-scroll' : 'is-paged'}`}>
              {visibleParagraphs.map((paragraph) => (
                <div className={getReadingBlockClassName(paragraph)} key={paragraph.id}>
                  <ChapterInlineSentences
                    activeChunkSelection={activeChunkSelection}
                    activeWord={wordLookup?.word}
                    bookLanguage={bookLanguage}
                    effectiveActiveSentenceId={effectiveActiveSentenceId}
                    isAndroid={isAndroid}
                    isWordLookupLoading={wordLookup?.loading}
                    onOpenSentence={onOpenSentence}
                    onSelectChunk={onSelectChunk}
                    onWordClick={(sentence, word) => {
                      void handleWordClick(sentence, word)
                    }}
                    paragraph={paragraph}
                    resumeHighlightSentenceId={resumeHighlightSentenceId}
                    results={results}
                    showFurigana={readingPreferences.showFurigana}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="reading-float-chrome" aria-label="阅读工具">
            {isScrollMode ? null : (
              <div className="reading-float-pager">
                <button
                  className="reading-float-button"
                  disabled={currentChapterPage <= 0}
                  type="button"
                  onClick={() => onChangeChapterPage('previous')}
                >
                  上一页
                </button>
                <button
                  className="reading-float-button"
                  disabled={currentChapterPage >= chapterPageCount - 1}
                  type="button"
                  onClick={() => onChangeChapterPage('next')}
                >
                  下一页
                </button>
              </div>
            )}
            <button
              className="reading-float-button reading-float-exit"
              type="button"
              onClick={onBackToWorkspace}
            >
              退出
            </button>
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
