export type SentenceStatus = 'idle' | 'queued' | 'running' | 'success' | 'error'
export type AppPage = 'library' | 'workspace' | 'reading' | 'resources'
export type SettingsTab = 'ai' | 'prompt' | 'anki'
export type WorkspaceSource = 'draft' | 'chapter'
export type ChapterAnalysisState = 'idle' | 'partial' | 'running' | 'analyzed'
export type KnowledgeKind = 'grammar' | 'phrase' | 'vocabulary'
// Current language routes. The product direction is multilingual; add new routes here with matching segmentation and prompt handling.
export type BookLanguage = 'es' | 'ja'
export type AnkiFieldSource =
  | 'sentence'
  | 'sentenceFurigana'
  | 'grammar'
  | 'meaning'
  | 'knowledge'
  | 'knowledgeFurigana'
  | 'knowledgeKind'
  | 'knowledgeExplanation'
export type SentenceRange = {
  start: number
  end: number
}

export type ApiConfig = {
  baseUrl: string
  apiKey: string
  model: string
  concurrency: number
}

export type PromptConfig = {
  template: string
  previousSentenceCount: number
  nextSentenceCount: number
  batchSize: number
}

export type VocabularyPromptConfig = {
  template: string
}

export type VocabularyExplanation = {
  word: string
  explanation: string
  rawText?: string
}

export type ReadingPreferences = {
  contentWidth: number
  fontSize: number
  showFurigana?: boolean
}

export type AnkiFieldMapping = Record<AnkiFieldSource, string>

export type AnkiConfig = {
  endpoint: string
  deck: string
  noteType: string
  fieldMapping: AnkiFieldMapping
}

export type SentenceItem = {
  id: string
  text: string
  editedText: string
  status: SentenceStatus
  error?: string
  tokens?: JapaneseToken[]
}

export type JapaneseToken = {
  surface: string
  reading: string
  baseForm: string
  pos: string
}

export type JapaneseChunkExplanation = {
  chunk: string
  reading: string
  pos: string
  grammarRole?: string
  tokenIndices?: number[]
  headChunkIndex?: number | null
  dependsOn?: string | null
  explanation: string
}

export type AnalysisHighlight = {
  id: string
  text: string
  kind: KnowledgeKind
  explanation: string
}

export type AnalysisResult = {
  sentenceId: string
  grammar: string
  meaning: string
  highlights?: AnalysisHighlight[]
  chunkAnalysis?: JapaneseChunkExplanation[]
  isPartial?: boolean
  rawText?: string
}

export type AnalysisJob = {
  sentenceId: string
  sentence: string
  previousSentence?: string
  nextSentence?: string
  documentContext?: AnalysisDocumentContext
  language?: BookLanguage
  tokens?: JapaneseToken[]
}

export type BatchAnalysisJob = {
  sentenceEntries: Array<{
    sentenceId: string
    sentence: string
    language?: BookLanguage
    tokens?: JapaneseToken[]
  }>
  previousSentence?: string
  nextSentence?: string
  documentContext?: AnalysisDocumentContext
}

export type AnalysisDocumentContext = {
  documentType: 'article' | 'chapter'
  title?: string
  author?: string
  chapterTitle?: string
}

export type ChapterParagraphBlock = {
  id: string
  kind?: 'paragraph' | 'heading' | 'quote' | 'list-item' | 'preformatted'
  headingLevel?: number
  text: string
  html?: string
  sentenceIds?: string[]
  sentenceTexts?: string[]
  sentenceHtml?: string[]
}

export type ReadingResumeAnchor = {
  sentenceId: string
  sentenceIndex: number
  sentenceSnippet: string
}

export type BookRecord = {
  id: string
  title: string
  author: string
  language?: BookLanguage
  sourceType?: 'epub' | 'manual'
  coverUrl?: string
  collectionId?: string
  importedAt: string
  chapterCount: number
  lastReadChapterId?: string
  lastOpenedAt?: string
  analysisState: ChapterAnalysisState
}

export type CollectionRecord = {
  id: string
  name: string
  createdAt: number
}

export type BookChapterRecord = {
  id: string
  bookId: string
  title: string
  order: number
  epubHref?: string
  originalText: string
  sourceText: string
  paragraphBlocks: ChapterParagraphBlock[]
  sentences: SentenceItem[]
  results: Record<string, AnalysisResult>
  analysisState: ChapterAnalysisState
  activeRange: SentenceRange | null
  lastReadEnd: number
  lastOpenedAt?: string
  resumeAnchor?: ReadingResumeAnchor | null
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
  language?: BookLanguage
  sourceText: string
  sentences: SentenceItem[]
  results: Record<string, AnalysisResult>
}

export type SavedKnowledgeResource = {
  id: string
  signature: string
  text: string
  kind: KnowledgeKind
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
}
