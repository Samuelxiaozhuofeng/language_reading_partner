import type { BookChapterRecord, BookRecord } from '../../types'

export function updateBookInList(books: BookRecord[], nextBook: BookRecord) {
  const hasMatch = books.some((book) => book.id === nextBook.id)

  return (hasMatch ? books.map((book) => (book.id === nextBook.id ? nextBook : book)) : books.concat(nextBook))
    .sort((left, right) => {
      const leftTime = left.lastOpenedAt ?? left.importedAt
      const rightTime = right.lastOpenedAt ?? right.importedAt
      return rightTime.localeCompare(leftTime)
    })
}

export function getAdjacentChapterIds(
  chapters: BookChapterRecord[],
  currentChapterId: string | null,
) {
  if (!currentChapterId) {
    return { previousId: null, nextId: null }
  }

  const index = chapters.findIndex((chapter) => chapter.id === currentChapterId)
  return {
    previousId: chapters[index - 1]?.id ?? null,
    nextId: chapters[index + 1]?.id ?? null,
  }
}

export function resolveNextCurrentChapterAfterRemoval(
  nextChapters: BookChapterRecord[],
  currentChapter: BookChapterRecord | null,
  removedChapter: BookChapterRecord,
) {
  if (!currentChapter || currentChapter.bookId !== removedChapter.bookId) {
    return currentChapter
  }

  return (
    nextChapters.find((chapter) => chapter.id === currentChapter.id) ??
    nextChapters[removedChapter.order] ??
    nextChapters[removedChapter.order - 1] ??
    null
  )
}

export function resolveNextSelectedChapterIdAfterRemoval(
  nextChapters: BookChapterRecord[],
  selectedChapterId: string | null,
  removedChapterId: string,
  removedOrder: number,
) {
  if (selectedChapterId !== removedChapterId) {
    return selectedChapterId
  }

  return nextChapters[removedOrder]?.id ?? nextChapters[removedOrder - 1]?.id ?? null
}
