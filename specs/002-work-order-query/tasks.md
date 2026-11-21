# 任务清单：阶段 2 工单数据与查询展示

**输入**：`specs/002-work-order-query/` 内的 spec.md、plan.md、research.md、data-model.md、contracts/read-contract.md、quickstart.md。

**前提**：阶段 1 已验收。28项实施任务已完成；实现与验收依据见 verification.md。

**组织方式**：先准备和共享基础，再按 US1（P1）、US2（P1）、US3（P2）交付。沿用当前依赖，不新建工程或新增通用框架。根据宪章只做必要人工验收与静态检查，不创建自动化测试、覆盖率或无障碍专项任务。

## 格式与路径

任务格式为 `- [X] T编号 [P可选] [US故事编号可选] 描述及文件路径`。路径均相对仓库根目录；[P] 表示满足该节明确前置条件后可在不同文件上并行，不表示跳过依赖。

迁移文件名由实际 CLI 生成。下文 `supabase/migrations/<生成时间戳>_work_order_query.sql` 指 T001 记录的同一实际文件，不得自行编造时间戳或重复创建迁移。

## 阶段 1：准备

**目标**：确认实现依据和迁移入口，不改变阶段范围。

- [X] T001 核对 `progress.md`、`specs/002-work-order-query/` 全部设计及现有身份迁移；读取相关 Supabase 技能与当前官方资料、已安装 Next.js 文档，按 AGENTS.md 优先尝试 Context7（无工具则使用官方资料并记录）；只读重新核对云端表、身份函数和迁移历史，使用可用 Supabase CLI 的 --help 确认并生成 `supabase/migrations/<生成时间戳>_work_order_query.sql`，将实际文件路径及现状记入 `specs/002-work-order-query/verification.md`，不把旧查询当现状。

## 阶段 2：共享基础（阻塞所有故事）

**目标**：建立实体、最小读取权限、只读契约与可重复演示集。T001 完成后开始。

- [X] T002 在 `supabase/migrations/<生成时间戳>_work_order_query.sql` 建立 work_orders，逐项实现 data-model.md 约束：id“uuid 主键”；number“integer，正数，自动生成，唯一”；project_id“uuid，非空，关联 projects”；creator_id、assignee_id“uuid，非空，关联 profiles”；created_at“timestamptz，非空，默认当前时间”；status“text，非空，默认 pending”；severity、discipline“text，非空”；description、location“text，非空且 trim 后非空”；details、root_cause、prevention“text，可空”；seed_key“text，可空且唯一”。枚举严格使用模型所列全部值；落实“待处理和已拒绝的当前归因/建议为空；已完成必须有非空归因”，添加编号唯一及项目/发起人、项目/责任人索引，不创建图片存储或业务删除入口。
- [X] T003 在同一 `supabase/migrations/<生成时间戳>_work_order_query.sql` 建立 work_order_records：id“uuid 主键”，work_order_id“uuid，非空，关联 work_orders”，actor_id“uuid，非空，关联 profiles”，occurred_at“timestamptz，非空”，action“text，非空，受枚举约束”，reason/root_cause/prevention“text，可空”，changes“jsonb，非空，默认空对象”，seed_key“text，可空且唯一”；落实“changes 仅允许工单业务字段”“解决记录归因必填，拒绝、指派、重开原因必填”，保留 before/after 与当次结果，增加 (work_order_id,occurred_at,id) 索引，外键不设置业务级联删除。
- [X] T004 在 `supabase/migrations/<生成时间戳>_work_order_query.sql` 实现 private.current_role()、can_read_work_order(uuid)、work_order_people(number)、work_order_exists(number)：只从当前有效 session membership 决定项目/角色；质检员按 creator、施工方按当前 assignee、管理员按当前项目授权；姓名只返回可见单关联人的 id/name，存在性只返回有效身份单编号布尔值；提权 helper 固定空 search_path、全限定 schema 并撤销 PUBLIC/anon EXECUTE。两表启用 RLS，authenticated 仅 SELECT、无写策略，记录权限跟随父单，保持 profiles_self 不变。
- [X] T005 在 `supabase/migrations/<生成时间戳>_work_order_query.sql` 实现 SECURITY INVOKER 的 public.list_work_orders(p_status,p_sort) 与 get_work_order(p_number)，按 `specs/002-work-order-query/contracts/read-contract.md` 输出 DTO/领域结果；主数据读取保留 RLS，姓名经受限 helper 获取，详情空结果再做最小存在性判断；列表限制普通角色，按 urgent 布尔值降序、created_at 与 number 同方向排序，ended 映射 completed/rejected，撤销默认公共执行权限后仅向 authenticated 授权，不接受客户端身份参数。
- [X] T006 审阅并应用 T002～T005 的 `supabase/migrations/<生成时间戳>_work_order_query.sql` 至约定项目，核对迁移历史、表、函数、GRANT/RLS 与数据库建议，修复本次引入问题；用真实普通身份作最小读/写拒绝冒烟核验，将结果写入 `specs/002-work-order-query/verification.md`，不将管理密钥调用当作普通权限验证。
- [X] T007 [P] 在 `lib/work-orders/types.ts` 定义枚举中文映射、Summary/Detail/Record DTO 和 ok/forbidden/not_found 结果；实现编号“1～2147483647 十进制正整数”、status“pending/ended/all”、sort“newest/oldest”解析，重复参数取首项、非法筛选归一 pending/newest；可空字段保持 null、数组保持 []，photos 本阶段固定 []，日期显示统一 Asia/Shanghai，不返回 seed_key 或登录资料（依赖 T001，可与 T002～T006 并行）。
- [X] T008 在 `scripts/seed-work-orders.mjs` 实现固定 UUID/编号/seed_key 的 16 单及六类历史，A项目14单/B项目2单，覆盖 `data-model.md` 全部样本情形和两名不同责任人；校验发起人为该项目有效质检员/管理员、责任人为有效施工方，重开清空当前结果并保留历史，固定时间和同时间样本；仅修改 stage2 标记数据，非样本编号冲突即停止，序列同步至最大编号，失败不报成功且可重跑，生成忽略的 `.local/demo-work-orders.json` 权限/排序验收清单（依赖 T006）。
- [X] T009 在 `scripts/seed-demo.mjs` 接入 T008，复用已有账号准备和仅离线管理密钥；为 multi001 增加 B 项目 contractor 身份，使角色关系为9条，不新建账号或重置密码；两次执行 npm run seed:demo 核对工单/记录不重复、不改无关数据，结果记入 `specs/002-work-order-query/verification.md`，不输出凭据。

**检查点**：迁移、RLS、只读 RPC、DTO 和样本均可用，再进入故事；T007 可提前并行，不解除其余基础门禁。

## 阶段 3：US1 查看当前身份相关工单（P1，最小可演示增量）

**目标**：质检员和施工方可按固定身份范围浏览、筛选和排序工单。

**独立验收**：qc001 和 sg001 各自核对全部六组合、紧急置顶、同时间编号顺序及无结果；不依赖详情或抽屉完成列表验收。

- [X] T010 [US1] 在 `lib/work-orders/queries.ts` 建立 server-only 的列表读取，按请求创建普通 Supabase 客户端并检查有效身份，只调用 list_work_orders；标准化错误、不使用管理密钥或跨请求缓存，不静默截断演示结果，服务器不信任客户端角色（依赖阶段2）。
- [X] T011 [P] [US1] 在 `components/work-orders/filters.tsx` 实现状态与排序控件，以规范化 URL 参数为唯一来源，保留我提出的/我负责的范围摘要并显示导航 pending，窄屏换行后核心筛选仍可见；不增加关键词、专业或管理员筛选（依赖阶段2，可与T010并行）。
- [X] T012 [P] [US1] 在 `components/work-orders/list.tsx` 实现编号、状态、严重度、描述摘要、位置、创建时间、当前责任人及专业的列表卡片，紧急红框，空列表中文说明，真实详情 Link 携带规范化 status/sort，暂不拦截点击；列表无建单/处理按钮（依赖阶段2，可与T010、T011并行）。
- [X] T013 [US1] 在 `app/(workspace)/work-orders/page.tsx` 接入 requireIdentity、异步 searchParams、T010～T012 和 AppShell；管理员显示无权限并不读取普通列表，其他角色默认 pending/newest，保留原 catch-all 对未开放模块的处理。
- [X] T014 [US1] 在 `app/(workspace)/work-orders/loading.tsx`、`app/(workspace)/work-orders/error.tsx` 完成加载过渡与中文错误重试，人工核对 `quickstart.md` 的列表六组合、非法参数及空结果，将样本对照结果写入 `specs/002-work-order-query/verification.md`（依赖T013）。

**检查点**：US1 可单独演示列表价值；详情链接在 US2 完成后才视为完整阶段路径，不能仅凭 US1 标记阶段2完成。

## 阶段 4：US2 查看完整详情与历史处理结果（P1）

**目标**：三角色可通过独立链接读取获准工单完整信息与历次结果。

**独立验收**：不经列表，直接访问三状态工单及历史样本，核对字段、六类记录、重开后当前结果为空及历史保留，管理员跨项目被拒绝。

- [X] T015 [US2] 在 `lib/work-orders/queries.ts` 添加单编号详情读取与领域结果映射，使用 get_work_order 和当前普通会话，非法编号直接 not_found；有权才组装数据，无权不返回任何正文或姓名，沿用 server-only 与无共享缓存约束（依赖阶段2；若与US1交替实施，串行修改该文件）。
- [X] T016 [P] [US2] 在 `components/work-orders/detail.tsx` 创建共用只读内容，依原型显示编号/状态/严重程度及基础、问题、当前周期处理分区，显示发起人/项目/责任人、完整摘要/位置/详情、当前归因/建议，空选填标注未填写或暂无，photos=[] 正常显示，不增加图片或处理入口（依赖阶段2，可与T015并行）。
- [X] T017 [P] [US2] 在 `components/work-orders/records.tsx` 显示记录类型、操作人、时间、原因、字段变化前后值及各次归因/建议；按 occurredAt、id 倒序稳定呈现，人员变更使用可见单限定姓名，空记录有说明，六类操作中文映射齐全（依赖阶段2，可与T015、T016并行）。
- [X] T018 [US2] 在 `app/(workspace)/work-orders/[number]/page.tsx` 接入异步 params、requireIdentity、T015 及共用 detail/records，直接链接和刷新均为完整独立页面；未找到与无权限明确区分，普通角色返回规范化筛选列表，管理员返回 `/admin/work-orders`；提供成功、失败和重试状态，不提前开放管理员中心（依赖T015～T017）。
- [X] T019 [US2] 按 `specs/002-work-order-query/quickstart.md` 核对三状态详情、六类历史、解决→重开→再次解决、拒绝→重开、转派原责任人失权、管理员直链与跨项目限制，将实际结果写入 `specs/002-work-order-query/verification.md`（依赖T018）。

## 阶段 5：US3 在电脑和手机上连续浏览（P2）

**目标**：在已有列表和详情上统一宽屏抽屉、窄屏页面及安全返回。

**独立验收**：以 US1/US2 作为可用前提，390px/1440px 分别完成筛选→打开→返回、直链刷新及未登录回跳；抽屉迟到请求不串单。

- [X] T020 [US3] 在 `app/api/work-orders/[number]/route.ts` 实现只读 GET，复用 T015，通过 getLoginContext 显式返回 JSON 401/403（不调用重定向式 requireIdentity），其余映射200/403/404/500及固定中文错误；所有响应 `Cache-Control: private, no-store`，无写方法（依赖US2）。
- [X] T021 [P] [US3] 在 `lib/auth/types.ts` 受控扩展 safeTarget，允许合法 `/work-orders/[number]` 及列表白名单 status/sort，拒绝外域、协议、双斜线和非法编号；保留原菜单目标；核对 `app/actions/auth.ts`、`app/login/page.tsx`、`app/select-identity/page.tsx`、`lib/auth/context.ts` 链路，必要时同步传递规范化目标，确保未登录直链登录选身份后返回详情（依赖US2，可与T020并行）。
- [X] T022 [P] [US3] 在 `components/app-shell.tsx` 处理详情的导航归属选中态：普通身份选中工单列表，管理员归属管理员中心且不新增普通列表菜单；保留现有窄屏导航、用户项目角色和退出能力（依赖US2，可与T020、T021并行）。
- [X] T023 [US3] 在 `components/work-orders/detail-drawer.tsx` 实现右侧抽屉及共享详情渲染，通过 T020 加载；关闭、切单时取消旧请求并忽略迟到响应，加载/失败立即清除旧正文，包含重试、失效登录/选身份入口与无权限/未找到提示，不缓存受限正文（依赖T020）。
- [X] T024 [US3] 在 `components/work-orders/list.tsx` 接入 T023，仅视口>=1024px 的无修饰主键点击阻止导航，其他点击及窄屏使用真实详情链接；筛选变化/导航离开时关闭抽屉，列表 URL 筛选不丢失，独立详情继续携带规范化参数返回（依赖US1、T023）。
- [X] T025 [US3] 按 `specs/002-work-order-query/quickstart.md` 完成390px/1440px、抽屉快切/关闭、窄屏返回、直接链接/新标签/刷新、登录回跳及外部next拒绝走查；核对 pending、错误重试、空结果、未找到和无权限反馈，将结果写入 `specs/002-work-order-query/verification.md`（依赖T021、T022、T024）。

## 阶段 6：跨故事核验与交付

**目标**：完成真实读取权限和核心路径验收，按实际结果更新项目进度。

- [X] T026 按 `specs/002-work-order-query/quickstart.md` 使用真实普通会话临时核对两表、RPC和详情 GET：三角色、多身份不叠加、跨项目、历史责任人、未选身份、退出旧JWT及成员失效；确认两表写入拒绝、姓名helper不越权、profiles策略未扩大，受限正文返回0条。仅在忽略的 `.local/` 保存临时材料，成员失效验证后恢复模拟成员，不提交凭据或自动化测试；完整矩阵写入 `specs/002-work-order-query/verification.md`（依赖全部故事）。
- [X] T027 运行 npm run check 并修复本阶段阻断项，将通过结果和残留限制写入 `specs/002-work-order-query/verification.md`；确认其他未开放页面、登录身份和退出流程未回归，不新增默认构建、部署或 npm audit 任务（依赖T026）。
- [X] T028 核对 `specs/002-work-order-query/tasks.md` 只勾选已完成项，同步 `progress.md` 的阶段2实际完成度、日期、SDD路径、验收/检查结果、已知限制与下一步；如模拟成员数量变化则同步 `AGENTS.md` 中受影响的长期事实，只有全部核心路径和 npm run check 通过才标记阶段2完成，中断同样记录实际阻塞（依赖T027）。

## 依赖与执行顺序

```text
T001 → T002 → T003 → T004 → T005 → T006 → T008 → T009
  └→ T007 ──────────────────────────────────────────┘
共享基础完成
  ├→ US1：T010/T011/T012 → T013 → T014
  └→ US2：T015/T016/T017 → T018 → T019
US1 + US2 → US3：T020/T021/T022 → T023 → T024 → T025
全部故事 → T026 → T027 → T028
```

- US1 与 US2 均只依赖共享基础，可分别独立验收；默认按 US1→US2 顺序，二者均修改 queries.ts，不能同时编辑该文件。US2 不依赖列表才能查看详情。
- US3 是在 US1/US2 上的集成故事，必须待二者可用；T021/T022可与T020并行，T023必须等T020，T024必须等T023和US1。
- 数据库迁移修改与应用必须顺序执行；不并行执行种子写入或覆盖同一 verification.md。各故事人工结果按顺序汇总。

## 各故事并行示例

| 故事 | 已满足前提 | 可并行的不同文件任务 | 后续汇合 |
| --- | --- | --- | --- |
| US1 | 阶段2完成 | T010 queries.ts、T011 filters.tsx、T012 list.tsx | T013页面集成 |
| US2 | 阶段2完成且无queries.ts并发修改 | T015 queries.ts、T016 detail.tsx、T017 records.tsx | T018详情集成 |
| US3 | US1/US2完成 | T020 GET route.ts、T021认证回跳文件、T022 app-shell.tsx | T023抽屉→T024链接接入→T025走查 |

[P] 共7项：T007、T011、T012、T016、T017、T021、T022（以及上述表中无[P]的主线任务可作为并行搭档）；不得把依赖尚未完成的任务提前执行。

## 实现策略与验收追踪

1. 最小增量为阶段1/2基础 + US1，先验收固定范围与六组合；它是列表演示检查点，不是本阶段最终完成条件。
2. 接入US2，以直链独立验收完整详情与历史；再完成US3统一打开规则和返回上下文。
3. 最终执行权限矩阵、npm run check和进度更新，阶段2全部通过后再进入阶段3；本清单不包含图片存储、工单处理写操作、AI或部署。

| 需求/结果 | 覆盖任务 |
| --- | --- |
| FR-001/002/008/011 数据、历史、样本 | T002～T009、T015～T019 |
| FR-003 当前身份授权 / SC-001 | T004～T006、T010、T015、T020、T026 |
| FR-004～006 列表 / SC-002 | T005、T007、T010～T014 |
| FR-007/008 详情历史 / SC-003 | T015～T019 |
| FR-009/012 设备与入口 / SC-004 | T011～T013、T016～T018、T020～T025 |
| FR-010 异常 / SC-005 | T007、T014、T018、T020、T023、T025 |
| FR-013/014 只读与图片边界 | T002、T004、T012、T016、T018、T026 |
| 静态检查和交付进度 | T027、T028 |

## 生成校验与钩子

共28项：准备1项、共享基础8项、US1五项、US2五项、US3六项、交付3项。全部使用连续任务编号、完成复选框、适用故事标签与文件路径。已执行实现与相应验证，未更改规范质量清单的已审核状态。当前无 `.specify/extensions.yml`，生成前后均无钩子需要执行。
