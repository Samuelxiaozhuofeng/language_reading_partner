export type SentenceStatus = 'idle' | 'queued' | 'running' | 'success' | 'error'
export type AppPage = 'library' | 'workspace' | 'reading'
export type SettingsTab = 'ai' | 'prompt'
export type WorkspaceSource = 'draft' | 'chapter'
export type ChapterAnalysisState = 'idle' | 'partial' | 'running' | 'analyzed'

export type ApiConfig = {
  baseUrl: string
  apiKey: string
  model: string
  concurrency: number
}

export type PromptConfig = {
  systemPrompt: string
  userPromptTemplate: string
}

export type SentenceItem = {
  id: string
  text: string
  editedText: string
  status: SentenceStatus
  error?: string
}

export type AnalysisResult = {
  sentenceId: string
  grammar: string
  meaning: string
  isPartial?: boolean
  rawText?: string
}

export type AnalysisJob = {
  sentenceId: string
  sentence: string
  previousSentence?: string
  nextSentence?: string
}

export type ChapterParagraphBlock = {
  id: string
  text: string
}

export type BookRecord = {
  id: string
  title: string
  author: string
  coverUrl?: string
  importedAt: string
  chapterCount: number
  lastReadChapterId?: string
  lastOpenedAt?: string
  analysisState: ChapterAnalysisState
}

export type BookChapterRecord = {
  id: string
  bookId: string
  title: string
  order: number
  originalText: string
  sourceText: string
  paragraphBlocks: ChapterParagraphBlock[]
  sentences: SentenceItem[]
  results: Record<string, AnalysisResult>
  analysisState: ChapterAnalysisState
  lastOpenedAt?: string
}

export type LibrarySelection = {
  bookId: string | null
  chapterId: string | null
}

export type ChapterStats = {
  total: number
  success: number
  error: number
  queued: number
  running: number
  finished: number
  progressPercent: number
}

export type RunSession = {
  id: string
  title: string
  createdAt: string
  sourceText: string
  sentences: SentenceItem[]
  results: Record<string, AnalysisResult>
}
