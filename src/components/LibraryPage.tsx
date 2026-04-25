import { chapterStatusLabelMap, formatTime } from '../lib/appState'
import type { BookChapterRecord, BookRecord, CollectionRecord } from '../types'
import CollectionsBar from './library/CollectionsBar'

type LibraryPageProps = {
  activeCollectionId: string | null
  books: BookRecord[]
  chapters: BookChapterRecord[]
  collectionBookCounts: Record<string, number>
  collections: CollectionRecord[]
  isImporting: boolean
  isLoading: boolean
  libraryError: string
  libraryNotice: string
  manualWorkspaceLabel: string
  onCreateCollection: (name: string) => void | Promise<void>
  onDeleteBook: (bookId: string) => void
  onDeleteChapter: (chapterId: string) => void
  onDeleteCollection: (collectionId: string) => void | Promise<void>
  onImportFile: (file: File) => void | Promise<void>
  onMoveBookToCollection: (bookId: string, collectionId: string | null) => void | Promise<void>
  onOpenChapterReading: (chapterId: string) => void
  onOpenChapterWorkspace: (chapterId: string) => void
  onOpenRecentChapter: () => void
  onOpenResources: () => void
  onOpenManualWorkspace: () => void
  onOpenSettings: () => void
  recentChapterTitle?: string
  onSelectBook: (bookId: string) => void
  onSetActiveCollection: (collectionId: string | null) => void | Promise<void>
  selectedBook: BookRecord | null
  selectedChapterId: string | null
  totalBookCount: number
}

function LibraryPage({
  activeCollectionId,
  books,
  chapters,
  collectionBookCounts,
  collections,
  isImporting,
  isLoading,
  libraryError,
  libraryNotice,
  manualWorkspaceLabel,
  onCreateCollection,
  onDeleteBook,
  onDeleteChapter,
  onDeleteCollection,
  onImportFile,
  onMoveBookToCollection,
  onOpenChapterReading,
  onOpenChapterWorkspace,
  onOpenRecentChapter,
  onOpenResources,
  onOpenManualWorkspace,
  onOpenSettings,
  recentChapterTitle,
  onSelectBook,
  onSetActiveCollection,
  selectedBook,
  selectedChapterId,
  totalBookCount,
}: LibraryPageProps) {
  const hasRecentChapter = Boolean(selectedBook?.lastReadChapterId && recentChapterTitle)
  const totalChapterCount = books.reduce((sum, book) => sum + book.chapterCount, 0)
  const activeCollectionName = activeCollectionId
    ? collections.find((collection) => collection.id === activeCollectionId)?.name
    : null
  const selectedBookLastOpenedAt = selectedBook?.lastOpenedAt
    ? formatTime(selectedBook.lastOpenedAt)
    : '未开始阅读'

  return (
    <>
      <header className="panel library-header">
        <div className="library-header-top">
          <div className="library-header-copy">
            <p className="eyebrow">Spanish Reading Copilot</p>
            <h1>阅读搭子</h1>
          </div>
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

        <div className="library-header-actions">
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
              {manualWorkspaceLabel}
            </button>
            {hasRecentChapter ? (
              <button className="ghost-button" type="button" onClick={onOpenRecentChapter}>
                继续最近阅读
              </button>
            ) : null}
          </div>
          <div className="library-status-strip" aria-label="书架概览">
            <span className="status-pill">
              {activeCollectionName ? `${activeCollectionName}：${books.length} 本书` : `${totalBookCount} 本书`}
            </span>
            <span className="status-pill">{totalChapterCount} 个章节</span>
            <span className="status-pill">
              {selectedBook ? `当前：${selectedBook.title}` : '还没有选中的书'}
            </span>
          </div>
        </div>

        {libraryNotice ? <p className="notice success">{libraryNotice}</p> : null}
        {libraryError ? <p className="notice error">{libraryError}</p> : null}
      </header>

      <main className="library-grid">
        <section className="panel bookshelf-panel">
          <div className="panel-header library-section-header">
            <div>
              <p className="section-kicker">Bookshelf</p>
              <h2>书架</h2>
            </div>
            <p className="panel-meta">只保存元数据、章节文本和解析结果。</p>
          </div>

          <CollectionsBar
            activeCollectionId={activeCollectionId}
            collectionBookCounts={collectionBookCounts}
            collections={collections}
            onCreateCollection={onCreateCollection}
            onDeleteCollection={onDeleteCollection}
            onSetActiveCollection={onSetActiveCollection}
            totalBookCount={totalBookCount}
          />

          {isLoading ? (
            <div className="empty-state">
              <p>正在载入本地书架...</p>
            </div>
          ) : books.length === 0 ? (
            <div className="empty-state">
              <p>
                {activeCollectionId && totalBookCount > 0
                  ? '这个集合还没有书。可以从全部中把书移动进来。'
                  : '书架还是空的。先导入一本 EPUB，或者粘贴一篇文章开始解析。'}
              </p>
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
                          <span>{book.sourceType === 'manual' ? 'TEXT' : 'EPUB'}</span>
                        </div>
                      )}
                    </div>

                    <div className="book-card-copy">
                      <div className="book-card-header">
                        <div className="book-card-title">
                          <h3>{book.title}</h3>
                          <p>{book.author}</p>
                        </div>
                        <span className="status-pill">{chapterStatusLabelMap[book.analysisState]}</span>
                      </div>
                      <div className="book-card-meta">
                        <span>{book.chapterCount} 章</span>
                        <span>{book.sourceType === 'manual' ? '手动保存' : 'EPUB 导入'}</span>
                        <span>导入于 {formatTime(book.importedAt)}</span>
                      </div>
                    </div>
                  </button>

                  <div className="book-card-actions">
                    <span className="book-card-hint">
                      {selectedBook?.id === book.id ? '当前查看中' : '点击查看章节'}
                    </span>
                    <label className="book-collection-control">
                      <span>集合</span>
                      <select
                        className="book-collection-select"
                        value={book.collectionId ?? ''}
                        onChange={(event) =>
                          void onMoveBookToCollection(book.id, event.target.value || null)
                        }
                      >
                        <option value="">全部</option>
                        {collections.map((collection) => (
                          <option key={collection.id} value={collection.id}>
                            {collection.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="ghost-button danger-button" type="button" onClick={() => onDeleteBook(book.id)}>
                      删除本书
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel chapter-panel">
          <div className="panel-header library-section-header">
            <div>
              <p className="section-kicker">Chapters</p>
              <h2>{selectedBook ? '章节' : '章节目录'}</h2>
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
            <>
              <div className="chapter-summary">
                <div className="chapter-summary-copy">
                  <h3>{selectedBook.title}</h3>
                  <p>{selectedBook.author}</p>
                </div>
                <div className="chapter-summary-meta">
                  <span className="status-pill">{selectedBook.chapterCount} 章</span>
                  <span className="status-pill">{chapterStatusLabelMap[selectedBook.analysisState]}</span>
                  <span className="status-pill">最近打开 {selectedBookLastOpenedAt}</span>
                </div>
              </div>

              <div className="chapter-list">
                {chapters.map((chapter) => (
                  <article
                    className={`chapter-card ${selectedChapterId === chapter.id ? 'is-active' : ''}`}
                    key={chapter.id}
                  >
                    <div className="chapter-card-copy">
                      <div className="chapter-card-header">
                        <span className="sentence-index">第 {chapter.order + 1} 章</span>
                        <span className="status-pill">{chapterStatusLabelMap[chapter.analysisState]}</span>
                      </div>
                      <h3>{chapter.title}</h3>
                      <div className="chapter-card-meta">
                        <span>{chapter.sentences.length} 句可解析</span>
                        {chapter.lastOpenedAt ? <span>最近打开 {formatTime(chapter.lastOpenedAt)}</span> : null}
                      </div>
                    </div>

                    <div className="chapter-card-actions">
                      <button className="secondary-button" type="button" onClick={() => onOpenChapterWorkspace(chapter.id)}>
                        工作区
                      </button>
                      <button className="ghost-button" type="button" onClick={() => onOpenChapterReading(chapter.id)}>
                        阅读
                      </button>
                      <button className="ghost-button danger-button" type="button" onClick={() => onDeleteChapter(chapter.id)}>
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </>
  )
}

export default LibraryPage
