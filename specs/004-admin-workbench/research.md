# 研究记录：阶段 4 管理员工作台

日期：2026-10-29。研究范围仅为本阶段最简实现。

## 1. 路由、身份与详情复用

**决策**：新增中心和大盘明确路由，沿用 requireIdentity/AppShell。复用 DetailDrawer、DetailController、既有详情 API 及 Server Actions。

**理由**：当前两个管理菜单已配置，但由 `[...section]/page.tsx` 显示占位；`listWorkOrders` 明确拒绝管理员。既有处理 RPC 已支持管理员及版本校验，重复写操作没有价值。

**备选**：扩展普通列表的 ended/all 模式无法表达单一已完成/已拒绝及五类筛选；建设另一套详情会分叉权限规则，均不采用。

**证据**：lib/auth/types.ts、lib/auth/context.ts、lib/work-orders/queries.ts、components/work-orders/detail-controller.tsx、detail-drawer.tsx。

## 2. 查询、统计完整性与授权

**决策**：增加两个 security invoker 只读 JSON RPC，在数据库执行条件和聚合；中心完整集合与数量一次返回，大盘同一次查询产生所有指标。不新增表或快照。

**理由**：现有 list_work_orders 和 get_work_order 已使用标量 jsonb 返回。中心结果不能受普通行查询上限影响，聚合不能基于某一页；现有RLS可直接约束管理员当前项目。两函数均拒绝非admin，并显式限定 current_project。

**备选**：逐页在服务端拉取所有工单再过滤会增加请求及不一致窗口；多次精确计数可能在操作间产生状态总数不等；新增统计表会引入同步成本，均不采用。

**姓名注意**：profiles 只允许读取本人，不能直接普通 join 获取发起人/责任人姓名；复用 private.work_order_people 的最小授权读取，保留原权限复核。

**证据**：supabase/migrations/20261027132653_app_auth_identity.sql、20261028134223_work_order_query.sql。这里是仓库设计核对，未查询或声明云端当前状态；实施前必须重新核实。

## 3. 筛选、搜索与返回

**决策**：中心URL使用 status、severity、discipline、keyword、number。所有页面与指标使用同一规范化和构造函数。关键词在SQL用 lower/strpos 普通文本包含判断，避免将 %、_ 或逗号当搜索语法。编号去 #、去空格后沿用 parseNumber 正整数范围；有输入但编号不合法时返回空结果，不能变成全部工单。

**理由**：原型是合并搜索，需求明确支持两类，区分控件后语义明确且可组合。现有普通 Filters 默认 pending 且含 ended，不应挪用。独立详情当前管理员返回是裸中心路径，需要附加安全 returnTo。

**备选**：任意URL回跳不安全；只依赖 history.back 在直链和登录后不可控；存储筛选到浏览器会污染从导航进入的默认值，均不采用。

## 4. 刷新与零结果抽屉

**决策**：操作成功保持中心URL并刷新中心；抽屉在空结果分支外。大盘不持久缓存业务数据，禁预取，并提供重新查询；新进入时确保请求服务端新数据。

**理由**：现有普通 list.tsx 在 orders 为空时提前返回，不能直接复制到管理中心，否则最后一条匹配工单处理后抽屉会消失。router.refresh 仅刷新当前路由，不会让其他页面的旧缓存自动失效。

**备选**：实时订阅和跨页面状态仓库超出范围，不采用；不承诺旧大盘在他人操作后实时变化。

## 5. 文档检索与限制

- 已读取本地与 Next.js 16.4.3 匹配的 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` 与 `04-functions/use-router.md`：params/searchParams 为 Promise；refresh 不清除服务端缓存，导航不得使用未清洗URL。
- 已应用 context7-mcp 与 Supabase 技能。工具发现未找到 Context7 resolve-library-id/query-docs，未编造 library id，按项目规则使用本地文档及官方文档回退。
- 官方资料：[数据库函数及权限](https://supabase.com/docs/guides/database/functions)、[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)、[select](https://supabase.com/docs/reference/javascript/select)、[range](https://supabase.com/docs/reference/javascript/range)。文档用于核对函数授权与返回完整性，不引入SDK新特性。
- Supabase changelog.md 的网页读取遇到不支持 text/markdown；终端补读受本地代理套接字限制，未能完成变更索引检查。实施前须补读相关变更记录；本阶段不更改云端或升级依赖，当前设计仅使用仓库既有RPC模式。

全部实现选择已明确，无待用户澄清项。云端核对与变更索引补读列为实施前置步骤，不将历史验收当作当前云端事实。
## 实施基线（2026-10-29）

- 实际分支master，起始未提交项仅progress.md和本阶段specs目录；阶段1～3代码已在当前提交中，不重置工作区。
- 云端重新核实了projects/work_orders字段（含version）、profiles_self/projects_current/work_orders_read策略及四个身份/人员函数；新增管理员函数尚不存在。云端阶段3迁移名与仓库对应，平台应用时间戳存在差异，保留历史原样。
- 当前项目A14张工单（待处理7、完成4、拒绝3），项目B2张（待处理1、完成1），验收以新查询为准。
- Context7工具仍不可用，已读取本地Next 16.4.3 page/use-router文档及Supabase函数/RLS官方文档；本次成功补查 https://supabase.com/changelog ，涉及表显式授权变更，本阶段不新增表，新增RPC显式撤销与授予执行权。
- 本地CLI不在PATH，使用已缓存的supabase.exe；帮助已核实。生成中心迁移：supabase/migrations/20261029133142_admin_work_order_center.sql。无依赖升级；忽略文件已覆盖node_modules、构建、环境及.local，项目不发布npm包，不创建其他无关ignore文件。

- 大盘迁移文件：supabase/migrations/20261029133259_admin_dashboard.sql。两个只读增量迁移已通过云端apply_migration应用；不新增表或放宽策略。
- 真实会话读取核验159项通过：五条件、普通文本特殊字符、全量顺序与姓名、统计与9个下钻、两项目隔离、无身份/匿名/非管理员/多身份/撤销会话拒绝。
- 安全advisors只有原有私有身份表无策略提示和密码泄露保护未启用提示，本阶段新增函数无安全告警。

## 实施完成补充

两个迁移云端应用版本分别为20261029133254、20261029133423。新增空项目使用普通projects/project_memberships预置和正常登录选择身份完成，不改私有认证表或伪造JWT。最终数据为3模拟项目、6账号、10角色关系、16工单，空项目无工单。

实现时补充了成功操作后的revalidatePath（中心、大盘），防止保留的客户端页面重复使用旧结果；中心读取错误在表单下显示重试，保留原条件。实际验证及工具中断恢复见verification.md。
