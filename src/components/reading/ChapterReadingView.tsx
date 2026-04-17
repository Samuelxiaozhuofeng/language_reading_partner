import type { RefObject } from 'react'
import {
  getReadingBlockClassName,
  getSentenceDisplayText,
  type ChapterReadingPage,
} from './readingShared'
import type { ChapterReadingParagraph } from '../../lib/readingFlow'

type ChapterReadingViewProps = {
  chapterParagraphs: ChapterReadingParagraph[]
  chapterBodyRef: RefObject<HTMLDivElement | null>
  chapterPageCount: number
  currentChapterPage: number
  currentChapterPageData: ChapterReadingPage | null
  effectiveActiveSentenceId: string | null
  onBackToWorkspace: () => void
  onChangeChapterPage: (direction: 'previous' | 'next') => void
  onOpenSentence: (sentenceId: string) => void
  readingTitle: string
  resumeHighlightSentenceId: string | null
}

export function ChapterReadingView({
  chapterParagraphs,
  chapterBodyRef,
  chapterPageCount,
  currentChapterPage,
  currentChapterPageData,
  effectiveActiveSentenceId,
  onBackToWorkspace,
  onChangeChapterPage,
  onOpenSentence,
  readingTitle,
  resumeHighlightSentenceId,
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
                  {paragraph.sentences.map((sentence) => (
                    <button
                      className={`reading-inline-sentence ${
                        effectiveActiveSentenceId === sentence.id ? 'is-active' : ''
                      } ${resumeHighlightSentenceId === sentence.id ? 'is-resumed' : ''}`}
                      key={sentence.id}
                      type="button"
                      onClick={() => onOpenSentence(sentence.id)}
                    >
                      {getSentenceDisplayText(sentence)}
                    </button>
                  ))}
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
