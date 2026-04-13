import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import './App.css'
import LibraryPage from './components/LibraryPage'
import ReadingPage from './components/ReadingPage'
import SettingsDialog from './components/SettingsDialog'
import WorkspacePage from './components/WorkspacePage'
import { countByStatus } from './lib/appState'
import { useAnalysisRunner } from './hooks/useAnalysisRunner'
import { useLibraryStore } from './hooks/useLibraryStore'
import { usePersistentConfig } from './hooks/usePersistentConfig'
import type {
  AnalysisResult,
  AppPage,
  SettingsTab,
  SentenceItem,
  WorkspaceSource,
} from './types'

function resolveStateAction<T>(current: T, action: SetStateAction<T>) {
  return typeof action === 'function' ? (action as (value: T) => T)(current) : action
}

function App() {
  const [activePage, setActivePage] = useState<AppPage>('library')
  const [workspaceSource, setWorkspaceSource] = useState<WorkspaceSource>('draft')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('ai')

  const persistent = usePersistentConfig()
  const library = useLibraryStore()

  const effectiveWorkspaceSource: WorkspaceSource =
    workspaceSource === 'chapter' && library.currentChapter ? 'chapter' : 'draft'

  const activeChapter = effectiveWorkspaceSource === 'chapter' ? library.currentChapter : null
  const workspaceSourceText = activeChapter?.sourceText ?? persistent.sourceText
  const workspaceSentences = activeChapter?.sentences ?? persistent.sentences
  const workspaceResults = activeChapter?.results ?? persistent.results

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

  const analysis = useAnalysisRunner({
    apiConfig: persistent.apiConfig,
    initialNotice,
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

  const successCount = countByStatus(workspaceSentences, 'success')
  const errorCount = countByStatus(workspaceSentences, 'error')
  const queuedCount = countByStatus(workspaceSentences, 'queued')
  const runningCount = countByStatus(workspaceSentences, 'running')
  const completedResultCount = Object.keys(workspaceResults).length
  const finishedCount = successCount + errorCount
  const progressTotal = workspaceSentences.length
  const progressPercent =
    progressTotal === 0 ? 0 : Math.round((finishedCount / progressTotal) * 100)

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

    setWorkspaceSource('chapter')
    setActivePage('reading')
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
          onImportFile={handleImportFile}
          onOpenChapterReading={handleOpenChapterReading}
          onOpenChapterWorkspace={handleOpenChapterWorkspace}
          onOpenManualWorkspace={handleOpenManualWorkspace}
          onOpenSettings={openSettings}
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
          onRunAnalysis={() => void handleRunAnalysis()}
          onSegment={analysis.handleSegment}
          onSentenceChange={analysis.handleSentenceChange}
          onSourceTextChange={setWorkspaceSourceText}
          progressPercent={progressPercent}
          progressTotal={progressTotal}
          queuedCount={queuedCount}
          readingDisabled={workspaceSentences.length === 0}
          runningCount={runningCount}
          sentences={workspaceSentences}
          sourceText={workspaceSourceText}
          successCount={successCount}
          workspaceSource={effectiveWorkspaceSource}
        />
      ) : (
        <ReadingPage
          adjacentChapterIds={effectiveWorkspaceSource === 'chapter' ? library.adjacentChapterIds : undefined}
          contextTitle={currentContextTitle}
          errorCount={errorCount}
          globalError={analysis.globalError}
          notice={analysis.notice}
          onBackToLibrary={() => setActivePage('library')}
          onBackToWorkspace={() => setActivePage('workspace')}
          onOpenAdjacentChapter={handleOpenAdjacentChapter}
          results={workspaceResults}
          sentences={workspaceSentences}
          successCount={successCount}
          workspaceSource={effectiveWorkspaceSource}
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
