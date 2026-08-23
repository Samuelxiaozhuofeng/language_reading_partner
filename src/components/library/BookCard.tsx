import { chapterStatusLabelMap, formatTime } from '../../lib/appState'
import { languageLabel } from '../../lib/languages'
import { isNativeAndroid } from '../../lib/platform'
import type { BookRecord, CollectionRecord } from '../../types'

type BookCardProps = {
  book: BookRecord
  collections: CollectionRecord[]
  isSelected: boolean
  isSingleArticle: boolean
  onDeleteBook: (bookId: string) => void
  onMoveBookToCollection: (bookId: string, collectionId: string | null) => void | Promise<void>
  onOpenBook: (bookId: string) => void
  onSelectBook: (bookId: string) => void
}

export default function BookCard({
  book,
  collections,
  isSelected,
  isSingleArticle,
  onDeleteBook,
  onMoveBookToCollection,
  onOpenBook,
  onSelectBook,
}: BookCardProps) {
  const isAnalyzed = book.analysisState === 'analyzed'
  const isManual = book.sourceType === 'manual'
  const currentLanguageLabel = languageLabel(book.language)

  const handleCardClick = () => {
    if (isSingleArticle) {
      onOpenBook(book.id)
    } else {
      onSelectBook(book.id)
    }
  }

  const handleDelete = () => {
    if (window.confirm(`确定删除「${book.title}」？删除后无法恢复。`)) {
      onDeleteBook(book.id)
    }
  }

  return (
    <article className={`book-card ${isSelected ? 'is-active' : ''}`}>
      <button className="book-card-main" type="button" onClick={handleCardClick}>
        <div className="book-cover">
          {book.coverUrl ? (
            <img alt={`${book.title} 封面`} src={book.coverUrl} />
          ) : (
            <div className="book-cover-fallback">
              <span>{isManual ? 'TEXT' : 'EPUB'}</span>
            </div>
          )}
        </div>

        <div className="book-card-copy">
          <div className="book-card-header">
            <div className="book-card-title">
              <h3>{book.title}</h3>
              {book.author ? <p>{book.author}</p> : null}
            </div>
            <span className="status-pill">{chapterStatusLabelMap[book.analysisState]}</span>
          </div>

          <div className="book-card-meta">
            {!isManual ? <span>{book.chapterCount} 章</span> : null}
            {!isManual ? <span>EPUB 导入</span> : null}
            <span>{currentLanguageLabel}</span>
            <span>导入于 {formatTime(book.importedAt)}</span>
          </div>
        </div>
      </button>

      <div className="book-card-actions">
        {isSingleArticle ? (
          <button
            className={
              isAnalyzed || isNativeAndroid()
                ? 'primary-button book-action-button'
                : 'secondary-button book-action-button'
            }
            type="button"
            onClick={() => onOpenBook(book.id)}
          >
            {isAnalyzed || isNativeAndroid() ? '阅读' : '解析'}
          </button>
        ) : (
          <button
            className="secondary-button book-action-button"
            type="button"
            onClick={() => onSelectBook(book.id)}
          >
            {isSelected ? '查看中' : '目录'}
          </button>
        )}

        <div className="book-card-sub-actions">
          {collections.length > 0 ? (
            <label className="book-collection-control">
              <span>集合</span>
              <select
                className="book-collection-select"
                value={book.collectionId ?? ''}
                onClick={(event) => event.stopPropagation()}
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
          ) : null}

          <button
            className="quiet-delete-button"
            type="button"
            onClick={handleDelete}
          >
            删除
          </button>
        </div>
      </div>
    </article>
  )
}
