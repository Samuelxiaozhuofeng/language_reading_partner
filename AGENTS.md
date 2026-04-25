# Repository Guidelines

## Project Structure & Module Organization
这是一个基于 Vite + React + TypeScript 的前端项目，应用代码放在 `src/`。

当前仓库已经完成 6 个阶段的职责拆分，后续开发必须延续这个分层，而不是把职责重新塞回大文件：

- `src/App.tsx`
  只作为应用装配层，负责页面状态、弹窗状态、hook 组合和页面级 JSX 分支。
- `src/components/`
  放页面组件和页面子组件。
  顶层页面包括 `LibraryPage.tsx`、`WorkspacePage.tsx`、`ReadingPage.tsx`、`ResourcesPage.tsx`、`SettingsDialog.tsx`。
  复杂页面的子模块继续放在子目录中：
  `src/components/reading/`、`src/components/settings/`。
- `src/hooks/`
  放状态编排和应用层行为，不放大段纯工具逻辑。
  现有 hook 包括：
  `usePersistentConfig.ts`、`useWorkspaceBinding.ts`、`useAppActions.ts`、`useAnalysisRunner.ts`、`useLibraryStore.ts`。
- `src/lib/`
  放纯函数、服务编排、API 调用、持久化访问和 domain 级辅助逻辑。
  已完成目录化的模块包括：
  `src/lib/anki/`、`src/lib/analysis/`、`src/lib/library/`。
- `src/types.ts`
  放共享类型定义。
- `src/main.tsx`
  放应用入口。
- `src/assets/`
  放构建时导入的静态资源。
- `public/`
  放需要原样提供的静态文件。
- `dist/`
  是构建产物，不要手改。

## Layer Responsibilities
后续添加功能、优化功能、修改功能时，必须优先判断职责应该落在哪一层：

- 页面结构、页面展示、页面子视图：放 `components/`
- 跨组件状态编排、事件动作、页面装配：放 `hooks/`
- 纯逻辑、纯算法、数据装配、持久化/服务访问：放 `lib/`
- 共享类型：放 `types.ts`

不要让单个文件同时承担以下多类职责：

- 页面 UI
- 状态编排
- 业务规则
- 数据持久化
- API 调用
- 大量工具函数

如果一个改动同时涉及这些职责，必须拆开实现。

## Complexity Control
后续开发时要谨慎，避免“为了快”把所有功能职责挤在一个代码文件中。

默认要求：

- 不要继续让 `App.tsx` 变回应用级控制器
- 不要继续让页面组件文件同时承载子组件、算法、浮层、详情面板、表单逻辑
- 不要继续让 hook 同时塞满 React state、服务访问、纯业务规则、数据转换
- 不要继续让 `lib/` 里出现含糊不清的 `utils.ts` / `helpers.ts` 大杂烩文件

满足以下任一情况时，应优先拆分：

- 一个文件开始同时处理 3 类以上职责
- 一个页面新增功能需要额外的子视图、纯逻辑或状态编排
- 一个 hook 出现明显可抽离的纯函数、校验逻辑、状态转换逻辑
- 一个模块开始同时处理 UI、存储和远程调用
- 修改某功能时，需要复制或堆叠已有逻辑而不是复用现有分层

优先拆分方向：

- 页面内部子区块：拆到 `components/<domain>/`
- 页面级编排：拆到 `hooks/`
- 纯逻辑：拆到 `lib/<domain>/`
- 数据装配与持久化流程：拆到 `lib/<domain>/service.ts`
- 选择器、派生计算：拆到 `lib/<domain>/selectors.ts`
- 输入构造、payload 生成：拆到职责明确的独立文件

## Build, Test, and Development Commands
使用 npm，因为仓库包含 `package-lock.json`。

- `npm install`：安装依赖
- `npm run dev`：启动 Vite 开发服务器
- `npm run build`：先执行 TypeScript 构建检查，再生成生产包
- `npm run preview`：本地预览生产构建
- `npm run lint`：运行 ESLint

## Change Workflow
做任何代码修改时，遵循下面的流程：

1. 先确认影响范围和职责归属
2. 先读相关代码，再改
3. 先做最小方案，不做顺手重构
4. 如果新增逻辑会让现有文件继续膨胀，先拆分再接功能
5. 完成后必须验证，不能只口头判断

如果只是为了实现新功能而把逻辑直接塞进现有大文件，这种做法默认视为不合格实现。

## Coding Style & Naming Conventions
使用 TypeScript 和 React 函数组件。保持现有代码风格：

- 2 空格缩进
- 单引号
- 不加分号

命名约定：

- 组件、类型：`PascalCase`
- hooks、函数、变量：`camelCase`
- 文件名与主职责一致，例如：
  `WorkspacePage.tsx`、`useAnalysisRunner.ts`、`service.ts`、`selectors.ts`

新增文件时，名称必须表达职责，不要使用模糊命名。

## Testing Guidelines
目前仓库没有完整的自动化测试框架。

每次改动后，至少执行：

- `npm run lint`
- `npm run build`

如果改动影响主流程，还应手动验证相关功能，例如：

- 粘贴文本、分句、运行解析
- 打开阅读页
- 设置弹窗配置
- 书架导入、打开、删除
- 学习资源增删

页面类改动的验证边界：

- 不需要启动 `npm run dev` 或 Vite dev server
- 不需要启动 `npm run preview`
- 不需要尝试按浏览器验证技能使用 `agent-browser`
- 完成 `npm run build` 后，至少确认 `dist/index.html` 已生成，作为页面可打开的基本验证
- 完成代码工作后，在最终回复中告诉用户自行打开页面尝试

如果新增测试，优先放在对应代码旁边，文件名使用 `*.test.ts` 或 `*.test.tsx`。优先给 `src/lib/` 中的纯逻辑补测试。

## Commit & Pull Request Guidelines
当前工作区不包含 `.git`，无法从本地历史推断提交风格。

提交信息建议使用简短祈使句，例如：

- `feat: add chapter range controls`
- `fix: preserve chapter selection after deletion`
- `refactor: split library service logic`

PR 描述应包含：

- 改了什么
- 为什么改
- 跑了哪些验证命令
- 是否涉及配置变化
- 如果有 UI 变化，附截图

## Security & Configuration Tips

- 不要硬编码 API Key、Base URL 或其他密钥
- 保持“用户在浏览器里自行配置”的现有行为
- 不要提交真实凭证
- 不要把环境相关地址写死到代码里
