# 数据模型：阶段 3 工单处理闭环

日期：2026-10-29。以下增量已应用到云端，实际迁移列表见 verification.md。

## 1. work_orders 增量

增加 `version integer not null default 1 check(version>0)`；所有有效业务修改递增一次。其余字段沿用阶段 2；不新增重复的当前拒绝原因或处理周期表。

- 详情增加 version；工单内部 UUID 只在数据库与存储函数间解析，客户端仍通过编号定位。
- completed 必须有非空 root_cause；pending/rejected 的 root_cause、prevention 必须为空；继续沿用既有约束。
- 必填文字 trim 后非空，选填空白转 null。客户端和数据库都校验枚举与必填。
- 上传准备、取消暂存和 no_changes 不递增工单版本；照片关联变化和文字变化合并为一次 edited。

## 2. work_order_records 增量

沿用 id、work_order_id、actor_id、occurred_at、action、reason、changes、root_cause、prevention。

- action 仍为 created/edited/resolved/rejected/assigned/reopened。
- reason 在 rejected/assigned/reopened 必填；resolved 保存本次 root_cause 和 prevention。
- changes 仍为 `{字段:{before:string|null,after:string|null}}`，只保存实际改变项；白名单补入 photos。
- photos 前后值采用有序的“图片 UUID + 原文件名”文本摘要，展示时作为纯文本处理；不包含可访问外链或依赖已删除文件的预览。
- 保留既有旧记录，不回填虚构变化；操作人、时间由数据库生成，不接受客户端传值。
- 无需要新增 request_id 表；expectedVersion 加行锁保证同一版本至多成功一次。响应丢失后的确认流程见契约。

## 3. 新表 work_order_photos

| 字段 | 类型与规则 | 用途 |
| --- | --- | --- |
| id | UUID 主键，受控预留函数生成 | 图片对外标识 |
| work_order_id | UUID，关联工单，非空，索引 | 权限归属 |
| object_path | text 唯一，非空 | 随机且不可变的 Storage 对象键 |
| original_name | text，非空 | 纯文本显示及变化摘要 |
| mime_type | text，限 image/jpeg、image/png、image/webp | 预留声明，提交时与存储元数据核对 |
| size_bytes | integer，1～10485760 | 声明大小，提交时核对对象实际元数据 |
| uploader_id | UUID，关联 profiles，非空 | 上传归属 |
| upload_session_id | UUID，非空，不外露 | 绑定预留的真实 JWT 会话，不能由客户端声明 |
| state | text，staged/attached/removed | 区分上传与正式业务保存 |
| position | integer，可空，attached 时非负 | 工单照片顺序 |
| created_at | timestamptz，默认当前时间 | 暂存过期依据 |

对象键固定为 `工单UUID/图片UUID.规范扩展名`，由服务器生成，原文件名不能参与路径。upload_session_id 不设删除会话时级联删照片的外键，否则退出会话可能损坏正式图片；仅用于验证 staged 上传归属，attached 读取不依赖原上传人会话。

约束：attached position 非空，单工单 attached 位置唯一（可使用部分唯一索引）；9 张上限在锁定工单的提交函数中校验。保存时检查照片 ID 无重复、属于同一工单、新增照片属于本会话且暂存未超 24 小时，并确认 storage.objects 中对象存在且大小/MIME 相符。现有 attached 图片可由当前编辑者保留，无需与原上传者相同。

排序仅按当前编辑列表保存，不额外提供拖拽排序需求。 removed 不重新关联；删除的旧图片信息通过记录保留。正式读取只返回 attached；staged 通过本地 File 预览，不提供远程暂存读取入口。

## 4. Storage 与 RLS

- 桶 `work-order-photos`：public=false；10 MiB，允许三类 MIME。
- photos 表开启 RLS，authenticated 只授予必要列 SELECT（不含 upload_session_id），策略为 state=attached 且 private.can_read_work_order(work_order_id)。无普通直接写权限。
- work_orders、work_order_records 保留已有 SELECT/RLS，无 authenticated INSERT/UPDATE/DELETE。
- Storage INSERT：对应 staged 元数据、本次上传者和真实会话匹配、24 小时内、当前仍有待处理编辑权限；只允许预留的精确路径，upsert=false，不开放 UPDATE。
- Storage SELECT：必须是 storage.object.get_authenticated 或其认证信息读取 object.get_authenticated_info/object.head_authenticated_info，且元数据 attached、当前身份能读工单；禁止 sign/sign_many、公开访问、替换与其他读取旁路。
- Storage 不授予业务 DELETE；正式删除是数据库事务内 state=removed，物理文件由离线辅助清理，避免通过 SDK 删文件破坏取消和记录一致性。
- RLS helper 位于 private，固定 search_path，最小显式执行授权；读取 helper 本身不能返回超出当前身份的数据。
- 清理脚本使用现有离线密钥，先检查 removed 或过期 staged 且没有 attached 引用，再走 Storage API 删除；保留历史记录摘要，不直接改 storage.objects。无运行时管理密钥、队列或定时器。

## 5. 状态机及原子步骤

| 动作 | 前置 | 工单变更 | 记录 |
| --- | --- | --- | --- |
| edited | pending + 发起质检员/当前施工方/管理员 | 六类问题字段，照片关系，version+1 | 问题字段与照片前后变化 |
| resolved | pending + 当前施工方/管理员 | completed，写新归因/建议，version+1 | 状态变化、本次完整结果 |
| rejected | pending + 当前施工方/管理员 | rejected，当前归因/建议为空，version+1 | 状态变化、拒绝原因 |
| assigned | pending + 当前施工方/管理员 | 新施工方，version+1，状态不变 | 前后责任人、指派原因 |
| reopened | completed/rejected + 发起质检员/管理员 | pending，清空归因/建议，version+1 | 状态和结果字段变化、重开原因 |

每次写函数先验证会话，按编号锁工单，锁后验证唯一身份、可读范围、动作资格、版本；按动作白名单构造新值；验证候选或照片；比较有效变化；更新工单/照片并插入记录；提交返回摘要。任一步失败整体回滚。Storage 上传在此之前单独完成，不声称文件系统和数据库支持跨系统事务。

资格不能仅按用户 ID 关系判断：拥有发起人 ID 的施工方身份仍只能访问当前负责工单，并且不能重开。

## 6. DTO 与兼容

- `WorkOrderPhoto = {id,name,url}`，url 为同源 `/api/work-orders/{number}/photos/{photoId}`；照片顺序由数组表达。
- WorkOrderSummary.photos 从 string[] 改为 WorkOrderPhoto[]，列表有图显示首图，无图维持空状态。
- WorkOrderDetail 增加 version:number、allowedActions:('edit'|'resolve'|'reject'|'assign'|'reopen')[]；其余阶段 2 字段保持。
- 候选仅 `{id,name,employeeId,department}`，不返回完整成员表或认证邮箱。
- 转派和详情读取用内部 profile UUID 对应施工方，不用成员关系 ID 混淆责任人字段。


实施校验补充：图片上传 cacheControl 必须为 `0, no-store`，数据库关联时核验 Storage metadata.cacheControl=`max-age=0, no-store`；普通 SELECT 仅开放必要展示和读取列，不开放 upload_session_id。应用下载附随机 cacheNonce 和 no-store。Storage 认证元数据读取与下载共享相同的工单权限，签名操作不在允许列表内。
