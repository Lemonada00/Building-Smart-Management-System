# 任务清单：公网演示与全流程验收

**日期** 2026-11-20  
**输入** spec.md、plan.md、research.md、data-model.md、contracts/deployment.md、quickstart.md  
**组织** 按 US1（P1）和 US2（P2）分组。采用必要人工走查与项目默认检查。

原八项简表由本清单取代。2026-11-17 的数据准备与构建证据保留在 verification.md；本清单中的复核任务以本次候选版本重新执行为完成条件。

## 阶段 1：准备

- [x] T001 核对 package.json、package-lock.json 与 Netlify 支持的 Node.js 版本，在 package.json 或项目设置固定匹配版本，将实际选择记入 specs/006-deploy-demo/verification.md。
- [x] T002 [P] 重新查询 Supabase 项目 lvwlxhgsixyrcpdnbgpg 及模拟数据，必要时运行 scripts/seed-demo.mjs，核对三项目、六账号和无工单项目，在 specs/006-deploy-demo/verification.md 记录结果，凭据保留于 .local/demo-accounts.json。
- [x] T003 [P] 核对 Netlify 账号、团队授权和目标站点，记录实际团队和站点到 specs/006-deploy-demo/plan.md，确认发布环境。

## 阶段 2：共用基础

**目标** 两个故事共用的图片、构建及公网候选可用。

- [ ] T004 核查 app/api/chat/uploads/route.ts、app/api/chat/drafts/[draftId]/photos/route.ts 和 lib/work-orders/photos.ts 的完整调用链，结合当前官方资料验证 Netlify 上传与响应限制，将受限直传及私有流式读取方案细化到 specs/006-deploy-demo/contracts/deployment.md。
- [ ] T005 改造 lib/assistant/uploads.ts、app/api/chat/uploads/route.ts 与 components/assistant/chat.tsx 的聊天照片上传，绑定当前会话、唯一对象路径、类型与大小，上传完成后验证对象再写快照，保留失败重试与退出并发清理；执行“最大 10 MiB，JPEG/PNG/WebP”约束。
- [ ] T006 改造 app/api/chat/drafts/[draftId]/photos/route.ts、lib/assistant/drafts.ts 与 components/assistant/create-order-card.tsx 的私有草稿上传，沿用当前会话授权和确认关联；执行“最大 10 MiB，JPEG/PNG/WebP，正式工单最多九张”，保证取消、过期及退出不删除正式照片。仅现有策略不足时在 supabase/migrations/ 添加最小迁移。
- [ ] T007 适配 lib/work-orders/photos.ts 与 app/api/work-orders/[number]/photos/[photoId]/route.ts 的私有大图传输，保持同源逐次鉴权、禁用缓存及 cacheNonce，验证转派失权；禁止用普通签名下载链接替代鉴权入口。
- [ ] T008 在 specs/006-deploy-demo/verification.md 记录图片本地核验，覆盖接近 10 MiB 的三种类型、超限、跨会话、取消、确认及退出清理；核对“确认前无正式编号，重复确认返回原工单”和正式照片关联。
- [x] T009 核对 .vercelignore 与 .env.example 的上传范围和环境变量名，执行 package.json 中 npm run check 和 npm run build，修复阻断问题；默认构建失败时根据云端证据选择 Webpack，记录命令至 specs/006-deploy-demo/verification.md。
- [x] T010 在目标 Netlify 项目配置 .env.example 对应环境变量并发布候选，核对 app/api/chat/route.ts 的 120 秒执行需求及部署设置，写入提交 SHA、工作树说明、部署 ID、环境、构建命令与 URL 到 specs/006-deploy-demo/verification.md，记录“不包含密钥”。

## 阶段 3：US1 三种身份完成工单闭环（P1）

**目标** 公网完成真实知识咨询与同一张工单的三角色流转。  
**独立验收** 质检员取得可核对来源的答复并确认建单，施工方解决、质检员重开、管理员查看，三个动作记录和统计一致。

- [ ] T011 [US1] 核对公网 /login、/select-identity、/assistant 及 Supabase Auth URL 配置，检查 app/actions/auth.ts 和 lib/auth/ 的会话行为，验证“同一会话仅一个有效身份，每次受保护请求校验”，结果写入 specs/006-deploy-demo/verification.md。
- [ ] T012 [P] [US1] 使用 lib/assistant/coze.ts 的真实单轮调用取得文字及图文来源答复，核对条文和历史隔离，并验证失败提示及用户主动按事实报事；必要时修复该适配器，将证据补入 specs/005-create-order-coze/verification.md。
- [x] T013 [P] [US1] 按 specs/006-deploy-demo/quickstart.md 整理三类身份的演示顺序、同项目选择和模拟数据说明，账号说明与密码分开管理。
- [ ] T014 [US1] 在公网以质检员通过真实咨询后主动报事，使用 components/assistant/create-order-card.tsx 确认含照片草稿，重复提交并核对唯一工单、唯一创建记录及正式附件，在 specs/006-deploy-demo/verification.md 记录编号。
- [ ] T015 [US1] 使用同一编号依次完成施工方解决、质检员重开和管理员查看，核对 app/actions/work-orders.ts 的“受控 RPC 原子写入，expectedVersion 防覆盖”行为、处理记录及管理员大盘一致性，将结果写入 specs/006-deploy-demo/verification.md。
- [ ] T016 [US1] 验证无工单项目大盘零值，以及知识失败后明确提示和主动建单路径，按 spec.md 的 SC-001、SC-002、SC-004 汇总 US1 结果到 specs/006-deploy-demo/verification.md。

## 阶段 4：US2 手机查看与处理授权工单（P2）

**目标** 两种视口可操作，详情、图片及退出按当前权限生效。  
**独立验收** 可使用已有模拟工单，在 390px/1440px 完成授权查询和处理，转派后原施工方无法读取详情或私有照片。

- [ ] T017 [P] [US2] 在 390px 与 1440px 对照 design/stitch/16591807519307787618/README.md 走查登录、助手、草稿、详情展示与编辑、管理员框架，修复 components/assistant/ 及对应页面的阻断交互，记录至 specs/006-deploy-demo/verification.md。
- [ ] T018 [P] [US2] 公网验证 app/api/work-orders/[number]/route.ts 和照片路由的匿名、未选身份、跨项目、未分配及转派失权请求，核对退出重登和详情直链，将证据写入 docs/stage7-permission-verification.md。
- [ ] T019 [US2] 在公网两种视口验证接近 10 MiB 的 JPEG/PNG/WebP 聊天上传、草稿选图和私有正式图读取，检查超限中文提示、重试、取消与退出后图片生命周期，将证据写入 specs/006-deploy-demo/verification.md。
- [ ] T020 [US2] 修复 T017～T019 暴露的核心路径问题，按 specs/006-deploy-demo/quickstart.md 复验受影响场景及 SC-003，将最终结果写入 specs/006-deploy-demo/verification.md。

## 阶段 5：交付核验

- [ ] T021 对最终修改执行 package.json 中 npm run check 和生产构建，若代码变化则更新部署并复验受影响流程，在 specs/006-deploy-demo/verification.md 记录实际发布版本。
- [ ] T022 对照 specs/006-deploy-demo/spec.md 的 FR-001～FR-006 和 SC-001～SC-004 核对证据，更新 specs/006-deploy-demo/quickstart.md 的实际入口和演示说明，并在 verification.md 写入限制及未完成项。
- [ ] T023 按真实完成结果勾选 specs/006-deploy-demo/tasks.md，更新 progress.md 顶部日期、阶段状态、SDD 路径、线上地址和下一步；仅全部必要验收通过后标记阶段完成。

## 依赖与执行顺序

准备 T001～T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010。

基础阶段完成后，US1 与 US2 均可开始。US2 使用已有模拟工单独立验收，不依赖 US1 新工单。US1 内按 T011 →（T012、T013）→ T014 → T015 → T016；US2 内按（T017、T018）→ T019 → T020。T021～T023 在两个故事完成后执行。

T012 的真实知识成功是 T014 所要求的成功咨询路径前置条件；若受外部服务阻塞，可继续 US2 和其他已具备条件的工作，记录阻塞。

## 并行执行示例

- US1 的 T012 修改 Coze 适配器及阶段六验收记录，T013 编辑演示指南，可并行。
- US2 的 T017 走查和修复界面，T018 核验权限并写独立证据文件，可并行；共用账号需要独立会话。
- T002 与 T003 可分别核对 Supabase 和 Netlify。写同一验收文件时顺序合并记录，避免覆盖。
- 公网部署或模拟数据变更按依赖顺序执行。

## 实施策略

先完成共用图片适配、构建和候选发布，再优先完成 US1 作为可演示 MVP。随后完成 US2 的两种视口及权限验收。每项完成需有对应版本的实际证据；历史通过记录用于定位，不自动替代本轮公网验收。



