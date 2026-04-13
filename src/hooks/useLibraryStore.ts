import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  BookChapterRecord,
  BookRecord,
  LibrarySelection,
  SavedKnowledgeResource,
} from '../types'
import { deriveBookAnalysisState, normalizeChapterRecord } from '../lib/chapterText'
import { importEpubBook } from '../lib/epub'
import { sortSavedResources } from '../lib/knowledge'
import {
  clearLibraryDb,
  deleteChapterCascade,
  deleteKnowledgeResource,
  deleteKnowledgeResources,
  deleteBookCascade,
  getBook,
  getBooks,
  getChapter,
  getChaptersByBook,
  getSavedResourceBySignature,
  getSavedResources,
  saveBook,
  saveChapter,
  saveKnowledgeResource,
  saveImportedBook,
} from '../lib/libraryDb'

type PersistChapterOptions = {
  markOpened?: boolean
}

type RemoveChapterResult = {
  nextCurrentChapterId: string | null
  removedCurrentChapter: boolean
}

function updateBookInList(books: BookRecord[], nextBook: BookRecord) {
  return books
    .map((book) => (book.id === nextBook.id ? nextBook : book))
    .sort((left, right) => {
      const leftTime = left.lastOpenedAt ?? left.importedAt
      const rightTime = right.lastOpenedAt ?? right.importedAt
      return rightTime.localeCompare(leftTime)
    })
}

export function useLibraryStore() {
  const [books, setBooks] = useState<BookRecord[]>([])
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

  const selectedBook = useMemo(
    () => books.find((book) => book.id === selection.bookId) ?? null,
    [books, selection.bookId],
  )

  const adjacentChapterIds = useMemo(() => {
    if (!currentChapter) {
      return { previousId: null, nextId: null }
    }

    const index = chapters.findIndex((chapter) => chapter.id === currentChapter.id)
    return {
      previousId: chapters[index - 1]?.id ?? null,
      nextId: chapters[index + 1]?.id ?? null,
    }
  }, [chapters, currentChapter])

  const hydrateBook = useCallback(async (bookId: string, preferredChapterId?: string | null) => {
    const [nextBook, nextChaptersRaw] = await Promise.all([getBook(bookId), getChaptersByBook(bookId)])
    if (!nextBook) {
      return
    }

    const nextChapters = nextChaptersRaw.map((chapter) => normalizeChapterRecord(chapter))
    setBooks((current) => updateBookInList(current, nextBook))
    setChapters(nextChapters)
    setSelection({
      bookId,
      chapterId: preferredChapterId ?? nextBook.lastReadChapterId ?? nextChapters[0]?.id ?? null,
    })
  }, [])

  useEffect(() => {
    let isCancelled = false

    async function bootstrap() {
      try {
        const [nextBooks, nextResources] = await Promise.all([getBooks(), getSavedResources()])
        if (isCancelled) {
          return
        }

        setBooks(nextBooks)
        setSavedResources(sortSavedResources(nextResources))

        if (nextBooks[0]) {
          await hydrateBook(nextBooks[0].id, nextBooks[0].lastReadChapterId)
        }
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
  }, [hydrateBook])

  const persistChapter = useCallback(
    async (chapter: BookChapterRecord, options?: PersistChapterOptions) => {
      const timestamp = new Date().toISOString()
      const nextChapter = normalizeChapterRecord(chapter, {
        lastOpenedAt: options?.markOpened ? timestamp : chapter.lastOpenedAt,
      })

      await saveChapter(nextChapter)

      setCurrentChapter((current) => (current?.id === nextChapter.id ? nextChapter : current))
      setChapters((currentChapters) => {
        const nextChapters = currentChapters.map((currentChapterItem) =>
          currentChapterItem.id === nextChapter.id ? nextChapter : currentChapterItem,
        )

        void (async () => {
          const currentBook = await getBook(nextChapter.bookId)
          if (!currentBook) {
            return
          }

          const nextBook: BookRecord = {
            ...currentBook,
            chapterCount: nextChapters.length,
            lastReadChapterId: nextChapter.id,
            lastOpenedAt: options?.markOpened ? timestamp : currentBook.lastOpenedAt,
            analysisState: deriveBookAnalysisState(nextChapters),
          }

          await saveBook(nextBook)
          setBooks((currentBooks) => updateBookInList(currentBooks, nextBook))
        })()

        return nextChapters
      })
    },
    [],
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
      await hydrateBook(bookId)
      setCurrentChapter(null)
    },
    [hydrateBook],
  )

  const openChapter = useCallback(
    async (chapterId: string) => {
      const chapterRecord = await getChapter(chapterId)
      if (!chapterRecord) {
        setLibraryError('章节不存在，可能已经被删除。')
        return null
      }

      const chapter = normalizeChapterRecord(chapterRecord)
      setSelection({ bookId: chapter.bookId, chapterId })
      setCurrentChapter(chapter)
      await hydrateBook(chapter.bookId, chapterId)
      await persistChapter(chapter, { markOpened: true })
      setLibraryNotice(`已打开章节《${chapter.title}》。`)
      setLibraryError('')
      return chapter
    },
    [hydrateBook, persistChapter],
  )

  const importBook = useCallback(async (file: File) => {
    setIsImporting(true)
    setLibraryError('')

    try {
      const payload = await importEpubBook(file)
      const normalizedChapters = payload.chapters.map((chapter) => normalizeChapterRecord(chapter))
      await saveImportedBook(payload.book, normalizedChapters)
      setBooks((current) => updateBookInList(current, payload.book))
      setChapters(normalizedChapters)
      setSelection({
        bookId: payload.book.id,
        chapterId: normalizedChapters[0]?.id ?? null,
      })
      setCurrentChapter(normalizedChapters[0] ?? null)
      setLibraryNotice(`已导入《${payload.book.title}》，共 ${payload.book.chapterCount} 章。`)
      return {
        ...payload,
        chapters: normalizedChapters,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'EPUB 导入失败。'
      setLibraryError(message)
      throw error
    } finally {
      setIsImporting(false)
    }
  }, [])

  const removeBook = useCallback(
    async (bookId: string) => {
      await deleteBookCascade(bookId)

      const nextBooks = books.filter((book) => book.id !== bookId)
      setBooks(nextBooks)
      setSavedResources((current) => current.filter((resource) => resource.bookId !== bookId))

      if (selection.bookId === bookId) {
        setChapters([])
        setCurrentChapter(null)
        setSelection({ bookId: nextBooks[0]?.id ?? null, chapterId: null })
        if (nextBooks[0]) {
          await hydrateBook(nextBooks[0].id)
        }
      }

      setLibraryNotice('书籍已从本地书架移除。')
    },
    [books, hydrateBook, selection.bookId],
  )

  const removeChapter = useCallback(
    async (chapterId: string): Promise<RemoveChapterResult | null> => {
      const chapterRecord = chapters.find((chapter) => chapter.id === chapterId) ?? (await getChapter(chapterId))
      if (!chapterRecord) {
        setLibraryError('章节不存在，可能已经被删除。')
        return null
      }

      const targetChapter = normalizeChapterRecord(chapterRecord)

      await deleteChapterCascade(chapterId)

      const siblingChapters =
        selection.bookId === targetChapter.bookId
          ? chapters
          : (await getChaptersByBook(targetChapter.bookId)).map((chapter) =>
              normalizeChapterRecord(chapter),
            )

      const nextChapters = siblingChapters
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

      await Promise.all(
        nextChapters.map((chapter) =>
          siblingChapters.some(
            (currentChapterItem) =>
              currentChapterItem.id === chapter.id && currentChapterItem.order !== chapter.order,
          )
            ? saveChapter(chapter)
            : Promise.resolve(),
        ),
      )

      const currentBook = await getBook(targetChapter.bookId)
      if (currentBook) {
        const fallbackChapter =
          nextChapters[targetChapter.order] ?? nextChapters[targetChapter.order - 1] ?? null
        const nextLastReadChapterId =
          currentBook.lastReadChapterId === chapterId
            ? fallbackChapter?.id
            : currentBook.lastReadChapterId

        const nextBook: BookRecord = {
          ...currentBook,
          chapterCount: nextChapters.length,
          lastReadChapterId: nextLastReadChapterId,
          analysisState: deriveBookAnalysisState(nextChapters),
        }

        await saveBook(nextBook)
        setBooks((current) => updateBookInList(current, nextBook))
      }

      const removedCurrentChapter = currentChapterRef.current?.id === chapterId
      const nextCurrentChapter =
        currentChapterRef.current?.bookId === targetChapter.bookId
          ? nextChapters.find((chapter) => chapter.id === currentChapterRef.current?.id) ??
            nextChapters[targetChapter.order] ??
            nextChapters[targetChapter.order - 1] ??
            null
          : currentChapterRef.current

      currentChapterRef.current = nextCurrentChapter
      setCurrentChapter(nextCurrentChapter)
      setSavedResources((current) => current.filter((resource) => resource.chapterId !== chapterId))

      if (selection.bookId === targetChapter.bookId) {
        const nextSelectedChapterId =
          selection.chapterId === chapterId
            ? nextChapters[targetChapter.order]?.id ?? nextChapters[targetChapter.order - 1]?.id ?? null
            : selection.chapterId

        setChapters(nextChapters)
        setSelection({
          bookId: targetChapter.bookId,
          chapterId: nextSelectedChapterId,
        })
      }

      setLibraryNotice(`已删除章节《${targetChapter.title}》。`)
      setLibraryError('')

      return {
        nextCurrentChapterId: nextCurrentChapter?.id ?? null,
        removedCurrentChapter,
      }
    },
    [chapters, selection.bookId, selection.chapterId],
  )

  const upsertKnowledgeResource = useCallback(async (resource: SavedKnowledgeResource) => {
    const existing = await getSavedResourceBySignature(resource.signature)
    const nextResource = existing
      ? {
          ...existing,
          ...resource,
          id: existing.id,
        }
      : resource

    await saveKnowledgeResource(nextResource)
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

    await deleteKnowledgeResource(resourceId)
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

    await deleteKnowledgeResources(targets.map((resource) => resource.id))
    setSavedResources((current) => current.filter((resource) => !resourceIds.includes(resource.id)))
    setLibraryNotice(`已从学习资源移除 ${targets.length} 条知识点。`)
    setLibraryError('')
  }, [savedResources])

  const clearLibrary = useCallback(async () => {
    await clearLibraryDb()
    setBooks([])
    setChapters([])
    setCurrentChapter(null)
    setSavedResources([])
    setSelection({ bookId: null, chapterId: null })
    setLibraryNotice('书架数据已清空。')
    setLibraryError('')
  }, [])

  return {
    adjacentChapterIds,
    chapters,
    clearLibrary,
    currentChapter,
    savedResources,
    importBook,
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
    removeKnowledgeResourceById,
    removeKnowledgeResourcesByIds,
    removeKnowledgeResourceBySignature,
    selectBook,
    upsertKnowledgeResource,
    setCurrentChapter,
    setLibraryError,
    setLibraryNotice,
    updateCurrentChapter,
    books,
  }
}
