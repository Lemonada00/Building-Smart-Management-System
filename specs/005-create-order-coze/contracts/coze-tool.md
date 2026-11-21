# Coze独立无记忆单轮工具契约

## 固定边界

工具名query_construction_knowledge，使用官方@coze/api。输入仅query:string（trim后非空、最多4000字）；主Agent先结合图文整理主题，不向Coze传完整UIMessage[]、工单、人员列表或图片二进制。bot/baseURL/token只取服务端环境，浏览器和模型不能覆盖。

国内站 `COZE_BASE_URL` 为 `https://api.coze.cn`。`COZE_BOT_ID` 使用当前配置中已发布到 API 渠道的智能体 ID，`COZE_API_KEY` 使用具备目标空间 `chat` 权限的服务端令牌。环境示例保留空项，真实值仅通过服务端环境配置。

## 官方SDK调用约定

new CozeAPI({baseURL,token,debug:false})；使用client.chat.stream（单数chat）。每次调用生成新随机user_id，不传conversation_id，auto_save_history:false，additional_messages仅一条role:user/content_type:text/content:query。不要建立Coze持久会话、线程映射或复用用户记忆标识。

无记忆指本应用不传历史、不复用对话/用户标识、不保存本轮作为后续上下文；不保证扣子平台无日志或子Agent内部无外部存储。主助手最近六轮是独立应用能力，不传给此工具。

官方约束stream:false需要auto_save_history:true以查询结果，因此不使用createAndPoll非流式方式。SDK流在服务端工具内收完答案，不透传浏览器；不自行解析SSE帧。

仅收集CONVERSATION_MESSAGE_COMPLETED中role=assistant且type=answer的完整content；按消息id去重并保序，不再拼delta，不把follow_up/verbose当答案。等待CONVERSATION_CHAT_COMPLETED成功终态，再返回ok与Markdown。终态前断开、CHAT_FAILED、ERROR、REQUIRES_ACTION均不可当作成功；没有answer返回empty。

单次总超时60秒并传递父请求AbortSignal，SDK请求timeout配合总时限；失败不无限重试，不续接历史。鉴权/权限/限流/超时/中断映射unavailable及中文可理解提示，不输出令牌或供应商原始错误。主Agent收到empty/unavailable时不得用自身知识补出规范结论；无依据只阻断专业判断，不阻断明确按事实报事。

来源依原返回Markdown展示，不假定有独立citations数组；缺失来源或依据不足时说明限制。真实Agent响应内容需联调核对，不能凭公开SDK类型认定其一定返回完整条文。

## 官方依据与联调限制

- [国内发起对话](https://docs.coze.cn/developer_guides_chat_v3)
- [官方SDK示例](https://github.com/coze-dev/coze-js/blob/main/examples/coze-js-node/src/chat.ts)
- [请求选项](https://github.com/coze-dev/coze-js/blob/main/examples/coze-js-node/src/request-options.ts)
- [SDK类型与实现](https://github.com/coze-dev/coze-js/blob/main/packages/coze-js/src/resources/chat/chat.ts)

用户playground链接在文档读取工具中无法打开，未核实Bot的API发布状态或实际答案。实施前确认API渠道和令牌权限，真实调用后再记录验收证据。
