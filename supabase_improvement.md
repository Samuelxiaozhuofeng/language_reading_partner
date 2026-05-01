# Supabase 云存储实现调研与改进建议

## 结论

当前 Supabase 接入已经覆盖云端书架主流程：用户登录后，书籍、章节、解析结果、集合和学习资源以 Supabase Postgres 为权威数据源，EPUB 原文件保存在 Supabase Storage 私有 bucket 中。旧 IndexedDB 书库保留为一次性迁移来源，另有浏览器 IndexedDB 快照缓存用于加速云端书架首屏恢复。

实现完成度可以判断为“主流程已可用，但工程化和运维验证还不完整”。后续优先补齐文档、schema 类型生成流程、真实 Supabase 环境验证记录，再考虑失败恢复与同步一致性增强。

## 当前架构

- 前端客户端使用 `@supabase/supabase-js`，入口在 `src/lib/supabase/client.ts`。
- 环境变量为 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`，未配置时登录入口会提示缺少 Supabase 配置。
- 认证封装在 `src/hooks/useSupabaseAuth.ts` 和 `src/hooks/useSupabaseSession.ts`，支持邮箱密码登录、注册、退出、恢复 session 和注册确认邮件重发。
- 云端书架数据访问集中在 `src/lib/library/remoteRepository.ts`，上层业务编排在 `src/lib/library/service.ts`，React 状态编排在 `src/hooks/useLibraryStore.ts`。
- EPUB 文件保存在私有 Storage bucket `book-files`，路径规则为 `${userId}/${bookId}/original.epub`。
- 本地 `src/lib/library/cloudCache.ts` 使用 IndexedDB 保存云端书架快照，只作为首屏缓存，不是权威数据源。
- 旧 `src/lib/libraryDb.ts` 仍保留 IndexedDB 读写能力，但当前新路径只通过 `src/lib/library/localMigration.ts` 读取旧数据并迁移到云端。

## 数据模型与安全

`supabase/schema.sql` 已定义并启用以下对象：

- `public.collections`：用户自定义集合。
- `public.books`：书籍元信息、语言、来源类型、集合、最近阅读章节和 EPUB 文件路径。
- `public.chapters`：章节全文、段落块、分句、解析结果、阅读范围、阅读位置和恢复锚点。
- `public.resources`：收藏的语法、短语和词汇资源。
- `storage.buckets` 中的 `book-files`：私有 EPUB 文件 bucket，限制为 `application/epub+zip`，大小限制 50 MB。

RLS 和 Storage policy 的实现方向正确：

- 四张业务表均启用 row level security。
- 表策略使用 `to authenticated`，并通过 `(select auth.uid()) = user_id` 限制用户只能管理自己的数据。
- Storage policy 使用 `storage.foldername(name)[1]` 与 `auth.uid()` 比较，限制用户只能访问自己路径前缀下的 EPUB 文件。
- Storage upsert 场景已配套 select、insert、update policy；删除 EPUB 文件也有 delete policy。

## 已实现能力

- 登录/注册：邮箱密码登录、注册、退出、session 恢复、确认邮件重发和基础错误提示。
- 云端初始化：登录后先读本地云端快照缓存，再拉取 Supabase 最新书架、集合、学习资源和首本书章节。
- EPUB 导入：解析 EPUB 后上传原始文件到 `book-files`，并写入 `books`、`chapters`。
- 手动文章保存：把粘贴文章转为 manual book/chapter 并写入云端。
- 章节打开与阅读进度：打开章节后更新 `books.last_read_chapter_id`、`books.last_opened_at` 和 `chapters.last_opened_at`。
- 解析结果同步：章节分句、解析结果、分析状态、阅读范围和恢复锚点通过防抖写回云端。
- 学习资源：支持按 signature 去重保存、删除单条、批量删除和按时间加载。
- 集合管理：支持创建集合、删除集合、移动书籍到集合或移回全部。
- 删除清理：删除书籍时会删除 EPUB 文件、相关资源，并依赖外键级联删除章节；清空书架时会删除用户所有书籍、资源、集合和本地云端快照。
- 旧数据迁移：检测旧 IndexedDB 书库后，允许把旧书籍、章节、EPUB 文件、集合和学习资源导入云端。

## 主要问题

1. 文档仍落后于实现

   README 仍把技术栈描述为“本地浏览器存储”，没有说明当前书架已经改为 Supabase-backed cloud library。AGENTS.md 原本也缺少 Supabase 细节，容易导致后续 agent 把云端职责误塞回本地 IndexedDB 或页面组件。

2. `database.ts` 没有生成流程说明

   `src/lib/supabase/database.ts` 是 generated-style 类型文件，但仓库没有记录如何从 Supabase schema 重新生成，后续 schema 改动容易造成类型与真实数据库漂移。

3. 部分操作是 optimistic UI，失败后只提示错误

   `openChapter`、`removeChapter`、章节快照同步等路径会先更新本地 UI，再异步写云端。失败时目前主要通过 `libraryError` 提示，不会自动回滚到远端状态。这个策略可以接受，但需要在文档里明确，未来若要求强一致，需要补远端重载或回滚策略。

4. 缺少真实 Supabase 环境验证记录

   代码和 schema 都存在，但仓库没有记录最近一次 Supabase SQL 执行、RLS policy 验证、Storage upload/download/remove 验证或 advisors 结果。后续 schema/policy 改动不应只跑前端 build。

5. 多语言扩展与 schema check 需要同步

   `books.language` 当前 check 约束只允许 `es` 和 `ja`。新增语言时，除了扩展前端 `BookLanguage`、分句策略和 prompt 路由，也必须同步更新 Supabase schema 和类型。

6. 云端缓存不是离线队列

   `cloudCache.ts` 只是最近一次云端快照缓存。离线期间产生的修改不会自动排队同步，不能把它当成本地优先数据源或冲突解决机制。

## 改进优先级

### P0：补齐仓库级规则

- 在 AGENTS.md 明确 Supabase 分层、环境变量、RLS、Storage、旧 IndexedDB 迁移和验证要求。
- 在后续 PR/变更说明中区分“云端权威数据源”和“本地缓存/旧迁移来源”。

### P1：补齐开发与部署文档

- 更新 README，说明首次使用需要 Supabase 登录，书架数据保存到云端，AI/Anki 配置仍保存在本地浏览器。
- 补充 Supabase 初始化步骤：执行 `supabase/schema.sql`、配置 `VITE_SUPABASE_URL`、配置 `VITE_SUPABASE_PUBLISHABLE_KEY`、启用邮箱认证。
- 记录 `book-files` bucket 的私有访问模型和 50 MB EPUB 限制。

### P1：规范 schema 类型生成

- 选择并记录类型生成命令，例如使用 Supabase CLI 从项目生成 `src/lib/supabase/database.ts`。
- 每次修改 `supabase/schema.sql` 后，同步更新 `database.ts`，并运行 `npm run lint`、`npm run build`。
- 如果暂时继续手写类型，必须在改动说明中明确这是人工同步，避免误认为已经自动生成。

### P2：补真实环境验证清单

- 针对 schema/policy 变更记录 Supabase SQL 执行结果。
- 验证 authenticated 用户只能 CRUD 自己的 `collections`、`books`、`chapters`、`resources`。
- 验证 `book-files` 中用户只能上传、下载、更新、删除自己用户 ID 前缀下的 EPUB。
- 尽量运行 Supabase advisors；如果当前环境缺少 CLI 或远程凭证，需要在最终说明中记录未验证原因。

### P2：增强失败恢复策略

- 对 optimistic UI 路径制定统一策略：失败后是保留本地变更并提示重试，还是自动重新拉取远端状态。
- 对删除章节、打开章节、章节快照同步这类异步写路径，考虑加入显式“重新同步/重新加载”入口。
- 避免添加静默 fallback；同步失败必须继续可见地暴露给用户。

### P3：考虑同步与数据体积优化

- 章节 `sentences`、`results`、`paragraph_blocks` 都存在 jsonb 中，主流程简单直接，但大书籍会带来较大的行体积。
- 如果后续出现性能问题，再考虑按结果拆表、分页加载章节内容或只同步当前章节。
- 当前阶段不建议提前重构数据模型，除非真实数据量验证显示瓶颈。

## 后续修改注意事项

- 前端只能使用 publishable key；绝不能把 Supabase secret key 或 service role key 放入 Vite 环境变量、源码或浏览器端代码。
- 新增云端字段时，要同时更新 `supabase/schema.sql`、`src/lib/supabase/database.ts`、`src/lib/library/remoteRepository.ts` 的 row/domain 映射。
- 新增书架功能时优先落到 `src/lib/library/service.ts` 和 `remoteRepository.ts`，React hook 只做状态编排，页面组件只做展示和事件连接。
- 新增语言时必须同步检查 Supabase `books.language` check 约束。
- 本地 IndexedDB key 中的 `spanish-reading-assistant` 是历史兼容标识，不代表产品重新限定为西语，也不应随意迁移或清空。

## 参考资料

- Supabase API keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
