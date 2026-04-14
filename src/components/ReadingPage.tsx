import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { statusLabelMap } from '../lib/appState'
import { toUserFacingAnkiError } from '../lib/anki'
import { buildKnowledgeSignature, knowledgeKindLabelMap } from '../lib/knowledge'
import { resolveReadingResumeAnchor } from '../lib/readingAnchor'
import { buildChapterReadingParagraphs } from '../lib/readingFlow'
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
  notice: string
  onAddToAnki: (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => Promise<void>
  onBackToLibrary: () => void
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

function getViewportSize() {
  if (typeof window === 'undefined') {
    return {
      width: 0,
    }
  }

  return {
    width: window.visualViewport?.width ?? window.innerWidth,
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
  const [ankiSubmitState, setAnkiSubmitState] = useState<{
    message: string
    selectionKey: string
    status: 'idle' | 'loading' | 'success' | 'error'
  }>({
    message: '',
    selectionKey: '',
    status: 'idle',
  })

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
  const selectedHighlightKey = selectedHighlight
    ? buildSelectionKey(sentence.id, selectedHighlight.id)
    : ''
  const visibleAnkiStatus =
    ankiSubmitState.selectionKey === selectedHighlightKey ? ankiSubmitState.status : 'idle'
  const visibleAnkiMessage =
    ankiSubmitState.selectionKey === selectedHighlightKey ? ankiSubmitState.message : ''

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

                  <button
                    className="secondary-button"
                    type="button"
                    disabled={visibleAnkiStatus === 'loading'}
                    onClick={() => void handleAddToAnki()}
                  >
                    {visibleAnkiStatus === 'loading' ? '📥 添加到 Anki 中...' : '📥 添加到 Anki'}
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
          <p>点击左侧任意一句，解释会固定显示在这里，并和正文保持同一套宽度与字号节奏。</p>
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
            {isPinned ? '📌 已记住位置' : '📌'}
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
        {activeSentence.editedText || activeSentence.text}
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
  adjacentChapterIds,
  contextTitle,
  errorCount,
  globalError,
  notice,
  onAddToAnki,
  onBackToLibrary,
  onBackToWorkspace,
  onOpenAdjacentChapter,
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
  successCount,
  workspaceSource,
}: ReadingPageProps) {
  const isChapterMode = workspaceSource === 'chapter'
  const readingTitle = isChapterMode ? contextTitle?.chapterTitle ?? '章节阅读' : '沉浸阅读'
  const [activeSelection, setActiveSelection] = useState<HighlightSelection | null>(null)
  const [activeSentenceId, setActiveSentenceId] = useState<string | null>(null)
  const [expandedSentenceIds, setExpandedSentenceIds] = useState<Set<string>>(() => new Set())
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>(() => getInspectorMode())
  const [isReadingSettingsOpen, setIsReadingSettingsOpen] = useState(false)
  const [resumeHighlightSentenceId, setResumeHighlightSentenceId] = useState<string | null>(() => {
    const resolvedAnchor = resolveReadingResumeAnchor(sentences, resumeAnchor)
    return isChapterMode ? resolvedAnchor?.sentence.id ?? null : null
  })
  const readingShellRef = useRef<HTMLElement | null>(null)
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
  const [initialResumeTargetId] = useState(() => resumeAnchorSentenceId)
  const shouldDockInspector = isChapterMode && inspectorMode === 'docked'
  const readingShellStyle = useMemo(
    () =>
      ({
        '--reading-content-width': `${readingPreferences.contentWidth}px`,
        '--reading-body-font-size': `${readingPreferences.fontSize}px`,
        '--reading-panel-font-size': `${Math.max(16, readingPreferences.fontSize - 1)}px`,
        '--reading-inspector-width': `${Math.round(
          Math.min(420, Math.max(320, readingPreferences.contentWidth * 0.42)),
        )}px`,
      }) as CSSProperties,
    [readingPreferences.contentWidth, readingPreferences.fontSize],
  )

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

  return (
    <main className="reading-page">
      <section
        className={`reading-shell ${shouldDockInspector ? 'has-docked-inspector' : ''}`}
        ref={readingShellRef}
        style={readingShellStyle}
      >
        <header className="reading-header">
          <div className="reading-header-top">
            <div className="reading-header-copy">
              <p className="section-kicker">{isChapterMode ? 'Chapter Reading' : 'Draft Reading'}</p>
              <h2>{readingTitle}</h2>
              {contextTitle?.bookTitle ? <p className="reading-breadcrumb">{contextTitle.bookTitle}</p> : null}
            </div>
            <div className="panel-actions reading-header-actions">
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
              <button className="ghost-button" type="button" onClick={onBackToLibrary}>
                返回书架
              </button>
              <button className="ghost-button" type="button" onClick={onBackToWorkspace}>
                返回工作区
              </button>
            </div>
          </div>

          <div className="reading-header-bottom">
            <div className="reading-summary">
              {isChapterMode && activeRange ? <span>区间 {activeRange.start}-{activeRange.end}</span> : null}
              <span>已展示 {sentences.length}</span>
              <span>已完成 {successCount}</span>
              <span>失败 {errorCount}</span>
            </div>

            <div className="reading-secondary-actions">
              {isChapterMode ? (
                <>
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
                </>
              ) : null}

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
          </div>

          {notice ? <p className="notice success">{notice}</p> : null}
          {globalError ? <p className="notice error">{globalError}</p> : null}
        </header>

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
                  })
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
