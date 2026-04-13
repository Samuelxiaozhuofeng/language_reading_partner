# Repository Guidelines

## Project Structure & Module Organization
This repository is a small Vite + React + TypeScript frontend. Keep application code in `src/`. `src/App.tsx` is now a thin composition layer that wires together page-level components and hooks. Page UI lives in `src/components/` (`WorkspacePage.tsx`, `ReadingPage.tsx`, `SettingsDialog.tsx`), stateful app logic lives in `src/hooks/` (`usePersistentConfig.ts`, `useAnalysisRunner.ts`), shared types are in `src/types.ts`, and reusable helpers belong in `src/lib/` (`openai.ts` for API calls, `segment.ts` for sentence splitting, `appState.ts` for app defaults/persistence helpers/shared state utilities). App bootstrapping is in `src/main.tsx`. Put imported images in `src/assets/` and static files that should be served as-is in `public/`. Build output is generated into `dist/` and should not be edited manually.

## Build, Test, and Development Commands
Use npm because this repo includes `package-lock.json`.

- `npm install`: install dependencies.
- `npm run dev`: start the Vite dev server with HMR.
- `npm run build`: run TypeScript project build checks, then create a production bundle in `dist/`.
- `npm run preview`: serve the production build locally.
- `npm run lint`: run ESLint across the project.

## Coding Style & Naming Conventions
Write TypeScript and React function components. Follow the existing style in `src/`: 2-space indentation, single quotes, and no semicolons. Keep component and type names in `PascalCase`, hooks and helpers in `camelCase`, and file names aligned with their primary export or responsibility (`WorkspacePage.tsx`, `useAnalysisRunner.ts`, `openai.ts`). Prefer page composition in `src/components/`, stateful orchestration in `src/hooks/`, and small pure helpers in `src/lib/` rather than growing `App.tsx` again.

## Testing Guidelines
There is no automated test runner configured yet. Before opening a PR, at minimum run `npm run lint` and `npm run build`, then verify the main flow manually: paste text, segment sentences, configure the API, and run analysis. If you add tests, place them next to the code they cover as `*.test.ts` or `*.test.tsx`, and prioritize `src/lib/` utilities first.

## Commit & Pull Request Guidelines
This workspace does not include `.git`, so no local commit history is available to infer conventions. Use short, imperative commit messages such as `feat: add model loading state` or `fix: guard empty sentence input`. PRs should include a clear summary, the commands you ran, any API/config changes, and screenshots for UI updates.

## Security & Configuration Tips
Do not hardcode API keys, base URLs, or model secrets. This app is designed to use user-provided settings in the browser; keep that behavior intact and avoid committing real credentials or environment-specific endpoints.
