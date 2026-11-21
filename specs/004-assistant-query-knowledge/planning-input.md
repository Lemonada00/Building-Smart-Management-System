# 本次规划输入更新

日期：2026-10-29。用户明确要求：

- 严格遵循 simple-next-langchain-agent 技能的 AI Elements → useChat → DefaultChatTransport → LangChain adapter → createAgent().stream() 路径，不自制简化替代。
- LLM 固定通过 OpenRouter API 接入。
- 暂不接入 Coze；当前迭代不完成基于 Coze 的专业问答验收，不用模型自身知识代替知识依据。
- 开发前先指导配置环境变量，确认保存后才能进入开发。

先前 plan/research/data-model/contracts/tasks 为草案，需在本次正式规划中重写，尤其不能沿用“仅内存、不持久化”的简化方案。按技能使用 Supabase 保存 UIMessage[] 快照、刷新 hydrate，并仍按登录会话限定最近 6 轮与退出清空，不提供跨登录恢复。
图片按用户指定技能采用独立聊天图片存储方案，不能把既有私有工单图片桶改为公开。具体存储权限、生命周期和显示边界在正式规划中明确。
MCP 和 HITL 按当前功能需要应用；当前只读查询不新增工单写入和审批流程。

环境变量准备阶段已在 .env.example 输出空项，并准备忽略的 .env.local；密钥不写进项目文档或聊天。
