import { formatTime, statusLabelMap } from '../lib/appState'
import type { ApiConfig, RunSession, SentenceItem, WorkspaceSource } from '../types'

type WorkspacePageProps = {
  apiConfig: ApiConfig
  completedResultCount: number
  contextTitle?: {
    bookTitle: string
    chapterTitle: string
  }
  errorCount: number
  finishedCount: number
  globalError: string
  history: RunSession[]
  isRunning: boolean
  notice: string
  onBackToLibrary: () => void
  onOpenReading: () => void
  onOpenSettings: () => void
  onOpenSettingsAi: () => void
  onRestoreSession: (session: RunSession) => void
  onRetrySentence: (sentenceId: string) => void
  onRunAnalysis: () => void
  onSegment: () => void
  onSentenceChange: (id: string, value: string) => void
  onSourceTextChange: (value: string) => void
  progressPercent: number
  progressTotal: number
  queuedCount: number
  readingDisabled: boolean
  runningCount: number
  sentences: SentenceItem[]
  sourceText: string
  successCount: number
  workspaceSource: WorkspaceSource
}

function WorkspacePage({
  apiConfig,
  completedResultCount,
  contextTitle,
  errorCount,
  finishedCount,
  globalError,
  history,
  isRunning,
  notice,
  onBackToLibrary,
  onOpenReading,
  onOpenSettings,
  onOpenSettingsAi,
  onRestoreSession,
  onRetrySentence,
  onRunAnalysis,
  onSegment,
  onSentenceChange,
  onSourceTextChange,
  progressPercent,
  progressTotal,
  queuedCount,
  readingDisabled,
  runningCount,
  sentences,
  sourceText,
  successCount,
  workspaceSource,
}: WorkspacePageProps) {
  const isChapterMode = workspaceSource === 'chapter'

  return (
    <>
      <header className="hero-panel workspace-hero">
        <div className="hero-copy">
          <div className="hero-topline">
            <p className="eyebrow">{isChapterMode ? 'Chapter Workspace' : 'Manual Draft'}</p>
            <div className="hero-actions">
              <button className="page-tab" type="button" onClick={onBackToLibrary}>
                返回书架
              </button>
              <button className="ghost-button settings-button" type="button" onClick={onOpenSettings}>
                设置
              </button>
            </div>
          </div>

          <h1>
            {isChapterMode ? contextTitle?.chapterTitle ?? '章节工作区' : '手动粘贴工作区'}
          </h1>
          <p className="hero-description">
            {isChapterMode
              ? `当前正在处理《${contextTitle?.bookTitle ?? '当前书籍'}》中的一个章节。你可以微调原文、重分句，并把 AI 解释持续写回本地书架。`
              : '这里保留原来的手动粘贴模式，适合临时导入片段、试 Prompt，或快速验证 API 配置。'}
          </p>

          <div className="settings-summary">
            <span>模型：{apiConfig.model || '未设置'}</span>
            <span>并发：{apiConfig.concurrency}</span>
            <span>结果：{completedResultCount} 句</span>
            {contextTitle?.bookTitle ? <span>书籍：{contextTitle.bookTitle}</span> : null}
          </div>
        </div>

        <div className="hero-metrics">
          <div className="metric-card">
            <span className="metric-label">当前句数</span>
            <strong>{sentences.length}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">成功</span>
            <strong>{successCount}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">失败</span>
            <strong>{errorCount}</strong>
          </div>
        </div>
      </header>

      <main className="workspace-grid">
        <section className="panel source-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Step 1</p>
              <h2>{isChapterMode ? '章节正文与重新分句' : '粘贴内容并分句'}</h2>
            </div>
            <div className="panel-actions">
              <button className="ghost-button" type="button" onClick={onOpenSettingsAi}>
                打开设置
              </button>
              <button className="secondary-button" type="button" onClick={onSegment}>
                重新分句
              </button>
            </div>
          </div>

          <label className="field field-block">
            <span>{isChapterMode ? '章节工作文本' : '原文'}</span>
            <textarea
              className="source-textarea"
              value={sourceText}
              onChange={(event) => onSourceTextChange(event.target.value)}
              placeholder={isChapterMode ? '你可以在这里微调当前章节再重新分句...' : '把一整章西语内容粘贴到这里...'}
            />
          </label>

          <div className="status-strip">
            <span>{sentences.length} 句</span>
            <span>{runningCount} 句解析中</span>
            <span>{errorCount} 句待重试</span>
          </div>

          {notice ? <p className="notice success">{notice}</p> : null}
          {globalError ? <p className="notice error">{globalError}</p> : null}
        </section>

        <section className="panel analysis-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Step 2</p>
              <h2>启动解析并进入阅读</h2>
            </div>
            <p className="panel-meta">
              {isChapterMode
                ? '章节模式会默认跳过已经成功的句子，只补齐未完成的批注。'
                : '手动草稿模式会重新跑整段文本，并在本地历史里保存最近结果。'}
            </p>
          </div>

          <div className="analysis-actions">
            <button className="primary-button" type="button" onClick={onRunAnalysis} disabled={isRunning}>
              {isRunning ? '解析中...' : '开始整章解析'}
            </button>
            <button className="ghost-button" type="button" disabled={readingDisabled} onClick={onOpenReading}>
              打开沉浸阅读页
            </button>
          </div>

          {(isRunning || progressTotal > 0) && (
            <div className="analysis-progress-card" aria-live="polite">
              <div className="analysis-progress-header">
                <div>
                  <p className="analysis-progress-label">
                    {isRunning ? '整章解析进度' : '当前章节解析状态'}
                  </p>
                  <strong>
                    {finishedCount}/{progressTotal || 0} 句
                  </strong>
                </div>
                <span className="analysis-progress-percent">{progressPercent}%</span>
              </div>

              <div
                className="analysis-progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progressTotal || 1}
                aria-valuenow={finishedCount}
                aria-valuetext={`${finishedCount}/${progressTotal || 0} 句，${progressPercent}%`}
              >
                <div className="analysis-progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>

              <div className="analysis-progress-meta">
                <span>成功 {successCount}</span>
                <span>失败 {errorCount}</span>
                <span>处理中 {runningCount + queuedCount}</span>
              </div>
            </div>
          )}
        </section>

        <section className="panel editor-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Step 3</p>
              <h2>逐句校对</h2>
            </div>
            <p className="panel-meta">你可以直接改每一句，AI 会以编辑后的内容为准。</p>
          </div>

          <div className="sentence-list">
            {sentences.length === 0 ? (
              <div className="empty-state">
                <p>{isChapterMode ? '这个章节目前还没有可解析的句子。' : '先粘贴一段西语并点击“重新分句”，这里就会出现可编辑句子。'}</p>
              </div>
            ) : (
              sentences.map((sentence, index) => (
                <article className="sentence-card" key={sentence.id}>
                  <div className="sentence-card-header">
                    <span className="sentence-index">#{index + 1}</span>
                    <span className={`status-badge status-${sentence.status}`}>
                      {statusLabelMap[sentence.status]}
                    </span>
                  </div>

                  <textarea
                    className="sentence-textarea"
                    value={sentence.editedText}
                    onChange={(event) => onSentenceChange(sentence.id, event.target.value)}
                    placeholder="句子内容"
                  />

                  {sentence.error ? <p className="sentence-error">{sentence.error}</p> : null}

                  <div className="sentence-actions">
                    <span>{sentence.editedText.trim().length} 字符</span>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onRetrySentence(sentence.id)}
                      disabled={isRunning || !sentence.editedText.trim()}
                    >
                      重试本句
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {!isChapterMode ? (
          <aside className="panel history-panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Recent</p>
                <h2>本地历史</h2>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="empty-state compact">
                <p>完成一次解析后，这里会保留最近几次记录。</p>
              </div>
            ) : (
              <div className="history-list">
                {history.map((session) => (
                  <button
                    className="history-card"
                    key={session.id}
                    type="button"
                    onClick={() => onRestoreSession(session)}
                  >
                    <strong>{session.title}</strong>
                    <span>{formatTime(session.createdAt)}</span>
                    <span>{session.sentences.length} 句</span>
                  </button>
                ))}
              </div>
            )}
          </aside>
        ) : null}
      </main>
    </>
  )
}

export default WorkspacePage
