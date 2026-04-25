import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  BookChapterRecord,
  BookRecord,
  CollectionRecord,
  SavedKnowledgeResource,
} from '../types'

const DB_NAME = 'spanish-reading-assistant/library'
const DB_VERSION = 4

type BookFileRecord = {
  bookId: string
  data: ArrayBuffer
}

function withoutBookCollection(book: BookRecord) {
  const nextBook = { ...book }
  delete nextBook.collectionId
  return nextBook
}

interface LibraryDbSchema extends DBSchema {
  books: {
    key: string
    value: BookRecord
    indexes: {
      'by-collection': string
    }
  }
  chapters: {
    key: string
    value: BookChapterRecord
    indexes: {
      'by-book': string
      'by-book-order': [string, number]
    }
  }
  bookFiles: {
    key: string
    value: BookFileRecord
  }
  resources: {
    key: string
    value: SavedKnowledgeResource
    indexes: {
      'by-saved-at': string
      'by-kind': string
      'by-book': string
      'by-signature': string
    }
  }
  collections: {
    key: string
    value: CollectionRecord
  }
}

let dbPromise: Promise<IDBPDatabase<LibraryDbSchema>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<LibraryDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(database, _oldVersion, _newVersion, transaction) {
        const bookStore = database.objectStoreNames.contains('books')
          ? transaction.objectStore('books')
          : database.createObjectStore('books', { keyPath: 'id' })

        if (!bookStore.indexNames.contains('by-collection')) {
          bookStore.createIndex('by-collection', 'collectionId')
        }

        if (!database.objectStoreNames.contains('chapters')) {
          const chapterStore = database.createObjectStore('chapters', { keyPath: 'id' })
          chapterStore.createIndex('by-book', 'bookId')
          chapterStore.createIndex('by-book-order', ['bookId', 'order'])
        }

        if (!database.objectStoreNames.contains('bookFiles')) {
          database.createObjectStore('bookFiles', { keyPath: 'bookId' })
        }

        if (!database.objectStoreNames.contains('resources')) {
          const resourceStore = database.createObjectStore('resources', { keyPath: 'id' })
          resourceStore.createIndex('by-saved-at', 'savedAt')
          resourceStore.createIndex('by-kind', 'kind')
          resourceStore.createIndex('by-book', 'bookId')
          resourceStore.createIndex('by-signature', 'signature', { unique: true })
        }

        if (!database.objectStoreNames.contains('collections')) {
          database.createObjectStore('collections', { keyPath: 'id' })
        }
      },
    })
  }

  return dbPromise
}

export async function getBooks() {
  const db = await getDb()
  const books = await db.getAll('books')
  return books.sort((left, right) => {
    const leftTime = left.lastOpenedAt ?? left.importedAt
    const rightTime = right.lastOpenedAt ?? right.importedAt
    return rightTime.localeCompare(leftTime)
  })
}

export async function getBook(bookId: string) {
  const db = await getDb()
  return db.get('books', bookId)
}

export async function getCollections() {
  const db = await getDb()
  const collections = await db.getAll('collections')
  return collections.sort((left, right) => left.createdAt - right.createdAt)
}

export async function saveCollection(collection: CollectionRecord) {
  const db = await getDb()
  await db.put('collections', collection)
}

export async function deleteCollection(collectionId: string) {
  const db = await getDb()
  const tx = db.transaction(['collections', 'books'], 'readwrite')
  const collectionStore = tx.objectStore('collections')
  const bookStore = tx.objectStore('books')
  const collection = await collectionStore.get(collectionId)

  if (!collection) {
    await tx.done
    throw new Error('集合不存在，可能已经被删除。')
  }

  const books = await bookStore.index('by-collection').getAll(collectionId)
  for (const book of books) {
    await bookStore.put(withoutBookCollection(book))
  }

  await collectionStore.delete(collectionId)
  await tx.done
}

export async function updateBookCollection(bookId: string, collectionId: string | null) {
  const db = await getDb()
  const tx = db.transaction(['books', 'collections'], 'readwrite')
  const bookStore = tx.objectStore('books')
  const collectionStore = tx.objectStore('collections')
  const book = await bookStore.get(bookId)

  if (!book) {
    await tx.done
    return null
  }

  if (collectionId) {
    const collection = await collectionStore.get(collectionId)
    if (!collection) {
      await tx.done
      throw new Error('目标集合不存在，可能已经被删除。')
    }
  }

  const nextBook = collectionId ? { ...book, collectionId } : withoutBookCollection(book)
  await bookStore.put(nextBook)
  await tx.done
  return nextBook
}

export async function getChaptersByBook(bookId: string) {
  const db = await getDb()
  const chapters = await db.getAllFromIndex('chapters', 'by-book', bookId)
  return chapters.sort((left, right) => left.order - right.order)
}

export async function getChapter(chapterId: string) {
  const db = await getDb()
  return db.get('chapters', chapterId)
}

export async function getBookFile(bookId: string) {
  const db = await getDb()
  const record = await db.get('bookFiles', bookId)
  return record?.data ?? null
}

export async function saveImportedBook(
  book: BookRecord,
  chapters: BookChapterRecord[],
  fileData?: ArrayBuffer,
) {
  const db = await getDb()
  const tx = db.transaction(['books', 'chapters', 'bookFiles'], 'readwrite')

  await tx.objectStore('books').put(book)
  for (const chapter of chapters) {
    await tx.objectStore('chapters').put(chapter)
  }
  if (fileData) {
    await tx.objectStore('bookFiles').put({
      bookId: book.id,
      data: fileData,
    })
  }

  await tx.done
}

export async function saveBook(book: BookRecord) {
  const db = await getDb()
  await db.put('books', book)
}

export async function saveChapter(chapter: BookChapterRecord) {
  const db = await getDb()
  await db.put('chapters', chapter)
}

export async function deleteChapterCascade(chapterId: string) {
  const db = await getDb()
  const tx = db.transaction(['chapters', 'resources'], 'readwrite')
  const chapterStore = tx.objectStore('chapters')
  const resourceStore = tx.objectStore('resources')
  const chapter = await chapterStore.get(chapterId)

  if (!chapter) {
    await tx.done
    return null
  }

  const resources = await resourceStore.getAll()
  for (const resource of resources) {
    if (resource.chapterId === chapterId) {
      await resourceStore.delete(resource.id)
    }
  }

  await chapterStore.delete(chapterId)
  await tx.done
  return chapter
}

export async function getSavedResources() {
  const db = await getDb()
  const resources = await db.getAll('resources')
  return resources.sort((left, right) => right.savedAt.localeCompare(left.savedAt))
}

export async function getSavedResourceBySignature(signature: string) {
  const db = await getDb()
  return db.getFromIndex('resources', 'by-signature', signature)
}

export async function saveKnowledgeResource(resource: SavedKnowledgeResource) {
  const db = await getDb()
  await db.put('resources', resource)
}

export async function deleteKnowledgeResource(resourceId: string) {
  const db = await getDb()
  await db.delete('resources', resourceId)
}

export async function deleteKnowledgeResources(resourceIds: string[]) {
  if (resourceIds.length === 0) {
    return
  }

  const db = await getDb()
  const tx = db.transaction('resources', 'readwrite')

  for (const resourceId of resourceIds) {
    await tx.store.delete(resourceId)
  }

  await tx.done
}

export async function deleteBookCascade(bookId: string) {
  const db = await getDb()
  const tx = db.transaction(['books', 'chapters', 'bookFiles', 'resources'], 'readwrite')
  const chapters = await tx.objectStore('chapters').index('by-book').getAll(bookId)
  const resources = await tx.objectStore('resources').index('by-book').getAll(bookId)

  for (const chapter of chapters) {
    await tx.objectStore('chapters').delete(chapter.id)
  }

  for (const resource of resources) {
    await tx.objectStore('resources').delete(resource.id)
  }

  await tx.objectStore('bookFiles').delete(bookId)
  await tx.objectStore('books').delete(bookId)
  await tx.done
}

export async function clearLibraryDb() {
  const db = await getDb()
  const tx = db.transaction(['books', 'chapters', 'bookFiles', 'resources', 'collections'], 'readwrite')
  await tx.objectStore('books').clear()
  await tx.objectStore('chapters').clear()
  await tx.objectStore('bookFiles').clear()
  await tx.objectStore('resources').clear()
  await tx.objectStore('collections').clear()
  await tx.done
}
