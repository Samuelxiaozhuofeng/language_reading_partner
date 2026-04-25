import type {
  BookChapterRecord,
  BookRecord,
  CollectionRecord,
  LibrarySelection,
  SavedKnowledgeResource,
} from '../../types'
import { deriveBookAnalysisState, normalizeChapterRecord } from '../chapterText'
import { importEpubBook } from '../epub'
import { sortSavedResources } from '../knowledge'
import {
  clearLibraryDb,
  deleteBookCascade,
  deleteChapterCascade,
  deleteCollection,
  deleteKnowledgeResource,
  deleteKnowledgeResources,
  getBook,
  getBookFile,
  getBooks,
  getChapter,
  getChaptersByBook,
  getCollections,
  getSavedResourceBySignature,
  getSavedResources,
  saveBook,
  saveChapter,
  saveCollection,
  saveImportedBook,
  saveKnowledgeResource,
  updateBookCollection,
} from '../libraryDb'
import { createManualDraftBookPayload, type CreateManualDraftBookPayloadInput } from './manualDraft'

export type PersistChapterOptions = {
  markOpened?: boolean
}

export type RemoveChapterResult = {
  nextBook: BookRecord | null
  nextChapters: BookChapterRecord[]
  removedChapter: BookChapterRecord
}

export type HydratedBookState = {
  book: BookRecord
  chapters: BookChapterRecord[]
  selection: LibrarySelection
}

export async function hydrateBookState(
  bookId: string,
  preferredChapterId?: string | null,
): Promise<HydratedBookState | null> {
  const [nextBook, nextChaptersRaw] = await Promise.all([getBook(bookId), getChaptersByBook(bookId)])
  if (!nextBook) {
    return null
  }

  const nextChapters = nextChaptersRaw.map((chapter) => normalizeChapterRecord(chapter))
  return {
    book: nextBook,
    chapters: nextChapters,
    selection: {
      bookId,
      chapterId: preferredChapterId ?? nextBook.lastReadChapterId ?? nextChapters[0]?.id ?? null,
    },
  }
}

export async function loadInitialLibraryState() {
  const [books, collections, savedResources] = await Promise.all([
    getBooks(),
    getCollections(),
    getSavedResources(),
  ])
  const hydratedBook = books[0]
    ? await hydrateBookState(books[0].id, books[0].lastReadChapterId)
    : null

  return {
    books,
    collections,
    hydratedBook,
    savedResources: sortSavedResources(savedResources),
  }
}

export async function createCollectionInLibrary(name: string) {
  const collectionName = name.trim()

  if (!collectionName) {
    throw new Error('集合名称不能为空。')
  }

  const collection: CollectionRecord = {
    id: crypto.randomUUID(),
    name: collectionName,
    createdAt: Date.now(),
  }

  await saveCollection(collection)

  return {
    collection,
    collections: await getCollections(),
  }
}

export async function deleteCollectionFromLibrary(collectionId: string) {
  await deleteCollection(collectionId)

  return {
    books: await getBooks(),
    collections: await getCollections(),
  }
}

export async function moveBookToCollectionInLibrary(
  bookId: string,
  collectionId: string | null,
) {
  const book = await updateBookCollection(bookId, collectionId)

  if (!book) {
    throw new Error('书籍不存在，可能已经被删除。')
  }

  return {
    book,
    books: await getBooks(),
  }
}

export async function persistChapterRecord(
  chapter: BookChapterRecord,
  options?: PersistChapterOptions,
) {
  const timestamp = new Date().toISOString()
  const nextChapter = normalizeChapterRecord(chapter, {
    lastOpenedAt: options?.markOpened ? timestamp : chapter.lastOpenedAt,
  })

  await saveChapter(nextChapter)

  const nextChapters = (await getChaptersByBook(nextChapter.bookId)).map((item) =>
    normalizeChapterRecord(item),
  )
  const currentBook = await getBook(nextChapter.bookId)
  const nextBook = currentBook
    ? {
        ...currentBook,
        chapterCount: nextChapters.length,
        lastReadChapterId: nextChapter.id,
        lastOpenedAt: options?.markOpened ? timestamp : currentBook.lastOpenedAt,
        analysisState: deriveBookAnalysisState(nextChapters),
      }
    : null

  if (nextBook) {
    await saveBook(nextBook)
  }

  return {
    book: nextBook,
    chapter: nextChapter,
    chapters: nextChapters,
  }
}

export async function openChapterRecord(chapterId: string) {
  const chapterRecord = await getChapter(chapterId)
  if (!chapterRecord) {
    return null
  }

  const chapter = normalizeChapterRecord(chapterRecord)
  const hydratedBook = await hydrateBookState(chapter.bookId, chapterId)
  const persisted = await persistChapterRecord(chapter, { markOpened: true })

  return {
    chapter,
    hydratedBook,
    persisted,
  }
}

export async function importBookToLibrary(file: File) {
  const payload = await importEpubBook(file)
  const chapters = payload.chapters.map((chapter) => normalizeChapterRecord(chapter))
  await saveImportedBook(payload.book, chapters, payload.fileData)

  return {
    book: payload.book,
    chapters,
    currentChapter: chapters[0] ?? null,
    selection: {
      bookId: payload.book.id,
      chapterId: chapters[0]?.id ?? null,
    } satisfies LibrarySelection,
  }
}

export async function saveManualDraftToLibrary(input: CreateManualDraftBookPayloadInput) {
  const payload = createManualDraftBookPayload(input)
  await saveImportedBook(payload.book, payload.chapters)

  return {
    ...payload,
    currentChapter: payload.chapters[0] ?? null,
    selection: {
      bookId: payload.book.id,
      chapterId: payload.chapters[0]?.id ?? null,
    } satisfies LibrarySelection,
  }
}

export async function loadBookFile(bookId: string) {
  return getBookFile(bookId)
}

export async function removeBookFromLibrary(bookId: string) {
  await deleteBookCascade(bookId)
  return getBooks()
}

export async function removeChapterFromLibrary(chapterId: string): Promise<RemoveChapterResult | null> {
  const chapterRecord = await getChapter(chapterId)
  if (!chapterRecord) {
    return null
  }

  const removedChapter = normalizeChapterRecord(chapterRecord)
  await deleteChapterCascade(chapterId)

  const siblingChapters = (await getChaptersByBook(removedChapter.bookId)).map((chapter) =>
    normalizeChapterRecord(chapter),
  )
  const nextChapters = siblingChapters
    .map((chapter, index) =>
      normalizeChapterRecord(
        chapter.order === index
          ? chapter
          : {
              ...chapter,
              order: index,
            },
      ),
  )

  await Promise.all(
    nextChapters.map((chapter) =>
      siblingChapters.some(
        (currentChapter) =>
          currentChapter.id === chapter.id && currentChapter.order !== chapter.order,
      )
        ? saveChapter(chapter)
        : Promise.resolve(),
    ),
  )

  const currentBook = await getBook(removedChapter.bookId)
  const fallbackChapter =
    nextChapters[removedChapter.order] ?? nextChapters[removedChapter.order - 1] ?? null
  const nextBook = currentBook
    ? {
        ...currentBook,
        chapterCount: nextChapters.length,
        lastReadChapterId:
          currentBook.lastReadChapterId === chapterId
            ? fallbackChapter?.id
            : currentBook.lastReadChapterId,
        analysisState: deriveBookAnalysisState(nextChapters),
      }
    : null

  if (nextBook) {
    await saveBook(nextBook)
  }

  return {
    nextBook,
    nextChapters,
    removedChapter,
  }
}

export async function saveKnowledgeResourceToLibrary(resource: SavedKnowledgeResource) {
  const existing = await getSavedResourceBySignature(resource.signature)
  const nextResource = existing
    ? {
        ...existing,
        ...resource,
        id: existing.id,
      }
    : resource

  await saveKnowledgeResource(nextResource)
  return nextResource
}

export async function removeKnowledgeResourceFromLibrary(resourceId: string) {
  await deleteKnowledgeResource(resourceId)
}

export async function removeKnowledgeResourcesFromLibrary(resourceIds: string[]) {
  await deleteKnowledgeResources(resourceIds)
}

export async function clearLibraryStorage() {
  await clearLibraryDb()
}
