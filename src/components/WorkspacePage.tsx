import { formatTime } from '../lib/appState'
import { languageLabel, SUPPORTED_BOOK_LANGUAGES } from '../lib/languages'
import { isNativeAndroid } from '../lib/platform'
import type {
  ApiConfig,
  BookLanguage,
  BookRecord,
  RunSession,
  SentenceItem,
  SentenceRange,
  WorkspaceSource,
} from '../types'
import SentenceEditorPanel from './workspace/SentenceEditorPanel'

type WorkspacePageProps = {
  apiConfig: ApiConfig
  articleTitle: string
  bookLanguage: BookLanguage
  chapterProgressPercent: number
  chapterResolvedCount: number
  chapterSourceType?: BookRecord['sourceType']
  completedResultCount: number
  contextTitle?: {
    bookTitle: string
    chapterTitle: string
  }
  errorCount: number
  draftLanguage: BookLanguage
  finishedCount: number
  globalError: string
  history: RunSession[]
  isRunning: boolean
  isSavingToLibrary?: boolean
  libraryError?: string
  libraryNotice?: string
  notice: string
  onArticleTitleChange: (value: string) => void
  onBackToLibrary: () => void
  onCancelAnalysis: () => void
  onOpenReading: () => void
  onOpenSettings: () => void
  onRestoreSession: (session: RunSession) => void
  onRetrySentence: (sentenceId: string) => void
  onSelectNextRange: () => void
  onRunAnalysis: () => void
  onSegment: () => void
  onSentenceChange: (id: string, value: string) => void
  onDraftLanguageChange: (language: BookLanguage) => void
  onSourceTextChange: (value: string) => void
  onUpdateRange: (range: SentenceRange) => void
  rangeSize: number
  progressPercent: number
  progressTotal: number
  queuedCount: number
  readingDisabled: boolean
  runningCount: number
  selectedRange: SentenceRange | null
  sentences: SentenceItem[]
  sentenceStartIndex: number
  sourceText: string
  successCount: number
  totalSentenceCount: number
  workspaceSource: WorkspaceSource
}

function WorkspacePage({
  apiConfig,
  articleTitle,
  bookLanguage,
  chapterProgressPercent,
  chapterResolvedCount,
  chapterSourceType,
  completedResultCount,
  contextTitle,
  errorCount,
  draftLanguage,
  finishedCount,
  globalError,
  history,
  isRunning,
  isSavingToLibrary = false,
  libraryError,
  libraryNotice,
  notice,
  onArticleTitleChange,
  onBackToLibrary,
  onCancelAnalysis,
  onOpenReading,
  onOpenSettings,
  onRestoreSession,
  onRetrySentence,
  onSelectNextRange,
  onRunAnalysis,
  onSegment,
  onSentenceChange,
  onDraftLanguageChange,
  onSourceTextChange,
  onUpdateRange,
  rangeSize,
  progressPercent,
  progressTotal,
  queuedCount,
  readingDisabled,
  runningCount,
  selectedRange,
  sentences,
  sentenceStartIndex,
  sourceText,
  successCount,
  totalSentenceCount,
  workspaceSource,
}: WorkspacePageProps) {
  const isChapterMode = workspaceSource === 'chapter'
  const isEpubChapterMode = isChapterMode && chapterSourceType === 'epub'
  const currentSentenceCount = isChapterMode ? totalSentenceCount : sentences.length
  const effectiveConcurrency =
    bookLanguage === 'ja'
      ? apiConfig.languageOverrides?.ja?.concurrency ?? apiConfig.concurrency
      : apiConfig.concurrency
  const workspaceTitle = isChapterMode
    ? contextTitle?.chapterTitle ?? '解析'
    : articleTitle.trim() || '粘贴文章'

  return (
    <>
      <header className="panel workspace-header">
        <div className="workspace-header-top">
          <div className="workspace-header-copy">
            <p className="eyebrow">{isChapterMode ? 'Chapter Workspace' : 'Article Draft'}</p>
            <h1>{workspaceTitle}</h1>
          </div>
          <div className="hero-actions">
            <button className="page-tab" type="button" onClick={onBackToLibrary}>
              返回书架
            </button>
            <button
              className={readingDisabled ? 'ghost-button' : 'primary-button'}
              type="button"
              disabled={readingDisabled}
              onClick={onOpenReading}
            >
              阅读
            </button>
            <button className="ghost-button settings-button" type="button" onClick={onOpenSettings}>
              设置
            </button>
          </div>
        </div>

        <div className="workspace-status-strip">
          <span className="status-pill">模型 {apiConfig.model || '未设置'}</span>
          <span className="status-pill">并发 {effectiveConcurrency}</span>
          <span className="status-pill">{currentSentenceCount} 句</span>
          <span className="status-pill">{languageLabel(bookLanguage)}</span>
          <span className="status-pill">完成 {completedResultCount}</span>
          <span className="status-pill">失败 {errorCount}</span>
          {contextTitle?.bookTitle ? <span className="status-pill">{contextTitle.bookTitle}</span> : null}
          {isChapterMode && selectedRange ? (
            <span className="status-pill">区间 {selectedRange.start}-{selectedRange.end}</span>
          ) : null}
        </div>

        {notice ? <p className="notice success">{notice}</p> : null}
        {libraryNotice ? <p className="notice success">{libraryNotice}</p> : null}
        {globalError ? <p className="notice error">{globalError}</p> : null}
        {libraryError ? <p className="notice error">{libraryError}</p> : null}
      </header>

      <main className={`workspace-grid ${isChapterMode ? 'is-chapter-mode' : 'is-draft-mode'}`}>
        <section className="panel source-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">{isEpubChapterMode ? 'EPUB' : 'Text'}</p>
              <h2>{isEpubChapterMode ? '原生阅读模式' : isChapterMode ? '章节正文' : '原文'}</h2>
            </div>
            <div className="panel-actions">
              {!isEpubChapterMode && !isNativeAndroid() ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={onSegment}
                  disabled={!isChapterMode && isSavingToLibrary}
                >
                  {!isChapterMode && isSavingToLibrary ? '保存中...' : '分句'}
                </button>
              ) : null}
            </div>
          </div>

          {!isChapterMode ? (
            <div className="draft-meta-grid">
              <label className="field field-block">
                <span>文章标题</span>
                <input
                  type="text"
                  value={articleTitle}
                  onChange={(event) => onArticleTitleChange(event.target.value)}
                  placeholder="例如：El Sur / 第三章 / 本周阅读文章"
                />
              </label>
              <label className="field field-block">
                <span>解析语言</span>
                <select
                  value={draftLanguage}
                  onChange={(event) =>
                    onDraftLanguageChange(event.currentTarget.value as BookLanguage)
                  }
                >
                  {SUPPORTED_BOOK_LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {languageLabel(language)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {isEpubChapterMode ? (
            <div className="epub-workspace-summary">
              <p>
                这本书会在阅读页按 EPUB 原始章节样式渲染，不再把正文转换成可编辑文本。
              </p>
              <p>
                当前工作区只负责选择句子范围并触发 AI 解析；章节总句数仍会从正文中提取用于统计与分段。
              </p>
              <p className="panel-tip">
                当前章节文本长度约 {sourceText.trim().length} 字符，可解析句子 {totalSentenceCount} 条。
              </p>
            </div>
          ) : (
            <>
              <label className="field field-block">
                <span>{isChapterMode ? '章节工作文本' : '原文'}</span>
                <textarea
                  className="source-textarea"
                  value={sourceText}
                  onChange={(event) => onSourceTextChange(event.target.value)}
                  placeholder={
                    isChapterMode
                      ? '你可以在这里微调当前章节再分句...'
                      : '把整篇文章、章节或短篇故事粘贴到这里...'
                  }
                />
              </label>

              <p className="panel-tip">
                {isNativeAndroid()
                  ? '贴上原文，点开始阅读。点词即可查义。'
                  : isChapterMode
                  ? '修改正文后记得分句，当前区间会按新的文本重新解析。'
                  : '贴上原文，点分句，再点解析。'}
              </p>
            </>
          )}
        </section>

        <section className="panel analysis-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Analysis</p>
              <h2>解析与阅读</h2>
            </div>
            <p className="panel-meta">
              {isNativeAndroid()
                ? '贴上原文，点开始阅读。点词即可查义。'
                : isEpubChapterMode
                ? '正文保持 EPUB 原始样式，只解析你选中的句子区间。'
                : isChapterMode
                ? '只会重跑当前区间，并覆盖这一段已有结果。'
                : '贴上原文，点分句，再点解析。'}
            </p>
          </div>

          {isChapterMode && totalSentenceCount > 0 && !isNativeAndroid() ? (
            <div className="analysis-progress-card chapter-progress-card" aria-live="polite">
              <div className="analysis-progress-header">
                <div>
                  <p className="analysis-progress-label">章节解析进度</p>
                  <strong>
                    {chapterResolvedCount}/{totalSentenceCount} 句
                  </strong>
                </div>
                <span className="analysis-progress-percent">{chapterProgressPercent}%</span>
              </div>

              <div
                className="analysis-progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={totalSentenceCount}
                aria-valuenow={chapterResolvedCount}
                aria-valuetext={`已解析 ${chapterResolvedCount}/${totalSentenceCount} 句，${chapterProgressPercent}%`}
              >
                <div className="analysis-progress-fill" style={{ width: `${chapterProgressPercent}%` }} />
              </div>

              <div className="analysis-progress-meta">
                <span>已解析 {chapterResolvedCount}</span>
                <span>未解析 {Math.max(0, totalSentenceCount - chapterResolvedCount)}</span>
                <span>当前结果会累计保存到整章</span>
              </div>
            </div>
          ) : null}

          {isChapterMode && !isNativeAndroid() ? (
            <div className="range-card">
              <div className="range-card-header">
                <span>本章共 {totalSentenceCount} 句</span>
                <span>{selectedRange ? `当前区间 ${selectedRange.start}-${selectedRange.end}` : '先选择一个区间'}</span>
              </div>

              <div className="range-grid">
                <label className="field">
                  <span>起始句（从 0 开始）</span>
                  <input
                    type="number"
                    min={0}
                    max={Math.max(0, totalSentenceCount - 1)}
                    value={selectedRange?.start ?? 0}
                    onChange={(event) =>
                      onUpdateRange({
                        start: Number(event.target.value),
                        end: selectedRange?.end ?? Math.max(0, totalSentenceCount - 1),
                      })
                    }
                  />
                </label>

                <label className="field">
                  <span>结束句（从 0 开始）</span>
                  <input
                    type="number"
                    min={selectedRange?.start ?? 0}
                    max={Math.max(0, totalSentenceCount - 1)}
                    value={selectedRange?.end ?? Math.max(0, totalSentenceCount - 1)}
                    onChange={(event) =>
                      onUpdateRange({
                        start: selectedRange?.start ?? 0,
                        end: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </div>

              <div className="range-card-actions">
                <button className="secondary-button" type="button" onClick={onSelectNextRange}>
                  下一段 {rangeSize} 句
                </button>
                <span>选择新段时，默认视为前一段已经读完。</span>
              </div>
            </div>
          ) : null}

          <div className="analysis-actions">
            {!isNativeAndroid() ? (
              <button
                className="primary-button"
                type="button"
                onClick={isRunning ? onCancelAnalysis : onRunAnalysis}
              >
                {isRunning ? (isChapterMode ? '停止当前区间解析' : '停止当前解析') : isChapterMode ? '开始当前区间解析' : '开始解析'}
              </button>
            ) : null}
            <button
              className={readingDisabled && !isNativeAndroid() ? 'ghost-button' : 'primary-button'}
              type="button"
              disabled={isNativeAndroid() ? !sourceText.trim() && sentences.length === 0 : readingDisabled}
              onClick={onOpenReading}
            >
              {isNativeAndroid() ? '开始阅读' : isChapterMode ? '打开当前区间阅读' : '阅读'}
            </button>
          </div>

          {(isRunning || progressTotal > 0) && !isNativeAndroid() && (
            <div className="analysis-progress-card" aria-live="polite">
              <div className="analysis-progress-header">
                <div>
                  <p className="analysis-progress-label">
                    {isChapterMode ? (isRunning ? '当前区间解析进度' : '当前区间解析状态') : isRunning ? '解析进度' : '解析状态'}
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

        {!isEpubChapterMode && !isNativeAndroid() ? (
          <SentenceEditorPanel
            isChapterMode={isChapterMode}
            isRunning={isRunning}
            onRetrySentence={onRetrySentence}
            onSentenceChange={onSentenceChange}
            selectedRange={selectedRange}
            sentenceStartIndex={sentenceStartIndex}
            sentences={sentences}
          />
        ) : null}
        {!isChapterMode && !isNativeAndroid() ? (
          <aside className="panel history-panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Recent</p>
                <h2>最近记录</h2>
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
