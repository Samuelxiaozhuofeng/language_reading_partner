import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AnalysisResult,
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
  createCollectionInLibrary,
  deleteCollectionFromLibrary,
  type HydratedBookState,
  hydrateBookState,
  importBookToLibrary,
  loadBookFile,
  loadInitialLibraryState,
  moveBookToCollectionInLibrary,
  openChapterRecord,
  persistChapterRecord,
  type PersistChapterOptions,
  removeBookFromLibrary,
  removeChapterFromLibrary,
  removeKnowledgeResourceFromLibrary,
  removeKnowledgeResourcesFromLibrary,
  saveKnowledgeResourceToLibrary,
  saveManualDraftToLibrary,
} from '../lib/library/service'
import {
  getAdjacentChapterIds,
  resolveNextCurrentChapterAfterRemoval,
  resolveNextSelectedChapterIdAfterRemoval,
  updateBookInList,
} from '../lib/library/selectors'

function filterBooksByCollection(books: BookRecord[], collectionId: string | null) {
  return collectionId ? books.filter((book) => book.collectionId === collectionId) : books
}

export function useLibraryStore() {
  const [allBooks, setAllBooks] = useState<BookRecord[]>([])
  const [collections, setCollections] = useState<CollectionRecord[]>([])
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null)
  const [chapters, setChapters] = useState<BookChapterRecord[]>([])
  const [savedResources, setSavedResources] = useState<SavedKnowledgeResource[]>([])
  const [selection, setSelection] = useState<LibrarySelection>({ bookId: null, chapterId: null })
  const [currentChapter, setCurrentChapter] = useState<BookChapterRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [libraryNotice, setLibraryNotice] = useState('')
  const [libraryError, setLibraryError] = useState('')
  const currentChapterRef = useRef<BookChapterRecord | null>(null)

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
    const hydratedBook = await hydrateBookState(bookId, preferredChapterId)
    applyHydratedBook(hydratedBook)
  }, [applyHydratedBook])

  const clearBookSelection = useCallback(() => {
    currentChapterRef.current = null
    setCurrentChapter(null)
    setChapters([])
    setSelection({ bookId: null, chapterId: null })
  }, [])

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
      try {
        const initialState = await loadInitialLibraryState()
        if (isCancelled) {
          return
        }

        setAllBooks(initialState.books)
        setCollections(initialState.collections)
        setSavedResources(initialState.savedResources)
        applyHydratedBook(initialState.hydratedBook)
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
  }, [applyHydratedBook])

  const persistChapter = useCallback(
    async (chapter: BookChapterRecord, options?: PersistChapterOptions) => {
      const persisted = await persistChapterRecord(chapter, options)
      setCurrentChapter((current) => (current?.id === persisted.chapter.id ? persisted.chapter : current))
      if (selection.bookId === persisted.chapter.bookId) {
        setChapters(persisted.chapters)
      }
      const persistedBook = persisted.book
      if (persistedBook) {
        setAllBooks((currentBooks) => updateBookInList(currentBooks, persistedBook))
      }
    },
    [selection.bookId],
  )

  const updateCurrentChapter = useCallback(
    async (
      updater: (chapter: BookChapterRecord) => BookChapterRecord,
      options?: PersistChapterOptions,
    ) => {
      const chapter = currentChapterRef.current
      if (!chapter) {
        return null
      }

      const nextChapter = updater(chapter)
      currentChapterRef.current = nextChapter
      await persistChapter(nextChapter, options)
      return nextChapter
    },
    [persistChapter],
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
      const payload = await openChapterRecord(chapterId)
      if (!payload) {
        setLibraryError('章节不存在，可能已经被删除。')
        return null
      }

      applyHydratedBook(payload.hydratedBook)
      currentChapterRef.current = payload.persisted.chapter
      setCurrentChapter(payload.persisted.chapter)
      const persistedBook = payload.persisted.book
      if (persistedBook) {
        setAllBooks((current) => updateBookInList(current, persistedBook))
      }
      setChapters(payload.persisted.chapters)
      setSelection({ bookId: payload.chapter.bookId, chapterId })
      setLibraryNotice(`已打开章节《${payload.chapter.title}》。`)
      setLibraryError('')
      return payload.persisted.chapter
    },
    [applyHydratedBook],
  )

  const importBook = useCallback(async (file: File) => {
    setIsImporting(true)
    setLibraryError('')

    try {
      const payload = await importBookToLibrary(file)
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
  }, [])

  const saveManualDraftAsBook = useCallback(async ({
    articleTitle,
    results,
    sentences,
    sourceText,
  }: {
    articleTitle: string
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

    const payload = await saveManualDraftToLibrary({
      articleTitle: articleTitle.trim(),
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
  }, [])

  const removeBook = useCallback(
    async (bookId: string) => {
      const nextBooks = await removeBookFromLibrary(bookId)
      setAllBooks(nextBooks)
      setSavedResources((current) => current.filter((resource) => resource.bookId !== bookId))

      if (selection.bookId === bookId) {
        await hydrateFirstVisibleBook(nextBooks, activeCollectionId)
      }

      setLibraryNotice('书籍已从本地书架移除。')
      setLibraryError('')
    },
    [activeCollectionId, hydrateFirstVisibleBook, selection.bookId],
  )

  const removeChapter = useCallback(
    async (chapterId: string): Promise<{ nextCurrentChapterId: string | null; removedCurrentChapter: boolean } | null> => {
      const payload = await removeChapterFromLibrary(chapterId)
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

      setLibraryNotice(`已删除章节《${payload.removedChapter.title}》。`)
      setLibraryError('')

      return {
        nextCurrentChapterId: nextCurrentChapter?.id ?? null,
        removedCurrentChapter,
      }
    },
    [selection.bookId, selection.chapterId],
  )

  const upsertKnowledgeResource = useCallback(async (resource: SavedKnowledgeResource) => {
    const nextResource = await saveKnowledgeResourceToLibrary(resource)
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
  }, [])

  const removeKnowledgeResourceById = useCallback(async (resourceId: string) => {
    const target = savedResources.find((resource) => resource.id === resourceId)
    if (!target) {
      return
    }

    await removeKnowledgeResourceFromLibrary(resourceId)
    setSavedResources((current) => current.filter((resource) => resource.id !== resourceId))
    setLibraryNotice(`已从学习资源移除「${target.text}」。`)
    setLibraryError('')
  }, [savedResources])

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

    await removeKnowledgeResourcesFromLibrary(targets.map((resource) => resource.id))
    setSavedResources((current) => current.filter((resource) => !resourceIds.includes(resource.id)))
    setLibraryNotice(`已从学习资源移除 ${targets.length} 条知识点。`)
    setLibraryError('')
  }, [savedResources])

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
        const payload = await createCollectionInLibrary(name)
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
    [allBooks, hydrateFirstVisibleBook],
  )

  const deleteCollection = useCallback(
    async (collectionId: string) => {
      try {
        const target = collections.find((collection) => collection.id === collectionId)
        const payload = await deleteCollectionFromLibrary(collectionId)
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
    [activeCollectionId, collections, hydrateFirstVisibleBook, selection.bookId],
  )

  const moveBookToCollection = useCallback(
    async (bookId: string, collectionId: string | null) => {
      try {
        const payload = await moveBookToCollectionInLibrary(bookId, collectionId)
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
    [activeCollectionId, collections, hydrateFirstVisibleBook, selection.bookId],
  )

  const clearLibrary = useCallback(async () => {
    await clearLibraryStorage()
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
  }, [])

  const getBookFile = useCallback(async (bookId: string) => {
    return loadBookFile(bookId)
  }, [])

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
    saveManualDraftAsBook,
    isImporting,
    isLoading,
    libraryError,
    libraryNotice,
    openChapter,
    persistChapter,
    removeBook,
    removeChapter,
    selectedBook,
    selection,
    moveBookToCollection,
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
