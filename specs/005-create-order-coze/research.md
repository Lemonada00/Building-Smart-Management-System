# 技术研究与决策

日期：2026-10-30。已按ecosystem-primer选择现有固定工具LangChain Agent，读取langchain-fundamentals、用户指定simple-next-langchain-agent、Supabase技能及本地Next.js文档。speckit-plan要求的研究代理已完成Coze官方资料核验。当前无Context7工具，按规则采用官方网络资料与已安装类型，不虚构library id。

## 1. Coze单轮无历史

**决策**：官方@coze/api的client.chat.stream，显式国内baseURL；每次随机user_id，不传conversation_id，auto_save_history:false，仅一条精练主题user消息。服务端收完整answer及成功终态后返回主Agent一次工具结果。

**理由**：用户指定独立无记忆工具；国内官方文档明确不传conversation_id会新建会话，auto_save_history:false不保存本轮用于后续上下文。非流式stream:false需要保存历史才能查询最终结果，不能满足该约束。

**替代方案**：不采用复用conversation_id、多轮扣子子会话、createAndPoll或把扣子原始流透传前端；不重建知识库。无历史调用不等于平台不留日志，也不能保证远端Agent内部无存储行为。

**依据**：[国内发起对话](https://docs.coze.cn/developer_guides_chat_v3)、[官方Node示例](https://github.com/coze-dev/coze-js/blob/main/examples/coze-js-node/src/chat.ts)、[SDK类型](https://github.com/coze-dev/coze-js/blob/main/packages/coze-js/src/resources/chat/chat.ts)、[请求选项](https://github.com/coze-dev/coze-js/blob/main/examples/coze-js-node/src/request-options.ts)。返回仅采用assistant/answer完整消息并等待成功；不混拼delta。失败、空答案、中断及要求外部动作不能作为有效依据。

**实施前置**：用户playground无法由文档工具打开；已知Bot ID，但发布状态、令牌权限及实际Markdown来源形式仍须真实联调。不因计划完成而声称服务已连通。采用COZE_BASE_URL、COZE_API_KEY、COZE_BOT_ID三项服务端变量，空项准备后由用户填写；本轮不安装SDK或计费调用。

## 2. 保留主Agent链路

**决策**：固定tool(fn,{name,description,schema})注册查询、知识、准备草稿，createAgent集中编排，主模型继续OpenRouter。保留当前values/messages streamMode兼容组合，不盲目改回三模式。

**理由**：已安装适配器与现有验证记录明确同时订阅tools会重复工具消息；本地@ai-sdk/langchain/dist/index.d.ts仍提供toBaseMessages与toUIMessageStream。UIMessage[]是唯一聊天边界，业务表单另存权威状态。

**替代方案**：不采用Deep Agents、手写工具循环、Agent Server、MCP桥接或自写SSE。不安装与本期无关依赖，不升级已有SDK。

**依据**：[LangChain工具](https://docs.langchain.com/oss/javascript/langchain/tools)、[官方适配器](https://ai-sdk.dev/providers/adapters/langchain)、[消息持久化](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence)及当前lib/assistant与specs/004-assistant-query-knowledge/verification.md。官方网页示例可更新，落地语法以已锁定类型复核。

## 3. 建单确认使用普通业务动作

**决策**：工具只准备草稿，正式创建由用户点击卡片后调用Server Action，不给模型正式创建工具。草稿是会话归属业务实体，工具输出只引用ID。

**理由**：满足必须编辑卡片、选择施工方、点击确认的业务需求；不需要暂停仍运行中的Agent，也不需要跨请求恢复模型运行。每个业务动作自行鉴权，不能把隐藏按钮或模型提示当授权。

**替代方案**：本期不启用HITL middleware/checkpointer/Command；若将正式写入移入Agent tool，就必须使用技能的完整HITL流程，不能用AI SDK needsApproval替代。

**依据**：本地node_modules/next/dist/docs/01-app/02-guides/server-actions.md说明Server Actions为可被调用的POST入口、需逐次鉴权；用户指定技能允许固定server-side tools，HITL仅在需要Agent审批暂停时启用。本设计选择结束草稿工具而非暂停工具。

## 4. 私有图片与原子创建

**决策**：新增草稿照片元数据，先将所选聊天图复制到私有暂存，再在一个RPC中创建工单、记录、正式附件及结果。文件复制只用鉴权后固定桶源，管理客户端不操作业务表。

**理由**：现有work_order_photos.work_order_id非空，未建单不能占用正式表；聊天公开图不能作为正式私有附件。SQL无法与Storage请求跨服务原子提交，先暂存可让最终业务关联全有或全无。

**替代方案**：不提前建占位工单、不把聊天桶改私有、不复用公开链接、不先报建单成功后补图。失败暂存留可重试或离线清理，不加调度器。

**依据**：[数据库函数](https://supabase.com/docs/guides/database/functions)、[Storage对象复制](https://supabase.com/docs/guides/storage/management/copy-move-objects)及现有照片迁移。函数权限须显式控制；本轮仅设计，迁移前重新查询实际云端。技能要求的changelog.md通过网页读取遇到Content-Type限制，本机请求受网络限制，未完成变更日志核查；实施迁移前须补查，未据此假称平台无变更。

## 5. 幂等、恢复与成功消息

**决策**：同草稿唯一结果、行锁与revision，确认成功事务追加唯一ID回执到现有UIMessage[]快照；SDK setMessages采用返回快照。普通聊天继续onEnd保存，确认时禁用发送，数据库冲突阻止旧流覆盖。轮淘汰、权限失效、退出使未提交草稿失效。

**理由**：减少额外模型调用并避免响应丢失后重复写入；权威草稿表保证刷新后不会仅凭旧工具结果重复建单。业务行锁、唯一约束和版本是实际去重边界。

**替代方案**：不将按钮disabled当作唯一去重，不仅用localStorage，不从DB回捞历史给模型，不自行合并tool call/result或维护SDK工具UI状态机。卡片表单状态与业务实体一致，不替代SDK流状态。

## 研究结论

技术方案已确定，无待决定的架构澄清。真实Coze凭据/发布状态、SDK可安装精确版本、云端现状及变更日志补查列为实施前置，不能作为已完成验收。计划可进入任务拆分，不直接执行开发。
