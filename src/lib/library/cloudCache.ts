import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type {
  BookChapterRecord,
  BookRecord,
  CollectionRecord,
  LibrarySelection,
  SavedKnowledgeResource,
} from '../../types'

const DB_NAME = 'spanish-reading-assistant/cloud-library-cache'
const DB_VERSION = 1

export type CloudLibrarySnapshot = {
  books: BookRecord[]
  collections: CollectionRecord[]
  hydratedBook: {
    book: BookRecord
    chapters: BookChapterRecord[]
    selection: LibrarySelection
  } | null
  savedResources: SavedKnowledgeResource[]
}

type CloudLibrarySnapshotRecord = {
  userId: string
  snapshot: CloudLibrarySnapshot
  savedAt: string
}

interface CloudLibraryCacheDbSchema extends DBSchema {
  snapshots: {
    key: string
    value: CloudLibrarySnapshotRecord
  }
}

let dbPromise: Promise<IDBPDatabase<CloudLibraryCacheDbSchema>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<CloudLibraryCacheDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('snapshots')) {
          database.createObjectStore('snapshots', { keyPath: 'userId' })
        }
      },
    })
  }

  return dbPromise
}

export async function loadCloudLibrarySnapshot(userId: string) {
  const record = await (await getDb()).get('snapshots', userId)
  return record?.snapshot ?? null
}

export async function saveCloudLibrarySnapshot(
  userId: string,
  snapshot: CloudLibrarySnapshot,
) {
  const db = await getDb()
  await db.put('snapshots', {
    userId,
    snapshot,
    savedAt: new Date().toISOString(),
  })
}

export async function clearCloudLibrarySnapshot(userId: string) {
  const db = await getDb()
  await db.delete('snapshots', userId)
}
