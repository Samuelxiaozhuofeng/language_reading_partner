import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { addNoteToAnki, buildAnkiNotePayload } from '../lib/anki'
import { DEFAULT_CHAPTER_RANGE_SIZE, doesRangeContainSentenceIndex, getSentenceRangeAroundIndex } from '../lib/chapterRange'
import { buildKnowledgeSignature } from '../lib/knowledge'
import { buildReadingResumeAnchor, resolveReadingResumeAnchor } from '../lib/readingAnchor'
import type {
  AnalysisHighlight,
  AnalysisResult,
  AnkiConfig,
  AppPage,
  BookChapterRecord,
  BookRecord,
  SentenceItem,
  WorkspaceSource,
} from '../types'

type PersistentActionState = {
  ankiConfig: AnkiConfig
  articleTitle: string
  resetAll: () => void
  setArticleTitle: Dispatch<SetStateAction<string>>
}

type AnalysisActionState = {
  clearStatus: () => void
}

type LibraryActionState = {
  clearLibrary: () => Promise<void>
  currentChapter: BookChapterRecord | null
  importBook: (file: File) => Promise<{
    chapters: BookChapterRecord[]
  }>
  openChapter: (chapterId: string) => Promise<BookChapterRecord | null>
  removeBook: (bookId: string) => Promise<void>
  removeChapter: (chapterId: string) => Promise<{
    nextCurrentChapterId: string | null
    removedCurrentChapter: boolean
  } | null>
  removeKnowledgeResourceBySignature: (signature: string) => Promise<void>
  saveManualDraftAsBook: (input: {
    articleTitle: string
    results: Record<string, AnalysisResult>
    sentences: SentenceItem[]
    sourceText: string
  }) => Promise<{
    chapters: BookChapterRecord[]
  } | null>
  selectedBook: BookRecord | null
  setLibraryError: Dispatch<SetStateAction<string>>
  setLibraryNotice: Dispatch<SetStateAction<string>>
  updateCurrentChapter: (
    updater: (chapter: BookChapterRecord) => BookChapterRecord,
  ) => Promise<BookChapterRecord | null>
  upsertKnowledgeResource: (resource: {
    id: string
    signature: string
    text: string
    kind: AnalysisHighlight['kind']
    explanation: string
    grammarText: string
    meaning?: string
    sentenceId: string
    sentenceText: string
    savedAt: string
    bookId?: string
    bookTitle?: string
    chapterId?: string
    chapterTitle?: string
  }) => Promise<unknown>
}

type UseAppActionsArgs = {
  activeChapter: BookChapterRecord | null
  analysis: AnalysisActionState
  effectiveWorkspaceSource: WorkspaceSource
  library: LibraryActionState
  persistent: PersistentActionState
  setActivePage: Dispatch<SetStateAction<AppPage>>
  setIsSavingManualDraft: Dispatch<SetStateAction<boolean>>
  setWorkspaceSource: Dispatch<SetStateAction<WorkspaceSource>>
  workspaceResults: Record<string, AnalysisResult>
  workspaceSentences: SentenceItem[]
  workspaceSourceText: string
}

type ManualDraftSaveInput = {
  articleTitle?: string
  results?: Record<string, AnalysisResult>
  sentences?: SentenceItem[]
  sourceText?: string
}

export function useAppActions({
  activeChapter,
  analysis,
  effectiveWorkspaceSource,
  library,
  persistent,
  setActivePage,
  setIsSavingManualDraft,
  setWorkspaceSource,
  workspaceResults,
  workspaceSentences,
  workspaceSourceText,
}: UseAppActionsArgs) {
  const handleOpenManualWorkspace = useCallback(() => {
    library.setLibraryNotice('')
    library.setLibraryError('')
    setWorkspaceSource('draft')
    setActivePage('workspace')
  }, [library, setActivePage, setWorkspaceSource])

  const handleManualArticleTitleChange = useCallback((value: string) => {
    library.setLibraryNotice('')
    library.setLibraryError('')
    persistent.setArticleTitle(value)
  }, [library, persistent])

  const handleOpenChapterWorkspace = useCallback(async (chapterId: string) => {
    const chapter = await library.openChapter(chapterId)
    if (!chapter) {
      return
    }

    setWorkspaceSource('chapter')
    setActivePage('workspace')
  }, [library, setActivePage, setWorkspaceSource])

  const handleOpenChapterReading = useCallback(async (chapterId: string) => {
    const chapter = await library.openChapter(chapterId)
    if (!chapter) {
      return
    }

    const resolvedResumeAnchor = resolveReadingResumeAnchor(
      chapter.sentences,
      chapter.resumeAnchor,
    )
    const activeRangeSize =
      chapter.activeRange ? chapter.activeRange.end - chapter.activeRange.start + 1 : DEFAULT_CHAPTER_RANGE_SIZE

    if (
      resolvedResumeAnchor &&
      !doesRangeContainSentenceIndex(
        chapter.activeRange,
        resolvedResumeAnchor.index,
        chapter.sentences.length,
      )
    ) {
      const nextRange = getSentenceRangeAroundIndex(
        chapter.sentences.length,
        resolvedResumeAnchor.index,
        activeRangeSize,
      )

      if (nextRange) {
        await library.updateCurrentChapter((currentChapter) => ({
          ...currentChapter,
          activeRange: nextRange,
        }))
      }
    }

    setWorkspaceSource('chapter')
    setActivePage('reading')
  }, [library, setActivePage, setWorkspaceSource])

  const handleOpenRecentChapter = useCallback(async () => {
    if (!library.selectedBook?.lastReadChapterId) {
      return
    }

    await handleOpenChapterReading(library.selectedBook.lastReadChapterId)
  }, [handleOpenChapterReading, library.selectedBook?.lastReadChapterId])

  const handleOpenAdjacentChapter = useCallback(async (chapterId: string | null) => {
    if (!chapterId) {
      return
    }

    await handleOpenChapterReading(chapterId)
  }, [handleOpenChapterReading])

  const handleDeleteBook = useCallback(async (bookId: string) => {
    const shouldFallbackToDraft = library.currentChapter?.bookId === bookId
    await library.removeBook(bookId)

    if (shouldFallbackToDraft) {
      setWorkspaceSource('draft')
      setActivePage('library')
    }
  }, [library, setActivePage, setWorkspaceSource])

  const handleDeleteChapter = useCallback(async (chapterId: string) => {
    const result = await library.removeChapter(chapterId)

    if (!result) {
      return
    }

    if (result.removedCurrentChapter && !result.nextCurrentChapterId) {
      setWorkspaceSource('draft')
    }
  }, [library, setWorkspaceSource])

  const handleImportFile = useCallback(async (file: File) => {
    const payload = await library.importBook(file)
    if (payload.chapters[0]) {
      setWorkspaceSource('chapter')
      setActivePage('workspace')
    }
  }, [library, setActivePage, setWorkspaceSource])

  const handleSaveManualDraft = useCallback(async (input: ManualDraftSaveInput = {}) => {
    if (effectiveWorkspaceSource !== 'draft') {
      return
    }

    setIsSavingManualDraft(true)

    try {
      const payload = await library.saveManualDraftAsBook({
        articleTitle: input.articleTitle ?? persistent.articleTitle,
        sourceText: input.sourceText ?? workspaceSourceText,
        sentences: input.sentences ?? workspaceSentences,
        results: input.results ?? workspaceResults,
      })

      if (!payload?.chapters[0]) {
        return
      }

      setWorkspaceSource('chapter')
      setActivePage('workspace')
    } finally {
      setIsSavingManualDraft(false)
    }
  }, [
    effectiveWorkspaceSource,
    library,
    persistent.articleTitle,
    setActivePage,
    setIsSavingManualDraft,
    setWorkspaceSource,
    workspaceResults,
    workspaceSentences,
    workspaceSourceText,
  ])

  const handleSaveHighlight = useCallback(async (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => {
    await library.upsertKnowledgeResource({
      id: crypto.randomUUID(),
      signature: buildKnowledgeSignature(highlight.kind, highlight.text),
      text: highlight.text,
      kind: highlight.kind,
      explanation: highlight.explanation,
      grammarText: result.grammar,
      meaning: result.meaning,
      sentenceId: sentence.id,
      sentenceText: sentence.editedText || sentence.text,
      savedAt: new Date().toISOString(),
      bookId: activeChapter?.bookId,
      bookTitle: library.selectedBook?.title,
      chapterId: activeChapter?.id,
      chapterTitle: activeChapter?.title,
    })
  }, [activeChapter?.bookId, activeChapter?.id, activeChapter?.title, library])

  const handleRemoveHighlight = useCallback(async (signature: string) => {
    await library.removeKnowledgeResourceBySignature(signature)
  }, [library])

  const handleAddHighlightToAnki = useCallback(async (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: AnalysisHighlight,
  ) => {
    const noteHighlight = {
      ...highlight,
      id: `${sentence.id}:${highlight.kind}:${highlight.text}`,
    }

    await addNoteToAnki(
      persistent.ankiConfig,
      buildAnkiNotePayload(sentence, result, noteHighlight),
    )
  }, [persistent.ankiConfig])

  const handleSetResumeAnchor = useCallback(async (sentence: SentenceItem, sentenceIndex: number) => {
    if (effectiveWorkspaceSource !== 'chapter') {
      return
    }

    await library.updateCurrentChapter((chapter) => ({
      ...chapter,
      resumeAnchor: buildReadingResumeAnchor(sentence, sentenceIndex),
    }))
  }, [effectiveWorkspaceSource, library])

  const handleClearLocalData = useCallback(async () => {
    analysis.clearStatus()
    persistent.resetAll()
    await library.clearLibrary()
  }, [analysis, library, persistent])

  return {
    handleAddHighlightToAnki,
    handleClearLocalData,
    handleDeleteBook,
    handleDeleteChapter,
    handleImportFile,
    handleManualArticleTitleChange,
    handleOpenAdjacentChapter,
    handleOpenChapterReading,
    handleOpenChapterWorkspace,
    handleOpenManualWorkspace,
    handleOpenRecentChapter,
    handleRemoveHighlight,
    handleSaveHighlight,
    handleSaveManualDraft,
    handleSetResumeAnchor,
  }
}
