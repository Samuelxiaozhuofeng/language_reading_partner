# Guide Progress

最后更新：2026-04-16

## 总览

- 已完成：Phase 1 `ReadingPage.tsx`、Phase 2 `SettingsDialog.tsx`
- 进行中：无
- 待完成：
  - Phase 3 `lib/anki.ts`
  - Phase 4 `App.tsx`
  - Phase 5 `useAnalysisRunner.ts`
  - Phase 6 `useLibraryStore.ts`

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

## 后续执行约束

- 严格按 `guide.md` 顺序继续
- 一次只做一个 phase
- 每个 phase 完成后单独执行：
  - `npm run lint`
  - `npm run build`
