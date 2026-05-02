# Repository Guidelines

## Project Structure & Module Organization
这是一个基于 Vite + React + TypeScript 的前端项目，应用代码放在 `src/`。

## Product Positioning

这是一个面向中文母语者的多语言阅读助手，不是单纯西语阅读器。

当前实现支持的语言入口是：

- `es`：历史默认语言，复用通用外语分句与通用多语言 prompt 路径。
- `ja`：日语路径，使用 kuromoji 分词、假名显示和日语专用 prompt。

后续 agent 修改 prompt、文案或分析流程时必须保持多语言定位：

- 默认 prompt 应描述为多语言/外语阅读助手，不要重新写死为西语教师。
- 只有明确处于 `ja` 专用路径时，才使用日语专用分词、语块和 furigana 逻辑。
- 历史 localStorage/IndexedDB key 中的 `spanish-reading-assistant` 是兼容旧数据的持久化标识，不代表产品只能支持西语，不能为了改名随意迁移或重置。
- 新增语言时优先扩展 `BookLanguage`、分句策略、显示标签和 prompt 路由，不要把新语言硬塞进页面组件。

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
- `npm run android:sync`：先构建 Web `dist/`，再同步到 Capacitor Android 工程
- `npm run android:debug`：同步后构建 Android debug APK

## Capacitor Android Packaging
当前项目已接入 Capacitor Android，原生工程在 `android/`，配置在 `capacitor.config.ts`，`webDir` 固定为 `dist`。

- Web 端仍以 Vite 为主；不要为了 Android 改动 `src/main.tsx`、`index.html` 或 Web 构建入口。
- Android 每次打包前先运行 `npm run android:sync`，确保最新 `dist/` 已复制到 `android/app/src/main/assets/public`。
- 发给用户覆盖安装的新版本，必须递增 `android/app/build.gradle` 里的 `versionCode`。
- release APK 必须使用同一个签名密钥；当前本机密钥位于 `~/.android/multireader-release.jks`，不要提交到仓库。
- 构建产物在 `android/app/build/outputs/apk/`；`android/app/build/` 属于生成物，不要手改。

## Supabase Cloud Storage
当前书架主数据源已经切换为 Supabase 云端存储。后续修改书架、章节、学习资源、登录或迁移逻辑时，必须遵守这一分层：

- `src/lib/supabase/client.ts`
  只负责创建 Supabase browser client 和读取 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`。
- `src/lib/supabase/auth.ts`
  放认证输入校验、错误文案和 auth 相关纯工具。
- `src/hooks/useSupabaseAuth.ts`、`src/hooks/useSupabaseSession.ts`
  负责邮箱密码登录、注册、退出、确认邮件重发和 session 恢复的 React 状态编排。
- `src/lib/library/remoteRepository.ts`
  是 Supabase Postgres / Storage 的唯一仓库访问层，负责 row/domain 映射、CRUD、Storage 上传下载删除和 Supabase 错误转译。
- `src/lib/library/service.ts`
  负责云端书架业务编排，例如导入、删除、章节打开、章节快照同步、旧数据迁移。
- `src/hooks/useLibraryStore.ts`
  负责页面级状态编排、乐观更新、防抖同步和错误提示，不直接写 Supabase 查询。

Supabase schema 与安全规则：

- 表、字段、索引、RLS policy、Storage bucket/policy 的来源文件是 `supabase/schema.sql`。
- 当前业务表包括 `collections`、`books`、`chapters`、`resources`，都必须启用 RLS。
- 暴露给前端的表 policy 必须限制到当前登录用户，保持 `to authenticated` 和 `(select auth.uid()) = user_id` 这一类隔离模型。
- 前端只允许使用 publishable key。禁止把 Supabase secret key、service role key 或任何后端特权 key 放进 Vite 环境变量、源码、localStorage 或浏览器端 bundle。
- `books.language` 的数据库 check 约束当前只允许 `es`、`ja`。新增语言时必须同步更新 `BookLanguage`、分句/prompt 路由、`supabase/schema.sql` 和 `src/lib/supabase/database.ts`。

Supabase Storage 规则：

- EPUB 原文件只放在私有 bucket `book-files`。
- 文件路径必须以用户 ID 作为第一段，当前规则为 `${userId}/${bookId}/original.epub`。
- 上传使用 upsert 时，Storage policy 必须同时允许目标用户路径下的 select、insert、update；删除文件需要 delete policy。
- 不要把 EPUB 文件转为 public URL；下载必须通过已登录用户的 Supabase client 和 RLS/Storage policy。

本地存储与迁移关系：

- `src/lib/libraryDb.ts` 是历史 IndexedDB 书库实现，当前只应作为旧数据迁移来源，不应继续作为新书架功能的权威存储。
- `src/lib/library/localMigration.ts` 负责读取旧 IndexedDB 数据并迁移到 Supabase。
- `src/lib/library/cloudCache.ts` 是云端书架快照缓存，只用于加速首屏恢复；它不是离线写入队列，也不是冲突解决机制。
- 历史 IndexedDB / localStorage key 中的 `spanish-reading-assistant` 是兼容旧数据的持久化标识，不能因为产品已多语言化而随意迁移、重命名或清空。

Supabase 修改验证要求：

- 改动 Supabase 相关 TypeScript 代码后，至少运行 `npm run lint` 和 `npm run build`。
- 改动 `supabase/schema.sql`、RLS policy 或 Storage policy 后，除前端 lint/build 外，还必须记录 Supabase SQL/advisors 或手动验证结果。
- 验证 schema/policy 时，应覆盖 authenticated 用户只能访问自己的 `collections`、`books`、`chapters`、`resources`，以及只能访问 `book-files` 中自己用户 ID 前缀下的 EPUB。
- 如果当前环境没有 Supabase CLI、远程凭证或无法运行真实云端验证，最终回复必须明确说明未验证项，不能声称 schema/policy 已在云端成功。
- `src/lib/supabase/database.ts` 是 generated-style 类型文件。修改 schema 后必须同步更新该文件；如果没有自动生成流程，需在变更说明中注明类型是人工同步。

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
