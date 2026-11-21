# 研究记录：阶段 2

日期：2026-10-28。研究仅涉及本阶段只读查询与展示。

## 1. 当前系统与云端现状

**决策**：复用 private.valid_session()、current_membership()、current_project()，新增 current_role() 从当前 membership 读取角色，不接受客户端提交的身份参数。

**原因**：已读取本地身份迁移及云端函数定义；现有逻辑验证 JWT session_id 对应 auth.sessions、身份未撤销、成员和项目有效。2026-10-28 云端 public 仅 profiles、projects、project_memberships，private 仅 login_identities；分别有 6、2、8 条公共基础数据，均启用 RLS。不能把历史连通检查当业务权限依据。

**替代方案**：合并用户全部角色或把身份放可编辑 metadata，会破坏唯一会话身份约束；新增身份系统无必要。

## 2. 数据与显示姓名

**决策**：普通工单和记录以 SECURITY INVOKER 查询并受 RLS 限定；公共读取 RPC 组织 DTO，必要时调用 private.work_order_people(number) 获得当前可见工单关联人的 id/name。

**原因**：profiles_self 只允许读取本人，直接联表不会返回其他人的姓名。私有函数先验证会话、当前身份和工单可见性，再仅返回该单发起人、当前责任人、历史操作人与变更涉及人员的 id/name；不返回工号、部门、邮箱或其他成员。public 包装函数保持 invoker，所有 private 提权函数固定空 search_path、显式限定 schema、收回 PUBLIC/anon 执行权限，仅授权 authenticated。

**替代方案**：放宽整个项目人员资料会扩大访问范围；在工单重复保存当前姓名导致数据冗余；SSR 使用管理密钥会绕过业务权限，均不采用。

## 3. 区分不存在与无权限

**决策**：详情读取 RPC 先按当前身份执行 RLS 查询；不可见时由 private.work_order_exists(number) 仅返回单编号存在性，用于 not_found/forbidden 区分。

**原因**：RLS 对不可见行返回空集，单靠查询无法区分二者；规范明确需要分别反馈。函数须验证有效会话与身份，只接收一个合法编号，不支持范围、批量、总数或内容返回。存在性这一比特是明确需求下的最小披露。

**替代方案**：统一“未找到或无权限”不满足现有规范；普通服务器持有管理密钥无必要。不存在性检查不能替代授权，不能让受限内容进入响应。

## 4. 页面与详情打开

**决策**：新增明确的 /work-orders 与 /work-orders/[number] 页面；列表项使用真实详情 Link，客户端仅在视口 >=1024px 的无修饰主键点击时阻止导航，打开本地右侧抽屉，通过同源 GET 获取详情。窄屏、新标签和直链正常进入独立页面。断点与现有应用框架一致。

**原因**：不改变现有 catch-all 的未开放模块；宽屏保留列表状态，独立页面分享与刷新自然成立。抽屉与页面复用同一 DTO、读取逻辑和详情内容。

**替代方案**：平行/拦截路由适用于模态导航，但本阶段引入布局槽、默认槽及窄屏分流增加改动；为全部页面重组布局无必要。

## 5. 筛选、返回和缓存

**决策**：URL 保存 status=pending|ended|all、sort=newest|oldest；服务端读取 page 的异步 searchParams 并规范化；客户端导航更新并显示 pending。详情从列表带同名筛选参数，返回时只构造固定站内列表路径，管理员回 /admin/work-orders 占位页。拓展 safeTarget 仅允许合法工单路径与已知查询参数，拒绝外部路径。

**原因**：URL 能保留浏览器返回和刷新语义。每次页面、RPC 和抽屉请求校验身份，不使用 use cache、跨请求结果缓存或静态生成；详情 GET 返回 private, no-store，失败不沿用上一张详情。请求内 React cache 仅允许同一请求复用。

**替代方案**：新增全局状态库、浏览器持久化或按客户端角色过滤，既增加复杂度也不能提供授权。

## 6. 演示样本与迁移

**决策**：沿用 seed:demo，追加固定 UUID/编号的 16 张工单及确定性记录；通过现有服务端管理密钥离线准备，不新增线上写入口。固定 seed_key 识别样本，只替换本阶段标记样本，若编号被非样本占用则停止，不覆盖业务数据。

**原因**：可重复验证且不会重置账号或密码。第二项目可用已有 multi001 管理员发起并作为历史操作人；为其补充仅该项目的 contractor membership，不新建账号。同项目多角色仍按会话选择授权，新增关系须在交付记录更新数量。

**替代方案**：为第二项目引用第一项目施工方违反角色归属；把管理密钥放到正常查询路径违反项目约定；不预建第二套种子框架。

## 资料依据与限制

- 已安装 Next.js 16.4.3：node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md、03-api-reference/04-functions/use-search-params.md、03-api-reference/02-components/link.md；参考服务端 searchParams、真实 Link 导航与请求时 Route Handler。
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)：通过官方 search_docs 查得；RLS 配合 GRANT、TO authenticated、当前身份谓词，提权函数位于非暴露 schema。
- [Supabase 变更记录](https://supabase.com/changelog?types=breaking-change)：markdown 索引访问失败后查官方页面；2026-04-28 公告要求显式授权新表 Data API 访问，计划明确 authenticated SELECT、RLS 与拒绝写入，不能依赖自动暴露。
- Context7 工具不可用，未假定或编造 library id。不升级依赖，不采用本阶段不需要的新 SDK。

所有技术选择已确定，无未解决澄清项；实现前须重新核对云端结构和所用 CLI 帮助，研究记录不是已执行迁移的证明。
