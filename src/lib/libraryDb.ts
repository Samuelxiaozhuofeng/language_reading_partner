import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { BookChapterRecord, BookRecord } from '../types'

const DB_NAME = 'spanish-reading-assistant/library'
const DB_VERSION = 1

interface LibraryDbSchema extends DBSchema {
  books: {
    key: string
    value: BookRecord
  }
  chapters: {
    key: string
    value: BookChapterRecord
    indexes: {
      'by-book': string
      'by-book-order': [string, number]
    }
  }
}

let dbPromise: Promise<IDBPDatabase<LibraryDbSchema>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<LibraryDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('books')) {
          database.createObjectStore('books', { keyPath: 'id' })
        }

        if (!database.objectStoreNames.contains('chapters')) {
          const chapterStore = database.createObjectStore('chapters', { keyPath: 'id' })
          chapterStore.createIndex('by-book', 'bookId')
          chapterStore.createIndex('by-book-order', ['bookId', 'order'])
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

export async function getChaptersByBook(bookId: string) {
  const db = await getDb()
  const chapters = await db.getAllFromIndex('chapters', 'by-book', bookId)
  return chapters.sort((left, right) => left.order - right.order)
}

export async function getChapter(chapterId: string) {
  const db = await getDb()
  return db.get('chapters', chapterId)
}

export async function saveImportedBook(book: BookRecord, chapters: BookChapterRecord[]) {
  const db = await getDb()
  const tx = db.transaction(['books', 'chapters'], 'readwrite')

  await tx.objectStore('books').put(book)
  for (const chapter of chapters) {
    await tx.objectStore('chapters').put(chapter)
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

export async function deleteBookCascade(bookId: string) {
  const db = await getDb()
  const tx = db.transaction(['books', 'chapters'], 'readwrite')
  const chapters = await tx.objectStore('chapters').index('by-book').getAll(bookId)

  for (const chapter of chapters) {
    await tx.objectStore('chapters').delete(chapter.id)
  }

  await tx.objectStore('books').delete(bookId)
  await tx.done
}

export async function clearLibraryDb() {
  const db = await getDb()
  const tx = db.transaction(['books', 'chapters'], 'readwrite')
  await tx.objectStore('books').clear()
  await tx.objectStore('chapters').clear()
  await tx.done
}

