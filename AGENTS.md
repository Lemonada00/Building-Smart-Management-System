# 项目协作指南

## 项目速览

- **定位**：建筑智能 / 智能质检工单 MVP，围绕明确需求交付可演示的核心路径。
- **当前状态**：阶段 1 登录身份、阶段 2 工单查询和阶段 3 工单处理闭环已实现。共用详情支持编辑、解决、拒绝、指派、重开及私有现场图片，按当前会话身份校验权限，版本冲突防止覆盖旧数据；阶段 4 管理员中心及数据大盘已实现；阶段 5 助手真实 OpenRouter 查询与图片理解已按当前约定范围验收通过；阶段 6 建单卡片及 Coze 单轮调用已接入，Coze API 已可调用，有来源的知识答复仍待验收。交付见 `progress.md` 与 `specs/001-app-auth/`、`specs/002-work-order-query/`、`specs/003-work-order-processing/`。
- **开发原则**：遵循 `.specify/memory/constitution.md`。实现直接简单，不提前建设扩展架构，不做无关重构或生产化建设。
- **语言**：项目文档、规范、计划和说明使用中文；上游技能及模板保留原文，基于模板创建的项目文档使用中文。

## 技术栈

| 层次 | 当前选型 |
| --- | --- |
| 应用 | Next.js 16.4.3 App Router、React 19.3.0、TypeScript 严格模式 |
| 样式与组件 | Tailwind CSS 4、shadcn/ui（radix-nova / neutral / CSS 变量）、Radix UI、lucide-react |
| 数据与认证 | Supabase：`@supabase/supabase-js` 2.118.0、`@supabase/ssr` 0.12.7 |
| 工程工具 | npm、Biome 2.4.2、Husky、lint-staged |
| 需求工作流 | Spec Kit，Codex 集成，PowerShell 脚本 |
| Agent 开发参考 | AI Elements、AI SDK 7、@ai-sdk/langchain 3、LangChain 1 createAgent；模型固定经 OpenRouter，精确依赖见 package.json/lockfile |

依赖与脚本以 `package.json` 为准，精确依赖树以 `package-lock.json` 为准；使用 npm 并提交 lockfile。

## 目录与入口

| 路径 | 用途 |
| --- | --- |
| `app/` | App Router 页面、根布局、全局样式；首页跳转助手，`login/`、`select-identity/` 和 `(workspace)/[...section]/` 承载阶段 1 页面，`actions/auth.ts` 为认证动作；`(workspace)/work-orders/` 为普通列表与详情，`api/work-orders/[number]/` 为详情读取接口，`photos/[photoId]/` 为鉴权图片读取，`actions/work-orders.ts` 为工单动作入口；`(workspace)/admin/work-orders/` 和 `(workspace)/dashboard/` 为管理员中心和大盘 |
| `components/` | 公共组件；`components/ui/` 存放 shadcn/ui 组件 |
| `lib/` | 工具函数与服务接入；`lib/utils.ts` 提供样式工具，`lib/supabase/` 封装客户端、环境变量与会话刷新 |
| `lib/work-orders/` | 工单 DTO、枚举、筛选规范化、输入校验及 server-only 读取/写入/图片下载；只使用当前用户会话 |
| `lib/admin/` | 管理员筛选规范化、安全返回链接、读取DTO与server-only只读RPC调用；权限按当前身份和项目 |
| `lib/auth/` | 服务端身份读取、角色菜单与身份类型；每个受保护页面独立校验身份 |
| `supabase/migrations/` | 云端业务表及权限迁移；阶段 1 身份绑定至 Auth session_id |
| `proxy.ts` | 请求代理入口，调用 Supabase 会话刷新逻辑 |
| `public/` | 应用静态资源 |
| `scripts/` | 项目维护脚本，包括 Supabase HTTP 连接检查 |
| `.specify/` | 宪章、规范模板、工作流和 PowerShell 脚本 |
| `.agents/skills/` | 项目技能；来源及哈希见 `skills-lock.json` |
| `design/stitch/16591807519307787618/` | 5 个页面的原始 HTML、截图与元数据；页面对应关系见该目录 `README.md` |
| `docs/` | 项目验证记录及第三方许可证 |
| `doc/建筑施工质检情报员规格文档.md` | 完整 MVP 需求依据 |
| `progress.md` | 七阶段 TODO、阶段状态与验收交付记录，跨对话进度追踪入口 |
| `.codex/config.example.toml` | Stitch MCP 配置模板；实际本地配置为被 Git 忽略的 `.codex/config.toml` |

## 常用命令

新环境执行 `npm ci`，从 `.env.example` 复制 `.env.local` 并填写 Supabase 连接信息。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动开发服务 |
| `npm run build` / `npm start` | 构建 / 启动生产服务，后者需要先构建 |
| `npm run check` | Biome 检查与 TypeScript 类型检查，默认交付检查 |
| `npm run lint` / `npm run lint:fix` | 检查 / 格式化并执行安全修复 |
| `npm run format` | 格式化 |
| `npm run tscheck` | 生成 Next.js 路由类型并执行 `tsc --noEmit` |
| `npm run check:supabase` | 使用本地 URL 与 Publishable Key 检查 Auth HTTP 连接 |
| `npm run seed:demo` | 使用仅服务端管理密钥可重复准备三个模拟项目（含无工单验收项目）、六个账号、十条角色关系及十六张工单、三十二条初始处理记录及模拟照片；重复执行只补缺失数据，保留已处理结果；multi001可选无工单项目管理员身份核对零值；密码仅保存在 `.local/demo-accounts.json`，工单验收清单为 `.local/demo-work-orders.json` |

## 开发与交付约定

- 优先使用 Spec Kit 的规范、计划与任务流程，按核心路径顺序实现，范围以当前需求为准。
- 开始开发前读取 `progress.md`，按七阶段顺序推进，每阶段是独立 SDD 单元，具体任务放在该阶段的 `tasks.md`。路线背景见 `docs/分阶段开发与上线规划.md`。
- **每阶段开发完成后必须在同一次交付中更新 `progress.md`**：勾选实际完成项，更新顶部进度、日期、阶段状态，填写 SDD 路径、核心路径验收与检查结果、已知限制和下一步；未通过验收不得标记完成。中断或受阻时同样记录实际进展与阻塞，供后续对话接续。
- 上线目标为公网演示版，应用部署到 Netlify 和 Vercel，沿用当前 Supabase 项目并自行预置模拟账号和业务数据。阶段 1～4 可独立于 AI 接口完成；阶段 5～6 须接入真实模型及既有 Coze 服务后验收，不以模拟回答代替完成。
- 通过 `@/` 导入项目代码，复用现有组件；图标按需从 `lucide-react` 导入。shadcn/ui 配置见 `components.json`，全局样式与主题变量位于 `app/globals.css`。
- 验收以核心路径必要人工走查和 `npm run check` 通过为准。无需编写自动化测试；不追加测试覆盖率、无障碍专项或扩展性任务。构建和部署仅在任务需要时执行，不处理 `npm audit`。
- 提交时 Husky 先执行 lint-staged，对暂存文件格式化并安全修复，再执行全项目类型检查。不得跳过钩子，保留部分暂存边界。
- 上游技能、辅助脚本与 Stitch 原始导出保留原样。Biome 排除 `.agents/skills/` 和 `design/stitch/`；TypeScript 排除 `.agents/`、`.local/` 和 `design/`，避免将参考代码当作应用源码。
- 密钥仅放本地忽略文件或服务端环境变量，禁止提交真实密钥或给服务端密钥添加 `NEXT_PUBLIC_` 前缀。`.local/` 用于本地临时下载与缓存，不作为可提交源码依赖。

## Supabase 接入约定

- 云项目：`architecture-intelligence`，ID `lvwlxhgsixyrcpdnbgpg`，区域新加坡 `ap-southeast-1`。[控制台](https://supabase.com/dashboard/project/lvwlxhgsixyrcpdnbgpg)。需要确认云端现状时重新查询，不依赖历史健康检查结果。
- `.env.local` 配置 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`；新环境从项目 Connect 面板获取。`SUPABASE_SECRET_KEY` 仅供 `seed:demo` 离线准备账号使用，普通浏览器与 SSR 客户端不依赖它；修改环境变量后重启开发服务。
- 浏览器组件：从 `@/lib/supabase/client` 调用 `createClient()`。
- Server Components、Server Actions 和 Route Handlers：从 `@/lib/supabase/server` 调用 `await createClient()`，每个请求单独创建；服务端模块使用 `server-only` 防止浏览器导入。
- 当前身份由数据库私有表按已验证的 JWT `session_id` 固定，每次读取校验 Auth 会话和成员关系；普通账号不可直接写身份表。同会话只能首次选择，切换身份必须退出重登。退出先撤销业务身份，再执行 Auth 本地退出；后续业务 RLS 使用该会话的唯一身份，不能合并本人全部角色。工号规范为 2～32 位小写字母、数字或连字符，映射到内部认证邮箱，用户仅填写工号。
- `proxy.ts` 与 `lib/supabase/proxy.ts` 使用 `getClaims()` 刷新会话，同步请求和响应 Cookie，并应用 SDK 提供的防缓存响应头。受保护页面仍须检查身份及具体资源权限，不能用 `getSession()` 替代授权校验。
- 数据库变更前读取 Supabase 技能与当前官方文档；暴露的业务表必须启用 RLS，配置并验证最小权限策略。
- `check:supabase` 请求 `/auth/v1/settings`，只验证 HTTP 连接和密钥，不证明业务表读写权限正确。不能根据 Publishable Key 请求 `/rest/v1/` 接口清单返回 401 判定数据库离线。

- 工单写入由受控 RPC 在单事务内检查会话身份、角色、状态和 expectedVersion，更新工单与唯一处理记录；普通账号不可直接写业务表。图片使用私有桶 `work-order-photos`，先暂存直传、保存时关联，最多 9 张、每张 10 MiB、JPEG/PNG/WebP；上传 cacheControl 为 `0, no-store`，同源读取每次鉴权并使用 cacheNonce 防止旧缓存代替权限判断。禁止普通签名 URL、替换或直接删除已关联文件；无引用文件仅在离线 seed 时清理。

## 技能与文档查阅

1. 优先读取当前任务相关的本地 `SKILL.md`。Agent 开发先读 `ecosystem-primer`，Next.js 单体 LangChain Agent 参考 `simple-next-langchain-agent`，再按任务读取对应技能；安装技能不代表已实现功能或安装运行时依赖。
2. 开发 Next.js 功能前，优先读取与已安装版本匹配的 `node_modules/next/dist/docs/`。项目关闭了 `agentRules` 自动生成，手动维护本文件。
3. 查询库、框架、SDK、API、CLI 或云服务的用法时，即使熟悉也须查当前资料。技能资料不足时使用 Context7：先 `resolve-library-id`，再按单一主题 `query-docs`；只有前两种方式不可用或无结果时才查官方网络文档。不要编造 library id 或假定当前会话一定提供某个 MCP 工具。
4. 实际解析并使用的常用 Context7 library id 可记录于本节；目前未记录已解析 ID。普通业务逻辑调试、重构和代码审查无需为此额外查询。

## Stitch 设计资源

- Stitch 项目：**智能质检工单**，ID `16591807519307787618`。本地包含智能助手、工单详情编辑、工单详情展示、导航区和管理员工单中心、登录页；准确 ID 与 Stitch 当前标题见设计目录 `README.md`。
- 每页保留 `code.html`、`screen.png` 或 `screen.jpg`、`screen.json`。HTML 引用的远程脚本、字体和图片未完整离线打包，不能直接视为 Next.js 实现。
- 远程 MCP 地址为 `https://stitch.googleapis.com/mcp`，使用 `X-Goog-Api-Key` 请求头。新环境复制 `.codex/config.example.toml` 为 `.codex/config.toml` 并填写自己的密钥；实际配置不得提交。
- 获取资源时通过 `get_screen` 读取当前下载 URL，再使用 `curl -L` 等工具下载；元数据中的旧 URL 可能失效。

## 本文件维护

仅记录长期有效的项目事实、入口与约束。技术栈、目录、脚本或接入方式变化时同步更新；一次性的安装过程、网络排障、检查结果和临时会话状态放入相应任务说明或 `docs/`，不在此累积。

## 助手接入约定

- 入口 `app/(workspace)/assistant/page.tsx`，前端 `components/assistant/`，服务端 `lib/assistant/`，接口 `/api/chat` 与 `/api/chat/uploads`；固定 AI Elements → useChat → DefaultChatTransport 完整 UIMessage[] → @ai-sdk/langchain → createAgent().stream()。
- 环境变量 `OPENROUTER_BASE_URL`、`OPENROUTER_API_KEY`、`OPENROUTER_MODEL` 仅服务端使用；Supabase Secret Key 另供鉴权后的聊天图片上传/清理使用，禁止用于工单查询或聊天快照。
- `assistant_sessions` 按 Auth session 与当前 membership 隔离，最多最近 6 轮 UIMessage[]，revision 防旧快照覆盖；退出先关闭聊天再撤销身份。固定查询工具复用当前会话 RLS，模型只能准备建单草稿；创建工单由用户在卡片确认后通过 `app/actions/assistant-drafts.ts` 和受控 RPC 完成。
- 聊天图片使用获许可的独立公开桶 `assistant-chat-images`，每张最多 10 MiB，JPEG/PNG/WebP；快照仅存 URL，持有链接者可读取。现有 `work-order-photos` 保持私有。
- Coze 使用 `COZE_BASE_URL`、`COZE_API_KEY`、`COZE_BOT_ID` 的服务端配置，官方 SDK 每次发送一个精练主题并关闭历史保存。知识不可用或依据不足时明确说明。阶段 6 联调见 `specs/005-create-order-coze/verification.md`，适配器兼容记录见第五阶段验收文档。
- 草稿与私有暂存图片按当前会话授权。确认事务写入正式工单、记录、图片关联和唯一成功回执，草稿取消、过期或退出不会删除正式照片。已失效的无引用私有暂存照片随离线 seed 清理。

## Netlify 公网部署

- 当前演示托管为 Netlify，团队 `lemonada00`，项目 `architecture-intelligence`，项目 ID `825a433d-a18e-476d-a282-1106aa4de6e2`。
- 公网入口：[architecture-intelligence](https://architecture-intelligence.netlify.app)，控制台：[Netlify 项目](https://app.netlify.com/projects/architecture-intelligence)。
- 根目录 `netlify.toml` 配置 Node.js 24、构建命令 `npm run build -- --webpack`、发布目录 `.next`，使用 Next.js OpenNext 适配器；构建依赖固定 @netlify/plugin-nextjs 5.16.8。
- 新环境先运行 `npx netlify-cli login`，再运行 `npx netlify-cli link --id 825a433d-a18e-476d-a282-1106aa4de6e2`。本机关联保存在 Git 忽略的 `.netlify/state.json`。
- production 部署执行 `npx netlify-cli deploy --prod --context production --site 825a433d-a18e-476d-a282-1106aa4de6e2`，命令包含构建和适配器打包。部署后核对登录、会话身份、助手、详情及私有图片。
- 环境变量使用 `.env.example` 的九项配置，在 Netlify 项目环境变量中管理。更新后重新部署。密钥值及 CLI 登录配置保持本地忽略，禁止提交。具体发布版本和验收结果见 `specs/006-deploy-demo/verification.md`。


- Windows 本地打包曾出现 Edge Function 的 CJS 文件 URL 路径解析错误。正常部署先执行上述完整命令；如遇同类错误，先执行 `node scripts/fix-netlify-windows.mjs` 修正生成目录中的 Windows 文件 URL，再执行 `npx netlify-cli deploy --no-build --prod --dir .netlify/static --functions .netlify/functions-internal --site 825a433d-a18e-476d-a282-1106aa4de6e2`。该命令仍会自动打包 `.netlify/edge-functions/` 中的代理，发布前须核对生成 manifest。发布目录限定为 `.netlify/static`，不直接公开 `.next` 构建目录。

- production 当前公开访问，Deploy Preview 保持私有；配置位置为 Project configuration → General → Visitor access → Project visibility。

## Vercel 公网部署

- 账号 lemonada00，团队 ID `team_uXspNl70FKwsLiiCwXPA6Nnu`，项目 `architecture-intelligence`，项目 ID `prj_bUXHtMikGgRgMElLKUeu2GVY3UM2`。
- production 入口：[建筑智能 Vercel](https://architecture-intelligence-lemonada00.vercel.app)，备用别名：[architecture-intelligence-puce](https://architecture-intelligence-puce.vercel.app)。
- 构建使用 Node.js 24、`npm run build -- --webpack`，函数区域 sin1。环境变量沿用 .env.example 的九项服务配置。
- CLI 已登录该账号时，使用 `npx vercel link --project architecture-intelligence --scope lemonada00` 关联，再使用 `npx vercel --prod --scope lemonada00` 发布。当前初次部署通过 Vercel 连接上传源码触发云端构建。
- .vercelignore 排除环境文件、本地凭据、Netlify 生成物和参考目录。上传源码不得包含真实密钥，环境配置在 Vercel 项目中维护。

- Vercel 控制台：[architecture-intelligence](https://vercel.com/lemonada00/architecture-intelligence)。Netlify 品牌徽章已在 General → Powered by Netlify badge 中关闭。
