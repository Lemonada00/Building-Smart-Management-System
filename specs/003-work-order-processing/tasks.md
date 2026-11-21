# 任务清单：阶段 3 工单处理闭环

**日期**：2026-10-29
**输入**：[spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、[data-model.md](data-model.md)、[契约](contracts/processing-contract.md)、[quickstart.md](quickstart.md)
**状态**：40/40 已完成，核心路径和默认检查通过；证据见 verification.md。
**组织方式**：按用户故事交付，先解决/拒绝，再重开、指派，最后编辑与照片。

## 格式与路径约定

任务格式为 `- [ ] T编号 [P可选] [US编号仅故事阶段] 描述与路径`。`[P]` 仅表示在明确的共同前置任务完成后，可与所列同阶段不同文件任务并行，不自动授权启用代理。

所有源码路径均相对仓库根目录。

数据库迁移文件必须在实施时先核对 CLI 帮助，以 `migration new` 生成实际时间戳文件名；以下为目标文件匹配路径，不是允许手写时间戳：

- 基础流转：`supabase/migrations/*_work_order_processing_base.sql`，T002 生成实际路径，后续基础/US1 任务引用它。
- 重开：`supabase/migrations/*_work_order_processing_reopen.sql`，T015 生成。
- 指派：`supabase/migrations/*_work_order_processing_assign.sql`，T019 生成。
- 照片和编辑：`supabase/migrations/*_work_order_processing_photos.sql`，T024 生成。

首次写入前生成文件，应用后不再改写已应用迁移；后续修复生成新的命名迁移。在 `specs/003-work-order-processing/verification.md` 记录实际文件名及应用结果。每个故事仅在对应迁移和应用代码共同可用后验收。

## 阶段 1：准备

**目的**：确认当前实现与资料，保留工作区边界。

- [X] T001 核对 `progress.md`、本阶段 `specs/003-work-order-processing/` 与 `git status`，记录现有阶段 2 改动和本阶段实施起点到 `specs/003-work-order-processing/verification.md`；读取 Supabase 技能、已安装 Next.js 相关文档，实际调用库/CLI 前按 AGENTS.md 尝试 Context7，工具不可用时使用官方资料，不将历史健康检查当作现状。
- [X] T002 重新只读核对云端工单/记录字段、当前身份函数、RLS、Storage helper 和桶；检查 CLI 版本与帮助后生成 `supabase/migrations/*_work_order_processing_base.sql`，把实际路径记入 `specs/003-work-order-processing/verification.md`，不改全局默认权限或已有阶段 2 迁移。

## 阶段 2：基础能力（阻塞全部用户故事）

**目的**：建立统一事务边界、版本、类型和详情控制器。基础阶段本身不宣称业务故事已完成。

- [X] T003 在 `supabase/migrations/*_work_order_processing_base.sql` 增加原文约束 `version integer not null default 1 check(version>0)`，建立 `public.process_work_order(p_number,p_expected_version,p_action,p_payload)` 的 invoker 包装与 private 受控事务骨架；验证真实会话及唯一身份、按编号锁行后重验可读范围/动作资格/状态/版本，拒绝未知动作和字段，不信任客户端 actor/project/session，不改变普通账号直接写表禁令；撤销 PUBLIC/anon 默认执行授权、最小授权 authenticated，private 函数固定空 search_path 且自行检查权限。
- [X] T004 扩展 `lib/work-orders/types.ts` 的命令联合类型、稳定错误码、`version:number`、`allowedActions:('edit'|'resolve'|'reject'|'assign'|'reopen')[]` 与 `WorkOrderPhoto={id,name,url}`；同步 `supabase/migrations/*_work_order_processing_base.sql` 的详情版本和可用动作快照，照片功能未建立前 photos 仍返回兼容空数组，不能提前展示未实现动作。
- [X] T005 实现 `lib/work-orders/validation.ts` 和 `lib/work-orders/mutations.ts` 的小请求校验与 server-only 会话 RPC 接入：编号为有效正整数、expectedVersion 为正整数，按动作严格允许字段；按原文“必填文字 trim 后非空，选填空白转 null”，输出契约错误码与字段提示，不泄露 SQL/密钥，不使用管理密钥。
- [X] T006 在 `app/actions/work-orders.ts` 实现 `submitWorkOrderCommand`，复核登录/当前身份后调用受控命令，成功只返回编号/新版本/accessLost，失败返回结构化错误；不在成功写入后因再次读详情失败而回报写入失败，网络结果不确定时保留原 expectedVersion，不自动换版本重放。
- [X] T007 在 `components/work-orders/detail-controller.tsx` 建立共享详情状态与操作回调，接入 `components/work-orders/detail-drawer.tsx` 和 `app/(workspace)/work-orders/[number]/page.tsx`；保留现有加载/失权/直链行为，失败保留输入，冲突重读不自动覆盖草稿，仅确认采用最新内容时重置；关闭/成功后清理状态，不增加跨会话恢复。
- [X] T008 在 `app/api/work-orders/[number]/route.ts`、`lib/work-orders/queries.ts`、`components/work-orders/list.tsx` 接通新 DTO 与刷新回调：保留 private,no-store 和每请求身份检查，详情成功显式重读、列表 router.refresh，保持原筛选排序；抽屉不得仅依赖 router.refresh 更新其本地状态。

**检查点**：共同契约和事务基础可用，后续故事可按顺序接入；T003 的迁移仍待 US1 完成后统一应用。

## 阶段 3：用户故事 1 — 处理工单并反馈结果（P1，最小可演示增量）

**目标**：施工方和管理员解决/拒绝工单，状态与结果记录一致。

**独立验收**：两张预置 pending 工单分别解决、拒绝；核对详情、默认列表和各一条记录；空必填、质检员直接请求和已结束状态操作全部拒绝。

- [X] T009 [US1] 在 `supabase/migrations/*_work_order_processing_base.sql` 完成 resolve/reject 分支：仅当前责任施工方或当前项目管理员处理 pending；“completed 必须有非空 root_cause；pending/rejected 的 root_cause、prevention 必须为空”；resolve 必填 rootCause、prevention 选填且缺失转 null，reject 必填 reason；同事务更新状态/结果/version 并恰好新增一条记录；记录 action 保持 created/edited/resolved/rejected/assigned/reopened 合法集合，本阶段只启用已实现分支，操作人/时间由数据库生成。
- [X] T010 [US1] 应用并核验 `supabase/migrations/*_work_order_processing_base.sql`，用真实用户会话确认解决/拒绝原子提交、直接表写入被拒、旧版本冲突、无权动作拒绝，检查相关数据库 advisor 并修复本次迁移引入问题，将实际结果写入 `specs/003-work-order-processing/verification.md`；不把管理账号成功当作业务权限通过。
- [X] T011 [P] [US1] 在 `components/work-orders/operation-dialog.tsx` 实现解决/拒绝弹框：解决收集必填归因与选填建议，拒绝收集必填原因，空白必填明确提示；提交中防重复与意外关闭，失败保留输入，按 allowedActions 显示入口并接入 T006/T007。
- [X] T012 [P] [US1] 在 `components/work-orders/records.tsx` 和 `components/work-orders/detail.tsx` 显示本次完整归因/建议、拒绝原因、状态变化和倒序记录，保持旧记录兼容，当前结果与历史结果分区明确。
- [X] T013 [US1] 在 `app/globals.css` 补齐处理弹框、输入、错误及进行中样式，沿用现有 wo-* 与 Stitch 展示页风格，保证宽屏抽屉和窄屏独立页均可提交解决/拒绝，操作成功默认待处理列表移除该工单。
- [X] T014 [US1] 按 `specs/003-work-order-processing/quickstart.md` 人工走查解决/拒绝、管理员直链、缺项、直接请求越权、重复点击与提交失败保留输入，逐项记录到 `specs/003-work-order-processing/verification.md`，每次有效操作只增加一条记录，单次简单处理可在 2 分钟内确认结果。

**检查点**：US1 可独立演示；它只是阶段 3 的首个增量，不能将阶段标为完成。

## 阶段 4：用户故事 2 — 重新打开并再次处理（P1）

**目标**：发起质检员或管理员重开已结束工单，保留责任人和历史结果。

**独立验收**：可用预置 completed/rejected 工单独立验证重开；与 US1 联验解决→重开→再解决，以及拒绝→重开→再处理。

- [X] T015 [US2] 生成并编写 `supabase/migrations/*_work_order_processing_reopen.sql`，为受控命令与 allowedActions 增加 reopen：仅有读取权限的发起质检员或管理员，对 completed/rejected 填非空 reason；责任人不变，状态转 pending，当前归因/建议清空，version+1，记录保留原因与字段变化；不得覆盖历次结果，施工方即使用户 ID 为发起人也不能重开。
- [X] T016 [US2] 在 `lib/work-orders/validation.ts`、`app/actions/work-orders.ts` 和 `components/work-orders/operation-dialog.tsx` 接入重开原因弹框，复用进行中/错误/输入保留交互；在 `components/work-orders/detail-controller.tsx` 刷新当前周期空结果和新增历史。
- [X] T017 [US2] 应用并核验 `supabase/migrations/*_work_order_processing_reopen.sql` 的权限、状态与记录一致性；以预置已结束工单验证当前责任施工方不能重开、pending 不能重开、旧版本不能覆盖，将结果写入 `specs/003-work-order-processing/verification.md`。
- [X] T018 [US2] 依据 `specs/003-work-order-processing/quickstart.md` 完整人工走查两条多周期闭环，核对再次解决不填建议时仍为空、历次归因/建议/拒绝原因完整且倒序可回看，记录于 `specs/003-work-order-processing/verification.md`。

## 阶段 5：用户故事 3 — 指派给另一施工方（P1）

**目标**：当前责任施工方或管理员移交责任，原责任人后续请求立即失权。

**独立验收**：甲→乙，核对甲原详情链接/旧表单拒绝、乙可处理、发起人和管理员仍可查看；图片失权在 US4 完成后补齐联验，不提前宣称该项通过。

- [X] T019 [US3] 生成并编写 `supabase/migrations/*_work_order_processing_assign.sql`，增加受控 `list_work_order_assignees` 与 assign 分支；仅可指派 pending 的当前责任施工方/管理员读取候选，返回 `{id,name,employeeId,department}`，候选与提交均限同项目活跃施工方、排除原责任人；原因 trim 后非空，同事务改责任人/version 并记录前后 UUID 与原因，状态不变，不放宽 profiles/project_memberships 的本人 RLS。
- [X] T020 [US3] 在 `lib/work-orders/types.ts`、`lib/work-orders/mutations.ts`、`lib/work-orders/validation.ts`、`app/actions/work-orders.ts` 接入候选 Action 与 assign 参数校验，明确 profile UUID 和成员关系 ID 的区别，成功返回 accessLost 而非读提交后详情。
- [X] T021 [US3] 在 `components/work-orders/operation-dialog.tsx` 实现候选选择与必填原因，展示姓名、工号/部门以区分同名，候选为空时说明无其他施工方；在 `components/work-orders/detail-controller.tsx`、`detail-drawer.tsx`、`list.tsx` 接通转派成功提示与失权关闭/安全回跳，保持筛选排序，管理员不跳无权限普通列表。
- [X] T022 [US3] 应用并核验 `supabase/migrations/*_work_order_processing_assign.sql`，检查自派、跨项目、非施工方、停用成员及候选加载后失效均拒绝；记录甲/乙/发起人/管理员的读取与处理权限及原责任人历史姓名仍可解析到 `specs/003-work-order-processing/verification.md`。
- [X] T023 [US3] 按 `specs/003-work-order-processing/quickstart.md` 人工走查转派后甲旧详情链接/旧写请求失权、新责任人可继续处理、多身份不叠加、转派后读失败不误报写失败，将图片失权联验明确标为待 US4 完成，写入 `specs/003-work-order-processing/verification.md`。

## 阶段 6：用户故事 4 — 编辑问题和现场照片（P2）

**目标**：授权人员编辑六类问题字段和照片，保存边界一致，图片权限跟随工单。

**独立验收**：待处理工单改文字、上传至少两张图、删除一张，分别保存/取消/制造失败；验证记录、文件读取、签名拒绝和转派失权。

- [X] T024 [US4] 生成并编写 `supabase/migrations/*_work_order_processing_photos.sql` 的 work_order_photos 表及桶：逐项落实原文约束“UUID 主键，受控预留函数生成”“UUID，关联工单，非空，索引”“text 唯一，非空”“text，非空”“text，限 image/jpeg、image/png、image/webp”“integer，1～10485760”“UUID，关联 profiles，非空”“UUID，非空，不外露”“text，staged/attached/removed”“integer，可空，attached 时非负”“timestamptz，默认当前时间”；对应 id/work_order_id/object_path/original_name/mime_type/size_bytes/uploader_id/upload_session_id/state/position/created_at，附加 attached position 非空与工单内唯一；upload_session_id 不设会话删除级联，桶 `work-order-photos` 为 public=false、10 MiB、上述三类 MIME。
- [X] T025 [US4] 在 `supabase/migrations/*_work_order_processing_photos.sql` 实现 prepare/discard 受控函数及 RLS：照片表仅 SELECT attached 且当前可读；预留由真实会话生成固定 `工单UUID/图片UUID.规范扩展名`，原文件名不入路径；Storage INSERT 仅本会话、本上传人、24 小时内 staged 精确路径且仍有 pending 编辑权，禁止 UPDATE/业务 DELETE；SELECT 限 `storage.object.get_authenticated` 加当前工单权限，拒绝 sign/sign_many/公开读取/其他旁路，helpers 自行校验且权限最小化，取消只能失效本会话 staged，不能影响 attached。
- [X] T026 [US4] 在 `supabase/migrations/*_work_order_processing_photos.sql` 完成 edit 分支及照片事务：仅发起质检员/当前施工方/管理员编辑 pending，只改 severity/discipline/description/location/details/photoIds；严重程度限 minor/normal/major/urgent、专业限 architecture/structure/plumbing，前四项必填、details/照片选填；保存锁工单并协调照片行锁，核对完整照片列表无重复、同工单、新图为本会话且未超 24 小时、对象实际大小/MIME 与预留相符，总数≤9；attached 顺序安全更新避免唯一索引冲突，removed 不重关联；文字与关联/version/恰好一条 edited 记录同事务提交，无修改不递增或记记录，扩展 changes 白名单 photos 并保存有序“图片 UUID + 原文件名”前后摘要。
- [X] T027 [US4] 在同一 `supabase/migrations/*_work_order_processing_photos.sql` 扩展 list_work_orders/get_work_order 返回已关联照片 `{id,name,url}`，不暴露存储路径、上传会话或 staged；在 `lib/work-orders/queries.ts` 和 `app/api/work-orders/[number]/route.ts` 接入 DTO，保留旧记录兼容和当前身份读取限制。
- [X] T028 [US4] 在 `lib/work-orders/photos.ts` 和 `app/actions/work-orders.ts` 实现 prepareWorkOrderPhoto/discardWorkOrderPhotos 的 server-only 小参数入口、结构化错误及会话验证；不接受客户端 uploader/session/object_path，不传文件字节，不使用运行时管理密钥，取消失败不修改正式工单。
- [X] T029 [P] [US4] 在 `app/api/work-orders/[number]/photos/[photoId]/route.ts` 实现同源鉴权图片 GET：验证参数、当前身份、attached 关系，用同一用户会话 download 输出真实图片类型；返回 private,no-store、Vary: Cookie、nosniff，不重定向签名地址、不走 304，映射 401/403/404/502，已移除或失权不返回图片。
- [X] T030 [P] [US4] 在 `components/work-orders/photos.tsx` 实现多图选择、本地预览/缩略图/放大/删除与逐文件上传状态，前置提示 JPEG/PNG/WebP、10 MiB/张、最多 9 张；通过预留后用现有浏览器会话 upload(upsert:false) 直传，失败保留 File 与可恢复选择、重试不覆盖对象，清理 Object URL；展示使用普通 img 或 unoptimized，图片失败有提示，未上传成功不得作为有效 photoId 保存。
- [X] T031 [US4] 在 `components/work-orders/edit-form.tsx`、`components/work-orders/detail-controller.tsx`、`lib/work-orders/validation.ts` 实现六类问题字段编辑、保存/取消、photoIds 完整列表和 no_changes 提示，其他字段保持只读；保存前确认所选图均上传成功，取消/失败不得先删原文件，冲突保留草稿并人工核对，失权禁用继续写入。
- [X] T032 [US4] 在 `components/work-orders/detail.tsx`、`records.tsx`、`list.tsx` 和 `app/globals.css` 接入照片展示、列表首图、照片变更纯文本摘要及原型编辑样式，保留无图/旧记录，保存后显示最新内容和紧急置顶，抽屉/独立页共用相同交互。
- [X] T033 [US4] 在 `scripts/seed-work-orders.mjs` 增补可重复准备的明确标记模拟照片和离线无引用对象清理，继续由 `scripts/seed-demo.mjs` 调用；不覆盖人工处理和密码，清理先确认 removed 或过期 staged 且无 attached 引用，通过 Storage remove 而非 SQL 删除 storage.objects，清理失败记录限制不撤销业务操作，清单仍存 `.local/demo-work-orders.json`，密钥仅现有离线环境。
- [X] T034 [US4] 应用并核验 `supabase/migrations/*_work_order_processing_photos.sql`，执行增强后的 npm run seed:demo；用真实会话确认新表显式授权/RLS、认证下载成功、createSignedUrl/createSignedUrls 拒绝、公开地址和直接改删已关联对象被拒，记录结果及本次 advisor 结论到 `specs/003-work-order-processing/verification.md`。
- [X] T035 [US4] 按 `specs/003-work-order-processing/quickstart.md` 人工走查照片编辑保存/取消、上传失败与重试、提交失败/冲突、超大小/数量/MIME、跨工单图片注入、旧图片删除后不可读、过期暂存及退出旧 JWT 拒绝；补齐 US3 转派后的图片新请求失权，验证原关联不部分丢失、一次有效保存一条记录，并记录到 `specs/003-work-order-processing/verification.md`。

## 阶段 7：联验与交付

**目的**：验证完整阶段，不扩展自动化测试、部署、覆盖率或专项建设。

- [X] T036 对照 `specs/003-work-order-processing/quickstart.md` 联验三角色×三状态全部动作、两条多周期闭环、管理员直链、跨项目/多身份、直接请求绕过按钮与转派旧链接/图片/写入失权，记录 `specs/003-work-order-processing/verification.md`；只用真实普通会话证明权限，不用 HTTP 连通替代。
- [X] T037 在 1440px 和 390px 核对 `components/work-orders/detail-controller.tsx`、`detail-drawer.tsx`、`edit-form.tsx`、`operation-dialog.tsx`、`photos.tsx` 对应完整核心流程，按 Stitch 编辑/展示原型修复阻断性布局、弹框关闭与草稿丢失、列表刷新/安全返回问题，将直接链接、刷新、筛选保持及 2 分钟单次操作结果写入 `specs/003-work-order-processing/verification.md`。
- [X] T038 在仓库根目录执行 npm run check，修复本次改动的 Biome/TypeScript 问题；编辑多个 TSX 后按适用的 React 最佳实践技能复核本次组件，不追加专项；记录实际命令与结果到 `specs/003-work-order-processing/verification.md`，不默认执行构建/部署/npm audit，不跳提交钩子。
- [X] T039 根据真实实现同步 `specs/003-work-order-processing/quickstart.md`、`contracts/processing-contract.md`、`data-model.md` 和 `AGENTS.md` 的入口、字段、脚本与接入事实，完成 `specs/003-work-order-processing/verification.md` 的迁移列表、核心路径、检查结果及离线清理等已知限制，不提交账号/JWT/密钥或临时缓存。
- [X] T040 在 `specs/003-work-order-processing/tasks.md` 仅勾选真实完成任务，同次更新 `progress.md` 的日期/顶部 3/7 进度/阶段状态/完成项/SDD 路径/验收结果/限制/下一步；只有核心路径和 npm run check 通过才标阶段完成，否则记录实际进展与阻塞，保留未完成项。

## 依赖与执行顺序

```text
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008
  → US1 T009～T014（首个可演示增量）
  → US2 T015～T018
  → US3 T019～T023
  → US4 T024～T035
  → T036 → T037 → T038 → T039 → T040
```

- 基础阶段阻塞所有故事。US1～US3 共用命令分支、弹框和迁移函数，按编号顺序修改，不把它们标成可无条件同时写文件。
- US2 的重开可用预置已结束工单独立验收；其完整再次处理闭环依赖 US1。
- US3 的责任转移可用预置 pending 工单独立验收；图片立即失权要在 US4 后完成 T035/T036，T023 必须注明未联验。
- US4 的编辑和照片可用预置 pending 工单独立验收；T035 的跨故事转派图片检查依赖 US3。
- 所有迁移均在相应故事代码完成后应用核验，后续故事引用前面的受控函数；共享基础迁移在 T010 应用，不在写完骨架时提前发布未完成入口。
- 每个故事内按编号执行；只有以下显式并行组可在共同前置完成后并行，组后任务等待组内全部完成。

## 并行机会与各故事示例

| 故事 | 共同前置 | 可并行工作 | 汇合点 |
| --- | --- | --- | --- |
| US1 | T010 | T011 弹框组件与 T012 详情/记录展示，文件不重叠 | T013 样式整合后 T014 验收 |
| US2 | T015 | 无无依赖实现并行组；函数、Action、弹框按 T016→T017→T018 完成；可独立核读 quickstart 的闭环验收预期，不另建任务 | T018 |
| US3 | T019 | 无无依赖实现并行组；T020 的候选接入先于 T021 界面，之后 T022→T023；不并行编辑共享弹框 | T023 |
| US4 | T028 | T029 图片 Route Handler 与 T030 客户端照片组件，按已有契约分别实现 | T031 集成 |

不为凑并行增加抽象、任务或自动化测试；没有明确并行标记的共享文件任务保持串行。并行标记共 4 项。

## 需求覆盖与独立验收

| 需求/成果 | 主要任务 | 通过依据 |
| --- | --- | --- |
| FR-001～002：身份、访问、动作资格 | T003～T008、T009、T015、T019、T025、T036 | 三角色状态矩阵、直链及直接请求 |
| FR-003～005：六字段编辑、保存取消 | T026、T031～T032、T035 | US4 保存/取消/no_changes |
| FR-006～007：解决与拒绝 | T009～T014 | US1 两张 pending 工单 |
| FR-008～009：合法指派与立即失权 | T019～T023、T029、T035～T036 | US3 四方会话与图片联验 |
| FR-010：重开、当前周期清空与历史 | T015～T018 | US2 两条多周期闭环 |
| FR-011～012：事务、唯一记录与历史变化 | T003、T009、T012、T015、T019、T026、T032、T036 | 每次记录增量、错误回滚、前后变化 |
| FR-013～015：照片上传展示/取消/权限 | T024～T035 | US4 真实上传、失败与签名旁路拒绝 |
| FR-016：过期、重复、失败输入保留 | T003、T005～T007、T011、T016、T021、T030～T031、T035～T037 | 冲突/重试/失权场景 |
| FR-017～018：刷新、统一详情与回跳 | T007～T008、T013、T021、T032、T037 | 抽屉、窄屏页、直链、筛选保留 |
| FR-019：范围边界 | T001、T038～T040 | 不增加正式建单、AI、管理员中心或部署 |
| SC-001～006 | T014、T018、T023、T035～T038 | quickstart 人工走查及计时，记录真实结果 |

## 实施策略

先完成 T001～T014，形成解决/拒绝这一最小可演示增量；验证通过后继续 US2、US3、US4，最终完成阶段 3 全部范围。MVP 检查点不意味着授权删减剩余故事，也不意味着需要停下等待确认。

本任务清单不增加自动化测试文件；故事验收任务均为必要人工核心路径和真实会话核验。默认交付门槛是完整核心路径通过及 npm run check；构建和上线留后续阶段。不要为了结束任务将未执行的验收勾选完成。

## 生成时检查

共 40 项：准备 2、基础 6、US1 6、US2 4、US3 5、US4 12、联验交付 5。任务编号 T001～T040 连续且唯一，所有任务具有未勾选复选框与目标路径，故事阶段任务均带对应标签。无前置或后置扩展配置；实现与验收已完成，实际执行结果见 verification.md。
