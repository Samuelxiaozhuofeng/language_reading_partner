# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at localhost:5173
npm run build     # Type check (tsc -b) + Vite build
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Architecture

Spanish reading assistant — users import EPUB books or paste text, sentences are analyzed by an OpenAI-compatible API, and results are displayed in a reading view with grammar/vocabulary highlights.

### Pages & Flow

1. **LibraryPage** → book/chapter management, EPUB import
2. **WorkspacePage** → text segmentation, analysis config, range selection
3. **ReadingPage** → sentence-by-sentence reading with AI analysis
4. **ResourcesPage** → saved knowledge points (grammar, vocabulary, phrases)

### State Management

- `useLibraryStore` — IndexedDB-backed library state (books, chapters, resources)
- `usePersistentConfig` — localStorage-backed user settings (API config, prompts, Anki)
- `useWorkspaceBinding` — workspace state (sentences, analysis results, source text)
- `useAnalysisRunner` — orchestrates concurrent AI analysis with a worker-pool queue

### Key Directories

- `src/lib/` — core business logic
  - `openai.ts` — OpenAI client, concurrent analysis orchestration (`runConcurrentAnalysis`)
  - `libraryDb.ts` — IndexedDB schema & CRUD
  - `appState.ts` — config defaults, localStorage persistence
  - `segment.ts` — Spanish sentence segmentation (handles abbreviations, soft breaks)
  - `epub.ts` — EPUB parsing and chapter extraction
  - `knowledge.ts` — knowledge resource management
  - `anki/` — Anki card payload building and error handling
  - `analysis/` — analysis state machine (`runState.ts`, `runContext.ts`, `runValidation.ts`)
  - `library/service.ts` — high-level library operations (import, persist, delete)
- `src/hooks/` — React hooks wrapping the above logic
- `src/components/` — UI layer (reading/, settings/, workspace pages)
- `src/types.ts` — all shared TypeScript types

### Analysis Pipeline

Sentences are queued → dispatched to a configurable worker pool (default concurrency 4, max 99) → each call hits the configured OpenAI-compatible endpoint with a JSON-schema-enforced system prompt → results parsed (with fallback for non-JSON) → stored in IndexedDB. AbortSignal cancellation and 60s per-request timeout are supported.

### Persistence

- **localStorage**: API config, prompt templates, Anki config, reading preferences, draft auto-save, session history (max 6)
- **IndexedDB** (via `idb`): books, chapters with full sentence/analysis data, saved knowledge resources

### Prompt Engineering

System prompt injects document metadata (title, author, chapter) plus a context window of previous + current + next sentence. The prompt enforces a JSON response schema for grammar, meaning, and highlight fields.
