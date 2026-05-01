import type { RefObject } from 'react'
import {
  getReadingBlockClassName,
  getSentenceDisplayText,
  type ChapterReadingPage,
} from './readingShared'
import { JapaneseChunkView } from './JapaneseChunkView'
import { ReadingDisplaySettings } from './ReadingDisplaySettings'
import type { JapaneseChunkSelection } from '../../lib/japaneseUtils'
import type { ChapterReadingParagraph } from '../../lib/readingFlow'
import type { AnalysisResult, BookLanguage, ReadingPreferences } from '../../types'

type ChapterReadingViewProps = {
  chapterParagraphs: ChapterReadingParagraph[]
  chapterBodyRef: RefObject<HTMLDivElement | null>
  chapterPageCount: number
  currentChapterPage: number
  currentChapterPageData: ChapterReadingPage | null
  effectiveActiveSentenceId: string | null
  activeChunkSelection: JapaneseChunkSelection | null
  bookLanguage: BookLanguage
  isReadingSettingsOpen: boolean
  onBackToWorkspace: () => void
  onCloseReadingSettings: () => void
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
  currentChapterPage,
  currentChapterPageData,
  effectiveActiveSentenceId,
  activeChunkSelection,
  bookLanguage,
  isReadingSettingsOpen,
  onBackToWorkspace,
  onCloseReadingSettings,
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
        <p>这一段暂时还没有可供阅读的正文内容，请先回工作区完成解析。</p>
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
                    ) : (
                      <button
                        className={sentenceClassName}
                        key={sentence.id}
                        type="button"
                        onClick={() => onOpenSentence(sentence.id)}
                      >
                        {paragraph.sentenceHtmlById?.[sentence.id] ? (
                          <span
                            dangerouslySetInnerHTML={{
                              __html: paragraph.sentenceHtmlById[sentence.id],
                            }}
                          />
                        ) : (
                          getSentenceDisplayText(sentence)
                        )}
                      </button>
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
    </div>
  )
}
