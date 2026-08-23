# Android local rebuild contract

## Product
整套 App 改为本地，不再登录、不再读写 Supabase。安卓 APK 是交付物。

用户打开 App 就能用：
1. 导入 EPUB
2. 粘贴文章

阅读里点「添加到 Anki」：
- 安卓原生：直接写入本机 AnkiDroid
- 电脑网页：继续走 AnkiConnect
- 不要再写入云端待导入队列

AI 解析仍用用户自己在设置里填的接口，这不是「我们的云端书架」。

## Non-goals
- 不迁移用户已有的 Supabase 云端书
- 不删 supabase 源码文件（可留着但业务不再调用）
- 不改阅读器 UI 结构、不分句/解析算法
- 不跑 lint / build / test（主会话最后统一跑）
- 不主动拆已经超 500 行的老文件；你改的文件如果会超过 500 行，先按职责拆再写

## Shared types / names
- 本地库继续用 `src/lib/libraryDb.ts`，DB 名保持 `spanish-reading-assistant/library`
- 语言仍是 `es` | `ja`
- Anki 字段与模板保持 SRA-ES / SRA-JA，见 `src/lib/anki/constants.ts`
- 平台判断：`Capacitor.getPlatform() === 'android'`，封装在 `src/lib/platform.ts`

## File ownership — do not edit the other agent's files

### LocalLibrary owns
- src/lib/library/localRepository.ts (new)
- src/lib/library/service.ts
- src/lib/libraryDb.ts
- src/hooks/useLibraryStore.ts
- src/App.tsx
- src/components/LibraryPage.tsx
- src/components/library/LibraryEmptyState.tsx (new, only if LibraryPage would exceed 500)
- src/App.css (only empty-state / entry-button styles)

### AnkiDroid owns
- src/lib/platform.ts (new)
- src/lib/anki/** (except do not rewrite constants field names)
- src/hooks/useAppActions.ts (only Anki functions)
- src/components/settings/AnkiSettingsTab.tsx
- src/components/settings/useAnkiConnection.ts
- src/components/resources/PendingAnkiImportPanel.tsx (hide/disable on Android)
- android/** native plugin, manifest, gradle
- src/plugins/ankidroid/** if you create a Capacitor plugin package

## Acceptance
打开 App 无登录墙。空书架能直接导入 EPUB 或去粘贴文章。书和解析结果存在本机。安卓点加 Anki 进 AnkiDroid，不再提示去电脑导入。
