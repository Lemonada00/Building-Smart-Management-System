# 数据模型：工单与处理记录

日期：2026-10-28。以下为待实现设计，未执行迁移。

## 枚举

| 字段 | 存储值与中文显示 |
| --- | --- |
| status | pending 待处理、completed 已完成、rejected 已拒绝 |
| severity | minor 轻微、normal 一般、major 严重、urgent 紧急 |
| discipline | architecture 建筑设计专业、structure 结构专业、plumbing 给排水专业 |
| action | created 创建、edited 编辑、resolved 解决、rejected 拒绝、assigned 指派他人、reopened 重新打开 |

使用 text + CHECK 约束，与现有迁移风格一致。

## public.work_orders

| 字段 | 类型与约束 | 含义 |
| --- | --- | --- |
| id | uuid 主键 | 内部关联与固定种子标识 |
| number | integer，正数，自动生成，唯一 | 用户工单编号，URL 使用十进制编号 |
| project_id | uuid，非空，关联 projects | 权限项目边界 |
| creator_id | uuid，非空，关联 profiles | 发起人 |
| assignee_id | uuid，非空，关联 profiles | 当前责任人 |
| created_at | timestamptz，非空，默认当前时间 | 创建时间，不随历史操作变化 |
| status | text，非空，默认 pending | 当前状态 |
| severity | text，非空 | 严重程度 |
| discipline | text，非空 | 专业 |
| description | text，非空且 trim 后非空 | 一句话问题摘要 |
| location | text，非空且 trim 后非空 | 详细位置 |
| details | text，可空 | 补充问题详情 |
| root_cause | text，可空 | 当前周期归因 |
| prevention | text，可空 | 当前周期建议 |
| seed_key | text，可空且唯一 | stage2: 前缀仅标记固定模拟数据 |

待处理和已拒绝的当前归因/建议为空；已完成必须有非空归因。种子准备校验发起人为项目质检员或管理员，责任人为项目施工方，均为有效成员；后续正式写入须在阶段 3/6 操作中维护这些不变量。当前无普通用户写入授权。现场图片不创建存储表、bucket 或公开 URL 字段，阶段 3 完成后再迁移补齐，DTO 本阶段 photos 固定为空数组。

最少索引：number 唯一；(project_id,creator_id)、(project_id,assignee_id)；records 的 (work_order_id,occurred_at,id)。紧急优先以查询表达式 severity='urgent' 降序，然后 created_at、number 同方向；不把非紧急严重程度插入排序键。

## public.work_order_records

| 字段 | 类型与约束 | 含义 |
| --- | --- | --- |
| id | uuid 主键 | 记录标识，同时间按 id 倒序稳定展示 |
| work_order_id | uuid，非空，关联 work_orders | 唯一所属工单 |
| actor_id | uuid，非空，关联 profiles | 操作人 |
| occurred_at | timestamptz，非空 | 操作时间 |
| action | text，非空，受枚举约束 | 六类操作 |
| reason | text，可空 | 拒绝、指派、重开的原因 |
| changes | jsonb，非空，默认空对象 | 字段名到 {before,after} 的映射 |
| root_cause | text，可空 | 该次解决的归因快照 |
| prevention | text，可空 | 该次解决的建议快照 |
| seed_key | text，可空且唯一 | 固定模拟记录标记 |

changes 仅允许工单业务字段；人员变更存用户 id，由受限姓名读取补足显示。解决记录归因必填，拒绝、指派、重开原因必填。创建记录含初始状态及责任人，编辑记录保留本次修改字段前后值。历史记录只追加，当前周期结果与历史快照互不覆盖。无删除工单入口，外键不设置业务级联删除。

## 权限

1. private.current_role() 只依据 private.current_membership() 读取当前角色，沿用有效会话校验，不扫描其他身份。
2. private.can_read_work_order(uuid) 为仅返回布尔值的最小提权辅助函数：会话有效、有当前 membership、项目相同，且当前角色满足 inspector + creator_id=auth.uid()、contractor + assignee_id=auth.uid() 或 admin。固定 search_path=''，全限定名称；不返回行内容。该函数同时用于两表 RLS 和关联姓名授权，避免 records 与 work_orders 相互递归。
3. 两表开启 RLS，收回 PUBLIC/anon/authenticated 原有权限后仅显式授予 authenticated SELECT；service_role 仅离线种子拥有必需写权限。无 INSERT/UPDATE/DELETE 策略，直接 REST 写入必须失败。
4. 工单 SELECT USING private.can_read_work_order(id)，记录 SELECT USING private.can_read_work_order(work_order_id)；不按 actor_id、历史责任人或本人其他角色授权。
5. private.work_order_people(number) 先按同一辅助函数授权，只返回可见单关联人员 id/name；历史变更涉及人员同样以该单记录为边界。它不修改 profiles_self，不暴露任意成员目录。
6. private.work_order_exists(number) 验证有效身份后只返回单编号存在性，不返回业务内容，供详情区分 forbidden 与 not_found。公开 invoker 详情 RPC 在 RLS 读取成功时才返回数据。
7. 新增 private 函数撤销 PUBLIC/anon 默认 EXECUTE，按需要授权 authenticated；所有提权函数均在非暴露 schema。公开 RPC 为 SECURITY INVOKER，不接收角色、项目、用户或 session 参数。

## 状态与历史

本阶段无在线状态转换。数据结构与样本表达：创建→待处理；解决→已完成；拒绝→已拒绝；指派→待处理且更换责任人；重开→待处理且责任人不变、清空当前归因与建议。历史记录仍保留当次完整内容。编辑仅改变问题字段。

## 演示集

- 计划共 16 张：项目 A 14 张、项目 B 2 张，均在标题或说明中明确为模拟；固定编号、UUID 与 seed_key，生成清单写至忽略文件 .local/demo-work-orders.json。
- 项目 A：qc001 与 multi001 等不同发起人，sg001/sg002/multi001 不同责任人；使 qc001 和 sg001 各自范围内均覆盖三状态、四严重度和三专业，且有两个同创建时间的工单验证编号稳定排序。
- 含解决→重开（当前待处理）、解决→重开→再次解决、拒绝→重开、sg001 转派 sg002 后 sg001 失权；含 multi001 发起但由 sg001 负责样本验证 multi001 施工身份不因本人发起而获权。
- 项目 B 由 multi001 管理身份发起；准备其该项目施工身份关系供责任人约束，角色关系从 8 条变为 9 条，不新增账号。以 A 管理身份访问 B 样本仍无权，退出重选 B 才可见。
- 保存每单预期可见身份、状态、排序位置与记录摘要供人工对照；种子从 profiles 按固定工号解析 id，不把真实用户 id 或凭据写入文档。
- 重复准备只操作 stage2 标记工单与记录；编号被其他数据占用即停止；固定编号插入后同步编号序列至现存最大编号，防止后续正式建单冲突。优先通过离线事务或受限管理准备步骤保证工单与记录一致，失败不可报告种子成功，可重跑修复固定样本。不删除其他样本、重置密码或改动现有会话。
