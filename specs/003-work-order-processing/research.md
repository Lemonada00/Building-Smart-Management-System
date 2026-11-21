# 研究记录：工单处理闭环

日期：2026-10-29。范围：确定足以实现阶段 3 的具体方案，不执行数据库变更。

## 现状核对

- package.json 与代码确认使用 Next.js 16.4.3、React 19.3.0、Supabase JS 2.118.0、SSR 0.12.7；当前 Node 为 v24.20.0。
- 云端只读查询确认 PostgreSQL 17.11；work_orders 无版本字段；work_order_records 的 changes 有允许键约束；Storage 桶为空。
- 当前 profiles、project_memberships RLS 仅能读本人；不能通过放宽这两张表读取权限来实现转派候选。
- 当前唯一身份来自 private.current_membership()，已经联查有效会话、成员与项目；本阶段必须复用。
- 当前 photos 是空 string[]；detail.tsx 是纯展示，drawer 独立 fetch。必须统一照片 DTO，并由共享控制器承载表单。
- setup-plan 输出 BRANCH=003-work-order-processing，但 git branch --show-current 仍为 master；按实际记录，不声称脚本创建了分支。

## 决策 1：一次业务命令在一个数据库事务提交

**选择**：public 的 SECURITY INVOKER 包装进入 private 的 SECURITY DEFINER 受控函数。只为 authenticated 显式授权执行，撤销 PUBLIC/anon 默认授权，search_path 为空并完全限定表名。私有函数本身也必须核验身份与动作，不能假定只能经包装访问。

**理由**：当前业务表没有普通账号写权限；封装窄命令才能同时约束字段、状态和历史记录。受控提权只为完成这一原子命令，不用于修补读取权限。资格按当前角色检查，而非简单判断 creator_id/assignee_id 相等。

**替代方案**：前端依次 update/insert 会部分成功；开放通用表写权限会绕过记录；引入 ORM 或新后端增加维护成本。

## 决策 2：行锁与整数版本处理并发和重复提交

**选择**：work_orders.version 从 1 开始；提交带 expectedVersion；锁定后重验权限、状态、版本，变更成功版本加一；no_changes 不写记录或递增。

**理由**：状态不变的编辑/转派也需要冲突检测；仅比较状态无法拒绝旧编辑。网络结果不确定时以同一版本重试，不允许自动换成新版本再提交。

**替代方案**：仅禁用按钮不能约束网络重试；独立幂等表不必要，版本已保证至多一次变更。冲突时用户核对最新记录确认上次是否成功，不把冲突伪报成功。

## 决策 3：图片直传暂存、关系事务提交

**选择**：私有桶 work-order-photos。小型 Server Action 预留 photoId/path；浏览器会话使用 upload(upsert:false) 直传；保存时验证 storage.objects 元数据与预留一致，统一关联/移除照片。选择与缩略图初始保留浏览器 File/Object URL。

**理由**：文件不经过 Server Action 的默认 1 MB 请求体限制；支持规范要求的 10 MiB。上传成功并不代表已经保存业务图片。

**替代方案**：在编辑时立即删正式文件会破坏取消；通过应用代理上传大文件增加请求体限制问题；本轮演示使用标准上传与可见重试，暂不引入断点续传依赖。官方建议大文件考虑可恢复上传，但不要求为最多 10 MiB 的 MVP 新建该能力。

**失败/清理**：元数据状态为 staged/attached/removed；失败保持 staged 供当前流程重试。取消将预留失效，正式关系不变；浏览器丢失的暂存 24 小时过期。业务移除立即阻断读取，物理文件由离线 seed 辅助清理，先查无关联再走 Storage remove，禁止直接 SQL 删除 storage.objects。清理失败不撤销已成功业务编辑，不建设定时任务。

## 决策 4：图片请求即时校验并阻止签名绕过

**选择**：同源 GET 返回文件流、Cache-Control: private,no-store，使用用户会话 download。Storage SELECT 使用 storage.allow_any_operation(ARRAY['storage.object.get_authenticated','object.get_authenticated_info','object.head_authenticated_info']) 并关联 attached 元数据和 private.can_read_work_order；staged/removed 不可下载。不开放 sign/sign_many、公开读取、更新对象或已关联对象删除。

**理由**：仅应用不生成签名链接仍不够，拥有一般 SELECT 的用户可能直接请求签名。当前云端已存在 operation helper；其文档支持按 Storage 操作限制授权。图片不经过 Next Image 优化缓存，采用普通 img 或 unoptimized。

**替代方案**：短期签名地址仍存在失权窗口；公开桶不满足权限；服务端管理密钥代理不符合项目普通请求使用会话的约定。

**限制**：已下载字节无法撤回；转派提交后的新请求必须拒绝。实施时须真实核验下载成功、签名拒绝与退出后旧 JWT 拒绝；不能只验证 helper 函数存在。

## 决策 5：候选、详情和输入状态复用

**选择**：窄候选 RPC 只在有权指派待处理工单时返回当前项目活跃施工方的 id/name/employeeId/department，排除当前责任人；候选提交时再次校验。详情带 version、allowedActions 和照片对象，前端共享控制器复用编辑/弹框。

**理由**：不放宽人员表 RLS，不信任客户端权限。成功后抽屉显式重读，router.refresh 更新列表；失权转派返回成功摘要，不再把读不到详情当作写入失败。

**替代方案**：全项目成员接口超出需求；分别实现页面和抽屉表单会产生规则分叉。

## 官方资料与适用结论

Context7 已按名称与描述检索，当前会话无 resolve-library-id/query-docs 工具；不编造 ID。按项目查阅顺序使用以下资料。研究代理独立检查数据库写入与照片边界，合并其发现的 changes 白名单和候选读取限制。

- 已安装 Next.js：node_modules/next/dist/docs/01-app/02-guides/server-actions.md；确认 Action 必须自行鉴权、默认请求体限制，供“小请求命令、大文件直传”决策使用。
- 已安装 Next.js：node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md；确认 Route Handler 可提供同源读取；不为图片开启缓存。
- [Supabase 数据库函数](https://supabase.com/docs/guides/database/functions)：支持 invoker/definer 的权限分工；显式授权、空 search_path 不能代替业务资格判断。
- [Storage 访问控制](https://supabase.com/docs/guides/storage/security/access-control)：私有桶与 storage.objects RLS 控制下载、上传等操作。
- [Storage 操作辅助函数](https://supabase.com/docs/guides/storage/schema/helper-functions)：按具体 Storage 操作限制 SELECT；云端只读检查已确认 helper 存在。
- [Storage 官方操作名称](https://github.com/supabase/storage/blob/master/src/http/routes/operations.ts)：核对 get_authenticated 与 sign 为不同操作。
- [Storage 文件服务](https://supabase.com/docs/guides/storage/serving/downloads)：签名地址到期前不会随普通身份变化失效，因此不用于本功能。
- [标准上传](https://supabase.com/docs/guides/storage/uploads/standard-uploads)、[可恢复上传](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)：本轮选择标准直传，失败显式重试。
- [PostgreSQL 行锁](https://www.postgresql.org/docs/17/explicit-locking.html)：在短事务锁定目标工单，上传网络等待必须放在事务外。
- [Supabase Changelog](https://supabase.com/changelog)：markdown 索引获取失败，已改读官方页面。与本阶段直接相关的[新表显式授权变更](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)要求新增表、函数权限写入迁移，不能依赖默认授权；不顺带修改项目全局默认权限。

## 研究完成条件

所有技术未知项已形成明确设计，无 NEEDS CLARIFICATION。云端检查仅为当日现状证据，实施迁移前仍要重新核对。没有运行迁移、写入工单或改变桶配置。


## 实施补充（2026-10-29）

实际云端 Storage 1.80.2 下载路径还会使用认证文件信息操作；在明确工单权限条件下只补充 get_authenticated_info/head_authenticated_info，签名操作仍拒绝。普通照片元数据 SELECT 不含 upload_session_id。上传及关联核验要求 cacheControl 为 max-age=0, no-store；应用同源图片接口先查当前工单权限，再以随机 cacheNonce 和 no-store 读取 Storage。新保存照片不以可复用签名 URL 展示。

底层存储或用户设备已经取得的缓存字节不能撤回；验收使用应用图片 URL 和新的认证源站请求核对权限，直接复用曾下载过的 Storage URL 可能得到已有边缘缓存，不能作为新授权成功的证据。此限制不影响应用同源接口在转派/退出后的新请求失权。

编辑表单位于问题信息区，基础信息、处理结果及历史继续只读；操作入口位于详情内容顶部，避免历史记录较长时难以发现。
