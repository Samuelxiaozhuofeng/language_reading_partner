import { useCallback, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  getDefaultSentenceRange,
  getSentencesInRange,
  normalizeSentenceRange,
} from '../lib/chapterRange'
import type {
  AnalysisDocumentContext,
  AnalysisResult,
  BookChapterRecord,
  BookRecord,
  RunSession,
  SentenceItem,
  SentenceRange,
  WorkspaceSource,
} from '../types'

type PersistentDraftState = {
  articleTitle: string
  history: RunSession[]
  initialNotice: string
  results: Record<string, AnalysisResult>
  sentences: SentenceItem[]
  setResults: Dispatch<SetStateAction<Record<string, AnalysisResult>>>
  setSentences: Dispatch<SetStateAction<SentenceItem[]>>
  setSourceText: Dispatch<SetStateAction<string>>
  sourceText: string
}

type LibraryWorkspaceState = {
  currentChapter: BookChapterRecord | null
  selectedBook: BookRecord | null
  setLibraryError: Dispatch<SetStateAction<string>>
  setLibraryNotice: Dispatch<SetStateAction<string>>
  updateCurrentChapter: (
    updater: (chapter: BookChapterRecord) => BookChapterRecord,
  ) => Promise<BookChapterRecord | null>
}

type UseWorkspaceBindingArgs = {
  chapterRangeOverrides: Record<string, SentenceRange | null>
  library: LibraryWorkspaceState
  persistent: PersistentDraftState
  workspaceSource: WorkspaceSource
}

function resolveStateAction<T>(current: T, action: SetStateAction<T>) {
  return typeof action === 'function' ? (action as (value: T) => T)(current) : action
}

function getSafeChapterRange(
  sentences: SentenceItem[],
  range: SentenceRange | null | undefined,
) {
  return normalizeSentenceRange(range, sentences.length)
}

export function useWorkspaceBinding({
  chapterRangeOverrides,
  library,
  persistent,
  workspaceSource,
}: UseWorkspaceBindingArgs) {
  const effectiveWorkspaceSource: WorkspaceSource =
    workspaceSource === 'chapter' && library.currentChapter ? 'chapter' : 'draft'

  const activeChapter = effectiveWorkspaceSource === 'chapter' ? library.currentChapter : null
  const workspaceSourceText = activeChapter?.sourceText ?? persistent.sourceText
  const workspaceSentences = activeChapter?.sentences ?? persistent.sentences
  const workspaceResults = activeChapter?.results ?? persistent.results
  const chapterRangeOverride = activeChapter ? chapterRangeOverrides[activeChapter.id] : undefined

  const setWorkspaceSourceText: Dispatch<SetStateAction<string>> = useCallback((action) => {
    if (effectiveWorkspaceSource === 'draft') {
      library.setLibraryNotice('')
      library.setLibraryError('')
      persistent.setSourceText(action)
      return
    }

    void library.updateCurrentChapter((chapter) => ({
      ...chapter,
      sourceText: resolveStateAction(chapter.sourceText, action),
    }))
  }, [effectiveWorkspaceSource, library, persistent])

  const setWorkspaceSentences: Dispatch<SetStateAction<SentenceItem[]>> = useCallback((action) => {
    if (effectiveWorkspaceSource === 'draft') {
      persistent.setSentences(action)
      return
    }

    void library.updateCurrentChapter((chapter) => ({
      ...chapter,
      sentences: resolveStateAction(chapter.sentences, action),
    }))
  }, [effectiveWorkspaceSource, library, persistent])

  const setWorkspaceResults: Dispatch<SetStateAction<Record<string, AnalysisResult>>> = useCallback((action) => {
    if (effectiveWorkspaceSource === 'draft') {
      persistent.setResults(action)
      return
    }

    void library.updateCurrentChapter((chapter) => ({
      ...chapter,
      results: resolveStateAction(chapter.results, action),
    }))
  }, [effectiveWorkspaceSource, library, persistent])

  const initialNotice =
    effectiveWorkspaceSource === 'chapter' && activeChapter
      ? `已载入《${library.selectedBook?.title ?? '当前书籍'}》的章节《${activeChapter.title}》。`
      : persistent.initialNotice

  const selectedChapterRange = useMemo(
    () =>
      effectiveWorkspaceSource === 'chapter'
        ? getSafeChapterRange(
            workspaceSentences,
            chapterRangeOverride ??
              getDefaultSentenceRange(
                workspaceSentences.length,
                activeChapter?.activeRange ?? null,
              ),
          )
        : null,
    [
      activeChapter?.activeRange,
      chapterRangeOverride,
      effectiveWorkspaceSource,
      workspaceSentences,
    ],
  )

  const activeReadingRange = useMemo(
    () =>
      effectiveWorkspaceSource === 'chapter'
        ? getSafeChapterRange(workspaceSentences, activeChapter?.activeRange)
        : null,
    [activeChapter?.activeRange, effectiveWorkspaceSource, workspaceSentences],
  )

  const workspaceVisibleSentences =
    effectiveWorkspaceSource === 'chapter'
      ? getSentencesInRange(workspaceSentences, selectedChapterRange)
      : workspaceSentences

  const readingRangeSentences =
    effectiveWorkspaceSource === 'chapter'
      ? getSentencesInRange(workspaceSentences, activeReadingRange)
      : workspaceSentences

  const readingVisibleSentences =
    effectiveWorkspaceSource === 'chapter'
      ? readingRangeSentences.filter((sentence) => workspaceResults[sentence.id])
      : workspaceSentences

  const analysisDocumentContext: AnalysisDocumentContext =
    effectiveWorkspaceSource === 'chapter'
      ? {
          documentType: 'chapter',
          title: library.selectedBook?.title,
          author: library.selectedBook?.author,
          chapterTitle: activeChapter?.title,
        }
      : {
          documentType: 'article',
          title: persistent.articleTitle,
        }

  const currentContextTitle =
    effectiveWorkspaceSource === 'chapter'
      ? {
          bookTitle: library.selectedBook?.title ?? '当前书籍',
          chapterTitle: activeChapter?.title ?? '未命名章节',
        }
      : undefined

  const manualHistory = effectiveWorkspaceSource === 'draft' ? persistent.history : []

  return {
    activeChapter,
    activeReadingRange,
    analysisDocumentContext,
    currentContextTitle,
    effectiveWorkspaceSource,
    initialNotice,
    manualHistory,
    readingRangeSentences,
    readingVisibleSentences,
    selectedChapterRange,
    setWorkspaceResults,
    setWorkspaceSentences,
    setWorkspaceSourceText,
    workspaceResults,
    workspaceSentences,
    workspaceSourceText,
    workspaceVisibleSentences,
  }
}
