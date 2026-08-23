import { useCallback, useState } from 'react'
import './App.css'
import AndroidPastePage from './components/AndroidPastePage'
import LibraryPage from './components/LibraryPage'
import ReadingPage from './components/ReadingPage'
import ResourcesPage from './components/ResourcesPage'
import SettingsDialog from './components/SettingsDialog'
import WorkspacePage from './components/WorkspacePage'
import { countByStatus } from './lib/appState'
import { explainVocabulary } from './lib/openai'
import { isNativeAndroid } from './lib/platform'
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
  const library = useLibraryStore('local')
  const {
    activeChapter,
    activeReadingRange,
    analysisDocumentContext,
    currentContextTitle,
    currentLanguage,
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
    language: currentLanguage,
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
    handleImportPendingAnkiNotes,
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
    currentLanguage,
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

  const handleOpenBook = useCallback(
    async (bookId: string) => {
      const hydrated = await library.hydrateBook(bookId)
      if (!hydrated) return
      const isSingle = hydrated.book.sourceType === 'manual' || hydrated.book.chapterCount <= 1 || hydrated.chapters.length <= 1
      if (isSingle && hydrated.chapters[0]) {
        const chapter = hydrated.chapters[0]
        if (isNativeAndroid()) {
          await handleOpenChapterReading(chapter.id, hydrated.book.language)
          return
        }
        const isAnalyzed = hydrated.book.analysisState === 'analyzed' || chapter.analysisState === 'analyzed' || chapter.sentences.some((s) => s.status === 'success')
        if (isAnalyzed) {
          await handleOpenChapterReading(chapter.id)
        } else {
          await handleOpenChapterWorkspace(chapter.id)
        }
      }
    },
    [handleOpenChapterReading, handleOpenChapterWorkspace, library],
  )

  const handleChapterRangeChange = (nextRange: SentenceRange) => {
    if (effectiveWorkspaceSource !== 'chapter' || !activeChapter) return
    setChapterRangeOverrides((current) => ({
      ...current,
      [activeChapter.id]: getSafeChapterRange(workspaceSentences, nextRange),
    }))
  }

  const handleUseNextChapterRange = () => {
    if (effectiveWorkspaceSource !== 'chapter' || !activeChapter) return
    setChapterRangeOverrides((current) => ({
      ...current,
      [activeChapter.id]: getNextSentenceRange(workspaceSentences.length, activeChapter.lastReadEnd ?? -1, activeChapter.activeRange ?? null),
    }))
  }

  const handleRunAnalysis = async () => {
    const nextPage = await analysis.runAnalysis()
    if (nextPage === 'reading') setActivePage('reading')
  }

  const handleSegment = async () => {
    const nextSentences = await analysis.handleSegment()
    if (effectiveWorkspaceSource !== 'draft' || !nextSentences) return
    await handleSaveManualDraft({ sentences: nextSentences, results: {} })
  }

  const handleSaveAndroidPaste = async () => {
    if (!workspaceSourceText.trim()) {
      return
    }

    const saved = await handleSaveManualDraft({ sentences: [], results: {} })
    if (!saved) {
      return
    }

    persistent.setArticleTitle('')
    setWorkspaceSourceText('')
    setWorkspaceSentences([])
    setWorkspaceResults({})
  }


  const handleDraftLanguageChange = (language: typeof persistent.draftLanguage) => {
    if (language === persistent.draftLanguage) return
    persistent.setDraftLanguage(language)
    setWorkspaceSentences([])
    setWorkspaceResults({})
    analysis.setNotice('已切换解析语言，请重新分句后再运行解析。')
  }

  const handleExplainVocabulary = useCallback((context: string, word: string) => {
    const vocabularyConfig =
      isNativeAndroid() || persistent.isVocabularyAiShared
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
      jaAnkiConfig={persistent.jaAnkiConfig}
      onAnkiConfigChange={persistent.handleAnkiConfigChange}
      onAnkiFieldMappingChange={persistent.handleAnkiFieldMappingChange}
      onClearLocalData={() => void handleClearLocalData()}
      onClose={() => setIsSettingsOpen(false)}
      onConfigChange={persistent.handleConfigChange}
      onJaAnkiConfigChange={persistent.handleJaAnkiConfigChange}
      onJaAnkiFieldMappingChange={persistent.handleJaAnkiFieldMappingChange}
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
          contextSentenceCount={persistent.promptConfig.previousSentenceCount}
          contextTitle={currentContextTitle}
          errorCount={0}
          globalError={analysis.globalError}
          onAddToAnki={handleAddHighlightToAnki}
          onBackToWorkspace={() => setActivePage(isNativeAndroid() ? 'library' : 'workspace')}
          onExplainVocabulary={handleExplainVocabulary}
          onOpenResources={() => setActivePage('resources')}
          onReadingPreferencesChange={persistent.handleReadingPreferencesChange}
          onRemoveHighlight={(signature) => void handleRemoveHighlight(signature)}
          onRetrySentence={(sentenceId) => void analysis.retrySingleSentence(sentenceId)}
          onSaveHighlight={(sentence, result, highlight) => void handleSaveHighlight(sentence, result, highlight)}
          onSetResumeAnchor={(sentence, sentenceIndex) => void handleSetResumeAnchor(sentence, sentenceIndex)}
          paragraphBlocks={activeChapter?.paragraphBlocks}
          readingPreferences={persistent.readingPreferences}
          bookLanguage={currentLanguage}
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
          onOpenBook={handleOpenBook}
          onOpenChapterReading={handleOpenChapterReading}
          onOpenChapterWorkspace={handleOpenChapterWorkspace}
          onOpenRecentChapter={() => void handleOpenRecentChapter()}
          onOpenManualWorkspace={handleOpenManualWorkspace}
          onOpenSettings={() => setIsSettingsOpen(true)}
          recentChapterTitle={recentChapter?.title}
          onSelectBook={(bookId) => void library.selectBook(bookId)}
          onSetActiveCollection={(collectionId) => void library.setActiveCollection(collectionId)}
          selectedBook={library.selectedBook}
          selectedChapterId={library.selection.chapterId}
          totalBookCount={library.totalBookCount}
        />
      ) : activePage === 'workspace' && isNativeAndroid() && effectiveWorkspaceSource === 'draft' ? (
        <AndroidPastePage
          articleTitle={persistent.articleTitle}
          draftLanguage={persistent.draftLanguage}
          error={library.libraryError}
          isSaving={isSavingManualDraft}
          notice={library.libraryNotice}
          onArticleTitleChange={handleManualArticleTitleChange}
          onCancel={() => setActivePage('library')}
          onDraftLanguageChange={handleDraftLanguageChange}
          onSave={() => void handleSaveAndroidPaste()}
          onSourceTextChange={setWorkspaceSourceText}
          sourceText={workspaceSourceText}
        />
      ) : activePage === 'workspace' ? (
        <WorkspacePage
          apiConfig={persistent.apiConfig}
          articleTitle={persistent.articleTitle}
          bookLanguage={currentLanguage}
          chapterProgressPercent={chapterProgressPercent}
          chapterResolvedCount={completedResultCount}
          chapterSourceType={effectiveWorkspaceSource === 'chapter' ? library.selectedBook?.sourceType : undefined}
          completedResultCount={completedResultCount}
          contextTitle={currentContextTitle}
          draftLanguage={persistent.draftLanguage}
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
          onDraftLanguageChange={handleDraftLanguageChange}
          onOpenReading={() => setActivePage('reading')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onRestoreSession={(session) => {
            persistent.setDraftLanguage(session.language ?? 'es')
            analysis.restoreSession(session)
          }}
          onRetrySentence={analysis.retrySingleSentence}
          onRunAnalysis={() => void handleRunAnalysis()}
          onSegment={() => void handleSegment()}
          onSelectNextRange={handleUseNextChapterRange}
          onSentenceChange={analysis.handleSentenceChange}
          onSourceTextChange={setWorkspaceSourceText}
          onUpdateRange={handleChapterRangeChange}
          progressPercent={progressPercent}
          progressTotal={progressTotal}
          queuedCount={queuedCount}
          rangeSize={DEFAULT_CHAPTER_RANGE_SIZE}
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
          sentenceStartIndex={selectedChapterRange?.start ?? 0}
          sentences={workspaceVisibleSentences}
          sourceText={workspaceSourceText}
          successCount={successCount}
          totalSentenceCount={workspaceSentences.length}
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
          onImportPendingAnkiNotes={handleImportPendingAnkiNotes}
          onKindChange={setResourceFilter}
          pendingAnkiNotes={library.pendingAnkiNotes}
          resources={library.savedResources}
        />
      )}

      {settingsDialog}
    </div>
  )
}

export default App
