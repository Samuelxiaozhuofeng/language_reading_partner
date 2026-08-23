import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AnalysisResult,
  BookChapterRecord,
  BookLanguage,
  BookRecord,
  CollectionRecord,
  LibrarySelection,
  PendingAnkiNote,
  SavedKnowledgeResource,
  SentenceItem,
} from '../types'
import { sortSavedResources } from '../lib/knowledge'
import {
  clearLibraryStorage,
  createCollectionInLibrary,
  createLocallyOpenedChapter,
  createOpenedChapterState,
  createRemovedChapterState,
  createUpdatedChapterState,
  deleteCollectionFromLibrary,
  type HydratedBookState,
  hydrateBookState,
  importBookToLibrary,
  loadBookFile,
  loadInitialLibraryState,
  markPendingAnkiNotesFailedInLibrary,
  markPendingAnkiNotesImportedInLibrary,
  migrateLegacyLocalLibraryStorage,
  moveBookToCollectionInLibrary,
  removeBookFromLibrary,
  removeChapterFromLibrary,
  removeKnowledgeResourceFromLibrary,
  removeKnowledgeResourcesFromLibrary,
  saveKnowledgeResourceToLibrary,
  saveManualDraftToLibrary,
  savePendingAnkiNoteToLibrary,
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

function resolveUserId(userId: string | null) {
  return userId || 'local'
}

type InitialLibraryState = {
  books: BookRecord[]
  collections: CollectionRecord[]
  hydratedBook: HydratedBookState | null
  pendingAnkiNotes: PendingAnkiNote[]
  savedResources: SavedKnowledgeResource[]
}

export function useLibraryStore(userId: string | null = 'local') {
  const [allBooks, setAllBooks] = useState<BookRecord[]>([])
  const [collections, setCollections] = useState<CollectionRecord[]>([])
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)
  const [chapters, setChapters] = useState<BookChapterRecord[]>([])
  const [pendingAnkiNotes, setPendingAnkiNotes] = useState<PendingAnkiNote[]>([])
  const [savedResources, setSavedResources] = useState<SavedKnowledgeResource[]>([])
  const [selection, setSelection] = useState<LibrarySelection>({ bookId: null, chapterId: null })
  const [currentChapter, setCurrentChapter] = useState<BookChapterRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [hasLegacyLocalLibrary] = useState(false)
  const [isMigratingLegacyLibrary, setIsMigratingLegacyLibrary] = useState(false)
  const [libraryNotice, setLibraryNotice] = useState('')
  const [libraryError, setLibraryError] = useState('')
  const currentChapterRef = useRef<BookChapterRecord | null>(null)
  const localActionVersionRef = useRef(0)

  useEffect(() => {
    currentChapterRef.current = currentChapter
  }, [currentChapter])

  const markLocalAction = useCallback(() => {
    localActionVersionRef.current += 1
    return localActionVersionRef.current
  }, [])

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

  const hydrateBook = useCallback(
    async (
      bookId: string,
      preferredChapterId?: string | null,
      shouldApply?: () => boolean,
    ) => {
      const targetUserId = resolveUserId(userId)
      const hydratedBook = await hydrateBookState(targetUserId, bookId, preferredChapterId)

      if (shouldApply && !shouldApply()) {
        return hydratedBook
      }

      applyHydratedBook(hydratedBook)
      return hydratedBook
    },
    [applyHydratedBook, userId],
  )

  const clearBookSelection = useCallback(() => {
    currentChapterRef.current = null
    setCurrentChapter(null)
    setChapters([])
    setSelection({ bookId: null, chapterId: null })
  }, [])

  const applyInitialLibraryState = useCallback(
    (initialState: InitialLibraryState) => {
      setAllBooks(initialState.books)
      setCollections(initialState.collections)
      setPendingAnkiNotes(initialState.pendingAnkiNotes ?? [])
      setSavedResources(initialState.savedResources)
      if (initialState.hydratedBook) {
        applyHydratedBook(initialState.hydratedBook)
      } else {
        clearBookSelection()
      }
    },
    [applyHydratedBook, clearBookSelection],
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
      const bootstrapVersion = localActionVersionRef.current
      const targetUserId = resolveUserId(userId)

      try {
        setIsLoading(true)
        setActiveCollectionId(null)
        const initialState = await loadInitialLibraryState(targetUserId)

        if (isCancelled || localActionVersionRef.current !== bootstrapVersion) {
          return
        }

        applyInitialLibraryState(initialState)
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
  }, [applyInitialLibraryState, userId])

  const updateCurrentChapter = useCallback(
    async (
      updater: (chapter: BookChapterRecord) => BookChapterRecord,
      options?: PersistChapterOptions,
    ) => {
      const chapter = currentChapterRef.current
      if (!chapter) {
        return null
      }

      const targetUserId = resolveUserId(userId)
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

      try {
        await syncChapterSnapshotToCloud(targetUserId, nextState.book, nextState.chapter)
      } catch (error) {
        setLibraryNotice('')
        setLibraryError(error instanceof Error ? error.message : '章节保存失败。')
      }

      return nextState.chapter
    },
    [chapters, selectedBook, userId],
  )

  const selectBook = useCallback(
    async (bookId: string) => {
      const actionVersion = markLocalAction()
      setLibraryError('')
      currentChapterRef.current = null
      await hydrateBook(bookId, null, () => localActionVersionRef.current === actionVersion)

      if (localActionVersionRef.current !== actionVersion) {
        return
      }

      setCurrentChapter(null)
    },
    [hydrateBook, markLocalAction],
  )

  const openChapter = useCallback(
    async (chapterId: string) => {
      markLocalAction()
      const targetUserId = resolveUserId(userId)
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

      void syncOpenedChapterToCloud(targetUserId, openedState).catch((error) => {
        setLibraryNotice('')
        setLibraryError(error instanceof Error ? error.message : '章节阅读进度更新失败。')
      })

      return openedState.chapter
    },
    [chapters, markLocalAction, selectedBook, userId],
  )

  const importBook = useCallback(
    async (file: File, language: BookLanguage) => {
      markLocalAction()
      const targetUserId = resolveUserId(userId)
      setIsImporting(true)
      setLibraryError('')

      try {
        const payload = await importBookToLibrary(targetUserId, file, language)
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
    },
    [markLocalAction, userId],
  )

  const saveManualDraftAsBook = useCallback(
    async ({
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
      markLocalAction()
      const trimmedSourceText = sourceText.trim()

      if (!trimmedSourceText) {
        setLibraryNotice('')
        setLibraryError('请先粘贴一段完整的原文，再保存到书架。')
        return null
      }

      const targetUserId = resolveUserId(userId)
      const payload = await saveManualDraftToLibrary(targetUserId, {
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
    },
    [markLocalAction, userId],
  )

  const removeBook = useCallback(
    async (bookId: string) => {
      markLocalAction()
      const targetUserId = resolveUserId(userId)
      const nextBooks = await removeBookFromLibrary(targetUserId, bookId)
      setAllBooks(nextBooks)
      setSavedResources((current) => current.filter((resource) => resource.bookId !== bookId))

      if (selection.bookId === bookId) {
        await hydrateFirstVisibleBook(nextBooks, activeCollectionId)
      }

      setLibraryNotice('书籍已从书架移除。')
      setLibraryError('')
    },
    [activeCollectionId, hydrateFirstVisibleBook, markLocalAction, selection.bookId, userId],
  )

  const removeChapter = useCallback(
    async (
      chapterId: string,
    ): Promise<{ nextCurrentChapterId: string | null; removedCurrentChapter: boolean } | null> => {
      markLocalAction()
      const targetUserId = resolveUserId(userId)
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

      void removeChapterFromLibrary(targetUserId, chapterId).catch((error) => {
        setLibraryNotice('')
        setLibraryError(error instanceof Error ? error.message : '章节删除失败。')
      })

      setLibraryNotice(`已删除章节《${payload.removedChapter.title}》。`)
      setLibraryError('')

      return {
        nextCurrentChapterId: nextCurrentChapter?.id ?? null,
        removedCurrentChapter,
      }
    },
    [chapters, markLocalAction, selectedBook, selection.bookId, selection.chapterId, userId],
  )

  const upsertKnowledgeResource = useCallback(
    async (resource: SavedKnowledgeResource) => {
      const targetUserId = resolveUserId(userId)
      const nextResource = await saveKnowledgeResourceToLibrary(targetUserId, resource)
      setSavedResources((current) =>
        sortSavedResources(
          current
            .filter((item) => item.id !== nextResource.id && item.signature !== nextResource.signature)
            .concat(nextResource),
        ),
      )
      setLibraryNotice(`已收藏「${nextResource.text}」到学习资源。`)
      setLibraryError('')
      return nextResource
    },
    [userId],
  )

  const enqueuePendingAnkiNote = useCallback(
    async (note: PendingAnkiNote) => {
      const targetUserId = resolveUserId(userId)
      const nextNote = await savePendingAnkiNoteToLibrary(targetUserId, note)
      setPendingAnkiNotes((current) => [
        nextNote,
        ...current.filter((item) => item.id !== nextNote.id && item.dedupeKey !== nextNote.dedupeKey),
      ])
      setLibraryNotice(`已将「${nextNote.text}」加入 Anki 待导入列表。`)
      setLibraryError('')
      return nextNote
    },
    [userId],
  )

  const markPendingAnkiNotesImported = useCallback(
    async (noteIds: string[]) => {
      if (noteIds.length === 0) {
        return
      }

      const targetUserId = resolveUserId(userId)
      const nextPendingNotes = await markPendingAnkiNotesImportedInLibrary(targetUserId, noteIds)
      setPendingAnkiNotes(nextPendingNotes)
      setLibraryNotice(`已成功导入 ${noteIds.length} 条待同步 Anki 条目。`)
      setLibraryError('')
    },
    [userId],
  )

  const markPendingAnkiNotesFailed = useCallback(
    async (noteIds: string[], message: string) => {
      if (noteIds.length === 0) {
        return
      }

      const targetUserId = resolveUserId(userId)
      const nextPendingNotes = await markPendingAnkiNotesFailedInLibrary(
        targetUserId,
        noteIds,
        message,
      )
      setPendingAnkiNotes(nextPendingNotes)
      setLibraryNotice('')
      setLibraryError(message)
    },
    [userId],
  )

  const removeKnowledgeResourceById = useCallback(
    async (resourceId: string) => {
      const target = savedResources.find((resource) => resource.id === resourceId)
      if (!target) {
        return
      }

      const targetUserId = resolveUserId(userId)
      await removeKnowledgeResourceFromLibrary(targetUserId, resourceId)
      setSavedResources((current) => current.filter((resource) => resource.id !== resourceId))
      setLibraryNotice(`已从学习资源移除「${target.text}」。`)
      setLibraryError('')
    },
    [savedResources, userId],
  )

  const removeKnowledgeResourceBySignature = useCallback(
    async (signature: string) => {
      const target = savedResources.find((resource) => resource.signature === signature)
      if (!target) {
        return
      }

      await removeKnowledgeResourceById(target.id)
    },
    [removeKnowledgeResourceById, savedResources],
  )

  const removeKnowledgeResourcesByIds = useCallback(
    async (resourceIds: string[]) => {
      if (resourceIds.length === 0) {
        return
      }

      const targets = savedResources.filter((resource) => resourceIds.includes(resource.id))
      if (targets.length === 0) {
        return
      }

      const targetUserId = resolveUserId(userId)
      await removeKnowledgeResourcesFromLibrary(
        targetUserId,
        targets.map((resource) => resource.id),
      )
      setSavedResources((current) =>
        current.filter((resource) => !resourceIds.includes(resource.id)),
      )
      setLibraryNotice(`已从学习资源移除 ${targets.length} 条知识点。`)
      setLibraryError('')
    },
    [savedResources, userId],
  )

  const setActiveCollection = useCallback(
    async (collectionId: string | null) => {
      markLocalAction()
      setActiveCollectionId(collectionId)

      const nextVisibleBooks = filterBooksByCollection(allBooks, collectionId)
      if (!selection.bookId || !nextVisibleBooks.some((book) => book.id === selection.bookId)) {
        await hydrateFirstVisibleBook(allBooks, collectionId)
      }

      setLibraryError('')
    },
    [allBooks, hydrateFirstVisibleBook, markLocalAction, selection.bookId],
  )

  const createCollection = useCallback(
    async (name: string) => {
      try {
        markLocalAction()
        const targetUserId = resolveUserId(userId)
        const payload = await createCollectionInLibrary(targetUserId, name)
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
    [allBooks, hydrateFirstVisibleBook, markLocalAction, userId],
  )

  const deleteCollection = useCallback(
    async (collectionId: string) => {
      try {
        markLocalAction()
        const target = collections.find((collection) => collection.id === collectionId)
        const targetUserId = resolveUserId(userId)
        const payload = await deleteCollectionFromLibrary(targetUserId, collectionId)
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
    [activeCollectionId, collections, hydrateFirstVisibleBook, markLocalAction, selection.bookId, userId],
  )

  const moveBookToCollection = useCallback(
    async (bookId: string, collectionId: string | null) => {
      try {
        markLocalAction()
        const targetUserId = resolveUserId(userId)
        const payload = await moveBookToCollectionInLibrary(targetUserId, bookId, collectionId)
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
    [activeCollectionId, collections, hydrateFirstVisibleBook, markLocalAction, selection.bookId, userId],
  )

  const clearLibrary = useCallback(async () => {
    markLocalAction()
    const targetUserId = resolveUserId(userId)
    await clearLibraryStorage(targetUserId)
    setAllBooks([])
    setCollections([])
    setActiveCollectionId(null)
    setChapters([])
    currentChapterRef.current = null
    setCurrentChapter(null)
    setPendingAnkiNotes([])
    setSavedResources([])
    setSelection({ bookId: null, chapterId: null })
    setLibraryNotice('书架数据已清空。')
    setLibraryError('')
  }, [markLocalAction, userId])

  const getBookFile = useCallback(
    async (bookId: string) => {
      const targetUserId = resolveUserId(userId)
      return loadBookFile(targetUserId, bookId)
    },
    [userId],
  )

  const migrateLegacyLocalLibrary = useCallback(async () => {
    markLocalAction()
    const targetUserId = resolveUserId(userId)
    setIsMigratingLegacyLibrary(true)
    setLibraryError('')
    setLibraryNotice('')

    try {
      const initialState = await migrateLegacyLocalLibraryStorage(targetUserId)
      setAllBooks(initialState.books)
      setCollections(initialState.collections)
      setPendingAnkiNotes(initialState.pendingAnkiNotes)
      setSavedResources(initialState.savedResources)
      applyHydratedBook(initialState.hydratedBook)
      setLibraryNotice('本地书库已刷新。')
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : '本地书库载入失败。')
      throw error
    } finally {
      setIsMigratingLegacyLibrary(false)
    }
  }, [applyHydratedBook, markLocalAction, userId])

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
    pendingAnkiNotes,
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
    enqueuePendingAnkiNote,
    markPendingAnkiNotesFailed,
    markPendingAnkiNotesImported,
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
