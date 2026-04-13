import { chapterStatusLabelMap, formatTime } from '../lib/appState'
import type { BookChapterRecord, BookRecord } from '../types'

type LibraryPageProps = {
  books: BookRecord[]
  chapters: BookChapterRecord[]
  isImporting: boolean
  isLoading: boolean
  libraryError: string
  libraryNotice: string
  onDeleteBook: (bookId: string) => void
  onDeleteChapter: (chapterId: string) => void
  onImportFile: (file: File) => void | Promise<void>
  onOpenChapterReading: (chapterId: string) => void
  onOpenChapterWorkspace: (chapterId: string) => void
  onOpenRecentChapter: () => void
  onOpenResources: () => void
  onOpenManualWorkspace: () => void
  onOpenSettings: () => void
  recentChapterTitle?: string
  onSelectBook: (bookId: string) => void
  selectedBook: BookRecord | null
  selectedChapterId: string | null
}

function LibraryPage({
  books,
  chapters,
  isImporting,
  isLoading,
  libraryError,
  libraryNotice,
  onDeleteBook,
  onDeleteChapter,
  onImportFile,
  onOpenChapterReading,
  onOpenChapterWorkspace,
  onOpenRecentChapter,
  onOpenResources,
  onOpenManualWorkspace,
  onOpenSettings,
  recentChapterTitle,
  onSelectBook,
  selectedBook,
  selectedChapterId,
}: LibraryPageProps) {
  const hasRecentChapter = Boolean(selectedBook?.lastReadChapterId && recentChapterTitle)

  return (
    <>
      <header className="hero-panel library-hero">
        <div className="hero-copy">
          <div className="hero-topline">
            <p className="eyebrow">Spanish Reading Copilot</p>
            <div className="hero-actions">
              <button className="page-tab is-active" type="button">
                书架首页
              </button>
              <button className="page-tab" type="button" onClick={onOpenResources}>
                学习资源
              </button>
              <button className="ghost-button settings-button" type="button" onClick={onOpenSettings}>
                设置
              </button>
            </div>
          </div>

          <h1>把 EPUB 书架、章节解析和沉浸阅读放进同一个本地工作流。</h1>
          <p className="hero-description">
            导入西语 EPUB 后，应用会自动拆出章节、为每章生成逐句工作区，并把 AI 批注和阅读进度长期保存在当前浏览器。
          </p>

          <div className="library-hero-actions">
            <label className="primary-button file-trigger">
              {isImporting ? '导入中...' : '导入 EPUB 图书'}
              <input
                accept=".epub,application/epub+zip"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) {
                    return
                  }

                  void onImportFile(file)
                  event.currentTarget.value = ''
                }}
              />
            </label>
            <button className="ghost-button" type="button" onClick={onOpenManualWorkspace}>
              继续手动粘贴解析
            </button>
          </div>

          {libraryNotice ? <p className="notice success">{libraryNotice}</p> : null}
          {libraryError ? <p className="notice error">{libraryError}</p> : null}
        </div>

        <div className="hero-metrics library-metrics">
          <div className="metric-card">
            <span className="metric-label">书架藏书</span>
            <strong>{books.length}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">当前书籍</span>
            <strong>{selectedBook ? selectedBook.chapterCount : 0}</strong>
            <p>{selectedBook ? '章节' : '等待导入'}</p>
          </div>
          <button
            className={`metric-card metric-card-action ${hasRecentChapter ? 'is-clickable' : ''}`}
            type="button"
            onClick={onOpenRecentChapter}
            disabled={!hasRecentChapter}
          >
            <span className="metric-label">最近阅读</span>
            <strong>{selectedBook?.lastOpenedAt ? formatTime(selectedBook.lastOpenedAt) : '--'}</strong>
            <p>{recentChapterTitle ?? '还没有最近阅读章节'}</p>
          </button>
        </div>
      </header>

      <main className="library-grid">
        <section className="panel bookshelf-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Bookshelf</p>
              <h2>本地图书</h2>
            </div>
            <p className="panel-meta">导入后的书籍会只保存元数据、章节文本和解析结果，不会长期保留原始文件。</p>
          </div>

          {isLoading ? (
            <div className="empty-state">
              <p>正在载入本地书架...</p>
            </div>
          ) : books.length === 0 ? (
            <div className="empty-state">
              <p>书架还是空的。先导入一本 `epub`，或者继续使用手动粘贴模式。</p>
            </div>
          ) : (
            <div className="book-grid">
              {books.map((book) => (
                <article
                  className={`book-card ${selectedBook?.id === book.id ? 'is-active' : ''}`}
                  key={book.id}
                >
                  <button className="book-card-main" type="button" onClick={() => onSelectBook(book.id)}>
                    <div className="book-cover">
                      {book.coverUrl ? (
                        <img alt={`${book.title} 封面`} src={book.coverUrl} />
                      ) : (
                        <div className="book-cover-fallback">
                          <span>EPUB</span>
                        </div>
                      )}
                    </div>

                    <div className="book-card-copy">
                      <div className="book-card-header">
                        <h3>{book.title}</h3>
                        <span className="status-pill">{chapterStatusLabelMap[book.analysisState]}</span>
                      </div>
                      <p>{book.author}</p>
                      <div className="book-card-meta">
                        <span>{book.chapterCount} 章</span>
                        <span>导入于 {formatTime(book.importedAt)}</span>
                      </div>
                    </div>
                  </button>

                  <button className="ghost-button danger-button" type="button" onClick={() => onDeleteBook(book.id)}>
                    删除本书
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel chapter-panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Chapters</p>
              <h2>{selectedBook ? `《${selectedBook.title}》章节目录` : '章节目录'}</h2>
            </div>
          </div>

          {!selectedBook ? (
            <div className="empty-state compact">
              <p>从左侧选一本书，这里会显示章节列表和最近阅读入口。</p>
            </div>
          ) : chapters.length === 0 ? (
            <div className="empty-state compact">
              <p>这本书目前还没有可显示的章节。</p>
            </div>
          ) : (
            <div className="chapter-list">
              {chapters.map((chapter) => (
                <article
                  className={`chapter-card ${selectedChapterId === chapter.id ? 'is-active' : ''}`}
                  key={chapter.id}
                >
                  <div className="chapter-card-copy">
                    <div className="chapter-card-header">
                      <span className="sentence-index">#{chapter.order + 1}</span>
                      <span className="status-pill">{chapterStatusLabelMap[chapter.analysisState]}</span>
                    </div>
                    <h3>{chapter.title}</h3>
                    <p>{chapter.sentences.length} 句可解析</p>
                  </div>

                  <div className="chapter-card-actions">
                    <button className="secondary-button" type="button" onClick={() => onOpenChapterWorkspace(chapter.id)}>
                      打开工作区
                    </button>
                    <button className="ghost-button" type="button" onClick={() => onOpenChapterReading(chapter.id)}>
                      进入阅读
                    </button>
                    <button className="ghost-button danger-button" type="button" onClick={() => onDeleteChapter(chapter.id)}>
                      删除章节
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  )
}

export default LibraryPage
