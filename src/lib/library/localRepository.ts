import type {
  BookChapterRecord,
  BookRecord,
  CollectionRecord,
  PendingAnkiNote,
  SavedKnowledgeResource,
} from '../../types'
import {
  clearLibraryDb as clearDb,
  deleteBookCascade as deleteBookCascadeDb,
  deleteChapterCascade as deleteChapterCascadeDb,
  deleteCollection as deleteCollectionDb,
  deleteKnowledgeResource as deleteKnowledgeResourceDb,
  deleteKnowledgeResources as deleteKnowledgeResourcesDb,
  getBook as getBookDb,
  getBookFile as getBookFileDb,
  getBooks as getBooksDb,
  getChapter as getChapterDb,
  getChaptersByBook as getChaptersByBookDb,
  getCollections as getCollectionsDb,
  getPendingAnkiNotes as getPendingAnkiNotesDb,
  getSavedResourceBySignature as getSavedResourceBySignatureDb,
  getSavedResources as getSavedResourcesDb,
  markPendingAnkiNotesImported as markPendingAnkiNotesImportedDb,
  saveBook as saveBookDb,
  saveChapter as saveChapterDb,
  saveCollection as saveCollectionDb,
  saveImportedBook as saveImportedBookDb,
  saveKnowledgeResource as saveKnowledgeResourceDb,
  savePendingAnkiNote as savePendingAnkiNoteDb,
  savePendingAnkiNoteErrors as savePendingAnkiNoteErrorsDb,
  updateBookCollection as updateBookCollectionDb,
} from '../libraryDb'

export async function getBooks(userId: string) {
  void userId
  return getBooksDb()
}

export async function getBook(_userId: string, bookId: string) {
  return (await getBookDb(bookId)) ?? null
}

export async function getCollections(userId: string) {
  void userId
  return getCollectionsDb()
}

export async function saveCollection(_userId: string, collection: CollectionRecord) {
  await saveCollectionDb(collection)
}

export async function deleteCollection(_userId: string, collectionId: string) {
  await deleteCollectionDb(collectionId)
}

export async function updateBookCollection(
  _userId: string,
  bookId: string,
  collectionId: string | null,
) {
  return updateBookCollectionDb(bookId, collectionId)
}

export async function getChaptersByBook(_userId: string, bookId: string) {
  return getChaptersByBookDb(bookId)
}

export async function getChapter(_userId: string, chapterId: string) {
  return (await getChapterDb(chapterId)) ?? null
}

export async function getBookFile(_userId: string, bookId: string) {
  return getBookFileDb(bookId)
}

export async function saveImportedBook(
  _userId: string,
  book: BookRecord,
  chapters: BookChapterRecord[],
  fileData?: ArrayBuffer | null,
) {
  await saveImportedBookDb(book, chapters, fileData ?? undefined)
  return book
}

export async function saveBook(_userId: string, book: BookRecord) {
  await saveBookDb(book)
}

export async function saveChapter(_userId: string, chapter: BookChapterRecord) {
  await saveChapterDb(chapter)
}

export async function updateChapterSnapshot(_userId: string, chapter: BookChapterRecord) {
  const existing = await getChapterDb(chapter.id)
  if (!existing) {
    throw new Error('章节保存失败：没有匹配到可更新的章节。')
  }
  await saveChapterDb(chapter)
}

export async function updateBookSnapshotSummary(_userId: string, book: BookRecord) {
  const existing = await getBookDb(book.id)
  if (!existing) {
    throw new Error('书籍摘要保存失败：没有匹配到可更新的书籍。')
  }
  const nextBook: BookRecord = {
    ...existing,
    chapterCount: book.chapterCount,
    lastReadChapterId: book.lastReadChapterId ?? undefined,
    lastOpenedAt: book.lastOpenedAt ?? undefined,
    analysisState: book.analysisState,
  }
  await saveBookDb(nextBook)
}

export async function updateBookReadingProgress(
  _userId: string,
  bookId: string,
  chapterId: string,
  lastOpenedAt: string,
) {
  const existing = await getBookDb(bookId)
  if (!existing) {
    throw new Error('书籍阅读进度更新失败：没有匹配到可更新的书籍。')
  }
  const nextBook: BookRecord = {
    ...existing,
    lastReadChapterId: chapterId,
    lastOpenedAt,
  }
  await saveBookDb(nextBook)
}

export async function updateChapterLastOpenedAt(
  _userId: string,
  chapterId: string,
  lastOpenedAt: string,
) {
  const existing = await getChapterDb(chapterId)
  if (!existing) {
    throw new Error('章节打开时间更新失败：没有匹配到可更新的章节。')
  }
  const nextChapter: BookChapterRecord = {
    ...existing,
    lastOpenedAt,
  }
  await saveChapterDb(nextChapter)
}

export async function deleteChapterCascade(_userId: string, chapterId: string) {
  return deleteChapterCascadeDb(chapterId)
}

export async function getSavedResources(userId: string) {
  void userId
  return getSavedResourcesDb()
}

export async function getPendingAnkiNotes(userId: string) {
  void userId
  return getPendingAnkiNotesDb()
}

export async function getSavedResourceBySignature(_userId: string, signature: string) {
  return (await getSavedResourceBySignatureDb(signature)) ?? null
}

export async function saveKnowledgeResource(
  _userId: string,
  resource: SavedKnowledgeResource,
) {
  await saveKnowledgeResourceDb(resource)
  return resource
}

export async function savePendingAnkiNote(_userId: string, note: PendingAnkiNote) {
  return savePendingAnkiNoteDb(note)
}

export async function markPendingAnkiNotesImported(_userId: string, noteIds: string[]) {
  await markPendingAnkiNotesImportedDb(noteIds)
}

export async function savePendingAnkiNoteErrors(
  _userId: string,
  noteIds: string[],
  message: string,
) {
  await savePendingAnkiNoteErrorsDb(noteIds, message)
}

export async function deleteKnowledgeResource(_userId: string, resourceId: string) {
  await deleteKnowledgeResourceDb(resourceId)
}

export async function deleteKnowledgeResources(_userId: string, resourceIds: string[]) {
  await deleteKnowledgeResourcesDb(resourceIds)
}

export async function deleteBookCascade(_userId: string, bookId: string) {
  await deleteBookCascadeDb(bookId)
}

export async function clearLibraryDb(userId: string) {
  void userId
  await clearDb()
}
