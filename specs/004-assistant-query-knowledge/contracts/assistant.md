# 助手接口契约：当前 OpenRouter 迭代

日期：2026-10-29。设计已明确，接口尚未实施。

## 页面与会话

/assistant 服务端校验当前身份，读取或创建唯一业务会话，取得 `{sessionId, revision, messages: UIMessage[]}` 作为 useChat 初值。归属由已验证的 Auth session_id、用户和 membership 决定，客户端不提供 owner/project/role。
同登录刷新与切页恢复，退出及新登录从空对话开始。无历史会话列表或 checkpoint 历史。

## POST /api/chat

- Node runtime、同源请求、Auth Cookie 与业务会话归属验证。
- JSON：`{sessionId, revision, messages: UIMessage[]}`。提交完整最近历史，最多 5 轮已完成问答加当前 user；不能提交 system 角色、外部地址或授权身份。
- 文字最多 4000 字，或至少一张本会话已上传图片；单消息图片最多 9 张。按 SDK schema 校验 parts；历史工具结果不作为真实查询依据。
- 建立服务端 runtime context，含当前身份、请求 Supabase 客户端和业务 session。工具权限只取自 context。
- await toBaseMessages → createAgent().stream(values/messages（当前适配器兼容配置，详见 verification.md）) → @ai-sdk/langchain toUIMessageStream → createUIMessageStream/writer.merge → createUIMessageStreamResponse。
- 使用 originalMessages 生成完整最终快照；start/finish 只由一层发出。不手写 SSE、不拼 token 和 tool 状态。
- onEnd outcome=completed 才保存最终 messages，裁剪至 6 轮；保存前复核身份并校验 expectedRevision，不回捞 DB 历史或比较消息前缀。
- 401 登录失效；403 身份/会话无权；400 输入非法；409 版本冲突。流中模型或保存错误通过 AI SDK 错误机制显示中文，不泄露原始服务错误或凭据。
- regenerate 重试保留同一用户轮及附件；不新增重复轮次。保存失败不能声称刷新可恢复。

## POST /api/chat/uploads

- 同源鉴权，FormData 为 sessionId 和一个 image 文件。多图由输入组件上传，消息发送前总数不超过 9。
- 文件 >0 且 <=10 MiB，JPEG/PNG/WebP；校验文件签名与 MIME，不接受任意下载 URL 或对象路径。
- 服务端先确认会话归属，再用 Secret Key 客户端写固定独立公开桶 assistant-chat-images；随机键，upsert=false。
- 返回 `{files: FileUIPart[]}`，项为 type=file、mediaType、filename、url；前端 sendMessage({text,files})，主聊天协议不变。
- 上传失败保留选择及已上传项，重试不重复上传成功附件；移除附件不随消息发送。
- 401/403/400/413/415/503 分别显示身份、参数、大小、格式或存储失败说明。

## 固定只读工具

search_work_orders 只接 number、keyword、location、status、severity、scope，不接用户/项目 ID、SQL、任意过滤表达式。
编号优先调用既有 get_work_order；无编号走新增最小 search RPC（security invoker + 现有工单 RLS）。scope 仅增加本人发起/本人负责条件，不扩大可见范围。状态为 pending/completed/rejected/ended/all，未指定时全部状态。
质检员“我的”为本人发起，施工方为当前负责，管理员必须追问。

返回 `{kind,total,hasMore,items}`，最多 20 个完整详情 DTO；编号区分 not_found/forbidden，其他无匹配 total=0。hasMore 时说明截断，不把 items.length 当完整总量。
单条摘要卡、多条文本编号链接，复用详情 controller 的宽屏抽屉/窄屏页面；点击重新授权。历史引用工单 hydrate/发送前复核，失权移除整轮，不让旧受限内容进入模型上下文。
工具 UI 使用 AI Elements Tool part 显示中文业务状态和结果，不暴露内部工具名称、参数、原始 JSON、路由和思维链。

Coze 暂不调用；专业咨询说明知识服务未开放，不凭训练知识判断合规。没有建单/编辑/解决/拒绝/转派/重开工具，不引入当前无实际需求的 MCP/HITL 接口。

## 数据库边界

ensure/read session 从 JWT/current_membership 派生唯一归属；save snapshot 仅接 sessionId、expectedRevision 和最终 UIMessage[]；clear session 只清当前登录身份，退出前调用。search RPC 使用业务会话/RLS，不用 Secret Key。
所有新增表启用 RLS；新函数撤销默认 PUBLIC/anon 执行权限，按最小需要授权 authenticated；用户不能修改归属或跨登录恢复快照。
