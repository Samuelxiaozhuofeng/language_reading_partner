import type {
  BookChapterRecord,
  BookLanguage,
  BookRecord,
  CollectionRecord,
  LibrarySelection,
  PendingAnkiNote,
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
  getPendingAnkiNotes,
  getSavedResourceBySignature,
  getSavedResources,
  markPendingAnkiNotesImported,
  saveBook,
  saveChapter,
  saveCollection,
  saveImportedBook,
  saveKnowledgeResource,
  savePendingAnkiNote,
  savePendingAnkiNoteErrors,
  updateBookSnapshotSummary,
  updateBookReadingProgress,
  updateBookCollection,
  updateChapterLastOpenedAt,
  updateChapterSnapshot,
} from './remoteRepository'
import {
  hasLegacyLocalLibraryData,
  loadLegacyLocalLibrarySnapshot,
} from './localMigration'
import { createManualDraftBookPayload, type CreateManualDraftBookPayloadInput } from './manualDraft'
import {
  clearCloudLibrarySnapshot,
  loadCloudLibrarySnapshot,
  saveCloudLibrarySnapshot,
  type CloudLibrarySnapshot,
} from './cloudCache'
import { getChaptersRequiringOrderSync } from './chapterOrderSync'

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

export type OpenedChapterState = {
  book: BookRecord
  chapter: BookChapterRecord
  chapters: BookChapterRecord[]
  selection: LibrarySelection
}

export type UpdatedChapterState = {
  book: BookRecord | null
  chapter: BookChapterRecord
  chapters: BookChapterRecord[]
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
  const [books, collections, savedResources, pendingAnkiNotes] = await Promise.all([
    getBooks(userId),
    getCollections(userId),
    getSavedResources(userId),
    getPendingAnkiNotes(userId),
  ])
  const hydratedBook = books[0]
    ? await hydrateBookState(userId, books[0].id, books[0].lastReadChapterId)
    : null

  return {
    books,
    collections,
    hydratedBook,
    pendingAnkiNotes,
    savedResources: sortSavedResources(savedResources),
  }
}

export async function loadCachedInitialLibraryState(userId: string) {
  return loadCloudLibrarySnapshot(userId)
}

export async function saveInitialLibraryStateCache(
  userId: string,
  snapshot: CloudLibrarySnapshot,
) {
  await saveCloudLibrarySnapshot(userId, snapshot)
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

export function createOpenedChapterState(
  book: BookRecord,
  chapters: BookChapterRecord[],
  chapterId: string,
  timestamp = new Date().toISOString(),
): OpenedChapterState | null {
  const chapter = chapters.find((item) => item.id === chapterId)
  if (!chapter) {
    return null
  }

  const nextChapter = normalizeChapterRecord({
    ...chapter,
    lastOpenedAt: timestamp,
  })
  const nextChapters = chapters.map((item) => (item.id === chapterId ? nextChapter : item))
  const nextBook = {
    ...book,
    lastReadChapterId: chapterId,
    lastOpenedAt: timestamp,
  }

  return {
    book: nextBook,
    chapter: nextChapter,
    chapters: nextChapters,
    selection: {
      bookId: book.id,
      chapterId,
    },
  }
}

export function createUpdatedChapterState(
  book: BookRecord | null,
  chapters: BookChapterRecord[],
  chapter: BookChapterRecord,
): UpdatedChapterState {
  const nextChapter = normalizeChapterRecord(chapter)
  const nextChapters = chapters.map((item) => (item.id === nextChapter.id ? nextChapter : item))
  const nextBook = book && book.id === nextChapter.bookId
    ? {
        ...book,
        analysisState: deriveBookAnalysisState(nextChapters),
      }
    : null

  return {
    book: nextBook,
    chapter: nextChapter,
    chapters: nextChapters,
  }
}

export function createLocallyOpenedChapter(
  chapter: BookChapterRecord,
  timestamp = new Date().toISOString(),
) {
  return normalizeChapterRecord({
    ...chapter,
    lastOpenedAt: timestamp,
  })
}

export function createRemovedChapterState(
  book: BookRecord,
  chapters: BookChapterRecord[],
  chapterId: string,
): RemoveChapterResult | null {
  const removedChapter = chapters.find((chapter) => chapter.id === chapterId)
  if (!removedChapter) {
    return null
  }

  const nextChapters = chapters
    .filter((chapter) => chapter.id !== chapterId)
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
  const fallbackChapter =
    nextChapters[removedChapter.order] ?? nextChapters[removedChapter.order - 1] ?? null

  return {
    nextBook: {
      ...book,
      chapterCount: nextChapters.length,
      lastReadChapterId:
        book.lastReadChapterId === chapterId ? fallbackChapter?.id : book.lastReadChapterId,
      analysisState: deriveBookAnalysisState(nextChapters),
    },
    nextChapters,
    removedChapter: normalizeChapterRecord(removedChapter),
  }
}

export async function syncOpenedChapterToCloud(
  userId: string,
  state: OpenedChapterState,
) {
  const openedAt = state.chapter.lastOpenedAt
  if (!openedAt) {
    throw new Error('章节打开时间缺失，无法同步阅读进度。')
  }

  await Promise.all([
    updateChapterLastOpenedAt(userId, state.chapter.id, openedAt),
    updateBookReadingProgress(userId, state.book.id, state.chapter.id, openedAt),
  ])
}

export async function syncChapterSnapshotToCloud(
  userId: string,
  book: BookRecord | null,
  chapter: BookChapterRecord,
) {
  await updateChapterSnapshot(userId, chapter)

  if (book) {
    await updateBookSnapshotSummary(userId, book)
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
  const currentSiblings = (await getChaptersByBook(userId, removedChapter.bookId)).map((chapter) =>
    normalizeChapterRecord(chapter),
  )
  await deleteChapterCascade(userId, chapterId)

  const nextChapters = currentSiblings
    .filter((chapter) => chapter.id !== chapterId)
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

  const chaptersRequiringOrderSync = getChaptersRequiringOrderSync(currentSiblings, nextChapters)
  for (const chapter of chaptersRequiringOrderSync) {
    await saveChapter(userId, chapter)
  }

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

export async function savePendingAnkiNoteToLibrary(
  userId: string,
  note: PendingAnkiNote,
) {
  return savePendingAnkiNote(userId, note)
}

export async function markPendingAnkiNotesImportedInLibrary(
  userId: string,
  noteIds: string[],
) {
  await markPendingAnkiNotesImported(userId, noteIds)
  return getPendingAnkiNotes(userId)
}

export async function markPendingAnkiNotesFailedInLibrary(
  userId: string,
  noteIds: string[],
  message: string,
) {
  await savePendingAnkiNoteErrors(userId, noteIds, message)
  return getPendingAnkiNotes(userId)
}

export async function removeKnowledgeResourceFromLibrary(userId: string, resourceId: string) {
  await deleteKnowledgeResource(userId, resourceId)
}

export async function removeKnowledgeResourcesFromLibrary(userId: string, resourceIds: string[]) {
  await deleteKnowledgeResources(userId, resourceIds)
}

export async function clearLibraryStorage(userId: string) {
  await clearLibraryDb(userId)
  await clearCloudLibrarySnapshot(userId)
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
