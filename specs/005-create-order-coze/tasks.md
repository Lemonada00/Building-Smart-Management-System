---
description: "阶段 6 智能建单与 Coze 单轮知识工具的实施任务"
---

# 实施任务：智能建单与 Coze 单轮知识工具

输入：[规范](spec.md)、[计划](plan.md)、[研究](research.md)、[数据模型](data-model.md)、[建单契约](contracts/assistant-create.md)、[Coze 契约](contracts/coze-tool.md)、[人工验收指南](quickstart.md)。

任务按依赖排列。路径相对于仓库根目录。[P] 表示前置满足后可与指定任务并行，且不修改同一文件。迁移文件名由项目使用的 Supabase CLI 生成，任务以 `*_变更名.sql` 指示目标。人工走查随对应实现任务记录在 `specs/005-create-order-coze/verification.md`。

## 阶段 1 · 准备

- [X] T001 在 `specs/005-create-order-coze/verification.md` 记录实施基线。对照 `package.json`、`package-lock.json`、`node_modules/next/dist/docs/`、阶段 5 验收记录和项目技能，核对锁定的聊天依赖、适配器双流模式及现有 Server Action 边界，准备隔离的模拟账号和验收记录。
- [X] T002 在 `specs/005-create-order-coze/verification.md` 记录数据前置复核。读取 Supabase 技能和现行官方资料，补查变更日志，查询云端当前迁移、会话锁、工单编号分配、施工方资格与照片存储约束，对照 `supabase/migrations/` 确定增量变更和最小授权。

## 阶段 2 · 共用基础

- [X] T003 在 `lib/assistant/types.ts` 和 `app/api/chat/route.ts` 扩展服务端工具上下文，绑定已校验的 sessionId、revision、当前用户轮 ID、合法附件引用及请求取消信号。保持完整 UIMessage[] 输送、现有 values/messages 流和 onEnd 保存。
- [X] T004 在 `lib/assistant/validation.ts` 扩展 SDK 动态和静态工具 part 白名单，加入 query_construction_knowledge、prepare_work_order_draft，延续角色、消息大小和附件归属校验。工具输出和浏览器对象仅作为引用数据，供后续草稿读取和确认动作重新鉴权。

## 阶段 3 · US1 核对卡片后创建工单（P1）

**目标**：有权限者给出四项问题信息后可编辑草稿并选择责任人，点击确认创建待处理工单。

**独立验收**：不配置 Coze，质检员和管理员各走通一次纯文字建单并从既有列表和详情核对。施工方、缺项和无有效责任人的场景无法创建。

- [X] T005 [US1] 在 `supabase/migrations/*_assistant_order_drafts.sql` 建立草稿表、行级权限和唯一约束。逐项落实 id「服务端生成UUID」、session_id「当前业务会话外键，退出后未提交草稿失效」、membership_id/project_id/creator_id「服务端从有效身份派生，不接受客户端或模型指定」、source_message_id「当前轮user UIMessage.id，由请求上下文提供，同会话同轮唯一」。同会话最多一个 editing。
- [X] T006 [US1] 在 `supabase/migrations/*_assistant_order_drafts.sql` 落实 description/location「trim后非空，复用现有字段约束」、severity/discipline「既有枚举，四项齐全才创建草稿」、details「可空」、assignee_id「可空；确认必须为当前项目有效施工方」、revision「非负整数；保存、取消、确认核对expectedRevision」、status「editing/cancelled/expired/created；submitting只是客户端进行态」、work_order_id「唯一创建结果，不能随会话级联删除」、receipt_message_id「稳定成功消息ID，重试不重复追加」、created_at/updated_at「服务端时间」。建立 prepare/read/save 及项目施工方选项的最小 RPC，重复准备不覆盖人工编辑，公开入口沿用 invoker 包装，必要私有 definer 固定空 search_path，限制执行权限并禁止普通账号直接写表。
- [X] T007 [US1] 在 `supabase/migrations/*_assistant_create_from_draft.sql` 实现无附件也可运行的确认事务。统一会话与草稿锁顺序，重新检查当前角色、项目、责任人、轮次、五项必填及双 revision。按现有编号规则创建 pending/version=1 工单和一条 created 记录，同时记录草稿终态并写入带稳定 ID 的成功消息和新会话 revision。同一有效身份重试已完成草稿时返回原结果，任一步失败回滚。
- [X] T008 [US1] 在 `lib/assistant/drafts.ts` 封装当前会话 prepare/read/save/confirm 调用及可读错误。在 `app/api/chat/drafts/[draftId]/route.ts` 返回权威草稿、施工方选项及状态，逐次鉴权并设 private,no-store。已创建链接只在当前仍可查看对应工单时返回。
- [X] T009 [US1] 在 `app/actions/assistant-drafts.ts` 实现 saveDraft 和 confirmDraft，校验 sessionId、draftId、expectedRevision、确认时的 sessionRevision 及完整可编辑表单。按契约返回字段错误、冲突、权限及成功快照，保持现有工单入口重新查询时能看到新单。
- [X] T010 [US1] 在 `lib/assistant/tools.ts` 注册仅准备草稿的固定工具，在 `lib/assistant/agent.ts` 区分工单查询、明确建单和意图不明。只追问四项中缺失或不确定的内容，责任人留在卡片选择，限制质检员和管理员建单。模型只生成草稿引用。
- [X] T011 [US1] 在 `components/assistant/create-order-card.tsx` 与 `components/assistant/chat.tsx` 用 SDK 工具 part 渲染中文卡片。支持问题字段编辑、普通施工方下拉、必填反馈和点击确认。成功时卡片只读，用 setMessages 接收事务回执并同步 revision，复用现有编号详情入口。
- [X] T012 [US1] 在 `specs/005-create-order-coze/verification.md` 按 quickstart 记录文字建单、缺项补全、施工方被拒、空责任人和责任人失效的结果。核对创建前零写入，创建后一单一条记录，列表、查询和共用详情一致。

## 阶段 4 · US2 获取有来源的专业回答（P1）

**目标**：主助手通过独立 Coze 单轮工具获取施工质检依据，按真实来源回答。

**独立验收**：不创建工单，分别完成真实文字和图文咨询，核对引用来源与两次请求隔离，并走查失败、空返回和依据不足。

- [X] T013 [US2] 核对 `.env.example` 和忽略的 `.env.local` 中 COZE_BASE_URL、COZE_API_KEY、COZE_BOT_ID 的配置。按 quickstart 核对国内端点、指定 Bot 的 API 发布及 chat 权限，仅记录是否可用。在 `package.json` 和 `package-lock.json` 精确锁定当时可安装的官方 @coze/api 版本，保持既有 SDK 版本。配置缺失时记录于 `specs/005-create-order-coze/verification.md`，建单故事可继续。
- [X] T014 [US2] 在 `lib/assistant/coze.ts` 实现 server-only 调用。输入「trim后非空、最多4000字精练主题」，用固定服务端配置调用 client.chat.stream，每次随机 user_id、不传 conversation_id、auto_save_history:false，仅传一条 user 文本。消费已完成 assistant/answer 事件，按 ID 去重保序并等待成功终态，结果为「ok+Markdown，或unavailable/empty+中文提示」。执行 60 秒总时限和请求取消，终态前断开、失败或外部动作请求映射为不可用。
- [X] T015 [US2] 在 `lib/assistant/tools.ts` 注册知识工具，在 `lib/assistant/agent.ts` 加入图文主题提炼、真实来源与适用条件、失败及依据不足的中文规则。将 Coze 文本当作资料，保留实际条文和数值，失败时说明缺少依据，SDK 结果通过现有消息流返回。
- [ ] T016 [US2] 在 `specs/005-create-order-coze/verification.md` 记录脱敏的真实文字、图文、两次单轮隔离及失败、空、依据不足结果，核对最终回答中的编号、数值和来源。Coze 无法调用时保留真实验收待办。

## 阶段 5 · US3 咨询后主动报事及选择图片（P1）

**目标**：用户先获取知识判断，再自主决定建单，并选择哪些图片作为正式私有附件。

**独立验收**：分别从知识成功和失败进入建单，先确认意愿再点击卡片。核对仅所选图片进入工单，清理聊天后仍可按权限查看。

- [X] T017 [P] [US3] 在 `supabase/migrations/*_assistant_draft_photos.sql` 加入草稿选图字段和私有暂存元数据。selected_upload_ids 为「本会话聊天附件ID，不存任意远程URL」，selected_photo_ids 为「私有草稿附件ID，与聊天选图合计最多9张」。照片字段为「id、draft_id、object_path（唯一）、mime_type、size_bytes、original_name、source_upload_id（可空）、state(staged/attached/removed)、created_at」，执行「JPEG/PNG/WebP，每张1～10485760字节」。约束 draft_id + source_upload_id 唯一，提供鉴权 register/discard，复用私有桶和最小权限边界。
- [X] T018 [P] [US3] 在 `lib/assistant/agent.ts` 实现混合意图顺序。先完成咨询再明确询问是否建单，即便知识不可用也允许用户主动按事实报事。复用确认过的事实，纯图或文字冲突时追问，用户拒绝或继续咨询时保持咨询路径。
- [X] T019 [US3] 在 `app/api/chat/drafts/[draftId]/photos/route.ts` 实现同源单图上传和 photoId 鉴权预览，复用文件签名、大小、MIME 校验及 private,no-store/cacheNonce。将已选聊天图按会话归属映射到固定源桶路径，在 `lib/assistant/drafts.ts` 复制为私有暂存，重试复用对象，管理密钥只操作通过鉴权的固定桶文件。
- [X] T020 [US3] 在 `supabase/migrations/*_assistant_attach_draft_photos.sql` 扩展确认事务和草稿保存。按最终选择校验数量、归属及 storage.objects 的真实文件、MIME 和大小，再原子关联 work_order_photos 与更新暂存状态。任一选图暂存失败则保留输入和暂存供重试，工单成功后通过既有照片接口鉴权读取。
- [X] T021 [US3] 在 `components/assistant/create-order-card.tsx` 实现聊天图保留、移除、私有相册上传和预览。将最终选图 ID 通过 `app/actions/assistant-drafts.ts` 保存并提交，报告单图失败及超限，保留其余已选内容。
- [ ] T022 [US3] 在 `specs/005-create-order-coze/verification.md` 记录知识成功后建单、知识失败后主动报事、拒绝建单和图文建单。核对确认前零写入、仅选图上传为正式附件、聊天退出后仍可访问、无权限或转派失权后无法读取原链接。

## 阶段 6 · US4 取消、重试与恢复（P2）

**目标**：草稿可取消和恢复，失败不丢输入，重复提交不会重复建单。

**独立验收**：从已展示草稿出发，不依赖 Coze 回答，分别检查取消、失败、双击、响应丢失、刷新、轮次淘汰和退出。

- [X] T023 [P] [US4] 在 `supabase/migrations/*_assistant_draft_lifecycle.sql` 实现 cancel/expire 以及保存快照、退出关闭与确认之间的统一锁及 revision。只允许 editing 转终态，确认重验有效轮次。限定离线清理候选为已失效且无正式附件引用的暂存对象，避免与创建并发时删除正式附件。
- [X] T024 [P] [US4] 在 `components/assistant/create-order-card.tsx` 实现保存中、未保存、提交中、已取消、已创建和失效的本地反馈，blur/选择变化保存，保留提交失败时的文字、责任人和图片。处理保存与确认竞态及过期响应，确认仍提交完整最终字段。
- [X] T025 [US4] 在 `lib/assistant/history.ts`、`lib/assistant/session.ts`、`lib/assistant/uploads.ts` 与 `app/actions/auth.ts` 接入权威轮次淘汰、失权、退出关闭和清理引用。整轮剔除时撤销编辑草稿，保留最近六轮，聊天上传清理排除有效草稿引用，退出后迟到流无法复活状态。
- [X] T026 [US4] 在 `app/actions/assistant-drafts.ts` 和 `components/assistant/chat.tsx` 集成取消、刷新恢复、冲突重载及重复确认返回原结果的交互。卡片以权威读取为准，取消不创建，提交期间互斥聊天发送，过期结果不能覆盖最新卡片和消息。
- [X] T027 [US4] 在 `specs/005-create-order-coze/verification.md` 记录取消、失败后编辑重试、双击、响应丢失及刷新重试。同一草稿核对一单一记录一回执，并验证跨项目责任人、其他身份、淘汰轮和退出后的旧草稿均无成功写入。

## 阶段 7 · 集成验收与交付

- [ ] T028 按 `specs/005-create-order-coze/quickstart.md` 核验完整路径。用 390px 和 1440px 检查卡片操作及共用详情，完成创建→解决→重开→再次解决，核对大盘与列表并回归既有查询和流式对话，将各项结果记入 `specs/005-create-order-coze/verification.md`。
- [X] T029 执行 `package.json` 的 npm run check 和 git diff --check，在 `specs/005-create-order-coze/verification.md` 记录结果，修复本阶段导致的检查错误。
- [X] T030 更新 `progress.md`、`AGENTS.md` 与 `specs/005-create-order-coze/verification.md`，按实际情况登记数据迁移、Coze 联调、边界及验收结论。真实服务或核心验收受阻时保存证据与下一步，阶段完成数按实际验收更新。

## 依赖和执行顺序

- T001、T002 完成共用准备。T003 → T004 后可开始 US1 和 US2。US1 不依赖 Coze 配置，US2 不依赖草稿表。
- US1 的数据层 T005 → T006 → T007 支撑 T008 → T009，随后 T010、T011、T012。US2 按 T013 → T014 → T015 → T016。
- US3 的图片路径依赖 US1 的草稿与确认能力，混合意图联调另依赖 US2 的知识工具。T017 与 T018 后执行 T019 → T020 → T021 → T022。
- US4 以 US1 的卡片和确认事务为基线，可用无图草稿独立走查。T025 的附件清理和 T027 的图片重试需先完成 US3 的图片路径。T023 与 T024 完成后集成 T025、T026、T027。
- SQL 文件生成、迁移应用和云端验证按依赖串行。每个涉及迁移的故事先在目标环境按顺序应用对应增量，核验现有权限与实际会话读写后再执行人工走查。涉及 `lib/assistant/agent.ts`、`lib/assistant/tools.ts` 或同一卡片文件的任务依次合入。全部故事通过后执行 T028 → T029 → T030。

## 并行示例

| 故事 | 可并行工作 |
| --- | --- |
| US1 | 共用基础完成后，T005 的草稿数据和 US2 的 T013 配置检查互不依赖。 |
| US2 | T014 的独立 Coze 适配可与 US1 的 T008 草稿读取开发并行，共用工具注册 T010 与 T015 串行。 |
| US3 | T017 的图片元数据与 T018 的混合意图指令并行，迁移应用仍保持顺序。 |
| US4 | T023 的生命周期迁移与 T024 的卡片反馈并行，完成后统一接入对话和权限。 |

## 实施策略

先交付 US1 纯文字建单，作为最小可演示增量，从用户确认走通现有工单详情和后续处理。随后补齐 US2 的真实知识、US3 的混合意图与私有图片、US4 的取消重试和恢复，再执行集成验收。完整阶段 6 以四个故事及真实 Coze 验收通过为准。
