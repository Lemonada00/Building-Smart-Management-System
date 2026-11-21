# 实施计划：智能建单与 Coze 单轮知识工具

**分支**：实际 Git 为 master，未新建分支；setup-plan 返回的 005-create-order-coze 是功能定位标识。
**日期**：2026-10-30 | **规范**：[spec.md](spec.md)
**输入**：specs/005-create-order-coze/spec.md

## 概要

沿用 AI Elements → useChat → DefaultChatTransport（完整 UIMessage[]）→ @ai-sdk/langchain → createAgent().stream() 与固定 OpenRouter。新增 query_construction_knowledge，使用官方 @coze/api 将指定扣子 Agent 作为独立、无历史单轮工具；prepare_work_order_draft 仅整理草稿，用户点击卡片后通过 Server Action 创建正式工单。

不向模型注册正式建单工具，故本期无 Agent 暂停/恢复，不需要 checkpointer、humanInTheLoopMiddleware 或 Command resume。卡片是普通业务确认表单；若后续改由 Agent 执行写入，须另行加入完整 HITL。不引入 MCP、Agent Server、第二套聊天协议或自写 SSE。

## 技术上下文

| 项目 | 当前方案 |
| --- | --- |
| 语言/平台 | TypeScript 严格模式、Next.js 16.4.3、React 19.3.0；App Router 默认 Node，沿用 cacheComponents 限制 |
| 依赖 | 保持现有 ai 7.0.156、@ai-sdk/react 4.0.160、@ai-sdk/langchain 3.0.156、langchain 1.6.0、core 1.3.1、openai 1.8.0、zod 4.6.7 |
| 新依赖 | 官方 @coze/api，实施时查询实际可安装版本并精确锁定，提交 npm lockfile；不虚构版本号 |
| 存储 | 当前 Supabase，新增草稿与私有暂存附件元数据；复用工单、记录和私有照片桶 |
| 验证 | 必要人工核心路径走查、真实模型/Coze、npm run check；不写自动化测试 |
| 目标/规模 | Next.js 单体、无跨请求常驻 Agent；三角色、一个编辑草稿、最近六轮，每单九张照片、每张10 MiB |
| 性能 | 点击即时进行态；沿用 chat maxDuration=120，Coze 单次总超时60秒，技术常量不放环境变量 |
| 限制 | 业务查询/写入/快照只用当前会话；管理密钥仅限经鉴权的文件操作及既有 seed；本期不部署 |

## 宪章检查

研究前及设计后均通过：仅阶段6与延期Coze，复用现有组件/权限/Agent，不建通用框架；中文文档；人工走查及默认静态检查。不追加自动化测试、覆盖率、无障碍、观测平台、构建或部署。无复杂度豁免。

## 项目结构

文档：spec.md、plan.md、research.md、data-model.md、contracts/assistant-create.md、contracts/coze-tool.md、quickstart.md 与 checklists/requirements.md。tasks.md 留待 speckit-tasks。

源码计划位置：

- lib/assistant/coze.ts：server-only 官方SDK单轮工具适配。
- lib/assistant/drafts.ts：草稿读取、保存、确认、图片晋升。
- lib/assistant/agent.ts、tools.ts、types.ts、validation.ts：固定工具、runtime context、输入白名单及中文指令。
- lib/assistant/history.ts、session.ts、uploads.ts：轮次失效、归属复核及清理排除草稿引用。
- app/actions/assistant-drafts.ts：save/cancel/confirm 普通业务 Server Actions。
- app/api/chat/drafts/[draftId]/route.ts：权威卡片读取。
- app/api/chat/drafts/[draftId]/photos/route.ts：私有草稿图上传与鉴权预览。
- components/assistant/create-order-card.tsx、chat.tsx：卡片与SDK工具parts渲染。
- app/api/chat/route.ts：保持现有主流水线，补充服务端派生session及当前轮上下文。
- supabase/migrations/：草稿与图片元数据、受控建单RPC及最小权限。
- .env.example、.env.local：新增三个空Coze变量，填写及非空核对后才进入相关开发。

## 阶段0：研究

见 research.md。已检查当前代码、本地Next.js文档与SDK类型、官方网络文档。Context7当前未提供工具，采用官方资料。云端现状在实施迁移前重新查询；本轮不修改数据库。Coze凭据、指定Agent发布状态及真实答案格式为联调前置，不把playground链接当作已通过验收。

## 阶段1：设计

1. 主Agent结合图文生成精练主题，调用固定Coze工具。官方SDK流只在工具内部消费，完整最终答案一次交回主Agent，不复用远端对话。
2. 明确建单且四项齐全调用准备草稿工具，服务端派生session、membership、project和本轮UIMessage.id。同会话最多一条editing，重复调用返回已有草稿，不能覆盖人工修改。
3. 工具输出草稿ID，SDK正常tool parts渲染卡片。卡片读取权威草稿表，blur/选择变化保存；失败显示未保存。确认提交完整最终字段，避免blur与点击竞态。
4. 确认先校验身份和版本，将聊天选图复制成私有暂存对象，全部成功后调用当前会话RPC。SQL锁定草稿和会话，原子创建pending工单、created记录、照片关联及草稿终态；重试返回同一工单。
5. UIMessage[]仍为聊天唯一边界；草稿表仅是业务表单状态，工具结果只作引用。客户端伪造工具输出不会获取他人草稿或创建权限。不从DB回捞历史拼接给模型。
6. 确认事务同时追加稳定ID的确定性assistant成功消息并递增session revision；客户端使用SDK setMessages采用权威快照，不额外发模型请求。确认与发送互斥，旧流onEnd由revision拒绝覆盖。
7. trim/失权移除整轮时撤销未提交草稿，退出关闭草稿；有效草稿引用聊天图不提前清理。正式工单图片独立保存，不随会话级联。无新调度器。

详情见 data-model.md 与 contracts/。卡片读写接口是普通业务接口，不是Agent command/state/event bridge。

## 实施顺序与交付

先配置与真实服务复核，再草稿/RPC/私有图片、知识工具、卡片及主Agent集成，最后核心走查和默认检查。配置缺失可推进不依赖它的工作，不能宣称真实知识完成。交付同步progress.md、AGENTS.md与verification.md。本命令到设计结束，不生成tasks、不安装依赖、不执行迁移、不改变业务阶段完成数。
