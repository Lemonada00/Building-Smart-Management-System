# 阶段 5 研究与技术决策

日期：2026-10-29。状态：本次 OpenRouter/Coze 暂缓迭代的规划未知项已闭合；真实运行验收留实施阶段。

## 研究依据

已读项目宪章、AGENTS.md、完整需求和原型、ecosystem-primer、simple-next-langchain-agent、langchain-fundamentals、langchain-dependencies 和 Supabase 技能。按 speckit-plan 派发只读技术研究代理核对前端与适配器，主代理核对配置、OpenRouter、数据库与现有代码。

当前工具没有 Context7 resolve-library-id/query-docs，遵循项目回退规则查询当前官方网页；Supabase 使用官方 MCP search_docs 并读取 Storage/RLS 官方文档；变更索引已通过 HTTPS 成功读取。Next.js Route Handler 用已安装 16.4.3 的 node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md 核对。

## 决策一：严格使用单体 LangChain 链路

**决定**：AI Elements、useChat、DefaultChatTransport、@ai-sdk/langchain、LangChain createAgent().stream 固定串联。工具用 Zod schema 和服务端 runtime context。
**理由**：用户明确要求；官方适配器直接支持 values/messages（当前适配器兼容配置，详见 verification.md） 三种 streamMode。
**替代方案**：拒绝手写 SSE、直接 fetch 模型、自建 token/tool 状态机、Agent Server、多 endpoint 协议和内存聊天简化。

当前版本注意：toBaseMessages 是异步；toUIMessageStream 从 @ai-sdk/langchain 导入。createUIMessageStream 设置 originalMessages，再由 writer.merge 合并 adapter stream；start/finish 边界由一层负责，不能重复。onEnd 的 outcome 区分成功、失败、中止；成功才保存完整终态，失败保留客户端输入供 regenerate 重试。当前 onEnd 有效，onFinish 是废弃兼容别名。

来源：[LangChain adapter](https://ai-sdk.dev/providers/adapters/langchain)、[createUIMessageStream](https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream)、[useChat](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)、[LangChain agents](https://docs.langchain.com/oss/javascript/langchain/agents)。

## 决策二：OpenRouter 兼容接口

**决定**：用技能列出的 @langchain/openai ChatOpenAI，显式绑定配置中的 apiKey、model、configuration.baseURL，通过 OpenRouter Chat Completions 调用；不依赖环境中的 OPENAI_API_KEY，不自动改模型或改成 Responses API。
**理由**：保持指定依赖路径；LangChain 支持自定义 baseURL，OpenRouter 提供 OpenAI 兼容协议。
**替代方案**：OpenRouter 的专用 ChatOpenRouter 包当前也可用，但本次遵循用户指定技能的依赖路径；不引入另一套 Agent SDK。

六个环境变量只检查非空，不输出值；已核对模型 `inclusionai/ling-3.0-flash-vl` 存在且 input_modalities 包含 image，supported_parameters 包含 tools。GET /key 返回 200，Supabase Auth settings 返回 200。没有发起计费推理，不能据此断言图片理解、流式或工具调用实际验收通过。Supabase 管理密钥尚未执行权限验证。

来源：[ChatOpenAI custom URLs](https://docs.langchain.com/oss/javascript/integrations/chat/openai#custom-urls)、[OpenRouter 接口](https://openrouter.ai/developers)、[所选模型](https://openrouter.ai/inclusionai/ling-3.0-flash-vl)、[模型目录](https://openrouter.ai/api/v1/models)。

## 决策三：当前依赖与组件

**决定**：采用 plan.md 表内已通过官方 npm registry 核对的精确版本，Node >=22。@ai-sdk/react 4 的 peer 覆盖 React 19.3；LangChain/core/openai、适配器与 Zod 的 peer 范围相容。实现时正常安装校验，不用 legacy-peer-deps 或 force 绕过。
**理由**：技能路径必须实际落在兼容版本上。
**替代方案**：不依据旧教程安装 AI SDK 4/5，不升级项目 Next.js 或 React 来迁就无关框架。

AI Elements 当前 Message 使用 from 属性，内部 MessageContent/MessageResponse，技能 `<Message message={message}/>` 是“优先”示意而非当前组件签名。遵照真实组件 API 仍属于严格使用技能路径。Conversation 用官方滚动组件；PromptInput 用官方文字、附件、提交部件。工具 part 用官方 Tool 组件呈现中文查询状态及业务结果，不输出内部路由或工具参数。Streamdown 的 CSS source 按组件文档配置。

来源：[Message](https://elements.ai-sdk.dev/components/message)、[Conversation](https://elements.ai-sdk.dev/components/conversation)、[PromptInput](https://elements.ai-sdk.dev/components/prompt-input)、[Tool](https://elements.ai-sdk.dev/components/tool)。

## 决策四：Supabase 快照与唯一登录身份

**决定**：一个 Auth session_id + 当前 membership 对应一段连续会话；UIMessage[] 存为 JSONB。页面读取初始快照，onEnd 保存最终快照，切页与刷新均可恢复；退出清空，重新登录无历史恢复。
**理由**：同时满足技能持久化要求和业务不跨登录恢复要求。
**替代方案**：不只用 React 内存，不用 localStorage，不用 LangGraph checkpoint 替代 UI 快照，不提供历史会话列表。

每次查询/写快照/上传确认当前身份。客户端只提供 sessionId 和 revision，不提供 owner 或 project；数据库用现有 private.valid_session/current_membership 复核。会话表启用 RLS，普通账号仅允许授权 RPC 的受限读写。公共 RPC 使用 invoker；如内部初始化必须访问私有身份信息，沿用项目私有 helper 的最小 privileged lookup，并显式撤销默认执行授权。

请求直接使用客户端完整 UIMessage[]，不回捞数据库上下文或进行前缀比较；revision 仅避免旧请求覆盖新快照。历史工具结果不构成授权，链接/编号必须重新读取。已转派失权工单的历史轮次在 hydrate 和发送前按该轮引用编号复核，失权则移除整轮，避免旧内容重新进入模型上下文。

来源：[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)；项目身份迁移及现有详情 RPC。

## 决策五：图片按技能存独立公开桶

**决定**：独立 assistant-chat-images 公开桶，浏览器通过自有上传 API，服务端验证用户/会话后用 Secret Key 上传，返回 FileUIPart；只存 URL。
**理由**：用户明确要求严格使用技能的图片路径；模型能够直接读取公开 URL。
**替代方案**：不使用 base64 写历史，不改私有 work-order-photos 桶，不复用业务图片签名 URL，不允许浏览器持有管理密钥。

公开 URL 的持有者可访问图片，不能描述成按登录鉴权的私有图片。上传、删除和元数据仍受服务端身份限制。随机对象键、限定 MIME/大小、不能覆盖已有对象；淘汰和退出清理本会话无引用对象，失败孤儿留离线维护。本阶段不复制聊天图片到工单，也不做部署或调度器。

来源：[Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals)。

## 决策六：Coze 暂缓与阶段 4

**决定**：当前迭代不实现知识服务或替代检索。对专业规范/合规咨询说明知识服务暂未开放，可理解图片中可见事实并追问目的，不生成专业结论。
**理由**：用户最新范围要求优先；不能因暂缓 Coze 删除原阶段最终验收要求。
**替代方案**：不以模型训练知识、网络搜索、模拟服务或虚构规范充当既有 Coze。

阶段 4 缺失只影响工作台/大盘，不阻断助手读取已有 RLS 数据。最小新增只读搜索 RPC 实现参数化过滤与完整详情，不代做阶段 4 页面。完整阶段 5 仍有 Coze 待办，当前迭代可独立验收。

## 未决项审查

无影响本次设计的 NEEDS CLARIFICATION。实际模型推理、管理密钥权限、迁移部署和浏览器走查属于实施验证，不能提前记为已通过。当前没有 MCP 服务和需审批的写入工具，故 MCP/HITL 章节为条件性能力，不生成空壳流程或额外服务。
