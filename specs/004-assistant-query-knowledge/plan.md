# 实施计划：阶段 5 智能助手（OpenRouter，Coze 暂缓）

**日期**：2026-10-29 | **规范**：[spec.md](spec.md) | **最新输入**：[planning-input.md](planning-input.md)
**Git 状态**：本工作树为 detached HEAD，起点 `53371772bca26ff92206ddcb52afe131c953b4fa`。setup-plan 返回的 `004-assistant-query-knowledge` 是功能标识，并非实际 Git 分支。
**状态**：本次 OpenRouter/Coze 暂缓迭代的研究与设计已完成；本命令止于设计，不执行应用开发。

## 概要

严格采用 AI Elements → useChat → DefaultChatTransport → @ai-sdk/langchain → createAgent().stream() 路径。模型固定经 OpenRouter，使用已配置的 `inclusionai/ling-3.0-flash-vl`。实现图文输入、流式对话、只读工单查询、最近 6 轮和同登录周期的 Supabase 快照恢复。

Coze 暂缓：本迭代专业问答只说明知识服务尚未开放，不使用模型自身知识作规范或合规判断；不能将本迭代完成等同完整阶段 5 完成。建单和所有业务写入留阶段 6；管理员工作台仍留阶段 4，不为实现助手代做工作台。

## 技术上下文

| 项目 | 决策 |
| --- | --- |
| 基础技术 | 保留 Next.js 16.4.3、React 19.3.0、TypeScript 严格模式、Tailwind 4、shadcn/ui、Biome、npm |
| 运行环境 | Node.js >=22；当前核对环境为 24.20.0；沿用 App Router Route Handler 的 Node runtime |
| UI 与协议 | AI Elements Conversation/Message/PromptInput；useChat；DefaultChatTransport；统一 UIMessage[] |
| 模型 | @langchain/openai ChatOpenAI，显式传 OPENROUTER_API_KEY、OPENROUTER_MODEL、configuration.baseURL；不调用 OpenAI 官方端点 |
| Agent | LangChain createAgent，Zod 固定只读工具，服务端 runtime context，不自建路由模型或工具循环 |
| 存储 | Supabase Auth、会话/图片元数据、UIMessage[] JSONB 快照；图片用独立公开聊天桶，由鉴权上传 API 经服务端 Secret Key 写入 |
| 业务权限 | 当前用户会话客户端和现有 work_orders RLS；不使用管理客户端查询工单或读写聊天快照 |
| 限制 | 最近 6 轮完整问答；4000 字；9 张图片、每张 10 MiB，JPEG/PNG/WebP；不新增历史会话列表 |
| 验收 | 必要人工核心路径与 npm run check；不追加自动化测试、生产构建或部署 |

### 依赖基线

2026-10-29 读取 npm 官方 registry 的稳定版本与 peer 范围，实施安装时使用精确版本并提交 lockfile：

| 包 | 版本 |
| --- | --- |
| ai | 7.0.156 |
| @ai-sdk/react | 4.0.160 |
| @ai-sdk/langchain | 3.0.156 |
| langchain | 1.6.0 |
| @langchain/core | 1.3.1 |
| @langchain/openai | 1.8.0 |
| @langchain/langgraph | 1.5.3（适配器 peer，非新增图编排） |
| zod | 4.6.7 |

AI Elements 按官方 CLI 获取所需组件及其直接依赖，保留项目现有组件风格。当前无外部 MCP 服务、无写入审批工具，不引入 MCP client 或 HITL 流程；未来实际需要时按技能接入 MultiServerMCPClient 或 humanInTheLoopMiddleware，不能自建替代。

## 宪章检查

设计前：范围限本阶段和最新用户指令；中文文档；沿用当前框架；不添加通用 Agent 平台、观测平台、自动化测试或管理员工作台。通过。

设计后：消息持久化、AI Elements 和公开聊天图片桶是用户明确指定技能的要求，取代早期草案的内存简化；公开桶只存用户本轮上传的聊天图片，现有私有工单桶和鉴权读取保持原有职责。所有业务查询仍经现有会话及 RLS。通过。

## 项目结构

```text
specs/004-assistant-query-knowledge/
  spec.md
  planning-input.md
  plan.md
  research.md
  data-model.md
  contracts/assistant.md
  quickstart.md
  checklists/requirements.md
  tasks.md                    # 已按本计划重生成 33 项实施任务，均未执行
  verification.md

拟修改/新增：
app/(workspace)/assistant/page.tsx
app/api/chat/route.ts
app/api/chat/uploads/route.ts
app/actions/auth.ts           # 退出先清理本会话，再撤销身份
components/assistant/chat.tsx
components/assistant/work-order-result.tsx
components/ai-elements/       # 官方生成 Conversation/Message/PromptInput 等
lib/assistant/agent.ts
lib/assistant/session.ts
lib/assistant/tools.ts
lib/assistant/uploads.ts
lib/assistant/env.ts
lib/supabase/admin.ts         # 仅聊天上传/清理使用的 server-only 客户端
supabase/migrations/          # 会话、快照、只读助手搜索和聊天桶
```

复用现有 AppShell、详情 controller、getLoginContext 和 getWorkOrder。助手页加载时读取唯一业务会话及消息快照；切回页面重新 hydrate，不依赖重构全工作区布局来保留局部状态。

## 请求数据流

1. assistant 页面验证当前身份，以 auth session_id + membership 读取/创建唯一聊天会话，加载最近 6 轮 UIMessage[] 初始值。
2. useChat 的 DefaultChatTransport 每次提交完整 messages[]，可附 sessionId 和 revision；不提交用户/项目授权参数。
3. POST /api/chat 逐请求验证登录及会话归属、消息大小、图片来源和轮次，建立服务端 runtime context。只做 schema、归属和 revision 检查，不回捞 DB 历史拼接或比较消息前缀。
4. toBaseMessages 转换输入；createAgent().stream 使用 values/messages（当前适配器兼容配置，详见 verification.md）；toUIMessageStream 交给 AI SDK 合并和输出，不手写 SSE、不拼 token 或工具状态。
5. createUIMessageStream 的 onEnd 在再次校验有效身份后保存完整最终 UIMessage[]（最多 6 轮）。SDK 当前回调名称以 research 的版本适配决策为准，不自制回调机制。
6. useChat 正常流式显示；保存失败用可识别错误状态提示，不声称已恢复持久化。错误重试复用同一用户轮次。

## 查询与权限

新增最小助手只读搜索 RPC，使用 security invoker 与既有工单 RLS，返回匹配总量/截断标志和至多 20 个完整详情；按编号优先，其他条件参数化匹配，不传任意 SQL/过滤表达式。编号详情复用 get_work_order。

用户、项目、角色来自运行时上下文，RPC 中再次从 JWT 确定；“我负责/我提出”仅增加条件，不能扩大 RLS。管理员“我的”先追问。单条结果用官方工具 part 内自定义业务摘要，多条用文本与可点击编号；工具名称和路由细节不向用户暴露。旧消息是快照，点击详情重新鉴权。

阶段 4 的 UI 缺失不阻断本查询设计：现有工单表/RLS 已支持管理员项目读取，助手新增 RPC 不实现工单中心或大盘。

## 消息与图片生命周期

业务会话绑定当前 Auth session_id 和 membership，服务端保存 UIMessage[]。退出清除本会话快照后撤销身份；退出并发期间 onEnd 不得重新写入。刷新和切页可恢复同一会话，重新登录的新 session_id 不可读旧会话。过期行不可读；本阶段不增加清理调度器。

聊天图片独立桶 `assistant-chat-images` 为 public，随机对象键，不复制私有工单图片。上传前校验当前身份、会话和文件类型大小，再由仅服务端管理客户端写入。消息只存 URL，不存 base64；返回 FileUIPart[]。模型可以读取 URL，持有 URL 的人也可读取，这是技能指定公开桶的访问语义，不能宣称图片受工单鉴权保护。

淘汰轮次或退出时清理无引用聊天图片，失败重试或中断的对象由后续离线清理处理，不删除已关联工单文件。未来建单必须另行复制到私有工单桶，此阶段不实现。

## 规划交付边界

环境六项已确认非空，OpenRouter 标准地址校验通过、密钥检查 HTTP 200、模型目录支持 image/tools、Supabase Auth HTTP 200。尚未发起模型推理、验证管理密钥权限、应用迁移或进行真实助手走查；这些属于实现验收。

前后置 hooks 文件均不存在，无可执行项。speckit-plan 止于研究与设计；后续 speckit-tasks 已按本设计生成 33 项任务，下一步为实施。完整阶段 5 的 Coze 验收继续保留待办。
