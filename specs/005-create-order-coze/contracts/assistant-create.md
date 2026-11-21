# 应用契约：草稿卡片与正式确认

## 聊天边界

POST /api/chat保留sessionId、revision、完整UIMessage[]，不回捞DB历史拼接。parseMessages白名单新增query_construction_knowledge与prepare_work_order_draft，兼容SDK动态/静态tool parts；不放开system或任意工具。

prepare_work_order_draft输入description/location/severity/discipline/details，前四项必填；session、project、membership、当前轮userMessageId由服务端context派生。聊天附件候选来自合法本轮及当前草稿上下文，不接受任意URL。输出draftId、revision、status及摘要；重复调用不能覆盖人工编辑。

SDK正常tool parts引用draftId渲染卡片，工具状态和调用结果配对由适配器处理，不手动拼合。模型工具列表无正式建单或其他工单操作。

## 卡片读取

GET /api/chat/drafts/[draftId]：重新鉴权，返回权威草稿、当前项目施工方、图片及可操作状态。private,no-store；他人草稿或失效会话403。已创建结果重新核对工单权限后显示链接。

## Server Actions

app/actions/assistant-drafts.ts提供saveDraft/cancelDraft/confirmDraft。所有输入不可信，逐次核对身份。共有draftId、expectedRevision、sessionId；save额外为允许编辑字段及附件ID；confirm额外为sessionRevision和完整最终表单。编号、状态、发起人、项目不能由客户端修改。

返回判别结果：ok（最新草稿及revision）；validation_error（中文字段错误）；conflict（权威状态，保留本地输入，核对后重试）；unauthorized/forbidden；unavailable（中文可重试提示，无原始供应商错误）。确认成功额外返回workOrderNumber、receiptMessageId、sessionRevision和权威UIMessage[]。

created同草稿重试在身份归属有效后返回同一结果，不因旧expectedRevision再创建；editing严格核对版本。cancel/save不能改变终态。

表单blur/选择变化保存，保存失败明确显示未保存；确认提交完整最终字段防止blur竞态。提交中禁用重复操作和聊天发送。失败保留内容、责任人和图片。成功回执由同一数据库事务以稳定ID追加，客户端SDK setMessages采用返回快照；不调用模型生成确认，不拼token。

## 图片

POST /api/chat/drafts/[draftId]/photos接收单图FormData image，同源、会话、创建权限及editing校验；返回私有附件ID及同源预览地址。GET同一路由以photoId读取，逐次鉴权、private,no-store及cacheNonce；不提供公开Storage URL或普通签名链接。移除选择经save，不直接删除正式已关联文件。

错误：401未登录、403归属/权限/同源、400格式、409终态或版本、413大小、415文件、503存储失败。工单创建后图片使用现有工单鉴权入口。

## 快照和并发

聊天仍由createUIMessageStream.onEnd保存完整UIMessage[]。草稿是独立表单状态，工具旧输出只作引用，不授予权限。确认、关闭与流保存核对session revision，旧流不能覆盖成功消息。轮淘汰或失权删除整轮时撤销草稿；清理聊天图片排除有效草稿引用，正式工单图片永不由聊天清理删除。
