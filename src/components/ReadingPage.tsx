import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { statusLabelMap } from '../lib/appState'
import { buildKnowledgeSignature, knowledgeKindLabelMap } from '../lib/knowledge'
import { resolveReadingResumeAnchor } from '../lib/readingAnchor'
import { buildChapterReadingParagraphs } from '../lib/readingFlow'
import type {
  AnalysisHighlight,
  AnalysisResult,
  ChapterParagraphBlock,
  ReadingResumeAnchor,
  SentenceItem,
  SentenceRange,
  WorkspaceSource,
} from '../types'

type HighlightSelection = {
  sentenceId: string
  highlightId: string
}

type ReadingPageProps = {
  activeRange?: SentenceRange | null
  adjacentChapterIds?: {
    previousId: string | null
    nextId: string | null
  }
  contextTitle?: {
    bookTitle: string
    chapterTitle: string
  }
  errorCount: number
  globalError: string
  notice: string
  onBackToLibrary: () => void
  onBackToWorkspace: () => void
  onOpenAdjacentChapter: (chapterId: string | null) => void
  onOpenResources: () => void
  onRemoveHighlight: (signature: string) => void
  onSaveHighlight: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => void
  onSetResumeAnchor?: (sentence: SentenceItem, sentenceIndex: number) => void
  paragraphBlocks?: ChapterParagraphBlock[]
  resumeAnchor?: ReadingResumeAnchor | null
  results: Record<string, AnalysisResult>
  savedHighlightSignatures: Set<string>
  sentenceStartIndex: number
  sentences: SentenceItem[]
  successCount: number
  workspaceSource: WorkspaceSource
}

type SentenceDetailPanelProps = {
  activeSelection: HighlightSelection | null
  onOpenResources: () => void
  onRemoveHighlight: (signature: string) => void
  onSaveHighlight: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => void
  onSelectHighlight: (sentenceId: string, highlightId: string) => void
  result?: AnalysisResult
  savedHighlightSignatures: Set<string>
  sentence: SentenceItem
}

type DesktopPopoverPosition = {
  left: number
  maxHeight: number
  placement: 'top' | 'bottom'
  top: number
}

type InspectorMode = 'popover' | 'sheet'

const MOBILE_READING_BREAKPOINT = 720
const DESKTOP_POPOVER_MIN_VIEWPORT_WIDTH = 960
const DESKTOP_POPOVER_MIN_VIEWPORT_HEIGHT = 680
const DESKTOP_POPOVER_MIN_WIDTH = 280
const DESKTOP_POPOVER_MAX_WIDTH = 420
const DESKTOP_POPOVER_WIDTH_RATIO = 0.32
const DESKTOP_POPOVER_ESTIMATED_HEIGHT = 420
const DESKTOP_POPOVER_GAP = 12
const DESKTOP_POPOVER_PADDING = 16

function getViewportSize() {
  if (typeof window === 'undefined') {
    return {
      height: 0,
      width: 0,
    }
  }

  return {
    height: window.visualViewport?.height ?? window.innerHeight,
    width: window.visualViewport?.width ?? window.innerWidth,
  }
}

function getInspectorMode(): InspectorMode {
  const { height, width } = getViewportSize()
  if (width <= MOBILE_READING_BREAKPOINT) {
    return 'sheet'
  }

  if (width < DESKTOP_POPOVER_MIN_VIEWPORT_WIDTH || height < DESKTOP_POPOVER_MIN_VIEWPORT_HEIGHT) {
    return 'sheet'
  }

  return 'popover'
}

function getDesktopPopoverWidth(viewportWidth: number) {
  return Math.min(
    DESKTOP_POPOVER_MAX_WIDTH,
    Math.max(DESKTOP_POPOVER_MIN_WIDTH, viewportWidth * DESKTOP_POPOVER_WIDTH_RATIO),
  )
}

function buildSelectionKey(sentenceId: string, highlightId: string) {
  return `${sentenceId}:${highlightId}`
}

function findInlineHighlightRanges(text: string, highlights: AnalysisHighlight[]) {
  const candidateRanges = highlights
    .map((highlight) => ({
      highlight,
      start: text.indexOf(highlight.text),
      end: text.indexOf(highlight.text) + highlight.text.length,
    }))
    .filter((range) => range.start >= 0)
    .sort((left, right) => {
      if (left.start !== right.start) {
        return left.start - right.start
      }

      return right.highlight.text.length - left.highlight.text.length
    })

  const acceptedRanges: typeof candidateRanges = []
  let cursor = -1

  for (const range of candidateRanges) {
    if (range.start < cursor) {
      continue
    }

    acceptedRanges.push(range)
    cursor = range.end
  }

  return acceptedRanges
}

function renderGrammarText(
  text: string,
  highlights: AnalysisHighlight[],
  activeSelection: HighlightSelection | null,
  sentenceId: string,
  savedHighlightSignatures: Set<string>,
  onSelect: (highlightId: string) => void,
) {
  const ranges = findInlineHighlightRanges(text, highlights)

  if (ranges.length === 0) {
    return text
  }

  const segments: ReactNode[] = []
  let cursor = 0

  ranges.forEach((range) => {
    if (cursor < range.start) {
      segments.push(
        <span key={`text:${cursor}`}>
          {text.slice(cursor, range.start)}
        </span>,
      )
    }

    const signature = buildKnowledgeSignature(range.highlight.kind, range.highlight.text)
    const isSaved = savedHighlightSignatures.has(signature)
    const isActive =
      activeSelection?.sentenceId === sentenceId &&
      activeSelection.highlightId === range.highlight.id

    segments.push(
      <button
        className={`inline-knowledge-link ${isActive ? 'is-active' : ''} ${isSaved ? 'is-saved' : ''}`}
        key={buildSelectionKey(sentenceId, range.highlight.id)}
        type="button"
        onClick={() => onSelect(range.highlight.id)}
      >
        {range.highlight.text}
      </button>,
    )
    cursor = range.end
  })

  if (cursor < text.length) {
    segments.push(
      <span key={`text:${cursor}`}>
        {text.slice(cursor)}
      </span>,
    )
  }

  return segments
}

function SentenceDetailPanel({
  activeSelection,
  onOpenResources,
  onRemoveHighlight,
  onSaveHighlight,
  onSelectHighlight,
  result,
  savedHighlightSignatures,
  sentence,
}: SentenceDetailPanelProps) {
  if (!result) {
    return (
      <div className="result-placeholder">
        <p>
          {sentence.status === 'error'
            ? '这句解析失败了，请回工作区重试本句。'
            : sentence.status === 'running' || sentence.status === 'queued'
              ? 'AI 正在处理中...'
              : '这句还没有开始解析。'}
        </p>
      </div>
    )
  }

  const highlights = result.highlights ?? []
  const selectedHighlight = highlights.find(
    (highlight) =>
      activeSelection?.sentenceId === sentence.id &&
      activeSelection.highlightId === highlight.id,
  )
  const selectedSignature = selectedHighlight
    ? buildKnowledgeSignature(selectedHighlight.kind, selectedHighlight.text)
    : null
  const isSelectedSaved = selectedSignature
    ? savedHighlightSignatures.has(selectedSignature)
    : false

  return (
    <div className="analysis-stack">
      <section>
        <h3>语法</h3>
        <div className="analysis-paragraph">
          {result.grammar
            ? renderGrammarText(
                result.grammar,
                highlights,
                activeSelection,
                sentence.id,
                savedHighlightSignatures,
                (highlightId) => onSelectHighlight(sentence.id, highlightId),
              )
            : '模型未稳定返回语法说明。'}
        </div>

        {highlights.length > 0 ? (
          <>
            <div className="knowledge-chip-list">
              {highlights.map((highlight) => {
                const signature = buildKnowledgeSignature(highlight.kind, highlight.text)
                const isSaved = savedHighlightSignatures.has(signature)
                const isActive =
                  activeSelection?.sentenceId === sentence.id &&
                  activeSelection.highlightId === highlight.id

                return (
                  <button
                    className={`knowledge-chip ${isActive ? 'is-active' : ''} ${isSaved ? 'is-saved' : ''}`}
                    key={highlight.id}
                    type="button"
                    onClick={() => onSelectHighlight(sentence.id, highlight.id)}
                  >
                    <span>{highlight.text}</span>
                    <span>{knowledgeKindLabelMap[highlight.kind]}</span>
                  </button>
                )
              })}
            </div>

            {selectedHighlight ? (
              <div className="knowledge-detail-card">
                <div className="knowledge-detail-header">
                  <div>
                    <p className="section-kicker">Knowledge Point</p>
                    <h4>{selectedHighlight.text}</h4>
                  </div>
                  <span className="status-pill">
                    {knowledgeKindLabelMap[selectedHighlight.kind]}
                  </span>
                </div>

                <p>{selectedHighlight.explanation}</p>

                <div className="panel-actions knowledge-detail-actions">
                  {isSelectedSaved && selectedSignature ? (
                    <button
                      className="ghost-button danger-button"
                      type="button"
                      onClick={() => onRemoveHighlight(selectedSignature)}
                    >
                      取消收藏
                    </button>
                  ) : (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => onSaveHighlight(sentence, result, selectedHighlight)}
                    >
                      保存到学习资源
                    </button>
                  )}

                  <button className="ghost-button" type="button" onClick={onOpenResources}>
                    打开学习资源页
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
      <section>
        <h3>内容</h3>
        <p>{result.meaning || '模型未稳定返回内容解读。'}</p>
      </section>
    </div>
  )
}

function ReadingPage({
  activeRange,
  adjacentChapterIds,
  contextTitle,
  errorCount,
  globalError,
  notice,
  onBackToLibrary,
  onBackToWorkspace,
  onOpenAdjacentChapter,
  onOpenResources,
  onRemoveHighlight,
  onSaveHighlight,
  onSetResumeAnchor,
  paragraphBlocks,
  resumeAnchor,
  results,
  savedHighlightSignatures,
  sentenceStartIndex,
  sentences,
  successCount,
  workspaceSource,
}: ReadingPageProps) {
  const isChapterMode = workspaceSource === 'chapter'
  const [activeSelection, setActiveSelection] = useState<HighlightSelection | null>(null)
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null)
  const [expandedSentenceIds, setExpandedSentenceIds] = useState<Set<string>>(() => new Set())
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>(() => getInspectorMode())
  const [desktopPopoverPosition, setDesktopPopoverPosition] = useState<DesktopPopoverPosition | null>(null)
  const [resumeHighlightSentenceId, setResumeHighlightSentenceId] = useState<string | null>(() => {
    const resolvedAnchor = resolveReadingResumeAnchor(sentences, resumeAnchor)
    return isChapterMode ? resolvedAnchor?.sentence.id ?? null : null
  })
  const sentenceButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const inspectorRef = useRef<HTMLElement | null>(null)
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
  const [initialResumeTargetId] = useState(() => resumeAnchorSentenceId)

  const calculateDesktopPopoverPosition = (sentenceId: string): DesktopPopoverPosition | null => {
    if (typeof window === 'undefined' || getInspectorMode() !== 'popover') {
      return null
    }

    const anchor = sentenceButtonRefs.current[sentenceId]
    if (!anchor) {
      return null
    }

    const { height: viewportHeight, width: viewportWidth } = getViewportSize()
    const anchorRect = anchor.getBoundingClientRect()
    const inspectorWidth = Math.min(
      inspectorRef.current?.offsetWidth ?? getDesktopPopoverWidth(viewportWidth),
      viewportWidth - DESKTOP_POPOVER_PADDING * 2,
    )
    const inspectorHeight = Math.min(
      inspectorRef.current?.offsetHeight ?? DESKTOP_POPOVER_ESTIMATED_HEIGHT,
      viewportHeight - DESKTOP_POPOVER_PADDING * 2,
    )
    const spaceBelow = viewportHeight - anchorRect.bottom - DESKTOP_POPOVER_PADDING
    const spaceAbove = anchorRect.top - DESKTOP_POPOVER_PADDING
    const placement =
      spaceBelow >= inspectorHeight + DESKTOP_POPOVER_GAP || spaceBelow >= spaceAbove
        ? 'bottom'
        : 'top'
    const unclampedTop =
      placement === 'bottom'
        ? anchorRect.bottom + DESKTOP_POPOVER_GAP
        : anchorRect.top - inspectorHeight - DESKTOP_POPOVER_GAP
    const top = Math.min(
      Math.max(DESKTOP_POPOVER_PADDING, unclampedTop),
      viewportHeight - inspectorHeight - DESKTOP_POPOVER_PADDING,
    )
    const unclampedLeft = anchorRect.left + anchorRect.width / 2 - inspectorWidth / 2
    const left = Math.min(
      Math.max(DESKTOP_POPOVER_PADDING, unclampedLeft),
      viewportWidth - inspectorWidth - DESKTOP_POPOVER_PADDING,
    )

    return {
      left,
      maxHeight: viewportHeight - DESKTOP_POPOVER_PADDING * 2,
      placement,
      top,
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleResize = () => {
      setInspectorMode(getInspectorMode())
    }

    window.addEventListener('resize', handleResize)
    window.visualViewport?.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.visualViewport?.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    if (!isChapterMode || !effectiveActiveSentenceId || inspectorMode !== 'popover') {
      return
    }

    const updatePosition = () => {
      const nextPosition = calculateDesktopPopoverPosition(effectiveActiveSentenceId)
      setDesktopPopoverPosition(nextPosition)
    }

    const frameId = window.requestAnimationFrame(updatePosition)
    const visualViewport = window.visualViewport
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    visualViewport?.addEventListener('resize', updatePosition)
    visualViewport?.addEventListener('scroll', updatePosition)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      visualViewport?.removeEventListener('resize', updatePosition)
      visualViewport?.removeEventListener('scroll', updatePosition)
    }
  }, [effectiveActiveSelection, effectiveActiveSentenceId, inspectorMode, isChapterMode])

  useEffect(() => {
    if (!isChapterMode || !initialResumeTargetId) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      sentenceButtonRefs.current[initialResumeTargetId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [initialResumeTargetId, isChapterMode])

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

  const handleSelectHighlight = (sentenceId: string, highlightId: string) => {
    setActiveSelection((current) =>
      current?.sentenceId === sentenceId && current.highlightId === highlightId
        ? null
        : { sentenceId, highlightId },
    )
  }

  const handleOpenSentence = (sentenceId: string) => {
    setActiveSelection(null)
    const nextSentenceId = effectiveActiveSentenceId === sentenceId ? null : sentenceId
    setActiveSentenceId(nextSentenceId)
    setDesktopPopoverPosition(
      nextSentenceId && inspectorMode === 'popover'
        ? calculateDesktopPopoverPosition(nextSentenceId)
        : null,
    )
  }

  const handleCloseSentence = () => {
    setActiveSentenceId(null)
    setActiveSelection(null)
    setDesktopPopoverPosition(null)
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

  return (
    <main className="reading-page">
      <section className="reading-shell">
        <div className="reading-page-header">
          <div>
            <p className="section-kicker">{isChapterMode ? 'Chapter Reading' : 'Draft Reading'}</p>
            <h2>{isChapterMode ? contextTitle?.chapterTitle ?? '章节阅读' : '沉浸式解释结果'}</h2>
            {contextTitle?.bookTitle ? <p className="reading-breadcrumb">{contextTitle.bookTitle}</p> : null}
          </div>
          <div className="panel-actions">
            <button className="ghost-button" type="button" onClick={onOpenResources}>
              学习资源
            </button>
            <button className="ghost-button" type="button" onClick={onBackToLibrary}>
              返回书架
            </button>
            <button className="ghost-button" type="button" onClick={onBackToWorkspace}>
              返回工作区
            </button>
          </div>
        </div>

        <p className="reading-intro">
          {isChapterMode
            ? activeRange
              ? `这里会把当前阅读段 ${activeRange.start}-${activeRange.end} 排成连续正文流；阅读时只需点一下句子，就会弹出解释。`
              : '先在工作区完成一个句子区间的解析，这里才会出现对应的沉浸阅读内容。'
            : '这里会把整章解释集中排版到一条居中的阅读流里，方便你像读批注版小说一样顺着往下读。'}
        </p>

        {notice ? <p className="notice success">{notice}</p> : null}
        {globalError ? <p className="notice error">{globalError}</p> : null}

        <div className="reading-summary">
          {isChapterMode && activeRange ? <span>当前区间 {activeRange.start}-{activeRange.end}</span> : null}
          <span>已展示 {sentences.length}</span>
          <span>已完成 {successCount}</span>
          <span>失败 {errorCount}</span>
          {!isChapterMode && sentences.length > 0 ? (
            <button
              className="ghost-button reading-toggle-all-button"
              type="button"
              onClick={handleToggleAllSentences}
            >
              {areAllSentencesExpanded ? '全部收起' : '全部展开'}
            </button>
          ) : null}
        </div>

        {isChapterMode ? (
          <div className="reading-nav-card">
            <button
              className="ghost-button"
              disabled={!adjacentChapterIds?.previousId}
              type="button"
              onClick={() => onOpenAdjacentChapter(adjacentChapterIds?.previousId ?? null)}
            >
              上一章
            </button>
            <button
              className="ghost-button"
              disabled={!adjacentChapterIds?.nextId}
              type="button"
              onClick={() => onOpenAdjacentChapter(adjacentChapterIds?.nextId ?? null)}
            >
              下一章
            </button>
          </div>
        ) : null}

        {isChapterMode ? (
          chapterParagraphs.length === 0 ? (
            <div className="empty-state reading-empty">
              <p>这一段暂时还没有可供阅读的正文内容，请先回工作区完成解析。</p>
            </div>
          ) : (
            <div className="reading-flow">
              {chapterParagraphs.map((paragraph) => (
                <p className="reading-paragraph" key={paragraph.id}>
                  {paragraph.sentences.map((sentence) => (
                    <button
                      className={`reading-inline-sentence ${
                        effectiveActiveSentenceId === sentence.id ? 'is-active' : ''
                      } ${resumeHighlightSentenceId === sentence.id ? 'is-resumed' : ''}`}
                      key={sentence.id}
                      ref={(node) => {
                        sentenceButtonRefs.current[sentence.id] = node
                      }}
                      type="button"
                      onClick={() => handleOpenSentence(sentence.id)}
                    >
                      {sentence.editedText || sentence.text}
                    </button>
                  ))}
                </p>
              ))}
            </div>
          )
        ) : (
          <div className="reading-result-list">
            {sentences.length === 0 ? (
              <div className="empty-state reading-empty">
                <p>先准备一个章节或手动草稿并启动解析，这里会自动显示阅读结果。</p>
              </div>
            ) : (
              sentences.map((sentence, index) => {
                const isExpanded = effectiveExpandedSentenceIds.has(sentence.id)

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
                      onClick={() => handleToggleSentence(sentence.id)}
                    >
                      <span className="reading-sentence-quote">{sentence.editedText || sentence.text}</span>
                      <span className="reading-sentence-toggle-hint">
                        {isExpanded ? '收起解释' : '点击展开解释'}
                      </span>
                    </button>

                    {isExpanded ? (
                      <SentenceDetailPanel
                        activeSelection={effectiveActiveSelection}
                        onOpenResources={onOpenResources}
                        onRemoveHighlight={onRemoveHighlight}
                        onSaveHighlight={onSaveHighlight}
                        onSelectHighlight={handleSelectHighlight}
                        result={results[sentence.id]}
                        savedHighlightSignatures={savedHighlightSignatures}
                        sentence={sentence}
                      />
                    ) : null}
                  </article>
                )
              })
            )}
          </div>
        )}
      </section>

      {isChapterMode && activeSentence ? (
        <div
          className={`reading-overlay ${inspectorMode === 'popover' ? 'is-popover' : 'is-sheet'}`}
          role="presentation"
          onClick={inspectorMode === 'popover' ? undefined : handleCloseSentence}
        >
          <section
            aria-label="句子解释"
            aria-modal="true"
            className={`reading-inspector ${
              inspectorMode === 'popover' ? 'is-popover' : 'is-sheet'
            } ${
              desktopPopoverPosition?.placement === 'top' ? 'is-above' : 'is-below'
            }`}
            role="dialog"
            ref={(node) => {
              inspectorRef.current = node
            }}
            style={
              inspectorMode === 'popover' && desktopPopoverPosition
                ? ({
                    left: desktopPopoverPosition.left,
                    maxHeight: desktopPopoverPosition.maxHeight,
                    top: desktopPopoverPosition.top,
                  } satisfies CSSProperties)
                : undefined
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div className="reading-inspector-header">
              <div>
                <p className="section-kicker">Sentence Note</p>
                <h3>句子解释</h3>
              </div>
              <button
                className={`ghost-button reading-resume-button ${
                  activeSentence.id === resumeAnchorSentenceId ? 'is-pinned' : ''
                }`}
                type="button"
                onClick={handleSetCurrentResumeAnchor}
              >
                {activeSentence.id === resumeAnchorSentenceId ? '📍 已记住位置' : '📍 标记到这里'}
              </button>
              <button
                className="ghost-button reading-inspector-close"
                type="button"
                onClick={handleCloseSentence}
              >
                关闭
              </button>
            </div>

            <div className="reading-inspector-meta">
              {activeSentenceIndex !== null ? <span>句子 #{activeSentenceIndex}</span> : null}
              <span className={`status-badge status-${activeSentence.status}`}>
                {statusLabelMap[activeSentence.status]}
              </span>
            </div>

            <p className="reading-inspector-sentence">
              {activeSentence.editedText || activeSentence.text}
            </p>

            <SentenceDetailPanel
              activeSelection={effectiveActiveSelection}
              onOpenResources={onOpenResources}
              onRemoveHighlight={onRemoveHighlight}
              onSaveHighlight={onSaveHighlight}
              onSelectHighlight={handleSelectHighlight}
              result={results[activeSentence.id]}
              savedHighlightSignatures={savedHighlightSignatures}
              sentence={activeSentence}
            />
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default ReadingPage
