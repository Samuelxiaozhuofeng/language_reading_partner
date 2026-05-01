import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AnalysisResult,
  BookLanguage,
  BookChapterRecord,
  BookRecord,
  CollectionRecord,
  LibrarySelection,
  SavedKnowledgeResource,
  SentenceItem,
} from '../types'
import { sortSavedResources } from '../lib/knowledge'
import {
  clearLibraryStorage,
  createLocallyOpenedChapter,
  createCollectionInLibrary,
  createOpenedChapterState,
  createRemovedChapterState,
  createUpdatedChapterState,
  deleteCollectionFromLibrary,
  hasLegacyLocalLibraryStorage,
  type HydratedBookState,
  hydrateBookState,
  importBookToLibrary,
  loadBookFile,
  loadCachedInitialLibraryState,
  loadInitialLibraryState,
  migrateLegacyLocalLibraryStorage,
  moveBookToCollectionInLibrary,
  removeBookFromLibrary,
  removeChapterFromLibrary,
  removeKnowledgeResourceFromLibrary,
  removeKnowledgeResourcesFromLibrary,
  saveInitialLibraryStateCache,
  saveKnowledgeResourceToLibrary,
  saveManualDraftToLibrary,
  syncChapterSnapshotToCloud,
  syncOpenedChapterToCloud,
} from '../lib/library/service'
import {
  getAdjacentChapterIds,
  resolveNextCurrentChapterAfterRemoval,
  resolveNextSelectedChapterIdAfterRemoval,
  updateBookInList,
} from '../lib/library/selectors'

type PersistChapterOptions = {
  markOpened?: boolean
}

function filterBooksByCollection(books: BookRecord[], collectionId: string | null) {
  return collectionId ? books.filter((book) => book.collectionId === collectionId) : books
}

function requireCloudUser(userId: string | null) {
  if (!userId) {
    throw new Error('请先登录后再使用云端书架。')
  }

  return userId
}

type InitialLibraryState = {
  books: BookRecord[]
  collections: CollectionRecord[]
  hydratedBook: HydratedBookState | null
  savedResources: SavedKnowledgeResource[]
}

export function useLibraryStore(userId: string | null) {
  const [allBooks, setAllBooks] = useState<BookRecord[]>([])
  const [collections, setCollections] = useState<CollectionRecord[]>([])
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)
  const [chapters, setChapters] = useState<BookChapterRecord[]>([])
  const [savedResources, setSavedResources] = useState<SavedKnowledgeResource[]>([])
  const [selection, setSelection] = useState<LibrarySelection>({ bookId: null, chapterId: null })
  const [currentChapter, setCurrentChapter] = useState<BookChapterRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadedLibrary, setHasLoadedLibrary] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [hasLegacyLocalLibrary, setHasLegacyLocalLibrary] = useState(false)
  const [isMigratingLegacyLibrary, setIsMigratingLegacyLibrary] = useState(false)
  const [libraryNotice, setLibraryNotice] = useState('')
  const [libraryError, setLibraryError] = useState('')
  const currentChapterRef = useRef<BookChapterRecord | null>(null)
  const chapterSnapshotSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingChapterSnapshotRef = useRef<{
    book: BookRecord | null
    chapter: BookChapterRecord
    userId: string
  } | null>(null)
  const libraryCacheSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingLibraryCacheRef = useRef<{
    snapshot: InitialLibraryState
    userId: string
  } | null>(null)

  useEffect(() => {
    currentChapterRef.current = currentChapter
  }, [currentChapter])

  const books = useMemo(
    () => filterBooksByCollection(allBooks, activeCollectionId),
    [activeCollectionId, allBooks],
  )

  const selectedBook = useMemo(
    () => allBooks.find((book) => book.id === selection.bookId) ?? null,
    [allBooks, selection.bookId],
  )

  const collectionBookCounts = useMemo(
    () =>
      allBooks.reduce<Record<string, number>>((counts, book) => {
        if (!book.collectionId) {
          return counts
        }

        return {
          ...counts,
          [book.collectionId]: (counts[book.collectionId] ?? 0) + 1,
        }
      }, {}),
    [allBooks],
  )

  const adjacentChapterIds = useMemo(
    () => getAdjacentChapterIds(chapters, currentChapter?.id ?? null),
    [chapters, currentChapter?.id],
  )

  const applyHydratedBook = useCallback((hydratedBook: HydratedBookState | null) => {
    if (!hydratedBook) {
      return
    }

    setAllBooks((current) => updateBookInList(current, hydratedBook.book))
    setChapters(hydratedBook.chapters)
    setSelection(hydratedBook.selection)
  }, [])

  const hydrateBook = useCallback(async (bookId: string, preferredChapterId?: string | null) => {
    const cloudUserId = requireCloudUser(userId)
    const hydratedBook = await hydrateBookState(cloudUserId, bookId, preferredChapterId)
    applyHydratedBook(hydratedBook)
  }, [applyHydratedBook, userId])

  const clearBookSelection = useCallback(() => {
    currentChapterRef.current = null
    setCurrentChapter(null)
    setChapters([])
    setSelection({ bookId: null, chapterId: null })
  }, [])

  const applyInitialLibraryState = useCallback((initialState: InitialLibraryState) => {
    setAllBooks(initialState.books)
    setCollections(initialState.collections)
    setSavedResources(initialState.savedResources)
    if (initialState.hydratedBook) {
      applyHydratedBook(initialState.hydratedBook)
    } else {
      clearBookSelection()
    }
  }, [applyHydratedBook, clearBookSelection])

  const flushPendingChapterSnapshot = useCallback(() => {
    const pending = pendingChapterSnapshotRef.current
    pendingChapterSnapshotRef.current = null
    if (chapterSnapshotSyncTimerRef.current) {
      clearTimeout(chapterSnapshotSyncTimerRef.current)
      chapterSnapshotSyncTimerRef.current = null
    }

    if (!pending) {
      return
    }

    void syncChapterSnapshotToCloud(pending.userId, pending.book, pending.chapter).catch((error) => {
      setLibraryNotice('')
      setLibraryError(error instanceof Error ? error.message : '章节保存同步失败。')
    })
  }, [])

  const scheduleChapterSnapshotSync = useCallback(
    (book: BookRecord | null, chapter: BookChapterRecord) => {
      const cloudUserId = requireCloudUser(userId)
      pendingChapterSnapshotRef.current = {
        book,
        chapter,
        userId: cloudUserId,
      }

      if (chapterSnapshotSyncTimerRef.current) {
        clearTimeout(chapterSnapshotSyncTimerRef.current)
      }

      chapterSnapshotSyncTimerRef.current = setTimeout(flushPendingChapterSnapshot, 800)
    },
    [flushPendingChapterSnapshot, userId],
  )

  const flushPendingLibraryCache = useCallback(() => {
    const pending = pendingLibraryCacheRef.current
    pendingLibraryCacheRef.current = null
    if (libraryCacheSyncTimerRef.current) {
      clearTimeout(libraryCacheSyncTimerRef.current)
      libraryCacheSyncTimerRef.current = null
    }

    if (!pending) {
      return
    }

    void saveInitialLibraryStateCache(pending.userId, pending.snapshot).catch((error) => {
      setLibraryError(error instanceof Error ? error.message : '云端书架快照缓存失败。')
    })
  }, [])

  const scheduleLibraryCacheSync = useCallback(
    (cloudUserId: string, snapshot: InitialLibraryState) => {
      pendingLibraryCacheRef.current = {
        userId: cloudUserId,
        snapshot,
      }

      if (libraryCacheSyncTimerRef.current) {
        clearTimeout(libraryCacheSyncTimerRef.current)
      }

      libraryCacheSyncTimerRef.current = setTimeout(flushPendingLibraryCache, 800)
    },
    [flushPendingLibraryCache],
  )

  useEffect(
    () => () => {
      flushPendingChapterSnapshot()
      flushPendingLibraryCache()
    },
    [flushPendingChapterSnapshot, flushPendingLibraryCache],
  )

  const hydrateFirstVisibleBook = useCallback(
    async (bookList: BookRecord[], collectionId: string | null) => {
      const nextBook = filterBooksByCollection(bookList, collectionId)[0]

      if (nextBook) {
        await hydrateBook(nextBook.id, nextBook.lastReadChapterId)
        return
      }

      clearBookSelection()
    },
    [clearBookSelection, hydrateBook],
  )

  useEffect(() => {
    let isCancelled = false

    async function bootstrap() {
      if (!userId) {
        setAllBooks([])
        setCollections([])
        setActiveCollectionId(null)
        setSavedResources([])
        clearBookSelection()
        setHasLoadedLibrary(false)
        setHasLegacyLocalLibrary(false)
        setLibraryError('')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setHasLoadedLibrary(false)
        setActiveCollectionId(null)
        const [cachedState, nextHasLegacyLocalLibrary] = await Promise.all([
          loadCachedInitialLibraryState(userId),
          hasLegacyLocalLibraryStorage(),
        ])
        if (isCancelled) {
          return
        }

        setHasLegacyLocalLibrary(nextHasLegacyLocalLibrary)
        if (cachedState) {
          applyInitialLibraryState(cachedState)
          setHasLoadedLibrary(true)
          setIsLoading(false)
        }

        const initialState = await loadInitialLibraryState(userId)
        if (isCancelled) {
          return
        }

        applyInitialLibraryState(initialState)
        setHasLoadedLibrary(true)
        setLibraryError('')
      } catch (error) {
        if (!isCancelled) {
          setLibraryError(error instanceof Error ? error.message : '书架初始化失败。')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      isCancelled = true
    }
  }, [applyInitialLibraryState, clearBookSelection, userId])

  useEffect(() => {
    if (!userId || !hasLoadedLibrary) {
      return
    }

    const hydratedBook =
      selectedBook && selection.bookId
        ? {
            book: selectedBook,
            chapters,
            selection,
          }
        : null

    scheduleLibraryCacheSync(userId, {
      books: allBooks,
      collections,
      hydratedBook,
      savedResources,
    })
  }, [
    allBooks,
    chapters,
    collections,
    hasLoadedLibrary,
    savedResources,
    scheduleLibraryCacheSync,
    selectedBook,
    selection,
    userId,
  ])

  const updateCurrentChapter = useCallback(
    async (
      updater: (chapter: BookChapterRecord) => BookChapterRecord,
      options?: PersistChapterOptions,
    ) => {
      const chapter = currentChapterRef.current
      if (!chapter) {
        return null
      }

      const updatedChapter = updater(chapter)
      const nextChapter = options?.markOpened
        ? createLocallyOpenedChapter(updatedChapter)
        : updatedChapter
      const nextState = createUpdatedChapterState(selectedBook, chapters, nextChapter)

      currentChapterRef.current = nextState.chapter
      setCurrentChapter(nextState.chapter)
      setChapters(nextState.chapters)
      if (nextState.book) {
        const nextBook = nextState.book
        setAllBooks((currentBooks) => updateBookInList(currentBooks, nextBook))
      }
      scheduleChapterSnapshotSync(nextState.book, nextState.chapter)
      return nextState.chapter
    },
    [chapters, scheduleChapterSnapshotSync, selectedBook],
  )

  const selectBook = useCallback(
    async (bookId: string) => {
      setLibraryError('')
      currentChapterRef.current = null
      await hydrateBook(bookId)
      setCurrentChapter(null)
    },
    [hydrateBook],
  )

  const openChapter = useCallback(
    async (chapterId: string) => {
      const cloudUserId = requireCloudUser(userId)
      const openedState = selectedBook
        ? createOpenedChapterState(selectedBook, chapters, chapterId)
        : null

      if (!openedState) {
        setLibraryError('章节尚未载入，请先选择对应书籍。')
        return null
      }

      currentChapterRef.current = openedState.chapter
      setCurrentChapter(openedState.chapter)
      setAllBooks((current) => updateBookInList(current, openedState.book))
      setChapters(openedState.chapters)
      setSelection(openedState.selection)
      setLibraryNotice(`已打开章节《${openedState.chapter.title}》。`)
      setLibraryError('')

      void syncOpenedChapterToCloud(cloudUserId, openedState).catch((error) => {
        setLibraryNotice('')
        setLibraryError(error instanceof Error ? error.message : '章节阅读进度同步失败。')
      })

      return openedState.chapter
    },
    [chapters, selectedBook, userId],
  )

  const importBook = useCallback(async (file: File, language: BookLanguage) => {
    const cloudUserId = requireCloudUser(userId)
    setIsImporting(true)
    setLibraryError('')

    try {
      const payload = await importBookToLibrary(cloudUserId, file, language)
      setActiveCollectionId(null)
      setAllBooks((current) => updateBookInList(current, payload.book))
      setChapters(payload.chapters)
      setSelection(payload.selection)
      currentChapterRef.current = payload.currentChapter
      setCurrentChapter(payload.currentChapter)
      setLibraryNotice(`已导入《${payload.book.title}》，共 ${payload.book.chapterCount} 章。`)
      setLibraryError('')
      return payload
    } catch (error) {
      const message = error instanceof Error ? error.message : 'EPUB 导入失败。'
      setLibraryError(message)
      throw error
    } finally {
      setIsImporting(false)
    }
  }, [userId])

  const saveManualDraftAsBook = useCallback(async ({
    articleTitle,
    language,
    results,
    sentences,
    sourceText,
  }: {
    articleTitle: string
    language: BookLanguage
    results: Record<string, AnalysisResult>
    sentences: SentenceItem[]
    sourceText: string
  }) => {
    const trimmedSourceText = sourceText.trim()

    if (!trimmedSourceText) {
      setLibraryNotice('')
      setLibraryError('请先粘贴一段完整的原文，再保存到书架。')
      return null
    }

    const cloudUserId = requireCloudUser(userId)
    const payload = await saveManualDraftToLibrary(cloudUserId, {
      articleTitle: articleTitle.trim(),
      language,
      results,
      sentences,
      sourceText: trimmedSourceText,
    })

    setActiveCollectionId(null)
    setAllBooks((current) => updateBookInList(current, payload.book))
    setChapters(payload.chapters)
    setSelection(payload.selection)
    currentChapterRef.current = payload.currentChapter
    setCurrentChapter(payload.currentChapter)
    setLibraryNotice(`已将手动内容保存到书架：《${payload.book.title}》。`)
    setLibraryError('')

    return payload
  }, [userId])

  const removeBook = useCallback(
    async (bookId: string) => {
      const cloudUserId = requireCloudUser(userId)
      const nextBooks = await removeBookFromLibrary(cloudUserId, bookId)
      setAllBooks(nextBooks)
      setSavedResources((current) => current.filter((resource) => resource.bookId !== bookId))

      if (selection.bookId === bookId) {
        await hydrateFirstVisibleBook(nextBooks, activeCollectionId)
      }

      setLibraryNotice('书籍已从云端书架移除。')
      setLibraryError('')
    },
    [activeCollectionId, hydrateFirstVisibleBook, selection.bookId, userId],
  )

  const removeChapter = useCallback(
    async (chapterId: string): Promise<{ nextCurrentChapterId: string | null; removedCurrentChapter: boolean } | null> => {
      const cloudUserId = requireCloudUser(userId)
      const payload = selectedBook
        ? createRemovedChapterState(selectedBook, chapters, chapterId)
        : null
      if (!payload) {
        setLibraryError('章节不存在，可能已经被删除。')
        return null
      }

      const removedCurrentChapter = currentChapterRef.current?.id === chapterId
      const nextCurrentChapter = resolveNextCurrentChapterAfterRemoval(
        payload.nextChapters,
        currentChapterRef.current,
        payload.removedChapter,
      )

      currentChapterRef.current = nextCurrentChapter
      setCurrentChapter(nextCurrentChapter)
      setSavedResources((current) => current.filter((resource) => resource.chapterId !== chapterId))
      const nextBook = payload.nextBook
      if (nextBook) {
        setAllBooks((current) => updateBookInList(current, nextBook))
      }

      if (selection.bookId === payload.removedChapter.bookId) {
        setChapters(payload.nextChapters)
        setSelection({
          bookId: payload.removedChapter.bookId,
          chapterId: resolveNextSelectedChapterIdAfterRemoval(
            payload.nextChapters,
            selection.chapterId,
            chapterId,
            payload.removedChapter.order,
          ),
        })
      }

      void removeChapterFromLibrary(cloudUserId, chapterId).catch((error) => {
        setLibraryNotice('')
        setLibraryError(error instanceof Error ? error.message : '章节删除同步失败。')
      })

      setLibraryNotice(`已删除章节《${payload.removedChapter.title}》。`)
      setLibraryError('')

      return {
        nextCurrentChapterId: nextCurrentChapter?.id ?? null,
        removedCurrentChapter,
      }
    },
    [chapters, selectedBook, selection.bookId, selection.chapterId, userId],
  )

  const upsertKnowledgeResource = useCallback(async (resource: SavedKnowledgeResource) => {
    const cloudUserId = requireCloudUser(userId)
    const nextResource = await saveKnowledgeResourceToLibrary(cloudUserId, resource)
    setSavedResources((current) =>
      sortSavedResources(
        current.filter(
          (item) => item.id !== nextResource.id && item.signature !== nextResource.signature,
        ).concat(nextResource),
      ),
    )
    setLibraryNotice(`已收藏「${nextResource.text}」到学习资源。`)
    setLibraryError('')
    return nextResource
  }, [userId])

  const removeKnowledgeResourceById = useCallback(async (resourceId: string) => {
    const target = savedResources.find((resource) => resource.id === resourceId)
    if (!target) {
      return
    }

    const cloudUserId = requireCloudUser(userId)
    await removeKnowledgeResourceFromLibrary(cloudUserId, resourceId)
    setSavedResources((current) => current.filter((resource) => resource.id !== resourceId))
    setLibraryNotice(`已从学习资源移除「${target.text}」。`)
    setLibraryError('')
  }, [savedResources, userId])

  const removeKnowledgeResourceBySignature = useCallback(async (signature: string) => {
    const target = savedResources.find((resource) => resource.signature === signature)
    if (!target) {
      return
    }

    await removeKnowledgeResourceById(target.id)
  }, [removeKnowledgeResourceById, savedResources])

  const removeKnowledgeResourcesByIds = useCallback(async (resourceIds: string[]) => {
    if (resourceIds.length === 0) {
      return
    }

    const targets = savedResources.filter((resource) => resourceIds.includes(resource.id))
    if (targets.length === 0) {
      return
    }

    const cloudUserId = requireCloudUser(userId)
    await removeKnowledgeResourcesFromLibrary(cloudUserId, targets.map((resource) => resource.id))
    setSavedResources((current) => current.filter((resource) => !resourceIds.includes(resource.id)))
    setLibraryNotice(`已从学习资源移除 ${targets.length} 条知识点。`)
    setLibraryError('')
  }, [savedResources, userId])

  const setActiveCollection = useCallback(
    async (collectionId: string | null) => {
      setActiveCollectionId(collectionId)

      const nextVisibleBooks = filterBooksByCollection(allBooks, collectionId)
      if (!selection.bookId || !nextVisibleBooks.some((book) => book.id === selection.bookId)) {
        await hydrateFirstVisibleBook(allBooks, collectionId)
      }

      setLibraryError('')
    },
    [allBooks, hydrateFirstVisibleBook, selection.bookId],
  )

  const createCollection = useCallback(
    async (name: string) => {
      try {
        const cloudUserId = requireCloudUser(userId)
        const payload = await createCollectionInLibrary(cloudUserId, name)
        setCollections(payload.collections)
        setActiveCollectionId(payload.collection.id)
        await hydrateFirstVisibleBook(allBooks, payload.collection.id)
        setLibraryNotice(`已创建集合「${payload.collection.name}」。`)
        setLibraryError('')
      } catch (error) {
        setLibraryNotice('')
        setLibraryError(error instanceof Error ? error.message : '集合创建失败。')
      }
    },
    [allBooks, hydrateFirstVisibleBook, userId],
  )

  const deleteCollection = useCallback(
    async (collectionId: string) => {
      try {
        const target = collections.find((collection) => collection.id === collectionId)
        const cloudUserId = requireCloudUser(userId)
        const payload = await deleteCollectionFromLibrary(cloudUserId, collectionId)
        const nextActiveCollectionId =
          activeCollectionId === collectionId ? null : activeCollectionId
        const nextVisibleBooks = filterBooksByCollection(payload.books, nextActiveCollectionId)

        setAllBooks(payload.books)
        setCollections(payload.collections)
        setActiveCollectionId(nextActiveCollectionId)

        if (!selection.bookId || !nextVisibleBooks.some((book) => book.id === selection.bookId)) {
          await hydrateFirstVisibleBook(payload.books, nextActiveCollectionId)
        }

        setLibraryNotice(`已删除集合「${target?.name ?? '未命名集合'}」，书籍已移回全部。`)
        setLibraryError('')
      } catch (error) {
        setLibraryNotice('')
        setLibraryError(error instanceof Error ? error.message : '集合删除失败。')
      }
    },
    [activeCollectionId, collections, hydrateFirstVisibleBook, selection.bookId, userId],
  )

  const moveBookToCollection = useCallback(
    async (bookId: string, collectionId: string | null) => {
      try {
        const cloudUserId = requireCloudUser(userId)
        const payload = await moveBookToCollectionInLibrary(cloudUserId, bookId, collectionId)
        const nextVisibleBooks = filterBooksByCollection(payload.books, activeCollectionId)
        const targetCollection = collectionId
          ? collections.find((collection) => collection.id === collectionId)
          : null

        setAllBooks(payload.books)

        if (!selection.bookId || !nextVisibleBooks.some((book) => book.id === selection.bookId)) {
          await hydrateFirstVisibleBook(payload.books, activeCollectionId)
        }

        setLibraryNotice(
          collectionId
            ? `已将《${payload.book.title}》移动到「${targetCollection?.name ?? '目标集合'}」。`
            : `已将《${payload.book.title}》移回全部。`,
        )
        setLibraryError('')
      } catch (error) {
        setLibraryNotice('')
        setLibraryError(error instanceof Error ? error.message : '移动书籍失败。')
      }
    },
    [activeCollectionId, collections, hydrateFirstVisibleBook, selection.bookId, userId],
  )

  const clearLibrary = useCallback(async () => {
    const cloudUserId = requireCloudUser(userId)
    await clearLibraryStorage(cloudUserId)
    setAllBooks([])
    setCollections([])
    setActiveCollectionId(null)
    setChapters([])
    currentChapterRef.current = null
    setCurrentChapter(null)
    setSavedResources([])
    setSelection({ bookId: null, chapterId: null })
    setLibraryNotice('书架数据已清空。')
    setLibraryError('')
  }, [userId])

  const getBookFile = useCallback(async (bookId: string) => {
    const cloudUserId = requireCloudUser(userId)
    return loadBookFile(cloudUserId, bookId)
  }, [userId])

  const migrateLegacyLocalLibrary = useCallback(async () => {
    const cloudUserId = requireCloudUser(userId)
    setIsMigratingLegacyLibrary(true)
    setLibraryError('')
    setLibraryNotice('')

    try {
      const initialState = await migrateLegacyLocalLibraryStorage(cloudUserId)
      setAllBooks(initialState.books)
      setCollections(initialState.collections)
      setSavedResources(initialState.savedResources)
      applyHydratedBook(initialState.hydratedBook)
      setHasLegacyLocalLibrary(false)
      setLibraryNotice('旧本地书库已导入云端。')
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : '旧本地书库导入失败。')
      throw error
    } finally {
      setIsMigratingLegacyLibrary(false)
    }
  }, [applyHydratedBook, userId])

  return {
    adjacentChapterIds,
    activeCollectionId,
    chapters,
    clearLibrary,
    collectionBookCounts,
    collections,
    createCollection,
    currentChapter,
    deleteCollection,
    getBookFile,
    savedResources,
    importBook,
    hasLegacyLocalLibrary,
    saveManualDraftAsBook,
    isImporting,
    isLoading,
    isMigratingLegacyLibrary,
    libraryError,
    libraryNotice,
    openChapter,
    removeBook,
    removeChapter,
    selectedBook,
    selection,
    moveBookToCollection,
    migrateLegacyLocalLibrary,
    removeKnowledgeResourceById,
    removeKnowledgeResourcesByIds,
    removeKnowledgeResourceBySignature,
    selectBook,
    setActiveCollection,
    upsertKnowledgeResource,
    setCurrentChapter,
    setLibraryError,
    setLibraryNotice,
    updateCurrentChapter,
    books,
    totalBookCount: allBooks.length,
  }
}
