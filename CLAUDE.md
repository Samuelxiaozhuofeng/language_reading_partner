# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server at localhost:5173
npm run build     # Type check (tsc -b) + Vite build
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Product Positioning

Multilingual reading assistant for Chinese-native learners. The project started as a Spanish reader, so some storage keys and package metadata still use `spanish-reading-assistant` for backwards compatibility, but the product direction is multilingual.

Current language routing:

- `es` is the historical default and uses the generic non-Japanese segmentation plus the multilingual prompt path.
- `ja` uses kuromoji tokenization, furigana-aware reading UI, and Japanese-specific prompts.

When editing prompts or analysis behavior, keep the default path language-agnostic. Do not convert the generic prompt back into a Spanish-only teacher prompt unless the code is explicitly inside a Spanish-only branch.

## Architecture

Users import EPUB books or paste text, choose a reading language, sentences are analyzed by an OpenAI-compatible API, and results are displayed in a reading view with grammar/vocabulary highlights.

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
  - `segment.ts` — language-routed sentence segmentation (`es` default path, `ja` Japanese path)
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

System prompt injects document metadata (title, author, chapter) plus a context window of previous + current + next sentence. The generic prompt is intentionally multilingual; Japanese has a separate token-aware prompt. All prompts enforce a JSON response schema for grammar, meaning, and highlight fields.
