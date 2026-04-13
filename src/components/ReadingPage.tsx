import { useState } from 'react'
import type { ReactNode } from 'react'
import { buildKnowledgeSignature, knowledgeKindLabelMap } from '../lib/knowledge'
import { statusLabelMap } from '../lib/appState'
import type {
  AnalysisHighlight,
  AnalysisResult,
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
  results: Record<string, AnalysisResult>
  savedHighlightSignatures: Set<string>
  sentenceIndices?: number[]
  sentenceStartIndex: number
  sentences: SentenceItem[]
  successCount: number
  workspaceSource: WorkspaceSource
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
  results,
  savedHighlightSignatures,
  sentenceIndices,
  sentenceStartIndex,
  sentences,
  successCount,
  workspaceSource,
}: ReadingPageProps) {
  const isChapterMode = workspaceSource === 'chapter'
  const [activeSelection, setActiveSelection] = useState<HighlightSelection | null>(null)

  const handleSelectHighlight = (sentenceId: string, highlightId: string) => {
    setActiveSelection((current) =>
      current?.sentenceId === sentenceId && current.highlightId === highlightId
        ? null
        : { sentenceId, highlightId },
    )
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
              ? `这里会只展示当前阅读段 ${activeRange.start}-${activeRange.end} 中已经解析完成的句子，方便你按段推进。`
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

        <div className="reading-result-list">
          {sentences.length === 0 ? (
            <div className="empty-state reading-empty">
              <p>先准备一个章节或手动草稿并启动解析，这里会自动显示阅读结果。</p>
            </div>
          ) : (
            sentences.map((sentence, index) => {
              const result = results[sentence.id]
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

              return (
                <article className="result-card reading-result-card" key={sentence.id}>
                  <div className="result-card-header">
                    <span className="sentence-index">
                      #{isChapterMode ? sentenceIndices?.[index] ?? sentenceStartIndex + index : index + 1}
                    </span>
                    <span className={`status-badge status-${sentence.status}`}>
                      {statusLabelMap[sentence.status]}
                    </span>
                  </div>

                  <blockquote>{sentence.editedText || sentence.text}</blockquote>

                  {result ? (
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
                                (highlightId) => handleSelectHighlight(sentence.id, highlightId),
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
                                    onClick={() => handleSelectHighlight(sentence.id, highlight.id)}
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
                  ) : (
                    <div className="result-placeholder">
                      <p>
                        {sentence.status === 'error'
                          ? '这句解析失败了，请回工作区重试本句。'
                          : sentence.status === 'running' || sentence.status === 'queued'
                            ? 'AI 正在处理中...'
                            : '这句还没有开始解析。'}
                      </p>
                    </div>
                  )}
                </article>
              )
            })
          )}
        </div>
      </section>
    </main>
  )
}

export default ReadingPage
