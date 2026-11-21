# 实施任务：阶段 5 智能助手（OpenRouter，Coze 暂缓）

日期：2026-10-29。
输入：[spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、[data-model.md](data-model.md)、[接口契约](contracts/assistant.md)、[验收指南](quickstart.md)。
状态：用户于 2026-10-30 确认第五阶段按当前约定范围验收通过，Coze 继续延期。以下复选框保留逐项执行证据状态；总体验收确认不冒充未记录的技术复测。此前记录如下。

第五阶段按约定范围已验收，任务 33/33。采用 AI Elements → useChat → DefaultChatTransport → @ai-sdk/langchain → createAgent().stream()，OpenRouter 为本阶段模型入口。Coze 知识问答转入[第六阶段任务](../005-create-order-coze/tasks.md)。阶段 4 工作台、阶段 6 建单和阶段 7 部署各有独立交付范围。

## 格式与路径

[P] 表示同阶段前置就绪后，可修改独立文件，不允许并发应用数据库迁移或编辑共享文件。
supabase/migrations/*_名称.sql 中星号由项目规定的 Supabase CLI 生成真实时间戳，不能猜测名称。文档引用为项目相对路径。开发前按 AGENTS.md 查当前官方文档及本地技能；新环境变量先写空项、指导用户填写并确认，不输出密钥。

## 阶段一：准备（T001～T003）

- [x] T001 在 specs/004-assistant-query-knowledge/verification.md 记录实施前置复核：读取最新计划、研究、契约和指定技能，确认 Node >=22、.env.local 六项非空且被忽略；不输出密钥，不重置工作树及原目录修改。
- [x] T002 在 package.json、package-lock.json 精确安装 ai@7.0.156、@ai-sdk/react@4.0.160、@ai-sdk/langchain@3.0.156、langchain@1.6.0、@langchain/core@1.3.1、@langchain/openai@1.8.0、@langchain/langgraph@1.5.3、zod@4.6.7，正常核验 peer，不用 force/legacy-peer-deps，不升级现有 Next.js/React 或引入替代 Agent SDK。
- [x] T003 通过官方 AI Elements CLI 向 components/ai-elements/ 添加 Conversation、Message、PromptInput、Tool 及实际需要的附件组件，在 app/globals.css 配置 MessageResponse/Streamdown 必要样式，同步 package-lock.json；保留现有 shadcn 风格，不自写简化组件。

## 阶段二：共用基础（T004～T010，阻塞所有故事）

目标：打通服务端身份、消息快照、真实模型 SDK 流及最小文本界面。

- [x] T004 在 supabase/migrations/*_assistant_sessions.sql 创建会话与受限 ensure/read/save/clear RPC：id 为“UUID 主键，服务端生成的业务会话 ID”，auth_session_id 为“已验证 JWT 对应的 Auth session_id；非客户端输入”，user_id 为“auth.uid()，非客户端输入”，membership_id 为“当前选定成员身份；非客户端输入”，messages 为“JSONB UIMessage[]，默认 []；最多最近 6 轮完整问答”，revision 为“非负整数，每次成功保存递增，阻止旧快照覆盖”，created_at/updated_at 为“服务端时间”；设置“唯一键 (auth_session_id, membership_id)”及身份/Auth session 关联和级联清理、RLS、归属不可改及最小 RPC 执行授权，不仅以 auth.uid() 放行旧登录；按技能核对云端后顺序应用并记录结果。
- [x] T005 [P] 在 lib/assistant/env.ts 封装 server-only OpenRouter 配置，显式取 OPENROUTER_API_KEY、OPENROUTER_MODEL、OPENROUTER_BASE_URL，缺项中文提示且不输出凭据或原始供应商错误；不回退 OpenAI 官方端点，更新 .env.example 说明。
- [x] T006 [P] 在 lib/assistant/types.ts、lib/assistant/validation.ts 基于 AI SDK UIMessage/FileUIPart、Zod 定义消息、runtime context 和查询结果类型，落实“用户文本最多 4000 字”“每条用户消息最多 9 张”；允许纯图、拒绝全空/system/非法工具类型和 parts/未知图片来源，不定义另一套 role/content 或 SSE 协议。
- [x] T007 在 lib/assistant/session.ts 使用当前会话 Supabase 客户端调用 T004 RPC，派生有效登录周期及 membership，返回唯一 sessionId/revision/UIMessage[]；expectedRevision 冲突保留内容并返回 409，不用 Secret Key 操作快照，不回捞历史拼接或比较消息前缀。
- [x] T008 在 lib/assistant/agent.ts 用 LangChain createAgent 和 @langchain/openai ChatOpenAI 显式绑定 OpenRouter apiKey/model/configuration.baseURL，建立固定中文系统指令和服务端 runtime context；不接受客户端模型/工具/授权范围，不自建路由模型或工具循环，为本次只读工具提供注册位置。
- [x] T009 在 app/api/chat/route.ts 实现 Node runtime、同源校验、逐请求身份/会话/输入/revision 验证，串联 await toBaseMessages → agent.stream(values/messages（当前适配器兼容配置，详见 verification.md）) → @ai-sdk/langchain toUIMessageStream → createUIMessageStream(originalMessages)/writer.merge → createUIMessageStreamResponse；start/finish 只发一次，onEnd 仅 completed 时保存，401/403/400/409 与流错误按契约处理，不手写 SSE、token 或工具状态。
- [x] T010 在 app/(workspace)/assistant/page.tsx、components/assistant/chat.tsx 用现有 AppShell/requireIdentity 读取快照，以 useChat({messages}) 和 DefaultChatTransport 指向 /api/chat 提交完整 UIMessage[]，用 AI Elements Conversation/Message/PromptInput 渲染真实文本对话、中文欢迎及基础进行态；兼容当前 catch-all 占位入口，不重构无关工作区布局。

基础检查点：已登录用户可看到真实模型文本流，业务会话归属和 SDK 消息快照正常；不代表故事或阶段完成。

## 阶段三：US1 当前身份工单查询（P1，最小可演示切片）

目标：真实查询和统一详情始终遵守当前身份。
独立验收：不依赖图片和 Coze，以三角色分别核对编号、关键词、位置、状态、个人范围、结果与越权。

- [x] T011 [US1] 在 supabase/migrations/*_assistant_work_order_search.sql 增加 security invoker 最小只读搜索 RPC，复用现有 RLS/get_work_order 完整 DTO；条件为“number、keyword、location、status、severity、scope（visible/created_by_me/assigned_to_me）”，编号优先，其他参数化组合，返回“total、hasMore、items，items 最多 20，紧急优先、时间倒序、编号稳定排序”；“已结束”对应 completed/rejected，默认全部状态，不用 Secret Key/任意 SQL/过滤表达式，顺序应用迁移。
- [x] T012 [US1] 在 lib/assistant/tools.ts 用 tool(fn,{name,description,schema}) 和 Zod 包装 search_work_orders 并注册到 lib/assistant/agent.ts；授权只取 runtime context 和数据库 JWT，scope 只缩小权限；编号复用 get_work_order 的 not_found/forbidden，返回真实完整详情、total/hasMore，不编造数据。
- [x] T013 [US1] 在 lib/assistant/agent.ts 落实编号优先、质检员“我的”=本人发起全部状态、施工方“我的”=当前负责全部状态、管理员“我的”必须追问范围；无匹配/不存在/无权限分别中文说明，不凭消息猜工单、人员或完整总量。
- [x] T014 [US1] 在 components/assistant/work-order-result.tsx、components/assistant/chat.tsx 使用 AI Elements Tool parts 呈现中文查询状态，单结果摘要含编号/描述/状态/责任人/下一步，多结果文本编号链接和截断提示；复用 components/work-orders/detail-controller.tsx 宽屏抽屉/窄屏页面及直链，点击重新鉴权，不显示内部工具名、参数、路由、思维链或原始 JSON。
- [x] T015 [US1] 在 lib/assistant/history.ts 按轮记录真实工具结果的引用工单编号，hydrate/请求前用现有 getWorkOrder 复核，失权移除整轮，不破坏 tool 配对；接入 lib/assistant/session.ts、app/api/chat/route.ts，旧历史不能充当新查询依据，不把私有工单图片转为公开聊天 URL。
- [X] T016 [US1] 在 specs/004-assistant-query-knowledge/verification.md 记录三角色编号/关键词/位置/状态/个人范围、管理员追问、单多空结果、>20 截断、跨项目与转派后旧消息/旧链接人工核验，确认 createAgent 实际调用只读工具且不写工单，并修复阻断问题。

检查点：US1 可独立演示；US2、US3 和完整阶段仍不能标完成。

## 阶段四：US2 图文理解与知识未开放边界（P1，Coze 延期）

目标：真实图文理解、不确定追问，以及暂缓专业知识服务的清楚说明。
独立验收：纯图/图文可见事实理解和意图追问正常；专业问题不编造依据或结论；不需要 Coze。

- [x] T017 [US2] 在 supabase/migrations/*_assistant_chat_uploads.sql 创建独立 public 桶 assistant-chat-images 和 assistant_uploads：id 为“UUID，随机生成”，session_id 为“关联当前业务会话”，object_path 为“独立聊天桶内唯一随机键，不包含姓名或工号”，mime_type 为“image/jpeg、image/png、image/webp”，size_bytes 为“>0 且 <=10 MiB”，original_name 为“仅显示用途，不直接成为对象路径”，created_at 为“服务端时间”；设置会话归属 RLS、受限元数据 RPC 及桶 MIME/大小限制，顺序应用迁移，不修改私有 work-order-photos。
- [x] T018 [US2] 在 lib/supabase/admin.ts、lib/assistant/uploads.ts 建立 server-only Secret Key 客户端，仅在鉴权并核对会话后上传/清理固定聊天桶；校验文件签名/MIME/大小、随机键和 upsert=false，写入会话元数据，不用于工单查询或消息快照。
- [x] T019 [US2] 在 app/api/chat/uploads/route.ts 实现同源鉴权的 FormData(sessionId,image) 上传，返回 files:FileUIPart[]（type=file、mediaType、filename、url），按契约返回 401/403/400/413/415/503 中文说明；在 lib/assistant/validation.ts 校验消息 URL 属于本会话上传记录，拒绝任意远程 URL、其他会话图片及 base64 历史。
- [x] T020 [US2] 在 components/assistant/chat.tsx 用官方 PromptInput 附件/预览/移除组件只提供相册选择；限制“每条用户消息最多 9 张”、每张“>0 且 <=10 MiB”及“image/jpeg、image/png、image/webp”，上传后 chat.sendMessage({text,files})；失败保留选择和成功附件、重试不重复上传，移除项不发送，无语音或相机入口。
- [x] T021 [US2] 在 lib/assistant/agent.ts 补齐纯图/图文和意图边界：只描述可见事实，不确定追问；规范/合规咨询说明 Coze 暂缓未开放，不凭训练知识判断；无关问题说明范围，建单/混合意图说明尚未开放，施工方说明无创建权限，不配置替代知识检索、MCP 或写入/HITL 工具。
- [X] T022 [US2] 在 specs/004-assistant-query-knowledge/verification.md 记录真实 OpenRouter 文字/纯图/图文、图片线索查询、不确定追问、专业服务未开放、无关/建单/混合意图和上传失败重试；核对 FileUIPart/快照只存 URL、公开聊天 URL 可读取且私有工单图片仍鉴权，修复问题，不冒充 SC-002 真实 Coze 验收。

延期：完整专业回答及 FR-006/007、SC-002 保留待后续真实 Coze 接入；本清单不生成 Coze 调用或模拟替代任务。

## 阶段五：US3 连续上下文与失败恢复（P2）

目标：同登录恢复最近 6 轮，退出清空，失败重试不重复/覆盖。
独立验收：基础文本流即可核对 7 轮、切页/刷新、错误重试和登录隔离；图片/工具引用清理在相应故事完成后集成。

- [x] T023 [US3] 在 lib/assistant/history.ts 实现“发送时最多最近 5 轮完整历史加当前用户消息；完成后保存最近 6 轮”，工具步骤归本轮 user→assistant；接入 app/api/chat/route.ts、components/assistant/chat.tsx，展示/提交/快照规则一致，整轮淘汰、不截断 tool 配对。
- [x] T024 [US3] 在 lib/assistant/session.ts、app/(workspace)/assistant/page.tsx 完善首次 ensure/read、同登录切页/刷新 hydrate 和 onEnd 完整 UIMessage[] 恢复，保留 SDK parts，不用仅内存、localStorage、DB 历史拼接/前缀比较或历史列表替代。
- [x] T025 [US3] 在 lib/assistant/uploads.ts、lib/assistant/session.ts 实现淘汰轮次/退出后清理本会话无引用对象与元数据，保留仍引用图片，失败孤儿留离线维护记录；不增加调度器、不删除私有工单图片，不声称已下载公开字节可撤回。
- [x] T026 [US3] 在 app/actions/auth.ts、lib/assistant/session.ts 按“清空快照和本会话图片引用 → 撤销身份 → Auth local signOut → 登录页”接入退出并保留失败提示；onEnd 再次校验有效会话，防止迟到响应复活快照，新登录/其他身份不可恢复旧记录。
- [x] T027 [US3] 在 components/assistant/chat.tsx 完善 ready→submitted→streaming→ready/error，处理中限制发送，失败保留已有消息/文字/附件并以 regenerate 重试同一轮，不自拼消息或重复 user；用 Conversation 自动滚动，窄屏输入置底，401/403 后不展示旧身份新响应。
- [x] T028 [US3] 在 app/api/chat/route.ts、lib/assistant/session.ts、components/assistant/chat.tsx 贯通 revision 回传和下轮提交，拒绝并发旧版本覆盖并保留输入；模型 failed/aborted 不宣称完成，快照保存失败显示未保存错误，不假装刷新可恢复。
- [X] T029 [US3] 在 specs/004-assistant-query-knowledge/verification.md 记录真实连续 7 轮仅保留 6 轮、含工具步骤整轮淘汰、同登录刷新/切页、重复发送限制、模型/上传/保存失败及 SDK 重试不重复轮次，修复阻断问题。
- [X] T030 [US3] 在 specs/004-assistant-query-knowledge/verification.md 记录退出/重登/换项目角色、旧 sessionId、错误 revision、迟到 onEnd 和无引用图片清理核验，确认本人旧登录亦不可读、业务工单/私有图片不受清理影响，修复问题。

## 阶段六：交付（T031～T033）

- [X] T031 按 specs/004-assistant-query-knowledge/quickstart.md 在电脑/手机走通当前迭代真实消息/工具/图片/详情/快照闭环与权限，在 specs/004-assistant-query-knowledge/verification.md 汇总证据、修复阻断；不用 HTTP 连通或模拟回答代替功能验收。
- [x] T032 执行 npm run check、git diff --check，将结果写入 specs/004-assistant-query-knowledge/verification.md 并修复静态检查问题；不跳提交钩子，不追加自动化测试或默认构建/部署。
- [x] T033 在 progress.md、AGENTS.md、specs/004-assistant-query-knowledge/quickstart.md、verification.md 同步实际入口、依赖、配置用途、当前验收及限制，按事实更新 tasks.md；Coze 未接入保持完整阶段 5 未完成，不把当前迭代标为完整 MVP。

## 依赖与执行顺序

准备 T001 → T002 → T003 → 共用基础 T004/T005/T006 → T007 → T008 → T009 → T010。
随后 US1：T011 → T012 → T013 → T014 → T015 → T016。
随后 US2：T017 → T018 → T019 → T020 → T021 → T022。
随后 US3：T023 → T024 → T025 → T026 → T027 → T028 → T029 → T030。
全部本次范围完成后：T031 → T032 → T033。

共用基础阻塞全部故事；T007 等 T004 RPC，T008 等 T005/T006/T007。US1、US2 后端可交错推进，共享 agent.ts/chat.tsx/validation.ts 必须串行合并，迁移顺序应用。
US3 纯文本上下文/重试在基础后即可独立推进；历史权限整合依赖 T015，图片清理依赖 T017～T020。T023 与 T015 顺序修改 history.ts；T025 依赖图片链路，T026 等 T025。
管理员工作台缺失不阻塞已有 RLS 复用；Coze 暂缓不是本任务开工阻塞。

## 并行机会与每故事示例

- 基础：准备完成后，T004 数据库迁移、T005 配置、T006 类型校验修改独立文件；数据库操作不并发。
- US1：T011 SQL 起草与 T014 独立 work-order-result.tsx 展示可按现有 DTO 同时准备；T014 完整集成等 T012，不提前标完成，所以不虚标 [P]。
- US2：T017 迁移与 T021 系统指令可独立准备；T021 不能与 T012/T013 同时改 agent.ts。T020 真发送联调等 T019。
- US3：基础完成后可分别准备 app/actions/auth.ts 退出整合和前端布局；清理 helper/SDK 重试/版本回传仍按 T025～T028 合并验证，前置未完成不宣称任务完成。

这些是实施调度示例，本次不派发子代理或创建并行测试。

## 增量策略与需求映射

先基础与 US1，形成真实只读权限查询 MVP；再 US2 图文及知识未开放边界；最后 US3 恢复/清理/失败语义与整体走查。
完整 Coze 要求继续保留在规范及 progress.md，后续明确接入再更新设计任务。

| 类别 | 数量 | 映射 |
| --- | --- | --- |
| 准备/基础 | 10 | 技能链路、SDK 协议、身份与会话模型 |
| US1 | 6 | FR-001/008/009/010/012；SC-001/005 |
| US2 本次范围 | 6 | FR-002/003/004/011/012；SC-002 延期 |
| US3 | 8 | FR-003/005/010/012；SC-003/004 |
| 交付 | 3 | 核心路径、默认检查与进度同步 |
| 合计 | 33 | 约定范围全部完成 |

## 生成审查

任务按用户故事组织，均有复选框、唯一连续 ID 与路径；故事阶段均有 US 标记。模型字段约束逐项引用，图片/身份/失败/清理和 Coze 延期均有落点。
前后置检查确认 .specify/extensions.yml 不存在，无可执行 hooks。此处审查通过不代表应用已实现或验收完成。

补验结果：T016、T022、T029、T030、T031 均已通过，证据见[第六阶段接入后的回归](verification.md#第六阶段接入后的回归)。
