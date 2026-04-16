# 西语阅读助手拆分 Guide

## 目的

这份文档用于指导 AI agent 对当前代码库做渐进式拆分。

目标不是重写，不是重构 UI，不是改业务逻辑，而是：

- 降低单文件职责密度
- 让页面层、hook 层、lib 层边界更清晰
- 在不改变现有行为的前提下，把“过胖文件”拆成更稳定的模块

---

## 当前判断

这个项目已经有基础分层：

- `components/`
- `hooks/`
- `lib/`
- `types.ts`

但核心问题是多个关键文件内部职责过多，属于“目录分层了，但关键文件还很挤”。

优先问题文件：

1. `src/components/ReadingPage.tsx`
2. `src/components/SettingsDialog.tsx`
3. `src/lib/anki.ts`
4. `src/App.tsx`
5. `src/hooks/useAnalysisRunner.ts`
6. `src/hooks/useLibraryStore.ts`

---

## 拆分总原则

### 1. 顺序

必须按这个顺序推进：

1. 先拆叶子模块
2. 再拆页面组件
3. 最后拆编排层

推荐顺序：

1. `ReadingPage.tsx`
2. `SettingsDialog.tsx`
3. `lib/anki.ts`
4. `App.tsx`
5. `useAnalysisRunner.ts`
6. `useLibraryStore.ts`

原因：

- 前 3 个主要是内部职责过多，对外接口相对稳定
- 后 3 个是编排层，依赖面大，应该最后收口

### 2. 每次只做一个阶段

禁止一个任务里同时拆多个 phase。  
每个 phase 必须独立完成、独立验证。

### 3. 先搬家，再整理

优先做：

- 提取纯函数
- 提取子组件
- 提取内部 hook
- 增加 re-export 收口

不要先做：

- 改业务行为
- 改交互文案
- 改样式体系
- 改 API 设计
- 引入新抽象层级

### 4. 兼容优先

拆分过程中尽量保持旧调用方式不变。

如果原来是：

- `import { xxx } from '../lib/anki'`

那么优先通过 `index.ts` 或中转导出保持兼容，而不是立刻全仓替换路径。

### 5. 验证是强制的

每个阶段完成后必须运行：

```bash
npm run lint
npm run build
```

不能口头说“应该没问题”。

---

## 目标目录结构

不是要求一次性实现，而是整体往这个方向收敛：

```text
src/
  components/
    reading/
      ReadingPage.tsx
      SentenceInspector.tsx
      SentenceDetailPanel.tsx
      ReadingDisplaySettings.tsx
      readingHighlights.tsx
      readingPagination.ts
      readingShared.ts
    settings/
      SettingsDialog.tsx
      AiSettingsTab.tsx
      PromptSettingsTab.tsx
      AnkiSettingsTab.tsx
      useModelFetch.ts
      useAnkiConnection.ts
      settingsShared.ts
  hooks/
    useAnalysisRunner.ts
    useLibraryStore.ts
    useWorkspaceBinding.ts
    useAppActions.ts
  lib/
    anki/
      index.ts
      constants.ts
      client.ts
      noteType.ts
      payload.ts
      errors.ts
    analysis/
      runValidation.ts
      runContext.ts
      runState.ts
    library/
      service.ts
      manualDraft.ts
      selectors.ts
```

---

## Phase 1: 拆 `ReadingPage.tsx`

### 当前问题

`src/components/ReadingPage.tsx` 同时承担了：

- 阅读页主组件
- 章节分页计算
- 高亮解析与渲染
- 句子详情面板
- 阅读设置面板
- 句子检查器

这不是单一页面文件，而是多个模块混装。

### 目标

把 `ReadingPage.tsx` 收缩成页面装配层。  
把纯算法、子组件、共享小工具拆出去。

### 建议拆分结果

#### `src/components/reading/readingPagination.ts`

移动这些函数：

- `estimateParagraphHeight`
- `measureParagraphHeight`
- `paginateChapterParagraphs`

要求：

- 保持纯函数
- 不依赖 React

#### `src/components/reading/readingHighlights.tsx`

移动这些函数：

- `findInlineHighlightRanges`
- `renderGrammarText`

#### `src/components/reading/SentenceDetailPanel.tsx`

提取当前详情面板组件。

包含：

- 高亮选择后详情展示
- 保存到学习资源
- 添加到 Anki
- Anki 提交状态

#### `src/components/reading/ReadingDisplaySettings.tsx`

提取阅读设置浮层。

#### `src/components/reading/SentenceInspector.tsx`

提取句子检查器侧栏或抽屉。

#### `src/components/reading/readingShared.ts`

移动共享工具和常量：

- `buildSelectionKey`
- `getSentenceDisplayText`
- `normalizeSentenceText`
- `buildParagraphText`
- 阅读页 breakpoint 常量

### `ReadingPage.tsx` 最终应只保留

- 页面级 state
- `useMemo/useEffect/useRef`
- 两种阅读模式的组合逻辑
- 页面骨架 JSX

### 验收标准

- `ReadingPage.tsx` 降到约 300-450 行
- 功能行为不变
- 章节分页仍正常
- 点击句子仍能打开解释
- 收藏/取消收藏正常
- 添加到 Anki 正常
- 阅读设置正常
- `npm run lint` 通过
- `npm run build` 通过

---

## Phase 2: 拆 `SettingsDialog.tsx`

### 当前问题

`src/components/SettingsDialog.tsx` 同时包含：

- AI 模型获取逻辑
- Anki 连接检测逻辑
- 字段映射同步逻辑
- 创建/修复 SRA note type
- 三个 tab 的全部 UI
- 对话框副作用管理

这已经不是一个简单组件，而是对话框 + 多个子系统。

### 目标

把设置弹窗拆成：

- 壳组件
- tab 子组件
- 与网络/连接相关的内部 hook

### 建议拆分结果

#### `src/components/settings/useModelFetch.ts`

负责：

- 模型列表拉取
- 拉取状态
- 搜索词
- 分页
- `runModelFetch`

#### `src/components/settings/useAnkiConnection.ts`

负责：

- deck / note type / field 获取
- 连接状态
- `handleCreateSraNoteType`
- 字段映射清理与同步

#### `src/components/settings/AiSettingsTab.tsx`

负责 UI：

- API URL
- API Key
- Model
- 并发数
- 模型列表选择

#### `src/components/settings/PromptSettingsTab.tsx`

负责 UI：

- 上下文句数
- Prompt 模板
- 恢复默认 Prompt

#### `src/components/settings/AnkiSettingsTab.tsx`

负责 UI：

- AnkiConnect URL
- deck 选择
- note type 选择
- field mapping
- SRA note type 创建/修复

#### `src/components/settings/settingsShared.ts`

放：

- `MODEL_SEARCH_THRESHOLD`
- `MODEL_PAGE_SIZE`
- `settingsTabLabelMap`

### `SettingsDialog.tsx` 最终应只保留

- 对话框外壳
- tab 切换
- Esc 关闭
- 调用三个 tab 组件

### 验收标准

- `SettingsDialog.tsx` 降到约 180-250 行
- AI 配置获取模型功能不变
- Prompt 配置功能不变
- Anki 连接检测功能不变
- 创建/修复 SRA note type 功能不变
- `npm run lint` 通过
- `npm run build` 通过

---

## Phase 3: 拆 `lib/anki.ts`

### 当前问题

`src/lib/anki.ts` 同时包含：

- SRA note type 模板与 CSS
- 浏览器兼容性判断
- AnkiConnect 通信 client
- 字段映射与 payload 构建
- note type 创建/修复
- 错误格式化

这是典型的“模块名对，但模块职责太杂”。

### 目标

按职责切开，但先保持对外导出兼容。

### 建议拆分结果

#### `src/lib/anki/constants.ts`

放：

- `SRA_NOTE_TYPE_NAME`
- 字段顺序
- 字段标签
- `sraFrontTemplate`
- `sraBackTemplate`
- `sraStyling`

#### `src/lib/anki/client.ts`

放：

- `normalizeAnkiEndpoint`
- `parseEndpoint`
- `getAnkiCompatibilityIssue`
- `invokeAnkiAction`
- `ensureAnkiPermission`
- `fetchAnkiVersion`
- `fetchAnkiDeckNames`
- `fetchAnkiNoteTypes`
- `fetchAnkiNoteFields`

#### `src/lib/anki/errors.ts`

放：

- `toUserFacingAnkiError`

#### `src/lib/anki/payload.ts`

放：

- `escapeHtml`
- `highlightKnowledgeInSentence`
- `getAnkiFieldMappingIssues`
- `buildFields`
- `createAnkiFieldMappingFromFieldNames`
- `buildAnkiNotePayload`

#### `src/lib/anki/noteType.ts`

放：

- `fetchAnkiModelTemplates`
- `createOrRepairSraAnkiNoteType`

#### `src/lib/anki/index.ts`

统一收口导出，优先保持调用方兼容。

### 过渡要求

如果当前项目大量使用：

```ts
import { addNoteToAnki } from './lib/anki'
```

那么第一步应该是：

- 保留原有导入路径可用
- 再逐步决定是否替换成目录导入

### 验收标准

- `src/lib/anki.ts` 可被目录化替代，或保留为薄 re-export 文件
- 旧功能全部可用
- Settings 页面与阅读页中的 Anki 行为都不回归
- `npm run lint` 通过
- `npm run build` 通过

---

## Phase 4: 拆 `App.tsx`

### 当前问题

`src/App.tsx` 已经不是薄入口，而是应用级控制器。

它现在同时负责：

- page 状态切换
- draft/chapter 双数据源桥接
- 工作区数据 setter 分流
- 阅读恢复与范围逻辑
- 书架操作
- 保存高亮
- 发送到 Anki
- 资源页切换
- Settings 传参

### 目标

让 `App.tsx` 回到“组合 hooks + 选择页面组件”的角色。

### 建议拆分结果

#### `src/hooks/useWorkspaceBinding.ts`

负责：

- `draft/chapter` 双数据源桥接
- `effectiveWorkspaceSource`
- `workspaceSourceText`
- `workspaceSentences`
- `workspaceResults`
- `setWorkspaceSourceText`
- `setWorkspaceSentences`
- `setWorkspaceResults`
- `selectedChapterRange`
- `activeReadingRange`
- `currentContextTitle`

这个 hook 的本质是把：

- `persistent`
- `library`
- `workspaceSource`

三者收口成统一的 workspace 视图。

#### `src/hooks/useAppActions.ts`

负责：

- `handleOpenManualWorkspace`
- `handleOpenChapterWorkspace`
- `handleOpenChapterReading`
- `handleOpenRecentChapter`
- `handleOpenAdjacentChapter`
- `handleDeleteBook`
- `handleDeleteChapter`
- `handleImportFile`
- `handleSaveManualDraft`
- `handleSaveHighlight`
- `handleRemoveHighlight`
- `handleAddHighlightToAnki`
- `handleClearLocalData`

### `App.tsx` 最终应只保留

- page state
- settings open state
- resource filter
- hook 组合
- 页面级 JSX 分支

### 验收标准

- `App.tsx` 明显缩小
- 页面切换逻辑行为不变
- 工作区、阅读页、资源页、设置页都能正常进入
- 收藏、删除、导入、保存到书架、发到 Anki 都不回归
- `npm run lint` 通过
- `npm run build` 通过

---

## Phase 5: 拆 `useAnalysisRunner.ts`

### 当前问题

`src/hooks/useAnalysisRunner.ts` 把这几类东西混在一起：

- 输入校验
- 上下文句收集
- 分句逻辑
- 并发分析 orchestration
- cancel/retry/restore
- React state 管理

这个 hook 的问题不是太长，而是“纯逻辑”和“React orchestration”混在一起。

### 目标

把纯业务规则移到 `lib/analysis/`，hook 本身只负责：

- state
- side effect
- 调用 `openai.ts`

### 建议拆分结果

#### `src/lib/analysis/runContext.ts`

提取：

- `collectContextSentences`

#### `src/lib/analysis/runValidation.ts`

提取：

- 运行前校验逻辑

建议返回统一结构：

```ts
type RunValidationResult =
  | { ok: true }
  | { ok: false; errorMessage: string }
```

#### `src/lib/analysis/runState.ts`

提取：

- pending entries 计算
- run 前句子状态构造
- cancel 后恢复句子状态
- retry 后成功/失败的句子状态辅助函数

### `useAnalysisRunner.ts` 最终应只保留

- `useState/useRef/useEffect`
- abort controller
- 调用 `analyzeSentence`
- 调用 `runConcurrentAnalysis`
- 面向组件暴露 handler

### 验收标准

- hook 压到约 250-350 行
- `segment`
- `runAnalysis`
- `cancelAnalysis`
- `retrySingleSentence`
- `restoreSession`

行为都不变。

必须重点手测：

- 取消分析
- 单句重试
- 恢复历史记录

并通过：

- `npm run lint`
- `npm run build`

---

## Phase 6: 拆 `useLibraryStore.ts`

### 当前问题

`src/hooks/useLibraryStore.ts` 同时承担：

- 书架 bootstrap
- hydrate 当前书籍
- 打开章节
- 导入 EPUB
- 手动草稿入库
- 删除书/删章
- 学习资源 CRUD
- 局部 selector 逻辑

这导致 hook 既像 store，又像 service，还像 domain assembler。

### 目标

把数据装配和数据库操作逻辑移到 `lib/library/`，让 hook 更像真正的 store。

### 建议拆分结果

#### `src/lib/library/manualDraft.ts`

提取：

- `buildManualBookTitle`
- `buildManualParagraphBlocks`
- `createManualDraftBookPayload`

#### `src/lib/library/selectors.ts`

提取：

- `updateBookInList`
- 邻接章节选择逻辑

#### `src/lib/library/service.ts`

提取带 DB 行为的逻辑：

- `loadInitialLibraryState`
- `hydrateBookState`
- `openChapterRecord`
- `importBookToLibrary`
- `removeBookFromLibrary`
- `removeChapterFromLibrary`
- `saveKnowledgeResourceToLibrary`

要求：

- 这些函数不直接持有 React state
- 只处理数据查询、组装、返回结果

### `useLibraryStore.ts` 最终应只保留

- state
- 调用 service
- 更新 state
- 管理 `libraryNotice/libraryError`

### 验收标准

- `useLibraryStore.ts` 明显变短
- 书架初始化正常
- 导入 EPUB 正常
- 打开章节正常
- 删除书/删章正常
- 学习资源增删正常
- `npm run lint` 通过
- `npm run build` 通过

---

## 每个 Phase 的统一执行要求

所有 agent 都必须遵守以下要求：

### 必做

- 只处理当前 phase
- 拆分时优先保持行为不变
- 优先提取纯函数、子组件、内部 hook
- 保持导出兼容，避免大规模全仓替换
- 完成后运行 `npm run lint`
- 完成后运行 `npm run build`
- 报告真实验证结果

### 禁止

- 不要顺手改 UI 设计
- 不要顺手重命名大量类型/函数
- 不要把多个 phase 混在一起
- 不要引入“未来可能会用到”的抽象
- 不要修改测试或检查逻辑来掩盖问题
- 不要宣称“应该没问题”而不验证

---

## 建议的单次任务模板

给 agent 下任务时，建议直接用下面的模板。

### 模板 A：执行单个 phase

```text
只处理 Phase X，不处理其他阶段。
目标是拆分当前文件职责，不改变任何用户可见行为。
优先提取纯函数、子组件、内部 hook；避免重写逻辑。
保持现有导出接口兼容，必要时增加 index.ts 做 re-export。
完成后必须运行 npm run lint 和 npm run build，并报告实际结果。
```

### 模板 B：限制风险的补充要求

```text
不要顺手做样式重构，不要改业务文案，不要改 API 设计。
如果发现别的文件也很大，只记录，不在这次任务里处理。
如需新增文件，命名必须贴合职责，不要创建含糊的 utils/helpers 大杂烩文件。
```

### 模板 C：要求交付格式

```text
请输出：
1. 你拆了哪些文件
2. 你保留了哪些兼容导出
3. 你运行了什么验证命令
4. lint/build 的真实结果
5. 还剩下哪些未处理风险
```

---

## 推荐执行顺序

推荐按 6 次任务推进，不要合并：

1. Phase 1: 拆 `ReadingPage.tsx`
2. Phase 2: 拆 `SettingsDialog.tsx`
3. Phase 3: 拆 `lib/anki.ts`
4. Phase 4: 拆 `App.tsx`
5. Phase 5: 拆 `useAnalysisRunner.ts`
6. Phase 6: 拆 `useLibraryStore.ts`

---

## 最终完成标准

拆分工作可以认为完成，当且仅当：

- 以上 6 个 phase 全部完成
- 关键大文件职责明显收缩
- 目录结构更符合“组件 / hook / lib / domain”边界
- 应用行为无明显回归
- 每个阶段都有真实的 `lint` 和 `build` 结果

如果只完成了部分 phase，只能叫“阶段性完成”，不能叫“拆分完成”。
