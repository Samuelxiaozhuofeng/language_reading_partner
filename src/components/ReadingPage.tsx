import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { statusLabelMap } from '../lib/appState'
import { resolveReadingResumeAnchor } from '../lib/readingAnchor'
import {
  buildChapterReadingParagraphs,
} from '../lib/readingFlow'
import { ChapterReadingView } from './reading/ChapterReadingView'
import { DraftReadingView } from './reading/DraftReadingView'
import { SentenceInspector } from './reading/SentenceInspector'
import { paginateChapterParagraphs } from './reading/readingPagination'
import {
  CHAPTER_PAGE_GAP,
  FALLBACK_CHAPTER_PAGE_LAYOUT,
  getChapterParagraphGap,
  getInspectorMode,
  getViewportSize,
  READING_DESKTOP_BREAKPOINT,
  type ChapterPageLayout,
  type HighlightSelection,
  type InspectorMode,
} from './reading/readingShared'
import type {
  AnalysisHighlight,
  AnalysisResult,
  ChapterParagraphBlock,
  ReadingPreferences,
  ReadingResumeAnchor,
  SentenceItem,
  SentenceRange,
  VocabularyExplanation,
  WorkspaceSource,
} from '../types'

type ReadingPageProps = {
  activeRange?: SentenceRange | null
  contextTitle?: {
    bookTitle: string
    chapterTitle: string
  }
  errorCount: number
  globalError: string
  onAddToAnki: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => Promise<void>
  onBackToWorkspace: () => void
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
  onSetResumeAnchor?: (sentence: SentenceItem, sentenceIndex: number) => void
  paragraphBlocks?: ChapterParagraphBlock[]
  readingPreferences: ReadingPreferences
  resumeAnchor?: ReadingResumeAnchor | null
  results: Record<string, AnalysisResult>
  savedHighlightSignatures: Set<string>
  sentenceStartIndex: number
  sentences: SentenceItem[]
  successCount: number
  workspaceSource: WorkspaceSource
}

function ReadingPage({
  activeRange,
  contextTitle,
  globalError,
  onAddToAnki,
  onBackToWorkspace,
  onExplainVocabulary,
  onOpenResources,
  onReadingPreferencesChange,
  onRemoveHighlight,
  onRetrySentence,
  onSaveHighlight,
  onSetResumeAnchor,
  paragraphBlocks,
  readingPreferences,
  resumeAnchor,
  results,
  savedHighlightSignatures,
  sentenceStartIndex,
  sentences,
  workspaceSource,
}: ReadingPageProps) {
  const isChapterMode = workspaceSource === 'chapter'
  const readingTitle = isChapterMode ? contextTitle?.chapterTitle ?? '章节阅读' : '沉浸阅读'
  const [activeSelection, setActiveSelection] = useState<HighlightSelection | null>(null)
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null)
  const [currentChapterPage, setCurrentChapterPage] = useState(0)
  const [expandedSentenceIds, setExpandedSentenceIds] = useState<Set<string>>(() => new Set())
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>(() => getInspectorMode())
  const [isReadingSettingsOpen, setIsReadingSettingsOpen] = useState(false)
  const [viewportSize, setViewportSize] = useState(getViewportSize)
  const [chapterPageLayout, setChapterPageLayout] =
    useState<ChapterPageLayout>(FALLBACK_CHAPTER_PAGE_LAYOUT)
  const [paginationMeasureContainer, setPaginationMeasureContainer] =
    useState<HTMLDivElement | null>(null)
  const [resumeHighlightSentenceId, setResumeHighlightSentenceId] = useState<string | null>(() => {
    const resolvedAnchor = resolveReadingResumeAnchor(sentences, resumeAnchor)
    return isChapterMode ? resolvedAnchor?.sentence.id ?? null : null
  })
  const readingShellRef = useRef<HTMLElement | null>(null)
  const chapterBodyRef = useRef<HTMLDivElement | null>(null)
  const validSentenceIdSet = useMemo(
    () => new Set(sentences.map((sentence) => sentence.id)),
    [sentences],
  )
  const effectiveActiveSelection =
    activeSelection && validSentenceIdSet.has(activeSelection.sentenceId)
      ? activeSelection
      : null
  const effectiveActiveSentenceId =
    activeSentenceId && validSentenceIdSet.has(activeSentenceId) ? activeSentenceId : null
  const effectiveExpandedSentenceIds = useMemo(
    () => new Set([...expandedSentenceIds].filter((sentenceId) => validSentenceIdSet.has(sentenceId))),
    [expandedSentenceIds, validSentenceIdSet],
  )
  const areAllSentencesExpanded =
    !isChapterMode &&
    sentences.length > 0 &&
    sentences.every((sentence) => effectiveExpandedSentenceIds.has(sentence.id))
  const chapterParagraphs = useMemo(
    () =>
      isChapterMode
        ? buildChapterReadingParagraphs(paragraphBlocks ?? [], sentences, activeRange)
        : [],
    [activeRange, isChapterMode, paragraphBlocks, sentences],
  )
  const chapterReadingKey = useMemo(
    () =>
      isChapterMode
        ? [
            activeRange?.start ?? 'none',
            activeRange?.end ?? 'none',
            sentences.map((sentence) => sentence.id).join('|'),
          ].join(':')
        : '',
    [activeRange?.end, activeRange?.start, isChapterMode, sentences],
  )
  const activeSentence = useMemo(
    () => sentences.find((sentence) => sentence.id === effectiveActiveSentenceId) ?? null,
    [effectiveActiveSentenceId, sentences],
  )
  const activeSentenceIndex = activeSentence
    ? sentenceStartIndex + sentences.findIndex((sentence) => sentence.id === activeSentence.id)
    : null
  const resolvedResumeAnchor = useMemo(
    () => resolveReadingResumeAnchor(sentences, resumeAnchor),
    [resumeAnchor, sentences],
  )
  const resumeAnchorSentenceId = resolvedResumeAnchor?.sentence.id ?? null
  const chapterPages = useMemo(
    () =>
      paginateChapterParagraphs(chapterParagraphs, {
        fontSize: readingPreferences.fontSize,
        measureContainer: paginationMeasureContainer,
        pageLayout: chapterPageLayout,
        viewportHeight: viewportSize.height,
        viewportWidth:
          viewportSize.width > READING_DESKTOP_BREAKPOINT
            ? viewportSize.width * 0.7
            : viewportSize.width,
      }),
    [
      chapterPageLayout,
      chapterParagraphs,
      paginationMeasureContainer,
      readingPreferences.fontSize,
      viewportSize.height,
      viewportSize.width,
    ],
  )
  const currentChapterPageData = chapterPages[currentChapterPage] ?? chapterPages[0] ?? null
  const chapterPageCount = Math.max(1, chapterPages.length)
  const resumeAnchorPageIndex = useMemo(
    () =>
      resumeAnchorSentenceId
        ? Math.max(
            0,
            chapterPages.findIndex((page) =>
              page.paragraphs.some((paragraph) =>
                paragraph.sentences.some((sentence) => sentence.id === resumeAnchorSentenceId),
              ),
            ),
          )
        : 0,
    [chapterPages, resumeAnchorSentenceId],
  )
  const shouldDockInspector = isChapterMode && inspectorMode === 'docked'
  const readingShellStyle = useMemo(
    () =>
      ({
        '--reading-content-width': isChapterMode ? '100%' : `${readingPreferences.contentWidth}px`,
        '--reading-body-font-size': `${readingPreferences.fontSize}px`,
        '--reading-panel-font-size': `${Math.max(16, readingPreferences.fontSize - 1)}px`,
        '--reading-inspector-width': isChapterMode ? '100%' : `${Math.round(
          Math.min(420, Math.max(320, readingPreferences.contentWidth * 0.42)),
        )}px`,
        '--reading-page-gap': `${CHAPTER_PAGE_GAP}px`,
        '--reading-page-paragraph-gap': `${getChapterParagraphGap(readingPreferences.fontSize)}px`,
      }) as CSSProperties,
    [isChapterMode, readingPreferences.contentWidth, readingPreferences.fontSize],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleResize = () => {
      setInspectorMode(getInspectorMode())
      setViewportSize(getViewportSize())
    }

    window.addEventListener('resize', handleResize)
    window.visualViewport?.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.visualViewport?.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (
      !isChapterMode ||
      !chapterBodyRef.current ||
      typeof ResizeObserver === 'undefined'
    ) {
      return
    }

    const measurePageBody = () => {
      const nextLayout = {
        bodyHeight: Math.round(chapterBodyRef.current?.clientHeight ?? 0),
        bodyWidth: Math.round(chapterBodyRef.current?.clientWidth ?? 0),
      }

      setChapterPageLayout((current) =>
        current.bodyHeight === nextLayout.bodyHeight &&
        current.bodyWidth === nextLayout.bodyWidth
          ? current
          : nextLayout,
      )
    }

    measurePageBody()
    const resizeObserver = new ResizeObserver(() => {
      measurePageBody()
    })

    resizeObserver.observe(chapterBodyRef.current)
    return () => resizeObserver.disconnect()
  }, [chapterPageCount, isChapterMode, readingPreferences.fontSize])

  useEffect(() => {
    if (!isChapterMode) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      setResumeHighlightSentenceId(resumeAnchorSentenceId)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isChapterMode, resumeAnchorSentenceId])

  useEffect(() => {
    if (!resumeHighlightSentenceId) {
      return
    }

    const timerId = window.setTimeout(() => {
      setResumeHighlightSentenceId((current) =>
        current === resumeHighlightSentenceId ? null : current,
      )
    }, 2600)

    return () => window.clearTimeout(timerId)
  }, [resumeHighlightSentenceId])

  useEffect(() => {
    if (!isChapterMode || !resumeAnchorSentenceId) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      setCurrentChapterPage(resumeAnchorPageIndex)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isChapterMode, resumeAnchorPageIndex, resumeAnchorSentenceId])

  useEffect(() => {
    if (!isChapterMode || resumeAnchorSentenceId) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      setCurrentChapterPage(0)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [chapterReadingKey, isChapterMode, resumeAnchorSentenceId])

  useEffect(() => {
    if (!isChapterMode) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      setCurrentChapterPage((current) => Math.min(current, Math.max(0, chapterPages.length - 1)))
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [chapterPages.length, isChapterMode])

  useEffect(() => {
    if (!shouldDockInspector || !activeSentence) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) {
        return
      }

      if (!readingShellRef.current?.contains(event.target)) {
        return
      }

      if (
        event.target.closest('.reading-inspector') ||
        event.target.closest('.reading-inline-sentence') ||
        event.target.closest('button, input, textarea, select, label')
      ) {
        return
      }

      setActiveSentenceId(null)
      setActiveSelection(null)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [activeSentence, shouldDockInspector])

  const handleSelectHighlight = (sentenceId: string, highlightId: string) => {
    setActiveSelection((current) =>
      current?.sentenceId === sentenceId && current.highlightId === highlightId
        ? null
        : { sentenceId, highlightId },
    )
  }

  const handleOpenSentence = (sentenceId: string) => {
    setActiveSelection(null)
    setActiveSentenceId((current) => (current === sentenceId ? null : sentenceId))
  }

  const handleCloseSentence = () => {
    setActiveSentenceId(null)
    setActiveSelection(null)
  }

  const handleToggleSentence = (sentenceId: string) => {
    if (effectiveActiveSelection?.sentenceId === sentenceId) {
      setActiveSelection(null)
    }

    setExpandedSentenceIds((current) => {
      const next = new Set(current)
      if (next.has(sentenceId)) {
        next.delete(sentenceId)
      } else {
        next.add(sentenceId)
      }
      return next
    })
  }

  const handleToggleAllSentences = () => {
    if (areAllSentencesExpanded) {
      setActiveSelection(null)
      setExpandedSentenceIds(new Set())
      return
    }

    setExpandedSentenceIds(new Set(sentences.map((sentence) => sentence.id)))
  }

  const handleSetCurrentResumeAnchor = () => {
    if (!activeSentence || activeSentenceIndex === null || !onSetResumeAnchor) {
      return
    }

    onSetResumeAnchor(activeSentence, activeSentenceIndex)
    setResumeHighlightSentenceId(activeSentence.id)
  }

  const handleChangeChapterPage = useCallback((direction: 'previous' | 'next') => {
    const nextPage =
      direction === 'previous'
        ? Math.max(0, currentChapterPage - 1)
        : Math.min(chapterPageCount - 1, currentChapterPage + 1)

    if (nextPage === currentChapterPage) {
      return
    }

    setActiveSentenceId(null)
    setActiveSelection(null)
    setCurrentChapterPage(nextPage)
  }, [chapterPageCount, currentChapterPage])

  useEffect(() => {
    if (!isChapterMode) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest('button, input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        handleChangeChapterPage('previous')
      }

      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        handleChangeChapterPage('next')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleChangeChapterPage, isChapterMode])

  return (
    <main className="reading-page">
      <section
        className={`reading-shell ${isChapterMode ? 'is-chapter-shell' : ''} ${shouldDockInspector ? 'has-docked-inspector' : ''}`}
        ref={readingShellRef}
        style={readingShellStyle}
      >
        {globalError ? <p className="notice error">{globalError}</p> : null}

        <div
          className={`reading-stage ${isChapterMode ? 'is-chapter-mode' : 'is-draft-mode'} ${
            shouldDockInspector ? 'has-docked-inspector' : ''
          }`}
        >
          <div className="reading-main-column">
            {isChapterMode ? (
              <ChapterReadingView
                chapterBodyRef={chapterBodyRef}
                chapterPageCount={chapterPageCount}
                chapterParagraphs={chapterParagraphs}
                currentChapterPage={currentChapterPage}
                currentChapterPageData={currentChapterPageData}
                effectiveActiveSentenceId={effectiveActiveSentenceId}
                onBackToWorkspace={onBackToWorkspace}
                onChangeChapterPage={handleChangeChapterPage}
                onOpenSentence={handleOpenSentence}
                readingTitle={readingTitle}
                resumeHighlightSentenceId={resumeHighlightSentenceId}
              />
            ) : (
              <DraftReadingView
                activeSelection={effectiveActiveSelection}
                areAllSentencesExpanded={areAllSentencesExpanded}
                expandedSentenceIds={effectiveExpandedSentenceIds}
                isReadingSettingsOpen={isReadingSettingsOpen}
                onAddToAnki={onAddToAnki}
                onBackToWorkspace={onBackToWorkspace}
                onCloseReadingSettings={() => setIsReadingSettingsOpen(false)}
                onExplainVocabulary={onExplainVocabulary}
                onOpenResources={onOpenResources}
                onReadingPreferencesChange={onReadingPreferencesChange}
                onRemoveHighlight={onRemoveHighlight}
                onRetrySentence={onRetrySentence}
                onSaveHighlight={onSaveHighlight}
                onSelectHighlight={handleSelectHighlight}
                onToggleAllSentences={handleToggleAllSentences}
                onToggleReadingSettings={() => setIsReadingSettingsOpen((current) => !current)}
                onToggleSentence={handleToggleSentence}
                readingPreferences={readingPreferences}
                readingTitle={readingTitle}
                results={results}
                savedHighlightSignatures={savedHighlightSignatures}
                sentences={sentences}
              />
            )}
          </div>

          {shouldDockInspector ? (
            <SentenceInspector
              activeSelection={effectiveActiveSelection}
              activeSentence={activeSentence}
              activeSentenceIndex={activeSentenceIndex}
              mode="docked"
              onAddToAnki={onAddToAnki}
              onCloseSentence={handleCloseSentence}
              onExplainVocabulary={onExplainVocabulary}
              onOpenResources={onOpenResources}
              onRemoveHighlight={onRemoveHighlight}
              onRetrySentence={onRetrySentence}
              onSaveHighlight={onSaveHighlight}
              onSelectHighlight={handleSelectHighlight}
              onSetCurrentResumeAnchor={handleSetCurrentResumeAnchor}
              resolveStatusLabel={(status) => statusLabelMap[status]}
              results={results}
              resumeAnchorSentenceId={resumeAnchorSentenceId}
              savedHighlightSignatures={savedHighlightSignatures}
            />
          ) : null}
        </div>

        {isChapterMode ? (
          <div
            aria-hidden="true"
            className="reading-pagination-measure"
            ref={setPaginationMeasureContainer}
          />
        ) : null}
      </section>

      {isChapterMode && !shouldDockInspector && activeSentence ? (
        <div className="reading-overlay is-sheet" role="presentation" onClick={handleCloseSentence}>
          <div className="reading-sheet-frame" onClick={(event) => event.stopPropagation()}>
            <SentenceInspector
              activeSelection={effectiveActiveSelection}
              activeSentence={activeSentence}
              activeSentenceIndex={activeSentenceIndex}
              mode="sheet"
              onAddToAnki={onAddToAnki}
              onCloseSentence={handleCloseSentence}
              onExplainVocabulary={onExplainVocabulary}
              onOpenResources={onOpenResources}
              onRemoveHighlight={onRemoveHighlight}
              onRetrySentence={onRetrySentence}
              onSaveHighlight={onSaveHighlight}
              onSelectHighlight={handleSelectHighlight}
              onSetCurrentResumeAnchor={handleSetCurrentResumeAnchor}
              resolveStatusLabel={(status) => statusLabelMap[status]}
              results={results}
              resumeAnchorSentenceId={resumeAnchorSentenceId}
              savedHighlightSignatures={savedHighlightSignatures}
            />
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default ReadingPage
