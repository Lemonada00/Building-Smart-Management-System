# 实施任务：阶段 4 管理员工作台

**输入**：本目录的 spec.md、plan.md、research.md、data-model.md、contracts/admin-workbench.md、quickstart.md。

**日期**：2026-10-29。30项已完成，实际验收见 verification.md。

**组织方式**：按故事优先级实施，P1 的权限故事 US4 提前完成，再推进 US1、US2，最后 P2 的 US3。故事编号保持与规范一致。

**验收方式**：必要人工走查和 `npm run check`。不新增自动化测试、覆盖率、无障碍专项、构建或部署任务。

## 格式与路径约定

任务使用 `- [ ] T编号 [P可选] [US编号可选] 描述及路径`。路径相对项目根目录；实际执行文件操作时使用绝对路径。[P] 仅表示依赖完成后，不同文件上的工作可并行，不是启动子代理的指令。

两个迁移文件不预编时间戳：T003 使用已核实的 Supabase CLI `migration new admin_work_order_center` 生成文件，并把实际完整路径记入 research.md，后续称“中心迁移文件”；T017 同理生成 `admin_dashboard` 的“大盘迁移文件”。相关任务中的 `supabase/migrations/20261029133142_admin_work_order_center.sql`、`*_admin_dashboard.sql` 唯一指代上述工具生成文件，执行后必须替换为实际文件名。不修改旧迁移。

## 阶段 1：准备

**目标**：确认既有工作区、资料及云端，不重复初始化项目。

- [X] T001 读取 progress.md、AGENTS.md、package.json 及本阶段全部设计文档，检查 Git 未提交边界与现有 app/(workspace)/、lib/work-orders/、components/work-orders/，将实施基线及实际分支记录在 specs/004-admin-workbench/research.md，保留阶段1～3已有改动，不重装或升级现有依赖。
- [X] T002 查阅适用 Supabase 技能和当前文档（优先可用Context7），补读此前受限的变更索引；重新只读核实云项目 lvwlxhgsixyrcpdnbgpg 的项目资料字段、会话私有函数、工单RLS、人员辅助函数、权限及迁移状态，与 supabase/migrations/ 对照，将事实、文档来源或实际阻塞写入 specs/004-admin-workbench/research.md，不依据旧健康检查判定云端。
- [X] T003 在T002完成后通过CLI帮助确认迁移命令，用工具生成 supabase/migrations/20261029133142_admin_work_order_center.sql，将实际文件路径写入 specs/004-admin-workbench/research.md；此时只准备本阶段增量文件，不应用占位SQL、不覆盖历史迁移、不输出凭据。

## 阶段 2：共用基础（阻塞所有故事）

**目标**：固定共享读取类型、条件及链接语义，避免普通列表筛选污染管理中心。

- [X] T004 在 lib/admin/types.ts 定义 AdminFilters、AdminWorkOrderRow、AdminListResult、AdminDashboard，复用既有枚举及Person；落实“pending / completed / rejected / 未选”“minor / normal / major / urgent / 未选”“architecture / structure / plumbing / 未选”“非法值视为未选”，关键词“trim，空字符串视为未选；普通文本包含匹配”，编号“trim并去前导#，合法正整数按parseNumber；非空非法输入保留为无结果条件”，复用1～2147483647整数边界；落实“重复查询参数采用第一项；未知参数忽略”“全部条件取交集，空条件不限制”，并生成编码后的中心URL及指标链接。
- [X] T005 在 lib/admin/types.ts 完成DTO约束：Row九列所需字段全部存在，Result满足“total: 非负整数”“total = items.length”；Dashboard包含project五字段、三状态和待处理四风险、pendingUrgent，落实“total = 三状态之和；statuses.pending = 四风险之和；无记录必须显式返回所有零值”及pendingUrgent等于pendingSeverities.urgent，不引入新持久实体或状态。

**检查点**：类型、规范化及URL构造就绪，后续故事使用同一契约。

## 阶段 3：用户故事 4 — 限制身份及项目范围（P1）

**目标**：先建立页面、读取层及数据库边界，禁止先实现无权限限制的数据读取。

**独立验收**：两个管理页面的非管理员直达被拒绝；当前admin可进入；普通身份不能借同账号其他角色越权，验证记录写入本阶段 verification.md。

- [X] T006 [US4] 在 app/(workspace)/admin/work-orders/page.tsx 与 app/(workspace)/dashboard/page.tsx 建立明确路由骨架，分别使用requireIdentity后检查当前role为admin，复用AppShell和中文无权限返回入口；保留 app/(workspace)/[...section]/page.tsx 的助手行为，不把其他角色引导到可读取管理员数据的路径。
- [X] T007 [US4] 在 lib/admin/queries.ts 建立server-only当前admin校验及每请求SSR客户端，拒绝无登录、无身份及非admin；不接收projectId/userId/role指定权限，不使用管理密钥或跨请求业务缓存；后续两个读取函数必须进入此边界。
- [X] T008 [US4] 在 supabase/migrations/20261029133142_admin_work_order_center.sql 编写 list_admin_work_orders 的函数骨架和完整权限门槛：stable security invoker、空search_path、校验current_membership/current_role/current_project、显式当前项目约束，撤销PUBLIC/anon执行仅授予authenticated；复用已有RLS及private.work_order_people，不放宽profiles策略；本任务不应用未完成函数。
- [X] T009 [US4] 人工检查 lib/auth/types.ts 的菜单角色、两个页面及 lib/admin/queries.ts 对匿名/未选身份/质检员/施工方/多身份的拒绝路径，在 specs/004-admin-workbench/verification.md 记录实际结果；新RPC直接调用与跨项目数据核验留T016及T022，不能在此提前声明通过。

**检查点**：授权骨架具备独立走查条件；数据库数据隔离最终随各RPC实施核验。

## 阶段 4：用户故事 1 — 筛选项目工单（P1，首个可演示增量）

**目标**：完整管理中心可按五类条件定位工单，具备响应式结果和真实数量。

**独立验收**：每类单项、至少两组组合、非法及空条件、清空、完整字段、稳定排序均正确；其他项目不可见。

- [X] T010 [US1] 完成 supabase/migrations/20261029133142_admin_work_order_center.sql 的 list_admin_work_orders(p_status,p_severity,p_discipline,p_keyword,p_number)，五参数text默认null；lower/strpos匹配description/location/details，编号验证后再转整数，非法非空编号返回零条；同一集合生成完整items和total，created_at desc、number desc，不限行截断；使用private.work_order_people返回creator/assignee姓名，不直接join受本人RLS限制的profiles。
- [X] T011 [US1] 审查并应用T010增量迁移，在 lib/admin/queries.ts 实现listAdminWorkOrders，调用五参数RPC并映射AdminListResult；数据库失败抛出中文可重试错误，不用空列表掩盖失败；将真实云端应用记录写入 specs/004-admin-workbench/research.md。
- [X] T012 [P] [US1] 在 components/admin/work-order-filters.tsx 实现状态、严重程度、专业、关键词、编号五项独立控件，草稿与URL生效条件分离，提供提交pending、结果条件摘要及清空，保留失败输入；使用lib/admin/types.ts构造规范URL，导航直接进入和清空均不带旧条件。
- [X] T013 [P] [US1] 在 components/admin/work-order-table.tsx 实现宽屏九列表格及窄屏同字段卡片，包含编号、状态、严重程度、专业、摘要、时间、责任人、发起人、详情入口；紧急突出、摘要截断、显示total及空结果清空入口，普通详情链接可用，不复制处理逻辑。
- [X] T014 [US1] 在 app/(workspace)/admin/work-orders/page.tsx 集成Promise searchParams、规范化条件、listAdminWorkOrders、筛选及结果；新增同目录 loading.tsx 和 error.tsx 提供中文加载及保留条件的重试反馈，避免数据失败显示0条。
- [X] T015 [US1] 在 app/globals.css 按 design/stitch/16591807519307787618/dfb9f1684b7f45be8559ae1c7cd653e5/code.html 和现有样式完成中心分组筛选、表格及390px卡片布局；在 components/app-shell.tsx 保证管理中心菜单使用裸路径，重新点击导航恢复默认无筛选。
- [X] T016 [US1] 按 specs/004-admin-workbench/quickstart.md 的A及相关D部分人工核对三状态、四严重程度、三专业、描述/位置/详情关键词、编号、组合、特殊字符、清空、全量数量、姓名及排序；同时以真实会话直接调用list_admin_work_orders验证非管理员拒绝及两项目隔离，将结果记入 specs/004-admin-workbench/verification.md。

**检查点**：权限基础与US1可独立演示；暂不把完整阶段标记完成。

## 阶段 5：用户故事 2 — 查看态势并定位风险（P1）

**目标**：项目资料、全量状态、待处理风险和9个指标入口全部一致。

**独立验收**：相同数据基线下三项统计不变量、9个下钻及零值场景全部成立。

- [X] T017 [US2] 用已核实的CLI命令生成 supabase/migrations/20261029133259_admin_dashboard.sql，记录实际路径；实现无参数get_admin_dashboard，复用T008的身份/角色/项目/执行权限模式，以一次查询返回project、total、statuses、pendingSeverities、pendingUrgent；仅待处理计风险，有效空项目归零，身份或项目失效必须拒绝，不造空项目。
- [X] T018 [US2] 审查并应用T017迁移，在 lib/admin/queries.ts 实现getAdminDashboard，复用当前admin边界及SSR客户端，不持久缓存、失败不归零；将迁移及直接调用的实际结果记录到 specs/004-admin-workbench/research.md。
- [X] T019 [P] [US2] 在 components/admin/dashboard.tsx 展示项目四项资料、关键指标、状态概览、四风险CSS分布条及重点紧急区，待处理优先、紧急突出、无紧急明确说明，零值键及入口全部保留，空分布不显示无意义比例；9个入口均复用lib/admin/types.ts生成条件，不附残留搜索。
- [X] T020 [US2] 在 app/(workspace)/dashboard/page.tsx 集成getAdminDashboard和展示组件，新增同目录 loading.tsx 与 error.tsx；提供重新查询反馈，关闭相关链接预取并按需要在 components/admin/dashboard.tsx、components/app-shell.tsx 处理重新进入时刷新，确保读最新数据，不误认为router.refresh会刷新其他路由缓存。
- [X] T021 [US2] 在 app/globals.css 完成1440px和390px大盘布局，沿用白底浅蓝及现有卡片风格，不安装图表依赖；确认状态与风险均有中文口径说明且一次点击即可定位集合。
- [X] T022 [US2] 按 specs/004-admin-workbench/quickstart.md 的B及相关D部分人工核对9个跳转、总数和状态之和、待处理和风险之和、紧急一致、已结束紧急排除、空项目/零紧急，以及get_admin_dashboard非管理员直接调用和跨项目隔离；必要的模拟数据缺口只在 scripts/seed-demo.mjs 及现有种子脚本补齐，保持可重复且不清空已有结果，将基线与结果写入 specs/004-admin-workbench/verification.md。

**检查点**：中心及大盘各自可使用，统计与下钻一致。

## 阶段 6：用户故事 3 — 执行管理干预（P2）

**目标**：复用既有闭环，完整保留筛选，正确刷新列表、详情及重新查询的大盘。

**独立验收**：五类管理员操作、窄屏返回、最后一条移出结果、并发冲突及刷新均通过。

- [X] T023 [US3] 在 lib/admin/types.ts 增加管理详情href及安全returnTo解析，严格落实“返回目标仅保存中心规范化路径及五类条件”；仅接受确切/admin/work-orders，外链、协议相对、反斜杠、嵌套returnTo或其他路径回退裸中心；详情自身status/sort保持普通列表语义，不混入管理条件。
- [X] T024 [US3] 在 lib/auth/types.ts 的safeTarget允许规范化管理员中心五项条件及详情returnTo，在 app/(workspace)/work-orders/[number]/page.tsx 为admin重建带原筛选的返回链接及登录目标，非admin忽略管理returnTo；保留原有普通列表筛选、工单编号和合法站内回跳边界。
- [X] T025 [US3] 在 components/admin/work-order-table.tsx 集成既有DetailDrawer，≥1024px普通单击开右抽屉、窄屏/修饰键沿真实详情链接；以独立状态保存当前工单，抽屉位于空结果分支之外，onUpdated刷新中心并保留URL，不按items或total重挂载详情。
- [X] T026 [US3] 联调 components/admin/work-order-table.tsx、components/work-orders/detail-controller.tsx、app/actions/work-orders.ts 及 components/admin/dashboard.tsx，验证沿用expectedVersion、五操作必填与状态规则、私有图片和处理记录；仅修复当前集成所需问题，不新增管理员写接口；成功更新详情、集合和数量，失败保留输入，重新进入/查询大盘拿最新值。
- [X] T027 [US3] 按 specs/004-admin-workbench/quickstart.md 的C及A返回场景人工完成编辑、解决、拒绝、指派、重开，验证最后一条移出后抽屉仍开、直链/登录后保留条件、安全回跳、普通列表回归、冲突与失败重试，在 specs/004-admin-workbench/verification.md 记录列表/详情/记录/大盘一致性。

**检查点**：四个用户故事集成完成，待最终验收及默认检查。

## 阶段 7：收尾与交付

- [X] T028 按 specs/004-admin-workbench/quickstart.md 汇总最终人工核心走查，确认两项目、三角色、多身份、图片访问、1440px/390px及加载/错误/空值场景；记录SC-001～006的实际结果和未通过项到 specs/004-admin-workbench/verification.md，不把任务或指南当验收证据。
- [X] T029 在项目根目录执行package.json定义的npm run check，修复本阶段阻断问题，将最终命令及结果写入 specs/004-admin-workbench/verification.md；不添加自动化测试、构建、部署或npm audit，不跳过已有提交钩子。
- [X] T030 按实际验收同步 specs/004-admin-workbench/spec.md、plan.md、tasks.md 及 progress.md，填写迁移、核心路径、检查、限制和下一步；目录/入口等长期事实变化时同步AGENTS.md，只有全部必要验收与默认检查通过才勾选阶段4完成；未执行或受阻项保留未勾选及原因。

## 依赖与执行顺序

```text
准备 T001 → T002 → T003
  → 共用类型 T004 → T005
  → US4 T006 → T007 → T008 → T009
  → US1 T010 → T011 → (T012 ∥ T013) → T014 → T015 → T016
  → US2 T017 → T018 → T019 → T020 → T021 → T022
  → US3 T023 → T024 → T025 → T026 → T027
  → 收尾 T028 → T029 → T030
```

- 权限门槛在US4先建立，不能以US4部分最终数据核验位于US1/US2为由跳过授权。
- US1依赖准备、基础和US4；US2的统计展示可独立验收，但完整指标下钻依赖US1中心。
- US3依赖US1中心和共用详情；跨页统计更新核对依赖US2。此前已完成的五操作后端不重建。
- 上图为默认串行顺序。不同故事均修改lib/admin/queries.ts、app/globals.css或同一个迁移文件时必须顺序合并，不机械并行。
- 迁移应用依赖实际云端核对和完成SQL审查，不能将T003/T008骨架作为完成迁移应用。

## 每个故事的并行示例

- **US4**：默认顺序实施；三个授权层有先后且共享边界，不标[P]。页面内容稳定后可同时做不同角色的只读人工观察，但不同时修改会话身份。
- **US1**：T011完成后，T012筛选组件与T013结果组件可并行，二者不同文件且只依赖已固定类型；T014统一集成。
- **US2**：T018完成后，T019纯展示组件可与不修改同文件的T022验收数据基线整理并行；实际下钻、零值和权限验收必须等T020～T021完成。T019标[P]仅表示展示工作可独立开展，不表示验证已完成。
- **US3**：默认顺序实施；安全链接、safeTarget、详情返回和表格抽屉有明确依赖，不虚设并行。T025完成后，桌面与窄屏人工走查可分开进行，最终在T027集中记录，避免并发操作同一工单。

## 实施策略与完整性核对

首个可演示增量为准备和基础、US4授权、US1中心筛选（T001～T016）；在此检查点验证通过后继续US2及US3，不提前宣称阶段4完成。完整阶段交付还要求T028～T030。

FR映射：FR-001由US4及T016/T022数据隔离覆盖；FR-002～006由US1及T023～024覆盖；FR-007～008由US3覆盖；FR-009～012由US2覆盖；FR-013～014分布于各页面状态、样式及最终响应式走查。SC-001对应T016，SC-002对应T022，SC-003对应T027，SC-004对应T009/T016/T022/T028，SC-005～006由T028核对。

共30项：准备3、基础2、US4 4、US1 7、US2 6、US3 5、收尾3。所有用户故事有独立验收标准，所有任务均已完成并勾选，实际核验和中间脚本纠正记录见verification.md。当前无.specify/extensions.yml，不需派发前置或后置钩子。
