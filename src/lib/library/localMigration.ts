import type { BookChapterRecord, BookRecord, CollectionRecord, SavedKnowledgeResource } from '../../types'
import {
  getBookFile,
  getBooks,
  getChaptersByBook,
  getCollections,
  getSavedResources,
} from '../libraryDb'

export type LegacyLocalBookPayload = {
  book: BookRecord
  chapters: BookChapterRecord[]
  fileData: ArrayBuffer | null
}

export type LegacyLocalLibrarySnapshot = {
  books: LegacyLocalBookPayload[]
  collections: CollectionRecord[]
  savedResources: SavedKnowledgeResource[]
}

export async function loadLegacyLocalLibrarySnapshot(): Promise<LegacyLocalLibrarySnapshot> {
  const [books, collections, savedResources] = await Promise.all([
    getBooks(),
    getCollections(),
    getSavedResources(),
  ])
  const bookPayloads = await Promise.all(
    books.map(async (book) => ({
      book,
      chapters: await getChaptersByBook(book.id),
      fileData: await getBookFile(book.id),
    })),
  )

  return {
    books: bookPayloads,
    collections,
    savedResources,
  }
}

export async function hasLegacyLocalLibraryData() {
  const snapshot = await loadLegacyLocalLibrarySnapshot()
  return snapshot.books.length > 0 || snapshot.collections.length > 0 || snapshot.savedResources.length > 0
}
