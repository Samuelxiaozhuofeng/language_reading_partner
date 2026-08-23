import { useCallback, useEffect, useRef, useState } from 'react'
import { chapterStatusLabelMap, formatTime } from '../lib/appState'
import { detectEpubLanguage } from '../lib/epub'
import { languageLabel } from '../lib/languages'
import type { IpadicFeatures, Tokenizer } from 'kuromoji'
import { getTokenizer } from '../lib/kuromoji'
import type { BookChapterRecord, BookLanguage, BookRecord, CollectionRecord } from '../types'
import BookCard from './library/BookCard'
import ChapterNavigator from './library/ChapterNavigator'
import CollectionsBar from './library/CollectionsBar'
import ImportChooser from './library/ImportChooser'
import LibraryEmptyState from './library/LibraryEmptyState'

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
  onImportFile: (file: File, language: BookLanguage) => void | Promise<void>
  onMoveBookToCollection: (bookId: string, collectionId: string | null) => void | Promise<void>
  onOpenBook: (bookId: string) => void
  onOpenChapterReading: (chapterId: string) => void
  onOpenChapterWorkspace: (chapterId: string) => void
  onOpenRecentChapter: () => void
  onOpenManualWorkspace: () => void
  onOpenSettings: () => void
  recentChapterTitle?: string
  onSelectBook: (bookId: string) => void
  onSetActiveCollection: (collectionId: string | null) => void | Promise<void>
  selectedBook: BookRecord | null
  selectedChapterId: string | null
  totalBookCount: number
}

export default function LibraryPage({
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
  onOpenBook,
  onOpenChapterReading,
  onOpenChapterWorkspace,
  onOpenRecentChapter,
  onOpenManualWorkspace,
  onOpenSettings,
  recentChapterTitle,
  onSelectBook,
  onSetActiveCollection,
  selectedBook,
  selectedChapterId,
  totalBookCount,
}: LibraryPageProps) {
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const [detectedLanguage, setDetectedLanguage] = useState<BookLanguage | null>(null)
  const [selectedImportLanguage, setSelectedImportLanguage] = useState<BookLanguage>('es')
  const [showLanguageDialog, setShowLanguageDialog] = useState(false)
  const [japaneseTokenizerStatus, setJapaneseTokenizerStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle')
  const [japaneseTokenizerError, setJapaneseTokenizerError] = useState('')
  const languageDialogRef = useRef<HTMLDialogElement | null>(null)
  const japaneseTokenizerPromiseRef = useRef<Promise<Tokenizer<IpadicFeatures>> | null>(null)

  const hasRecentChapter = Boolean(selectedBook?.lastReadChapterId && recentChapterTitle)
  const selectedBookLastOpenedAt = selectedBook?.lastOpenedAt
    ? formatTime(selectedBook.lastOpenedAt)
    : '未开始阅读'
  const isPreparingJapaneseImport =
    selectedImportLanguage === 'ja' && japaneseTokenizerStatus === 'loading'
  const isSelectedBookSingleArticle = selectedBook
    ? selectedBook.sourceType === 'manual' ||
      selectedBook.chapterCount <= 1 ||
      chapters.length <= 1
    : false
  const showChapterPanel = Boolean(selectedBook && !isSelectedBookSingleArticle)

  const preloadJapaneseTokenizer = useCallback(async () => {
    setJapaneseTokenizerError('')
    setJapaneseTokenizerStatus('loading')

    try {
      japaneseTokenizerPromiseRef.current ??= getTokenizer()
      await japaneseTokenizerPromiseRef.current
      setJapaneseTokenizerStatus('ready')
    } catch (error) {
      japaneseTokenizerPromiseRef.current = null
      setJapaneseTokenizerStatus('error')
      setJapaneseTokenizerError(
        error instanceof Error ? error.message : '日语分词字典加载失败，请稍后重试。',
      )
    }
  }, [])

  useEffect(() => {
    const dialog = languageDialogRef.current
    if (!showLanguageDialog || !dialog || dialog.open) {
      return
    }

    dialog.showModal()
  }, [showLanguageDialog])

  useEffect(() => {
    if (showLanguageDialog && selectedImportLanguage === 'ja' && japaneseTokenizerStatus === 'idle') {
      void preloadJapaneseTokenizer()
    }
  }, [japaneseTokenizerStatus, preloadJapaneseTokenizer, selectedImportLanguage, showLanguageDialog])

  const handleFileSelected = async (file: File) => {
    setPendingImportFile(file)
    setDetectedLanguage(null)
    setSelectedImportLanguage('es')
    setJapaneseTokenizerStatus('idle')
    setJapaneseTokenizerError('')

    const detected = await detectEpubLanguage(file)
    setDetectedLanguage(detected)
    setSelectedImportLanguage(detected ?? 'es')
    setShowLanguageDialog(true)
    if (detected === 'ja') {
      void preloadJapaneseTokenizer()
    }
  }

  const handleCancelLanguageDialog = () => {
    setPendingImportFile(null)
    setDetectedLanguage(null)
    setSelectedImportLanguage('es')
    setJapaneseTokenizerStatus('idle')
    setJapaneseTokenizerError('')
    setShowLanguageDialog(false)
  }

  const handleConfirmLanguage = async () => {
    if (!pendingImportFile) {
      return
    }

    const file = pendingImportFile
    setShowLanguageDialog(false)
    setPendingImportFile(null)
    await onImportFile(file, selectedImportLanguage)
  }

  return (
    <>
      <header className="panel library-header">
        <div className="library-header-top">
          <div className="library-header-copy">
            <p className="eyebrow">Reading Copilot</p>
            <h1>阅读搭子</h1>
          </div>
          <div className="hero-actions">
            <ImportChooser
              isImporting={isImporting}
              manualWorkspaceLabel={manualWorkspaceLabel}
              onFileSelected={(file) => void handleFileSelected(file)}
              onOpenManualWorkspace={onOpenManualWorkspace}
            />
            {hasRecentChapter ? (
              <button className="ghost-button" type="button" onClick={onOpenRecentChapter}>
                继续最近阅读
              </button>
            ) : null}
            <button className="ghost-button settings-button" type="button" onClick={onOpenSettings}>
              设置
            </button>
          </div>
        </div>

        <div className="library-header-actions">
          <div className="library-status-strip" aria-label="书架概览">
            <span className="status-pill">{totalBookCount} 篇</span>
            {hasRecentChapter ? (
              <span className="status-pill">最近：{recentChapterTitle}</span>
            ) : null}
          </div>
        </div>

        {libraryNotice ? <p className="notice success">{libraryNotice}</p> : null}
        {libraryError ? <p className="notice error">{libraryError}</p> : null}
      </header>

      <main className={`library-grid${showChapterPanel ? '' : ' is-articles-only'}`}>
        <section className="panel bookshelf-panel">
          <div className="panel-header library-section-header">
            <div>
              <p className="section-kicker">Bookshelf</p>
              <h2>书架</h2>
            </div>
            <p className="panel-meta">点卡片阅读。未解析完的文章会继续分句和解析。</p>
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
              <p>正在载入书架...</p>
            </div>
          ) : books.length === 0 ? (
            activeCollectionId && totalBookCount > 0 ? (
              <div className="empty-state">
                <p>这个集合还没有书。可以从全部中把书移动进来。</p>
              </div>
            ) : (
              <LibraryEmptyState
                isImporting={isImporting}
                manualWorkspaceLabel={manualWorkspaceLabel}
                onFileSelected={(file) => void handleFileSelected(file)}
                onOpenManualWorkspace={onOpenManualWorkspace}
              />
            )
          ) : (
            <div className="book-grid">
              {books.map((book) => {
                const isSingleArticle =
                  book.sourceType === 'manual' ||
                  book.chapterCount <= 1 ||
                  (selectedBook?.id === book.id && chapters.length <= 1)

                return (
                  <BookCard
                    book={book}
                    collections={collections}
                    isSingleArticle={isSingleArticle}
                    isSelected={selectedBook?.id === book.id}
                    key={book.id}
                    onDeleteBook={onDeleteBook}
                    onMoveBookToCollection={onMoveBookToCollection}
                    onOpenBook={onOpenBook}
                    onSelectBook={onSelectBook}
                  />
                )
              })}
            </div>
          )}
        </section>

        {showChapterPanel && selectedBook ? (
          <section className="panel chapter-panel">
            <div className="panel-header library-section-header">
              <div>
                <p className="section-kicker">Chapters</p>
                <h2>章节目录</h2>
              </div>
            </div>

            {chapters.length === 0 ? (
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

                <ChapterNavigator
                  chapters={chapters}
                  key={selectedBook.id}
                  selectedChapterId={selectedChapterId}
                  onDeleteChapter={onDeleteChapter}
                  onOpenChapterReading={onOpenChapterReading}
                  onOpenChapterWorkspace={onOpenChapterWorkspace}
                />
              </>
            )}
          </section>
        ) : null}
      </main>

      {showLanguageDialog ? (
        <dialog ref={languageDialogRef} className="language-dialog" onCancel={handleCancelLanguageDialog}>
          <form method="dialog" className="language-dialog-card">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Language</p>
                <h2>选择导入语言</h2>
              </div>
            </div>
            <p className="panel-tip">
              {detectedLanguage
                ? `检测到 EPUB 语言为${languageLabel(detectedLanguage)}。`
                : '未能从 EPUB 元数据中识别语言，请手动选择。'}
            </p>
            <label className="field field-block">
              <span>解析语言</span>
              <select
                value={selectedImportLanguage}
                onChange={(event) => setSelectedImportLanguage(event.currentTarget.value as BookLanguage)}
              >
                <option value="es">西班牙语</option>
                <option value="ja">日本語</option>
                <option value="ar">阿拉伯语</option>
              </select>
            </label>
            {selectedImportLanguage === 'ja' ? (
              <p className={`notice ${japaneseTokenizerStatus === 'error' ? 'error' : ''}`}>
                {japaneseTokenizerStatus === 'loading'
                  ? '正在加载日语分词字典，首次加载可能需要几秒。'
                  : japaneseTokenizerStatus === 'ready'
                    ? '日语分词字典已就绪。'
                    : japaneseTokenizerStatus === 'error'
                      ? japaneseTokenizerError
                      : '确认导入前会加载日语分词字典。'}
              </p>
            ) : null}
            <div className="panel-actions">
              <button className="ghost-button" type="button" onClick={handleCancelLanguageDialog}>
                取消
              </button>
              <button
                className="primary-button"
                disabled={isImporting || isPreparingJapaneseImport}
                type="button"
                onClick={() => void handleConfirmLanguage()}
              >
                {isImporting ? '导入中...' : isPreparingJapaneseImport ? '准备日语字典...' : '确认导入'}
              </button>
            </div>
          </form>
        </dialog>
      ) : null}
    </>
  )
}
