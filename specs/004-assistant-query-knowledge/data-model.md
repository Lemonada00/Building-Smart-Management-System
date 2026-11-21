# 数据模型：阶段 5 当前迭代

日期：2026-10-29。只定义设计，不代表迁移已经应用。

## assistant_sessions

| 字段 | 约束与用途 |
| --- | --- |
| id | UUID 主键，服务端生成的业务会话 ID |
| auth_session_id | 已验证 JWT 对应的 Auth session_id；非客户端输入 |
| user_id | auth.uid()，非客户端输入 |
| membership_id | 当前选定成员身份；非客户端输入 |
| messages | JSONB UIMessage[]，默认 []；最多最近 6 轮完整问答 |
| revision | 非负整数，每次成功保存递增，阻止旧快照覆盖 |
| created_at / updated_at | 服务端时间 |

唯一键 `(auth_session_id, membership_id)`，同一登录身份只有一段对话。关联身份和 Auth session，删除时级联清理元数据。RLS 同时校验有效会话、当前 membership 及 user_id；不能仅凭 auth.uid() 读取本人旧登录会话。普通账号不得修改归属字段。业务使用当前会话客户端，Secret Key 不用于快照操作。

读取/创建会话、保存快照和退出清理走受限 RPC。保存带 expectedRevision，冲突保留客户端内容并提示刷新，不做消息前缀比较。退出清理后撤销身份；流结束再次验证身份，防止迟到响应复活已退出会话。

## UIMessage[] 边界

使用 AI SDK 类型，不定义另一套 role/content 协议。用户、助手消息含 id、role、parts；图片用 FileUIPart，工具结果保留 SDK 的 tool part。自定义 metadata 只记录本轮引用工单编号及业务显示需要，不作为授权依据。

一轮从 user 到本次 assistant 完成，内部工具步骤属于该轮。发送时最多最近 5 轮完整历史加当前用户消息；完成后保存最近 6 轮。失败不生成重复 user 消息，SDK regenerate 重试。服务端拒绝 system 角色、非法工具类型、未知图片来源和超限字段；客户端历史不可改变固定系统提示或工具权限。

用户文本最多 4000 字。对话完成后淘汰整轮，不截断单条工具调用/结果配对。hydrate/请求时对历史引用工单重新鉴权，失权移除整轮；既有已下载内容不能追溯撤回。

## assistant_uploads

| 字段 | 约束与用途 |
| --- | --- |
| id | UUID，随机生成 |
| session_id | 关联当前业务会话 |
| object_path | 独立聊天桶内唯一随机键，不包含姓名或工号 |
| mime_type | image/jpeg、image/png、image/webp |
| size_bytes | >0 且 <=10 MiB |
| original_name | 仅显示用途，不直接成为对象路径 |
| created_at | 服务端时间 |

每条用户消息最多 9 张。浏览器上传 API 鉴权后，管理客户端只写 assistant-chat-images 桶；元数据归属验证仍基于会话。文件内容和 MIME 一致校验，upsert=false。消息内 URL 必须对应当前会话已有上传记录，不接受任意用户注入的远程 URL。

公开桶意味着 URL 公开可读，不声称具有私有工单图片权限。淘汰或退出清理无引用对象与元数据；失败孤儿记录保留可离线处理。既有工单及私有图片不受本清理影响。

## 工单搜索结果

查询条件：number、keyword、location、status、severity、scope（visible/created_by_me/assigned_to_me）。用户、项目由数据库从会话派生。number 存在时优先查编号。其他条件参数化组合；“已结束”对应 completed/rejected，“我的”由角色解释，管理员先追问。

搜索返回 total、hasMore、items，items 最多 20，紧急优先、时间倒序、编号稳定排序。items 复用完整详情 DTO（含处理记录、当前责任人等），RLS 不允许的记录不能进入结果。详情照片只保留同源鉴权引用，不转换成公开聊天图片。

## 状态转换

客户端：ready → submitted → streaming → ready；任一步失败进入 error，保留输入和已有消息，可 regenerate。
服务端：身份验证 → 会话归属/版本验证 → Agent stream → onEnd(completed) 保存并递增 revision；failed/aborted 不宣称成功。模型成功但快照保存失败时明确提示本轮未保存，不假装刷新可恢复。
退出：清空快照和本会话图片引用 → 撤销身份 → Auth local signOut → 登录页；失败保留现有退出错误处理。
