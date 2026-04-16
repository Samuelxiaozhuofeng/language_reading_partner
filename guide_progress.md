# Guide Progress

最后更新：2026-04-16

## 总览

- 已完成：Phase 1 `ReadingPage.tsx`、Phase 2 `SettingsDialog.tsx`、Phase 3 `lib/anki.ts`、Phase 4 `App.tsx`、Phase 5 `useAnalysisRunner.ts`、Phase 6 `useLibraryStore.ts`
- 进行中：无
- 待完成：无

## 已完成工作

### Phase 1: 拆 `ReadingPage.tsx`

已完成拆分，且已独立验证。

新增模块：

- `src/components/reading/readingShared.ts`
- `src/components/reading/readingPagination.ts`
- `src/components/reading/readingHighlights.tsx`
- `src/components/reading/SentenceDetailPanel.tsx`
- `src/components/reading/ReadingDisplaySettings.tsx`
- `src/components/reading/SentenceInspector.tsx`
- `src/components/reading/ChapterReadingView.tsx`
- `src/components/reading/DraftReadingView.tsx`

结果：

- `src/components/ReadingPage.tsx` 已从超大混合文件收缩为页面装配层
- 分页算法、高亮渲染、详情面板、阅读设置、句子检查器已搬出
- chapter / draft 两种阅读视图已拆成子组件

验证：

- `npm run lint` 通过
- `npm run build` 通过

备注：

- `ReadingPage.tsx` 当前约 551 行，较 guide 中建议的 300-450 行仍偏大
- 但本轮已完成主要职责拆分，行为未做主动改动
- 若后续需要继续压缩，可再提取页面内部状态编排或 chapter/draft 相关 hook

### Phase 2: 拆 `SettingsDialog.tsx`

已完成拆分，且已独立验证。

新增模块：

- `src/components/settings/settingsShared.ts`
- `src/components/settings/useModelFetch.ts`
- `src/components/settings/useAnkiConnection.ts`
- `src/components/settings/AiSettingsTab.tsx`
- `src/components/settings/PromptSettingsTab.tsx`
- `src/components/settings/AnkiSettingsTab.tsx`

结果：

- `src/components/SettingsDialog.tsx` 已收缩为对话框壳组件
- AI 模型获取逻辑已迁移到 `useModelFetch.ts`
- Anki 连接检测、字段映射同步、SRA note type 创建/修复已迁移到 `useAnkiConnection.ts`
- AI / Prompt / Anki 三个 tab 的 UI 已拆成独立组件

验证：

- `npm run lint` 通过
- `npm run build` 通过

备注：

- `SettingsDialog.tsx` 当前仅保留弹窗壳、tab 切换和 Esc 关闭逻辑
- `App.tsx` 的调用方式保持不变

### Phase 3: 拆 `lib/anki.ts`

已完成拆分，且已独立验证。

新增模块：

- `src/lib/anki/index.ts`
- `src/lib/anki/constants.ts`
- `src/lib/anki/client.ts`
- `src/lib/anki/errors.ts`
- `src/lib/anki/payload.ts`
- `src/lib/anki/noteType.ts`

结果：

- 原 `src/lib/anki.ts` 已被目录化实现替代，并由 `src/lib/anki/index.ts` 统一收口导出
- SRA note type 模板、AnkiConnect client、字段映射与 payload、note type 创建/修复、错误格式化已按职责拆开
- 现有调用方仍可继续使用 `import ... from './lib/anki'` / `../lib/anki` / `../../lib/anki`

验证：

- `npm run lint` 通过
- `npm run build` 通过

备注：

- Settings 页面与阅读页的 Anki 相关调用路径未改，属于兼容迁移
- `build` 仍有 Vite 主 chunk 体积告警，但不影响本阶段验收

### Phase 4: 拆 `App.tsx`

已完成拆分，且已独立验证。

新增模块：

- `src/hooks/useWorkspaceBinding.ts`
- `src/hooks/useAppActions.ts`

结果：

- `src/App.tsx` 已从应用级控制器收缩为页面装配层，主要保留页面状态、设置弹窗状态、分析 hook 接线与页面 JSX 分支
- `useWorkspaceBinding.ts` 已统一收口 draft/chapter 双数据源桥接、workspace setter 分流、阅读区间与上下文派生
- `useAppActions.ts` 已承接工作区切换、章节打开、导入/删除、草稿入书架、高亮收藏、发送到 Anki、阅读恢复锚点与本地清理等应用级动作
- `SettingsDialog` 的公共 props 已在 `App.tsx` 中统一收口，阅读页和其他页面继续复用同一套设置对话框参数

验证：

- `npm run lint` 通过
- `npm run build` 通过

备注：

- `build` 仍保留 Vite 主 chunk 体积告警，但与本次拆分无关，不影响 Phase 4 验收
- `handleRunAnalysis`、章节区间切换与 `useAnalysisRunner` 的对接仍留在 `App.tsx`，符合 guide 中“编排层继续在后续 phase 再收口”的拆分顺序

### Phase 5: 拆 `useAnalysisRunner.ts`

已完成拆分，并完成静态验证。

新增模块：

- `src/lib/analysis/runContext.ts`
- `src/lib/analysis/runValidation.ts`
- `src/lib/analysis/runState.ts`

结果：

- `src/hooks/useAnalysisRunner.ts` 已将上下文句收集、运行前校验、pending 计算、run 前状态构造、取消后恢复、单句重试状态辅助等纯逻辑迁移到 `src/lib/analysis/`
- `useAnalysisRunner.ts` 当前主要保留 React state / ref、abort controller、`analyzeSentence` / `runConcurrentAnalysis` 调用以及对外暴露的 handler
- `segment`、`runAnalysis`、`cancelAnalysis`、`retrySingleSentence`、`restoreSession` 的对外接口和行为文案保持不变

验证：

- `npm run lint` 通过
- `npm run build` 通过

备注：

- 当前已完成代码级阶段验收，但未在本轮终端中完成 guide 要求的重点手测（取消分析、单句重试、恢复历史记录）
- `build` 仍保留 Vite 主 chunk 体积告警，但与本次拆分无关，不影响 Phase 5 的静态验收

### Phase 6: 拆 `useLibraryStore.ts`

已完成拆分，并完成静态验证。

新增模块：

- `src/lib/library/manualDraft.ts`
- `src/lib/library/selectors.ts`
- `src/lib/library/service.ts`

结果：

- `src/hooks/useLibraryStore.ts` 已把手动草稿入库 payload 生成、书籍/章节选择器、以及 IndexedDB 相关的数据查询与装配逻辑迁移到 `src/lib/library/`
- `manualDraft.ts` 现在负责 `buildManualBookTitle`、`buildManualParagraphBlocks`、`createManualDraftBookPayload`
- `selectors.ts` 现在负责 `updateBookInList`、邻接章节计算、删章后的当前章节与选中章节回退逻辑
- `service.ts` 现在负责 `loadInitialLibraryState`、`hydrateBookState`、`persistChapterRecord`、`openChapterRecord`、`importBookToLibrary`、`saveManualDraftToLibrary`、`removeBookFromLibrary`、`removeChapterFromLibrary`、学习资源保存/删除和清空本地书架
- `useLibraryStore.ts` 当前主要保留 React state、调用 service、同步 notice/error 与将 service 返回值映射回 store state

验证：

- `npm run lint` 通过
- `npm run build` 通过

备注：

- 当前已完成代码级阶段验收，但未在本轮终端中完成 guide 中要求的书架流手测（导入 EPUB、打开章节、删除书/删章、学习资源增删）
- `build` 仍保留 Vite 主 chunk 体积告警，但与本次拆分无关，不影响 Phase 6 的静态验收

## 后续执行约束

- 严格按 `guide.md` 顺序继续
- 一次只做一个 phase
- 每个 phase 完成后单独执行：
  - `npm run lint`
  - `npm run build`
