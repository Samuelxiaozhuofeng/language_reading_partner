import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import './App.css'
import LibraryPage from './components/LibraryPage'
import ReadingPage from './components/ReadingPage'
import ResourcesPage from './components/ResourcesPage'
import SettingsDialog from './components/SettingsDialog'
import WorkspacePage from './components/WorkspacePage'
import { countByStatus } from './lib/appState'
import {
  DEFAULT_CHAPTER_RANGE_SIZE,
  doesRangeContainSentenceIndex,
  getDefaultSentenceRange,
  getNextSentenceRange,
  getSentenceRangeAroundIndex,
  getSentencesInRange,
  normalizeSentenceRange,
} from './lib/chapterRange'
import { buildKnowledgeSignature } from './lib/knowledge'
import { buildReadingResumeAnchor, resolveReadingResumeAnchor } from './lib/readingAnchor'
import { useAnalysisRunner } from './hooks/useAnalysisRunner'
import { useLibraryStore } from './hooks/useLibraryStore'
import { usePersistentConfig } from './hooks/usePersistentConfig'
import type {
  AnalysisResult,
  AppPage,
  KnowledgeKind,
  SettingsTab,
  SentenceItem,
  SentenceRange,
  WorkspaceSource,
} from './types'

function resolveStateAction<T>(current: T, action: SetStateAction<T>) {
  return typeof action === 'function' ? (action as (value: T) => T)(current) : action
}

function getSafeChapterRange(
  sentences: SentenceItem[],
  range: SentenceRange | null | undefined,
) {
  return normalizeSentenceRange(range, sentences.length)
}

function areRangesEqual(left: SentenceRange | null, right: SentenceRange | null) {
  return left?.start === right?.start && left?.end === right?.end
}

function App() {
  const [activePage, setActivePage] = useState<AppPage>('library')
  const [workspaceSource, setWorkspaceSource] = useState<WorkspaceSource>('draft')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('ai')
  const [chapterRangeOverrides, setChapterRangeOverrides] = useState<Record<string, SentenceRange | null>>({})
  const [resourceFilter, setResourceFilter] = useState<KnowledgeKind | 'all'>('all')

  const persistent = usePersistentConfig()
  const library = useLibraryStore()

  const effectiveWorkspaceSource: WorkspaceSource =
    workspaceSource === 'chapter' && library.currentChapter ? 'chapter' : 'draft'

  const activeChapter = effectiveWorkspaceSource === 'chapter' ? library.currentChapter : null
  const workspaceSourceText = activeChapter?.sourceText ?? persistent.sourceText
  const workspaceSentences = activeChapter?.sentences ?? persistent.sentences
  const workspaceResults = activeChapter?.results ?? persistent.results
  const chapterRangeOverride = activeChapter ? chapterRangeOverrides[activeChapter.id] : undefined
  const activeReadingRange =
    effectiveWorkspaceSource === 'chapter'
      ? getSafeChapterRange(workspaceSentences, activeChapter?.activeRange)
      : null

  const setWorkspaceSourceText: Dispatch<SetStateAction<string>> = (action) => {
    if (effectiveWorkspaceSource === 'draft') {
      persistent.setSourceText(action)
      return
    }

    void library.updateCurrentChapter((chapter) => ({
      ...chapter,
      sourceText: resolveStateAction(chapter.sourceText, action),
    }))
  }

  const setWorkspaceSentences: Dispatch<SetStateAction<SentenceItem[]>> = (action) => {
    if (effectiveWorkspaceSource === 'draft') {
      persistent.setSentences(action)
      return
    }

    void library.updateCurrentChapter((chapter) => ({
      ...chapter,
      sentences: resolveStateAction(chapter.sentences, action),
    }))
  }

  const setWorkspaceResults: Dispatch<SetStateAction<Record<string, AnalysisResult>>> = (action) => {
    if (effectiveWorkspaceSource === 'draft') {
      persistent.setResults(action)
      return
    }

    void library.updateCurrentChapter((chapter) => ({
      ...chapter,
      results: resolveStateAction(chapter.results, action),
    }))
  }

  const initialNotice =
    effectiveWorkspaceSource === 'chapter' && activeChapter
      ? `已载入《${library.selectedBook?.title ?? '当前书籍'}》的章节《${activeChapter.title}》。`
      : persistent.initialNotice

  const selectedChapterRange =
    effectiveWorkspaceSource === 'chapter'
      ? getSafeChapterRange(
          workspaceSentences,
          chapterRangeOverride ??
            getDefaultSentenceRange(
              workspaceSentences.length,
              activeChapter?.activeRange ?? null,
            ),
        )
      : null
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

  const analysis = useAnalysisRunner({
    apiConfig: persistent.apiConfig,
    chapterRange: selectedChapterRange,
    initialNotice,
    onChapterRangeCommitted: (range) => {
      if (effectiveWorkspaceSource !== 'chapter') {
        return
      }

      return library.updateCurrentChapter((chapter) => {
        const previousRange = getSafeChapterRange(chapter.sentences, chapter.activeRange)
        let nextLastReadEnd = Math.max(-1, chapter.lastReadEnd ?? -1)

        if (range.start > 0) {
          nextLastReadEnd = Math.max(nextLastReadEnd, range.start - 1)
        }

        if (previousRange && range.start > previousRange.end) {
          nextLastReadEnd = Math.max(nextLastReadEnd, previousRange.end)
        }

        return {
          ...chapter,
          activeRange: range,
          lastReadEnd: nextLastReadEnd,
        }
      })
    },
    onChapterSegmentReset: (sentenceCount) => {
      if (effectiveWorkspaceSource !== 'chapter') {
        return
      }

      setChapterRangeOverrides((current) =>
        activeChapter
          ? {
              ...current,
              [activeChapter.id]: getDefaultSentenceRange(sentenceCount, null),
            }
          : current,
      )
      void library.updateCurrentChapter((chapter) => ({
        ...chapter,
        activeRange: null,
        lastReadEnd: -1,
      }))
    },
    promptConfig: persistent.promptConfig,
    results: workspaceResults,
    sentences: workspaceSentences,
    setHistory: effectiveWorkspaceSource === 'draft' ? persistent.setHistory : undefined,
    setResults: setWorkspaceResults,
    setSentences: setWorkspaceSentences,
    setSourceText: setWorkspaceSourceText,
    sourceText: workspaceSourceText,
    workspaceSource: effectiveWorkspaceSource,
  })

  const progressSentences =
    effectiveWorkspaceSource === 'chapter' ? workspaceVisibleSentences : workspaceSentences
  const successCount = countByStatus(progressSentences, 'success')
  const errorCount = countByStatus(progressSentences, 'error')
  const queuedCount = countByStatus(progressSentences, 'queued')
  const runningCount = countByStatus(progressSentences, 'running')
  const completedResultCount = Object.keys(workspaceResults).length
  const finishedCount = successCount + errorCount
  const progressTotal = progressSentences.length
  const progressPercent =
    progressTotal === 0 ? 0 : Math.round((finishedCount / progressTotal) * 100)
  const readingSuccessCount =
    effectiveWorkspaceSource === 'chapter'
      ? readingVisibleSentences.length
      : countByStatus(readingVisibleSentences, 'success')
  const readingErrorCount =
    effectiveWorkspaceSource === 'chapter'
      ? countByStatus(readingRangeSentences, 'error')
      : countByStatus(readingVisibleSentences, 'error')
  const recentChapter =
    library.selectedBook?.lastReadChapterId
      ? library.chapters.find((chapter) => chapter.id === library.selectedBook?.lastReadChapterId) ?? null
      : null
  const savedResourceSignatures = new Set(library.savedResources.map((resource) => resource.signature))
  const canBackToReading = readingVisibleSentences.length > 0

  const handleChapterRangeChange = (nextRange: SentenceRange) => {
    if (effectiveWorkspaceSource !== 'chapter' || !activeChapter) {
      return
    }

    setChapterRangeOverrides((current) => ({
      ...current,
      [activeChapter.id]: getSafeChapterRange(workspaceSentences, nextRange),
    }))
  }

  const handleUseNextChapterRange = () => {
    if (effectiveWorkspaceSource !== 'chapter' || !activeChapter) {
      return
    }

    setChapterRangeOverrides((current) => ({
      ...current,
      [activeChapter.id]: getNextSentenceRange(
        workspaceSentences.length,
        activeChapter.lastReadEnd ?? -1,
        activeChapter.activeRange ?? null,
      ),
    }))
  }

  const handleRunAnalysis = async () => {
    const nextPage = await analysis.runAnalysis()
    if (nextPage === 'reading') {
      setActivePage('reading')
    }
  }

  const handleOpenManualWorkspace = () => {
    setWorkspaceSource('draft')
    setActivePage('workspace')
  }

  const handleOpenChapterWorkspace = async (chapterId: string) => {
    const chapter = await library.openChapter(chapterId)
    if (!chapter) {
      return
    }

    setWorkspaceSource('chapter')
    setActivePage('workspace')
  }

  const handleOpenChapterReading = async (chapterId: string) => {
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
  }

  const handleOpenRecentChapter = async () => {
    if (!library.selectedBook?.lastReadChapterId) {
      return
    }

    await handleOpenChapterReading(library.selectedBook.lastReadChapterId)
  }

  const handleOpenAdjacentChapter = async (chapterId: string | null) => {
    if (!chapterId) {
      return
    }

    await handleOpenChapterReading(chapterId)
  }

  const handleDeleteBook = async (bookId: string) => {
    const shouldFallbackToDraft = library.currentChapter?.bookId === bookId
    await library.removeBook(bookId)

    if (shouldFallbackToDraft) {
      setWorkspaceSource('draft')
      setActivePage('library')
    }
  }

  const handleDeleteChapter = async (chapterId: string) => {
    const result = await library.removeChapter(chapterId)

    if (!result) {
      return
    }

    if (result.removedCurrentChapter && !result.nextCurrentChapterId) {
      setWorkspaceSource('draft')
    }
  }

  const handleImportFile = async (file: File) => {
    const payload = await library.importBook(file)
    if (payload.chapters[0]) {
      setWorkspaceSource('chapter')
      setActivePage('workspace')
    }
  }

  const handleClearLocalData = async () => {
    analysis.clearStatus()
    persistent.resetAll()
    await library.clearLibrary()
  }

  const openSettings = () => {
    setIsSettingsOpen(true)
  }

  const openSettingsAi = () => {
    setActiveSettingsTab('ai')
    setIsSettingsOpen(true)
  }

  const openResources = () => {
    setActivePage('resources')
  }

  const handleSaveHighlight = async (
    sentence: SentenceItem,
    result: AnalysisResult,
    highlight: {
      text: string
      kind: KnowledgeKind
      explanation: string
    },
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
  }

  const handleRemoveHighlight = async (signature: string) => {
    await library.removeKnowledgeResourceBySignature(signature)
  }

  const handleSetResumeAnchor = async (sentence: SentenceItem, sentenceIndex: number) => {
    if (effectiveWorkspaceSource !== 'chapter') {
      return
    }

    await library.updateCurrentChapter((chapter) => ({
      ...chapter,
      resumeAnchor: buildReadingResumeAnchor(sentence, sentenceIndex),
    }))
  }

  const manualHistory = effectiveWorkspaceSource === 'draft' ? persistent.history : []
  const currentContextTitle =
    effectiveWorkspaceSource === 'chapter'
      ? {
          bookTitle: library.selectedBook?.title ?? '当前书籍',
          chapterTitle: activeChapter?.title ?? '未命名章节',
        }
      : undefined

  return (
    <div className={`app-shell ${activePage === 'reading' ? 'reading-mode' : ''}`}>
      {activePage === 'library' ? (
        <LibraryPage
          books={library.books}
          chapters={library.chapters}
          isImporting={library.isImporting}
          isLoading={library.isLoading}
          libraryError={library.libraryError}
          libraryNotice={library.libraryNotice}
          onDeleteBook={handleDeleteBook}
          onDeleteChapter={handleDeleteChapter}
          onImportFile={handleImportFile}
          onOpenChapterReading={handleOpenChapterReading}
          onOpenChapterWorkspace={handleOpenChapterWorkspace}
          onOpenRecentChapter={() => void handleOpenRecentChapter()}
          onOpenResources={openResources}
          onOpenManualWorkspace={handleOpenManualWorkspace}
          onOpenSettings={openSettings}
          recentChapterTitle={recentChapter?.title}
          onSelectBook={(bookId) => void library.selectBook(bookId)}
          selectedBook={library.selectedBook}
          selectedChapterId={library.selection.chapterId}
        />
      ) : activePage === 'workspace' ? (
        <WorkspacePage
          apiConfig={persistent.apiConfig}
          completedResultCount={completedResultCount}
          contextTitle={currentContextTitle}
          errorCount={errorCount}
          finishedCount={finishedCount}
          globalError={analysis.globalError}
          history={manualHistory}
          isRunning={analysis.isRunning}
          notice={analysis.notice}
          onBackToLibrary={() => setActivePage('library')}
          onOpenReading={() => setActivePage('reading')}
          onOpenSettings={openSettings}
          onOpenSettingsAi={openSettingsAi}
          onRestoreSession={analysis.restoreSession}
          onRetrySentence={analysis.retrySingleSentence}
          onSelectNextRange={handleUseNextChapterRange}
          onUpdateRange={handleChapterRangeChange}
          onRunAnalysis={() => void handleRunAnalysis()}
          onSegment={analysis.handleSegment}
          onSentenceChange={analysis.handleSentenceChange}
          onSourceTextChange={setWorkspaceSourceText}
          rangeSize={DEFAULT_CHAPTER_RANGE_SIZE}
          progressPercent={progressPercent}
          progressTotal={progressTotal}
          queuedCount={queuedCount}
          readingDisabled={
            effectiveWorkspaceSource === 'chapter'
              ? readingVisibleSentences.length === 0 ||
                !selectedChapterRange ||
                !activeReadingRange ||
                !areRangesEqual(selectedChapterRange, activeReadingRange)
              : workspaceSentences.length === 0
          }
          runningCount={runningCount}
          selectedRange={selectedChapterRange}
          sentences={workspaceVisibleSentences}
          sentenceStartIndex={selectedChapterRange?.start ?? 0}
          sourceText={workspaceSourceText}
          successCount={successCount}
          totalSentenceCount={workspaceSentences.length}
          workspaceSource={effectiveWorkspaceSource}
        />
      ) : activePage === 'reading' ? (
        <ReadingPage
          activeRange={activeReadingRange}
          adjacentChapterIds={effectiveWorkspaceSource === 'chapter' ? library.adjacentChapterIds : undefined}
          contextTitle={currentContextTitle}
          errorCount={readingErrorCount}
          globalError={analysis.globalError}
          notice={analysis.notice}
          onBackToLibrary={() => setActivePage('library')}
          onBackToWorkspace={() => setActivePage('workspace')}
          onOpenAdjacentChapter={handleOpenAdjacentChapter}
          onOpenResources={openResources}
          onRemoveHighlight={(signature) => void handleRemoveHighlight(signature)}
          onSaveHighlight={(sentence, result, highlight) =>
            void handleSaveHighlight(sentence, result, highlight)
          }
          onSetResumeAnchor={(sentence, sentenceIndex) =>
            void handleSetResumeAnchor(sentence, sentenceIndex)
          }
          paragraphBlocks={activeChapter?.paragraphBlocks}
          resumeAnchor={activeChapter?.resumeAnchor}
          results={workspaceResults}
          savedHighlightSignatures={savedResourceSignatures}
          sentenceStartIndex={activeReadingRange?.start ?? 0}
          sentences={
            effectiveWorkspaceSource === 'chapter'
              ? readingRangeSentences
              : readingVisibleSentences
          }
          successCount={readingSuccessCount}
          workspaceSource={effectiveWorkspaceSource}
        />
      ) : (
        <ResourcesPage
          activeKind={resourceFilter}
          canBackToReading={canBackToReading}
          onBackToLibrary={() => setActivePage('library')}
          onBackToReading={canBackToReading ? () => setActivePage('reading') : undefined}
          onDeleteResource={(resourceId) => void library.removeKnowledgeResourceById(resourceId)}
          onDeleteResources={(resourceIds) => void library.removeKnowledgeResourcesByIds(resourceIds)}
          onKindChange={setResourceFilter}
          resources={library.savedResources}
        />
      )}

      <SettingsDialog
        activeSettingsTab={activeSettingsTab}
        apiConfig={persistent.apiConfig}
        isOpen={isSettingsOpen}
        onClearLocalData={() => void handleClearLocalData()}
        onClose={() => setIsSettingsOpen(false)}
        onConfigChange={persistent.handleConfigChange}
        onPromptChange={persistent.handlePromptChange}
        onResetPrompt={persistent.resetPromptConfig}
        onSettingsTabChange={setActiveSettingsTab}
        promptConfig={persistent.promptConfig}
      />
    </div>
  )
}

export default App
