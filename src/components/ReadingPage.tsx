import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { statusLabelMap } from '../lib/appState'
import { toUserFacingAnkiError } from '../lib/anki'
import { buildKnowledgeSignature, knowledgeKindLabelMap } from '../lib/knowledge'
import { resolveReadingResumeAnchor } from '../lib/readingAnchor'
import {
  buildChapterReadingParagraphs,
  type ChapterReadingParagraph,
} from '../lib/readingFlow'
import type {
  AnalysisHighlight,
  AnalysisResult,
  ChapterParagraphBlock,
  ReadingPreferences,
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
  onAddToAnki: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => Promise<void>
  onBackToWorkspace: () => void
  onOpenAdjacentChapter: (chapterId: string | null) => void
  onOpenResources: () => void
  onReadingPreferencesChange: <Key extends keyof ReadingPreferences>(
    key: Key,
    value: ReadingPreferences[Key],
  ) => void
  onRemoveHighlight: (signature: string) => void
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

type SentenceDetailPanelProps = {
  activeSelection: HighlightSelection | null
  onAddToAnki: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => Promise<void>
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

type InspectorMode = 'docked' | 'sheet'

type ChapterReadingPage = {
  id: string
  paragraphs: ChapterReadingParagraph[]
}

type ChapterPageLayout = {
  bodyHeight: number
  bodyWidth: number
}

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

type ReadingDisplaySettingsProps = {
  isOpen: boolean
  onClose: () => void
  onReadingPreferencesChange: <Key extends keyof ReadingPreferences>(
    key: Key,
    value: ReadingPreferences[Key],
  ) => void
  onToggle: () => void
  readingPreferences: ReadingPreferences
}

const DOCKED_READING_BREAKPOINT = 960
const CHAPTER_PAGE_GAP = 56
const READING_DESKTOP_BREAKPOINT = 960
const CHAPTER_PAGE_BOTTOM_SAFE_LINES = 1.2
const FALLBACK_CHAPTER_PAGE_LAYOUT: ChapterPageLayout = {
  bodyHeight: 0,
  bodyWidth: 0,
}

function getViewportSize() {
  if (typeof window === 'undefined') {
    return {
      width: 0,
      height: 0,
    }
  }

  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  }
}

function getInspectorMode(): InspectorMode {
  const { width } = getViewportSize()
  if (width <= DOCKED_READING_BREAKPOINT) {
    return 'sheet'
  }

  return 'docked'
}

function buildSelectionKey(sentenceId: string, highlightId: string) {
  return `${sentenceId}:${highlightId}`
}

function getSentenceDisplayText(sentence: SentenceItem) {
  return sentence.editedText || sentence.text
}

function normalizeSentenceText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function buildParagraphText(sentences: SentenceItem[]) {
  return sentences
    .map((sentence) => normalizeSentenceText(getSentenceDisplayText(sentence)))
    .filter(Boolean)
    .join(' ')
}

function estimateParagraphHeight(
  sentences: SentenceItem[],
  pageBodyWidth: number,
  fontSize: number,
) {
  const effectiveWidth = Math.max(260, pageBodyWidth)
  const charsPerLine = Math.max(18, Math.floor(effectiveWidth / Math.max(7.4, fontSize * 0.56)))
  const lineHeight = fontSize * 2
  const paragraphText = buildParagraphText(sentences)

  if (!paragraphText) {
    return lineHeight
  }

  const estimatedLineCount = Math.max(1, Math.ceil(paragraphText.length / charsPerLine))
  return Math.ceil(estimatedLineCount * lineHeight)
}

function measureParagraphHeight(
  measureContainer: HTMLDivElement,
  sentences: SentenceItem[],
  pageBodyWidth: number,
  fontSize: number,
) {
  measureContainer.style.width = `${Math.max(260, pageBodyWidth)}px`
  measureContainer.replaceChildren()

  const paragraph = document.createElement('p')
  paragraph.className = 'reading-paragraph reading-paragraph--measure'

  sentences.forEach((sentence, sentenceIndex) => {
    const sentenceButton = document.createElement('button')
    sentenceButton.className = 'reading-inline-sentence reading-inline-sentence--measure'
    sentenceButton.type = 'button'
    sentenceButton.tabIndex = -1
    sentenceButton.textContent = getSentenceDisplayText(sentence)
    paragraph.appendChild(sentenceButton)

    if (sentenceIndex < sentences.length - 1) {
      paragraph.appendChild(document.createTextNode(' '))
    }
  })

  measureContainer.appendChild(paragraph)
  const height = Math.ceil(paragraph.getBoundingClientRect().height)
  measureContainer.replaceChildren()

  return height || estimateParagraphHeight(sentences, pageBodyWidth, fontSize)
}

function paginateChapterParagraphs(
  paragraphs: ChapterReadingParagraph[],
  options: {
    fontSize: number
    measureContainer: HTMLDivElement | null
    pageLayout: ChapterPageLayout
    viewportHeight: number
    viewportWidth: number
  },
) {
  if (paragraphs.length === 0) {
    return [] as ChapterReadingPage[]
  }

  const pageBodyWidth =
    options.pageLayout.bodyWidth || Math.max(360, Math.round(options.viewportWidth - 52))
  const bottomSafeSpace = Math.max(18, Math.round(options.fontSize * CHAPTER_PAGE_BOTTOM_SAFE_LINES))
  const pageBodyHeight =
    Math.max(
      180,
      (options.pageLayout.bodyHeight ||
        Math.max(320, Math.round(options.viewportHeight - options.fontSize * 9.6))) -
        bottomSafeSpace,
    )
  const paragraphGap = Math.max(16, Math.round(options.fontSize * 1.1))
  const measuredHeightCache = new Map<string, number>()
  const pages: ChapterReadingPage[] = []
  let currentParagraphs: ChapterReadingParagraph[] = []
  let currentHeight = 0
  let pageIndex = 0

  const getParagraphHeight = (sentences: SentenceItem[]) => {
    const cacheKey = sentences.map((sentence) => sentence.id).join('|')
    const cachedHeight = measuredHeightCache.get(cacheKey)
    if (cachedHeight) {
      return cachedHeight
    }

    const measuredHeight = options.measureContainer
      ? measureParagraphHeight(
          options.measureContainer,
          sentences,
          pageBodyWidth,
          options.fontSize,
        )
      : estimateParagraphHeight(sentences, pageBodyWidth, options.fontSize)

    measuredHeightCache.set(cacheKey, measuredHeight)
    return measuredHeight
  }

  const pushPage = () => {
    if (currentParagraphs.length === 0) {
      return
    }

    pages.push({
      id: `reading-page-${pageIndex}`,
      paragraphs: currentParagraphs,
    })
    pageIndex += 1
    currentParagraphs = []
    currentHeight = 0
  }

  const pushParagraphChunk = (paragraphId: string, sentences: SentenceItem[]) => {
    const paragraphHeight = getParagraphHeight(sentences)
    const nextHeight =
      currentParagraphs.length === 0
        ? paragraphHeight
        : currentHeight + paragraphGap + paragraphHeight

    if (currentParagraphs.length > 0 && nextHeight > pageBodyHeight) {
      pushPage()
    }

    currentParagraphs = [
      ...currentParagraphs,
      {
        id: `${paragraphId}-${currentParagraphs.length}`,
        sentences,
      },
    ]
    currentHeight =
      currentParagraphs.length === 1 ? paragraphHeight : currentHeight + paragraphGap + paragraphHeight
  }

  paragraphs.forEach((paragraph) => {
    const paragraphHeight = getParagraphHeight(paragraph.sentences)

    if (paragraphHeight <= pageBodyHeight) {
      pushParagraphChunk(paragraph.id, paragraph.sentences)
      return
    }

    let chunk: SentenceItem[] = []
    let chunkHeight = 0

    paragraph.sentences.forEach((sentence) => {
      const nextChunk = [...chunk, sentence]
      const nextChunkHeight = getParagraphHeight(nextChunk)

      if (chunk.length > 0 && nextChunkHeight > pageBodyHeight) {
        pushParagraphChunk(paragraph.id, chunk)
        chunk = [sentence]
        chunkHeight = getParagraphHeight(chunk)
        return
      }

      chunk = nextChunk
      chunkHeight = nextChunkHeight
    })

    if (chunk.length > 0 && chunkHeight > 0) {
      pushParagraphChunk(paragraph.id, chunk)
    }
  })

  pushPage()
  return pages
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
  onAddToAnki,
  onOpenResources,
  onRemoveHighlight,
  onSaveHighlight,
  onSelectHighlight,
  result,
  savedHighlightSignatures,
  sentence,
}: SentenceDetailPanelProps) {
  const knowledgeDetailCardRef = useRef<HTMLDivElement | null>(null)
  const [ankiSubmitState, setAnkiSubmitState] = useState<{
    message: string
    selectionKey: string
    status: 'idle' | 'loading' | 'success' | 'error'
  }>({
    message: '',
    selectionKey: '',
    status: 'idle',
  })
  const highlights = result?.highlights ?? []
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
  const selectedHighlightKey = selectedHighlight
    ? buildSelectionKey(sentence.id, selectedHighlight.id)
    : ''
  const visibleAnkiStatus =
    ankiSubmitState.selectionKey === selectedHighlightKey ? ankiSubmitState.status : 'idle'
  const visibleAnkiMessage =
    ankiSubmitState.selectionKey === selectedHighlightKey ? ankiSubmitState.message : ''

  useEffect(() => {
    if (!selectedHighlight || !knowledgeDetailCardRef.current) {
      return
    }

    const detailCard = knowledgeDetailCardRef.current
    const scrollContainer = detailCard.closest('.reading-inspector')

    if (!(scrollContainer instanceof HTMLElement)) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      const detailRect = detailCard.getBoundingClientRect()
      const containerRect = scrollContainer.getBoundingClientRect()
      const scrollPadding = 16
      const isAboveViewport = detailRect.top < containerRect.top + scrollPadding
      const isBelowViewport = detailRect.bottom > containerRect.bottom - scrollPadding

      if (!isAboveViewport && !isBelowViewport) {
        return
      }

      const nextScrollTop = isAboveViewport
        ? scrollContainer.scrollTop + detailRect.top - containerRect.top - scrollPadding
        : scrollContainer.scrollTop + detailRect.bottom - containerRect.bottom + scrollPadding

      scrollContainer.scrollTo({
        top: Math.max(0, nextScrollTop),
        behavior: 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [selectedHighlight])

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

  const handleAddToAnki = async () => {
    if (!selectedHighlight || !selectedHighlightKey) {
      return
    }

    setAnkiSubmitState({
      message: '正在添加到 Anki...',
      selectionKey: selectedHighlightKey,
      status: 'loading',
    })

    try {
      await onAddToAnki(sentence, result, selectedHighlight)
      setAnkiSubmitState({
        message: `已将「${selectedHighlight.text}」添加到 Anki。`,
        selectionKey: selectedHighlightKey,
        status: 'success',
      })
    } catch (error) {
      setAnkiSubmitState({
        message: toUserFacingAnkiError(error),
        selectionKey: selectedHighlightKey,
        status: 'error',
      })
    }
  }

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
              <div className="knowledge-detail-card" ref={knowledgeDetailCardRef}>
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

                  <button
                    className="secondary-button"
                    type="button"
                    disabled={visibleAnkiStatus === 'loading'}
                    onClick={() => void handleAddToAnki()}
                  >
                    {visibleAnkiStatus === 'loading' ? '添加到 Anki 中...' : '添加到 Anki'}
                  </button>

                  <button className="ghost-button" type="button" onClick={onOpenResources}>
                    打开学习资源
                  </button>
                </div>

                {visibleAnkiStatus !== 'idle' ? (
                  <p className={`notice ${visibleAnkiStatus === 'success' ? 'success' : visibleAnkiStatus === 'error' ? 'error' : ''}`}>
                    {visibleAnkiMessage}
                  </p>
                ) : null}
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

function ReadingSettingsIcon() {
  return (
    <svg aria-hidden="true" className="reading-display-icon" viewBox="0 0 24 24">
      <path
        d="M4 7h10M18 7h2M4 17h3M11 17h9M14 7a2 2 0 1 0 0-4a2 2 0 0 0 0 4Zm-4 12a2 2 0 1 0 0-4a2 2 0 0 0 0 4Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function ReadingDisplaySettings({
  isOpen,
  onClose,
  onReadingPreferencesChange,
  onToggle,
  readingPreferences,
}: ReadingDisplaySettingsProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        panelRef.current &&
        event.target instanceof Node &&
        !panelRef.current.contains(event.target)
      ) {
        onClose()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen, onClose])

  return (
    <div className={`reading-display-settings ${isOpen ? 'is-open' : ''}`} ref={panelRef}>
      <button
        aria-expanded={isOpen}
        aria-label="阅读设置"
        className="ghost-button reading-display-trigger"
        type="button"
        onClick={onToggle}
      >
        <ReadingSettingsIcon />
        <span>阅读设置</span>
      </button>

      {isOpen ? (
        <section className="reading-display-popover" aria-label="阅读偏好">
          <div className="reading-display-popover-header">
            <div>
              <p className="section-kicker">Reader</p>
              <h3>版面与字号</h3>
            </div>
            <button className="ghost-button reading-display-close" type="button" onClick={onClose}>
              收起
            </button>
          </div>

          <label className="reading-display-field">
            <span>阅读容器宽度</span>
            <strong>{readingPreferences.contentWidth}px</strong>
            <input
              max="1180"
              min="720"
              step="20"
              type="range"
              value={readingPreferences.contentWidth}
              onChange={(event) =>
                onReadingPreferencesChange('contentWidth', Number(event.currentTarget.value))
              }
            />
          </label>

          <label className="reading-display-field">
            <span>文字大小</span>
            <strong>{readingPreferences.fontSize}px</strong>
            <input
              max="24"
              min="16"
              step="1"
              type="range"
              value={readingPreferences.fontSize}
              onChange={(event) =>
                onReadingPreferencesChange('fontSize', Number(event.currentTarget.value))
              }
            />
          </label>
        </section>
      ) : null}
    </div>
  )
}

function SentenceInspector({
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

      <p className="reading-inspector-sentence">
        {getSentenceDisplayText(activeSentence)}
      </p>

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

function ReadingPage({
  activeRange,
  contextTitle,
  globalError,
  onAddToAnki,
  onBackToWorkspace,
  onOpenResources,
  onReadingPreferencesChange,
  onRemoveHighlight,
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
  const sentenceButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
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
    if (!isChapterMode || !chapterBodyRef.current || typeof ResizeObserver === 'undefined') {
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
  }, [chapterPages, isChapterMode, resumeAnchorSentenceId])

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

  const visiblePageProgressCount = Math.min(chapterPageCount, 12)
  const visiblePageProgressActiveIndex =
    visiblePageProgressCount === chapterPageCount
      ? currentChapterPage
      : Math.round(
          (currentChapterPage / Math.max(1, chapterPageCount - 1)) *
            Math.max(0, visiblePageProgressCount - 1),
        )

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
              chapterParagraphs.length === 0 ? (
                <div className="empty-state reading-empty">
                  <p>这一段暂时还没有可供阅读的正文内容，请先回工作区完成解析。</p>
                </div>
              ) : (
                <div className="reading-page-stack">
                  <div className="reading-book-viewport">
                    <div className="reading-book-page">
                      <div className="reading-book-page-header">
                        <h2>{readingTitle}</h2>
                      </div>

                      <div className="reading-book-body" ref={chapterBodyRef}>
                        <div className="reading-flow is-paged">
                          {(currentChapterPageData?.paragraphs ?? []).map((paragraph: ChapterReadingParagraph) => (
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
                                  {getSentenceDisplayText(sentence)}
                                </button>
                              ))}
                            </p>
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
                            onClick={() => handleChangeChapterPage('previous')}
                          >
                            上一页
                          </button>
                          <button
                            className="ghost-button"
                            disabled={currentChapterPage >= chapterPageCount - 1}
                            type="button"
                            onClick={() => handleChangeChapterPage('next')}
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
            ) : (
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
                          onClose={() => setIsReadingSettingsOpen(false)}
                          onReadingPreferencesChange={onReadingPreferencesChange}
                          onToggle={() => setIsReadingSettingsOpen((current) => !current)}
                          readingPreferences={readingPreferences}
                        />
                        <button className="ghost-button" type="button" onClick={onOpenResources}>
                          学习资源
                        </button>
                        <button className="ghost-button" type="button" onClick={onBackToWorkspace}>
                          退出
                        </button>
                        <button className="ghost-button reading-toggle-all-button" type="button" onClick={handleToggleAllSentences}>
                          {areAllSentencesExpanded ? '全部收起' : '全部展开'}
                        </button>
                      </div>
                    </div>
                    {sentences.map((sentence, index) => {
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
                            onAddToAnki={onAddToAnki}
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
                    })}
                  </>
                )}
              </div>
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
              onOpenResources={onOpenResources}
              onRemoveHighlight={onRemoveHighlight}
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
              onOpenResources={onOpenResources}
              onRemoveHighlight={onRemoveHighlight}
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
