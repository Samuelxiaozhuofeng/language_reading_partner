import type {
  BookChapterRecord,
  BookLanguage,
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
} from './remoteRepository'
import {
  hasLegacyLocalLibraryData,
  loadLegacyLocalLibrarySnapshot,
} from './localMigration'
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
  userId: string,
  bookId: string,
  preferredChapterId?: string | null,
): Promise<HydratedBookState | null> {
  const [nextBook, nextChaptersRaw] = await Promise.all([
    getBook(userId, bookId),
    getChaptersByBook(userId, bookId),
  ])
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

export async function loadInitialLibraryState(userId: string) {
  const [books, collections, savedResources] = await Promise.all([
    getBooks(userId),
    getCollections(userId),
    getSavedResources(userId),
  ])
  const hydratedBook = books[0]
    ? await hydrateBookState(userId, books[0].id, books[0].lastReadChapterId)
    : null

  return {
    books,
    collections,
    hydratedBook,
    savedResources: sortSavedResources(savedResources),
  }
}

export async function createCollectionInLibrary(userId: string, name: string) {
  const collectionName = name.trim()

  if (!collectionName) {
    throw new Error('集合名称不能为空。')
  }

  const collection: CollectionRecord = {
    id: crypto.randomUUID(),
    name: collectionName,
    createdAt: Date.now(),
  }

  await saveCollection(userId, collection)

  return {
    collection,
    collections: await getCollections(userId),
  }
}

export async function deleteCollectionFromLibrary(userId: string, collectionId: string) {
  await deleteCollection(userId, collectionId)

  return {
    books: await getBooks(userId),
    collections: await getCollections(userId),
  }
}

export async function moveBookToCollectionInLibrary(
  userId: string,
  bookId: string,
  collectionId: string | null,
) {
  const book = await updateBookCollection(userId, bookId, collectionId)

  if (!book) {
    throw new Error('书籍不存在，可能已经被删除。')
  }

  return {
    book,
    books: await getBooks(userId),
  }
}

export async function persistChapterRecord(
  userId: string,
  chapter: BookChapterRecord,
  options?: PersistChapterOptions,
) {
  const timestamp = new Date().toISOString()
  const nextChapter = normalizeChapterRecord(chapter, {
    lastOpenedAt: options?.markOpened ? timestamp : chapter.lastOpenedAt,
  })

  await saveChapter(userId, nextChapter)

  const nextChapters = (await getChaptersByBook(userId, nextChapter.bookId)).map((item) =>
    normalizeChapterRecord(item),
  )
  const currentBook = await getBook(userId, nextChapter.bookId)
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
    await saveBook(userId, nextBook)
  }

  return {
    book: nextBook,
    chapter: nextChapter,
    chapters: nextChapters,
  }
}

export async function openChapterRecord(userId: string, chapterId: string) {
  const chapterRecord = await getChapter(userId, chapterId)
  if (!chapterRecord) {
    return null
  }

  const chapter = normalizeChapterRecord(chapterRecord)
  const hydratedBook = await hydrateBookState(userId, chapter.bookId, chapterId)
  const persisted = await persistChapterRecord(userId, chapter, { markOpened: true })

  return {
    chapter,
    hydratedBook,
    persisted,
  }
}

export async function importBookToLibrary(userId: string, file: File, language: BookLanguage) {
  const payload = await importEpubBook(file, language)
  const chapters = payload.chapters.map((chapter) => normalizeChapterRecord(chapter))
  const book = await saveImportedBook(userId, payload.book, chapters, payload.fileData)

  return {
    book,
    chapters,
    currentChapter: chapters[0] ?? null,
    selection: {
      bookId: book.id,
      chapterId: chapters[0]?.id ?? null,
    } satisfies LibrarySelection,
  }
}

export async function saveManualDraftToLibrary(
  userId: string,
  input: CreateManualDraftBookPayloadInput,
) {
  const payload = createManualDraftBookPayload(input)
  const book = await saveImportedBook(userId, payload.book, payload.chapters)

  return {
    ...payload,
    book,
    currentChapter: payload.chapters[0] ?? null,
    selection: {
      bookId: book.id,
      chapterId: payload.chapters[0]?.id ?? null,
    } satisfies LibrarySelection,
  }
}

export async function loadBookFile(userId: string, bookId: string) {
  return getBookFile(userId, bookId)
}

export async function removeBookFromLibrary(userId: string, bookId: string) {
  await deleteBookCascade(userId, bookId)
  return getBooks(userId)
}

export async function removeChapterFromLibrary(
  userId: string,
  chapterId: string,
): Promise<RemoveChapterResult | null> {
  const chapterRecord = await getChapter(userId, chapterId)
  if (!chapterRecord) {
    return null
  }

  const removedChapter = normalizeChapterRecord(chapterRecord)
  await deleteChapterCascade(userId, chapterId)

  const siblingChapters = (await getChaptersByBook(userId, removedChapter.bookId)).map((chapter) =>
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
        ? saveChapter(userId, chapter)
        : Promise.resolve(),
    ),
  )

  const currentBook = await getBook(userId, removedChapter.bookId)
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
    await saveBook(userId, nextBook)
  }

  return {
    nextBook,
    nextChapters,
    removedChapter,
  }
}

export async function saveKnowledgeResourceToLibrary(
  userId: string,
  resource: SavedKnowledgeResource,
) {
  const existing = await getSavedResourceBySignature(userId, resource.signature)
  const nextResource = existing
    ? {
        ...existing,
        ...resource,
        id: existing.id,
      }
    : resource

  return saveKnowledgeResource(userId, nextResource)
}

export async function removeKnowledgeResourceFromLibrary(userId: string, resourceId: string) {
  await deleteKnowledgeResource(userId, resourceId)
}

export async function removeKnowledgeResourcesFromLibrary(userId: string, resourceIds: string[]) {
  await deleteKnowledgeResources(userId, resourceIds)
}

export async function clearLibraryStorage(userId: string) {
  await clearLibraryDb(userId)
}

export async function hasLegacyLocalLibraryStorage() {
  return hasLegacyLocalLibraryData()
}

export async function migrateLegacyLocalLibraryStorage(userId: string) {
  const snapshot = await loadLegacyLocalLibrarySnapshot()

  for (const collection of snapshot.collections) {
    await saveCollection(userId, collection)
  }

  for (const payload of snapshot.books) {
    await saveImportedBook(userId, payload.book, payload.chapters, payload.fileData)
  }

  for (const resource of snapshot.savedResources) {
    await saveKnowledgeResource(userId, resource)
  }

  return loadInitialLibraryState(userId)
}
