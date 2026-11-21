# 数据模型：草稿、确认与独立图片

## 既有数据

保留 assistant_sessions（Auth session + membership、UIMessage[]、revision）、assistant_uploads、work_orders、work_order_records、work_order_photos。现有照片表 work_order_id 非空，不用它保存未建单草稿，不为草稿预建占位工单。

## assistant_order_drafts（新增，名称为规划）

| 字段 | 约束 |
| --- | --- |
| id | 服务端生成UUID |
| session_id | 当前业务会话外键，退出后未提交草稿失效 |
| membership_id、project_id、creator_id | 服务端从有效身份派生，不接受客户端或模型指定 |
| source_message_id | 当前轮user UIMessage.id，由请求上下文提供，同会话同轮唯一 |
| description、location | trim后非空，复用现有字段约束 |
| severity、discipline | 既有枚举，四项齐全才创建草稿 |
| details | 可空 |
| assignee_id | 可空；确认必须为当前项目有效施工方 |
| selected_upload_ids | 本会话聊天附件ID，不存任意远程URL |
| selected_photo_ids | 私有草稿附件ID，与聊天选图合计最多9张 |
| revision | 非负整数；保存、取消、确认核对expectedRevision |
| status | editing/cancelled/expired/created；submitting只是客户端进行态 |
| work_order_id | 唯一创建结果，不能随会话级联删除 |
| receipt_message_id | 稳定成功消息ID，重试不重复追加 |
| created_at、updated_at | 服务端时间 |

部分唯一约束限制同session最多一个editing。准备工具重复同轮返回已有草稿，不覆盖人工编辑；其他轮已有编辑草稿时提示先完成或取消。状态为 editing → created/cancelled/expired，终态不再编辑。先校验身份和归属，再对created重试返回既有结果；编辑态严格核对版本。

## assistant_draft_photos（新增）

字段：id、draft_id、object_path（唯一）、mime_type、size_bytes、original_name、source_upload_id（可空）、state(staged/attached/removed)、created_at。位于私有work-order-photos桶随机草稿路径，不含工号姓名；JPEG/PNG/WebP，每张1～10485760字节。

卡片新图经鉴权上传到私有暂存对象，预览通过本应用逐次鉴权及no-store读取。聊天选图根据当前session元数据取得固定桶/path，服务端读取原文件并上传至私有路径，禁止抓取任意客户端URL。管理密钥仅操作鉴权后固定桶字节，不操作业务行或聊天快照。

draft_id + source_upload_id唯一，重试复用已完成复制，不用upsert覆盖。确认RPC校验storage.objects实际对象与MIME/大小，原子向work_order_photos插入正式关联并标记attached。正式照片无草稿级联删除。

Storage与SQL不在同一事务：先暂存，再单事务关联；SQL失败保留暂存可重试，不先建单再补图并报告完整成功。取消/退出清理仅处理无正式工单引用的暂存，失败留离线清理记录，不增调度器；锁草稿避免清理与提交竞态。

## 权限与受控事务

- 暴露表全部RLS，按当前有效Auth session唯一membership归属读取；普通账号不能直接写。
- 延续项目模式：公开security invoker包装调用私有受控函数；必要security definer固定空search_path，显式复核会话、角色、项目，撤销PUBLIC/anon权限，仅授权必要authenticated调用。
- 草稿prepare/read/save/cancel/expire、图片register/discard、create_from_draft均为最小RPC，不接受任意SQL、owner或project注入。
- 创建锁定会话及草稿，锁顺序与保存/关闭一致；核对session revision、draft revision、当前施工方、五项必填、所选附件及草稿所在轮仍有效，再原子写入pending/version=1工单、created记录、附件、草稿终态和稳定成功消息，任一失败回滚。
- 同草稿重复确认先返回已成功结果，不重复创建或追加回执。退出及旧流保存与确认共用会话锁/revision，防止迟到响应复活会话或覆盖确认结果。
- 正式工单不受会话清理级联；原工单RLS、转派失权、私有图读取保持。

## 知识结果

不新增知识记忆表。输入query为trim后非空、最多4000字精练主题；输出ok+Markdown，或unavailable/empty+中文提示。来源保留原Markdown，不编造结构化来源字段。SDK工具parts随最近六轮UIMessage[]保存；Coze会话/用户标识不作为可恢复句柄持久化。
