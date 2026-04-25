import { useCallback, useState } from 'react'
import './App.css'
import LibraryPage from './components/LibraryPage'
import ReadingPage from './components/ReadingPage'
import ResourcesPage from './components/ResourcesPage'
import SettingsDialog from './components/SettingsDialog'
import WorkspacePage from './components/WorkspacePage'
import { countByStatus } from './lib/appState'
import { explainVocabulary } from './lib/openai'
import {
  getAutoAdvanceSentenceRange,
  DEFAULT_CHAPTER_RANGE_SIZE,
  getDefaultSentenceRange,
  getNextSentenceRange,
  normalizeSentenceRange,
} from './lib/chapterRange'
import { useAppActions } from './hooks/useAppActions'
import { useAnalysisRunner } from './hooks/useAnalysisRunner'
import { useLibraryStore } from './hooks/useLibraryStore'
import { usePersistentConfig } from './hooks/usePersistentConfig'
import { useWorkspaceBinding } from './hooks/useWorkspaceBinding'
import type {
  AppPage,
  KnowledgeKind,
  SettingsTab,
  SentenceRange,
  WorkspaceSource,
} from './types'

function getSafeChapterRange(
  sentences: { id: string }[],
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
  const [isSavingManualDraft, setIsSavingManualDraft] = useState(false)

  const persistent = usePersistentConfig()
  const library = useLibraryStore()
  const {
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
  } = useWorkspaceBinding({
    chapterRangeOverrides,
    library,
    persistent,
    workspaceSource,
  })

  const analysis = useAnalysisRunner({
    apiConfig: persistent.apiConfig,
    chapterRange: selectedChapterRange,
    documentContext: analysisDocumentContext,
    initialNotice,
    onChapterAnalysisCompleted: (range) => {
      if (effectiveWorkspaceSource !== 'chapter' || !activeChapter) {
        return
      }

      setChapterRangeOverrides((current) => ({
        ...current,
        [activeChapter.id]: getAutoAdvanceSentenceRange(workspaceSentences.length, range),
      }))
    },
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
  const chapterProgressPercent =
    effectiveWorkspaceSource === 'chapter' && workspaceSentences.length > 0
      ? Math.round((completedResultCount / workspaceSentences.length) * 100)
      : 0
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
  const canBackToReading =
    effectiveWorkspaceSource === 'chapter' ? Boolean(activeChapter) : readingVisibleSentences.length > 0
  const manualWorkspaceLabel = persistent.hasSavedDraft ? '继续编辑草稿' : '粘贴文章解析'

  const {
    handleAddHighlightToAnki,
    handleClearLocalData,
    handleDeleteBook,
    handleDeleteChapter,
    handleImportFile,
    handleManualArticleTitleChange,
    handleOpenChapterReading,
    handleOpenChapterWorkspace,
    handleOpenManualWorkspace,
    handleOpenRecentChapter,
    handleRemoveHighlight,
    handleSaveHighlight,
    handleSaveManualDraft,
    handleSetResumeAnchor,
  } = useAppActions({
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
  })

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

  const handleSegment = async () => {
    const nextSentences = analysis.handleSegment()
    if (effectiveWorkspaceSource !== 'draft' || !nextSentences) {
      return
    }

    await handleSaveManualDraft({
      sentences: nextSentences,
      results: {},
    })
  }

  const openSettings = () => {
    setIsSettingsOpen(true)
  }

  const openResources = () => {
    setActivePage('resources')
  }

  const handleExplainVocabulary = useCallback((context: string, word: string) => {
    const vocabularyConfig = persistent.isVocabularyAiShared
      ? persistent.apiConfig
      : persistent.vocabularyApiConfig

    return explainVocabulary(
      vocabularyConfig,
      persistent.vocabularyPromptConfig,
      { context, word },
    )
  }, [
    persistent.apiConfig,
    persistent.isVocabularyAiShared,
    persistent.vocabularyApiConfig,
    persistent.vocabularyPromptConfig,
  ])

  const settingsDialog = (
    <SettingsDialog
      activeSettingsTab={activeSettingsTab}
      ankiConfig={persistent.ankiConfig}
      apiConfig={persistent.apiConfig}
      isOpen={isSettingsOpen}
      isVocabularyAiShared={persistent.isVocabularyAiShared}
      onAnkiConfigChange={persistent.handleAnkiConfigChange}
      onAnkiFieldMappingChange={persistent.handleAnkiFieldMappingChange}
      onClearLocalData={() => void handleClearLocalData()}
      onClose={() => setIsSettingsOpen(false)}
      onConfigChange={persistent.handleConfigChange}
      onPromptChange={persistent.handlePromptChange}
      onResetPrompt={persistent.resetPromptConfig}
      onSettingsTabChange={setActiveSettingsTab}
      onVocabularyAiSharedChange={persistent.handleVocabularyAiSharedChange}
      onVocabularyConfigChange={persistent.handleVocabularyConfigChange}
      onVocabularyPromptChange={persistent.handleVocabularyPromptChange}
      onResetVocabularyPrompt={persistent.resetVocabularyPromptConfig}
      promptConfig={persistent.promptConfig}
      vocabularyApiConfig={persistent.vocabularyApiConfig}
      vocabularyPromptConfig={persistent.vocabularyPromptConfig}
    />
  )

  if (activePage === 'reading') {
    return (
      <>
        <ReadingPage
          activeRange={activeReadingRange}
          contextTitle={currentContextTitle}
          errorCount={readingErrorCount}
          globalError={analysis.globalError}
          onAddToAnki={(sentence, result, highlight) =>
            handleAddHighlightToAnki(sentence, result, highlight)
          }
          onBackToWorkspace={() => setActivePage('workspace')}
          onExplainVocabulary={handleExplainVocabulary}
          onOpenResources={openResources}
          onReadingPreferencesChange={persistent.handleReadingPreferencesChange}
          onRemoveHighlight={(signature) => void handleRemoveHighlight(signature)}
          onRetrySentence={(sentenceId) => void analysis.retrySingleSentence(sentenceId)}
          onSaveHighlight={(sentence, result, highlight) =>
            void handleSaveHighlight(sentence, result, highlight)
          }
          onSetResumeAnchor={(sentence, sentenceIndex) =>
            void handleSetResumeAnchor(sentence, sentenceIndex)
          }
          paragraphBlocks={activeChapter?.paragraphBlocks}
          readingPreferences={persistent.readingPreferences}
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

        {settingsDialog}
      </>
    )
  }

  return (
    <div className="app-shell">
      {activePage === 'library' ? (
        <LibraryPage
          activeCollectionId={library.activeCollectionId}
          books={library.books}
          chapters={library.chapters}
          collectionBookCounts={library.collectionBookCounts}
          collections={library.collections}
          isImporting={library.isImporting}
          isLoading={library.isLoading}
          libraryError={library.libraryError}
          libraryNotice={library.libraryNotice}
          manualWorkspaceLabel={manualWorkspaceLabel}
          onCreateCollection={(name) => void library.createCollection(name)}
          onDeleteBook={handleDeleteBook}
          onDeleteChapter={handleDeleteChapter}
          onDeleteCollection={(collectionId) => void library.deleteCollection(collectionId)}
          onImportFile={handleImportFile}
          onMoveBookToCollection={(bookId, collectionId) =>
            void library.moveBookToCollection(bookId, collectionId)
          }
          onOpenChapterReading={handleOpenChapterReading}
          onOpenChapterWorkspace={handleOpenChapterWorkspace}
          onOpenRecentChapter={() => void handleOpenRecentChapter()}
          onOpenResources={openResources}
          onOpenManualWorkspace={handleOpenManualWorkspace}
          onOpenSettings={openSettings}
          recentChapterTitle={recentChapter?.title}
          onSelectBook={(bookId) => void library.selectBook(bookId)}
          onSetActiveCollection={(collectionId) => void library.setActiveCollection(collectionId)}
          selectedBook={library.selectedBook}
          selectedChapterId={library.selection.chapterId}
          totalBookCount={library.totalBookCount}
        />
      ) : activePage === 'workspace' ? (
        <WorkspacePage
          apiConfig={persistent.apiConfig}
          articleTitle={persistent.articleTitle}
          chapterProgressPercent={chapterProgressPercent}
          chapterResolvedCount={completedResultCount}
          completedResultCount={completedResultCount}
          contextTitle={currentContextTitle}
          errorCount={errorCount}
          finishedCount={finishedCount}
          globalError={analysis.globalError}
          history={manualHistory}
          isRunning={analysis.isRunning}
          isSavingToLibrary={isSavingManualDraft}
          libraryError={library.libraryError}
          libraryNotice={library.libraryNotice}
          notice={analysis.notice}
          onArticleTitleChange={handleManualArticleTitleChange}
          onBackToLibrary={() => setActivePage('library')}
          onCancelAnalysis={analysis.cancelAnalysis}
          onOpenReading={() => setActivePage('reading')}
          onOpenSettings={openSettings}
          onRestoreSession={analysis.restoreSession}
          onRetrySentence={analysis.retrySingleSentence}
          onSelectNextRange={handleUseNextChapterRange}
          onUpdateRange={handleChapterRangeChange}
          onRunAnalysis={() => void handleRunAnalysis()}
          onSegment={() => void handleSegment()}
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
          chapterSourceType={effectiveWorkspaceSource === 'chapter' ? library.selectedBook?.sourceType : undefined}
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

      {settingsDialog}
    </div>
  )
}

export default App
