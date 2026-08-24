import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

const DB_NAME = 'spanish-reading-assistant/speech-cache'
const DB_VERSION = 1
const MAX_CACHE_ENTRIES = 400

export interface SpeechCacheItem {
  key: string
  bytes: Uint8Array
  savedAt: number
}

interface SpeechCacheDbSchema extends DBSchema {
  speeches: {
    key: string
    value: SpeechCacheItem
    indexes: {
      'by-saved-at': number
    }
  }
}

let dbPromise: Promise<IDBPDatabase<SpeechCacheDbSchema>> | null = null

function getSpeechCacheDb() {
  if (!dbPromise) {
    dbPromise = openDB<SpeechCacheDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('speeches')) {
          const store = database.createObjectStore('speeches', { keyPath: 'key' })
          store.createIndex('by-saved-at', 'savedAt')
        }
      },
    }).catch((error) => {
      console.warn('打开语音缓存数据库失败:', error)
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}

export function normalizeSpeechCacheKey(language: string, word: string): string {
  const normalizedLang = language.trim().toLowerCase()
  const normalizedWord = word.trim().toLowerCase()
  return `${normalizedLang}:${normalizedWord}`
}

export async function getCachedSpeech(language: string, word: string): Promise<Uint8Array | null> {
  try {
    const key = normalizeSpeechCacheKey(language, word)
    const db = await getSpeechCacheDb()
    const record = await db.get('speeches', key)
    if (!record || !record.bytes) {
      return null
    }
    return record.bytes
  } catch (error) {
    console.warn('获取语音缓存失败:', error)
    return null
  }
}

export async function putCachedSpeech(language: string, word: string, bytes: Uint8Array): Promise<void> {
  try {
    const key = normalizeSpeechCacheKey(language, word)
    const db = await getSpeechCacheDb()
    const tx = db.transaction('speeches', 'readwrite')
    const store = tx.objectStore('speeches')

    await store.put({
      key,
      bytes,
      savedAt: Date.now(),
    })

    const count = await store.count()
    if (count > MAX_CACHE_ENTRIES) {
      const excess = count - MAX_CACHE_ENTRIES
      const index = store.index('by-saved-at')
      let cursor = await index.openCursor()
      let deleted = 0
      while (cursor && deleted < excess) {
        await cursor.delete()
        deleted++
        cursor = await cursor.continue()
      }
    }

    await tx.done
  } catch (error) {
    console.warn('写入语音缓存失败:', error)
  }
}
