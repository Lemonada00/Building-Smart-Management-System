# 实现计划：阶段 4 管理员工作台

**分支**：实际 Git 分支为 `master`；setup-plan 返回的 `004-admin-workbench` 为功能标识，没有切换分支。

**日期**：2026-10-29 | **规范**：[spec.md](spec.md)

## 摘要

新增 `/admin/work-orders` 与 `/dashboard` 两个明确路由，替代通配路由的占位展示。中心通过五类组合条件查询当前项目全部匹配工单；大盘展示项目资料、全量状态统计及仅待处理风险，并通过同一套 URL 条件构造函数下钻。复用现有 AppShell、详情抽屉、独立详情页、处理动作和私有图片。

数据使用当前用户 SSR 客户端调用两个新增只读 RPC，返回单个 JSON 对象，数据库内完成过滤、完整数量及聚合。不新增表、不新增服务、不安装依赖，不修改既有业务写入规则。计划阶段不修改云端。

## 技术上下文

- **语言与版本**：TypeScript 严格模式；Next.js 16.4.3、React 19.3.0，版本来自 package.json。
- **主要依赖**：Tailwind CSS 4、已有 shadcn/ui 与 Radix、lucide-react；Supabase JS 2.118.0、SSR 0.12.7。沿用 npm 及 lockfile。
- **存储**：现有 Supabase PostgreSQL，复用 projects、work_orders、处理记录及身份私有函数；私有图片存储沿用阶段 3。
- **验证**：人工核心路径走查及 `npm run check`；不编写自动化测试，不增加构建、部署或专项验收。
- **平台与类型**：响应式 Web 单体应用；1440px 桌面、390px 手机，已有 1024px 详情抽屉分界。
- **性能目标**：满足规范中 1 分钟内识别风险和一次点击定位；小规模预置演示数据，无新增并发或吞吐指标。
- **约束**：当前会话唯一身份、项目隔离；无服务端管理密钥参与普通读取；不跨请求缓存用户业务数据；数据库内拒绝非管理员调用。
- **规模与范围**：两个管理页面、两个只读 RPC、五类筛选、9 个指标入口；已有两个模拟项目、16 张工单，验收前重新读取实际数据，不写死数量。

## 宪章检查

| 原则 | 研究前检查 | 设计后检查 |
| --- | --- | --- |
| MVP 范围优先 | 通过，仅阶段4 | 通过，不增加导出、趋势、成员管理、AI、部署 |
| 核心路径正确 | 通过，定义筛选、指标、干预、权限走查 | 通过，契约覆盖口径与刷新及返回 |
| 直接简单实现 | 通过，复用既有闭环 | 通过，两只读RPC，无新表和架构 |
| 最小验收门槛 | 通过，人工及默认检查 | 通过，不增加测试套件或专项 |
| 中文文档 | 通过 | 通过，新增设计文档全部中文 |

无门禁失败，无需复杂度例外。

## 项目结构

### 本阶段文档

```text
specs/004-admin-workbench/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/admin-workbench.md
├── quickstart.md
└── tasks.md                     # 30项已实现并验收
```

### 应用变更位置（计划）

```text
app/(workspace)/admin/work-orders/page.tsx  # 新增中心，独立服务端鉴权
app/(workspace)/admin/work-orders/loading.tsx
app/(workspace)/admin/work-orders/error.tsx
app/(workspace)/dashboard/page.tsx          # 新增大盘，独立服务端鉴权
app/(workspace)/dashboard/loading.tsx
app/(workspace)/dashboard/error.tsx
app/(workspace)/work-orders/[number]/page.tsx # 管理员返回条件
components/admin/work-order-filters.tsx
components/admin/work-order-table.tsx       # 窄屏卡片与宽屏表格，复用抽屉
components/admin/dashboard.tsx
lib/admin/types.ts                         # DTO、条件规范化与URL构造
lib/admin/queries.ts                       # server-only，只读RPC
lib/auth/types.ts                          # safeTarget 管理查询白名单
components/app-shell.tsx                   # 必要时关闭管理数据预取，导航为裸路径
app/globals.css                           # 局部管理样式
supabase/migrations/                       # 实施时生成增量只读RPC迁移
```

现有 `app/(workspace)/[...section]/page.tsx` 保留助手及未知页面处理，明确路由接管管理页面。已有 `components/work-orders/`、`app/actions/work-orders.ts` 和详情读取接口继续复用。只在实际需要处修改，保留工作区既有未提交内容。

## 阶段 0：研究结论

详见 [research.md](research.md)。已确认现有身份私有函数、工单RLS、姓名获取辅助函数及 JSON RPC 模式；已核实普通列表主动拒绝管理员，不能直接拿来作管理中心。当前详情页的管理员返回链接会丢失筛选，须补齐白名单回跳。无待澄清项。

## 阶段 1：设计

1. 在实施开始时重新查询云端表、函数及权限，与仓库迁移核对；只读核对后建立增量迁移，不覆盖旧迁移。按 Supabase 技能生成迁移文件，不能虚构时间戳。
2. 新建 `list_admin_work_orders` 与 `get_admin_dashboard`，均为 `stable security invoker`，固定空 search_path，显式校验 current_membership/current_role/current_project，限定项目且保留工单RLS；撤销 PUBLIC/anon 执行，仅授予 authenticated。姓名通过已授权、会复核工单权限的 private.work_order_people 获取，不能直接 join 仅允许本人读取的 profiles 后得到缺失姓名。
3. 中心 RPC 返回完整匹配数组和 total，SQL 内统一过滤、排序、聚合；大盘 RPC 一次查询生成三状态与待处理风险，空值归零。单个 JSON 标量复用项目已有方式，避免按返回行数上限截断集合后统计。不建设分页框架；演示范围之外的大量数据性能不作承诺。
4. 页面先 `requireIdentity` 再检查 admin，读取层再次检查，RPC 最终复核。URL 为已生效筛选唯一来源，表单草稿单独保留。搜索提交后导航，显示 pending；清空和菜单导航使用裸中心路径。
5. 桌面表格与窄屏卡片共用数据、链接及抽屉状态；抽屉放在结果是否为空的分支外，避免最后一条工单移出结果后详情被卸载。操作成功刷新当前中心，详情沿用既有重新读取行为。
6. 独立详情仍使用 `/work-orders/[number]`，附带编码后的 returnTo；只接受 `/admin/work-orders` 及五项规范化条件，其余丢弃。更新 safeTarget 允许这些管理查询及详情回跳经过登录保存；非管理员不使用管理返回目标。
7. 用户业务读取不使用持久服务端缓存。大盘每次进入/重新查询读取当前数据，链接禁预取；若路由复用已有客户端状态，进入时刷新并提供显式刷新按钮。实现时验证操作后离开再进入，不能只假定 router.refresh 会刷新其他路由或服务端缓存。
8. 大盘使用现有样式、卡片、数值和 CSS 分布条，不引入图表依赖；四风险和三状态全部保留零值入口。

## 交付与下一步

已完成30项任务、两个只读云端迁移及页面实现，核心路径与npm run check通过，见verification.md。新增components/admin/denied.tsx、read-error.tsx、refresh.tsx完成权限、错误和刷新；app/actions/work-orders.ts在成功写入后使中心与大盘缓存失效。种子准备补充scripts/seed-admin-empty-project.mjs供真实空项目验收，原有两项目工单不变。下一步准备模型及Coze资料推进阶段5。
