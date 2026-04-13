import { statusLabelMap } from '../lib/appState'
import type { AnalysisResult, SentenceItem, SentenceRange, WorkspaceSource } from '../types'

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
  results: Record<string, AnalysisResult>
  sentenceIndices?: number[]
  sentenceStartIndex: number
  sentences: SentenceItem[]
  successCount: number
  workspaceSource: WorkspaceSource
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
  results,
  sentenceIndices,
  sentenceStartIndex,
  sentences,
  successCount,
  workspaceSource,
}: ReadingPageProps) {
  const isChapterMode = workspaceSource === 'chapter'

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
                        <p>{result.grammar || '模型未稳定返回语法说明。'}</p>
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
