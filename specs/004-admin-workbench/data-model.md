# 数据模型：阶段 4 管理员工作台

## 持久实体（复用，无新增表）

| 实体 | 相关字段 | 关系及规则 |
| --- | --- | --- |
| 当前身份 | session_id、membership_id、user_id、project_id、role | 现有私有会话身份和成员关系校验，须为当前admin |
| projects | id、name、city、customer_name、project_type、is_active | 只读取当前有效项目 |
| work_orders | id、number、project_id、creator_id、assignee_id、created_at、status、severity、discipline、description、location、details、version | 项目为边界，保留已有RLS及状态约束 |
| profiles | id、name | 本人读取受限；中心人员姓名通过既有受控工单人员函数获取 |
| work_order_records / photos | 现有字段 | 只由共用详情使用，不在中心重复读取历史及图片 |

无新增状态流转。管理操作继续调用 process_work_order：待处理可编辑/解决/拒绝/指派；完成或拒绝可重开，保留版本及原子记录约束。

## 新增应用读取模型

### AdminFilters

| 字段 | 取值 | 规范化 |
| --- | --- | --- |
| status | pending / completed / rejected / 未选 | 非法值视为未选 |
| severity | minor / normal / major / urgent / 未选 | 非法值视为未选 |
| discipline | architecture / structure / plumbing / 未选 | 非法值视为未选 |
| keyword | 字符串 | trim，空字符串视为未选；普通文本包含匹配 |
| number | 编号输入字符串 | trim并去前导#，合法正整数按parseNumber；非空非法输入保留为无结果条件 |

重复查询参数采用第一项；未知参数忽略。全部条件取交集，空条件不限制。用编码后的规范参数重建URL，不拼接用户输入为路径。

### AdminWorkOrderRow / AdminListResult

- Row：number、status、severity、discipline、description、createdAt、assignee: Person、creator: Person。
- Result：items: AdminWorkOrderRow[]、total: 非负整数。
- 数据库同一筛选集合生成 items 及 total，必须满足 total = items.length；创建时间倒序、编号倒序稳定排序。无图片及完整处理记录负载。

### AdminDashboard

- project：id、name、city、customerName、projectType。
- total：当前项目所有工单数。
- statuses：pending、completed、rejected，均非负整数。
- pendingSeverities：minor、normal、major、urgent，均非负整数。
- pendingUrgent：等于 pendingSeverities.urgent。
- 不变量：total = 三状态之和；statuses.pending = 四风险之和；无记录必须显式返回所有零值。

## 安全与生命周期

- 新增读取函数使用 invoker，固定空search_path，对 authenticated 开放执行但在函数内复核唯一身份、角色及项目；匿名与其他角色不可读取管理员集合。
- 不接收 projectId、userId 或 role 来指定权限范围，不扩展 profiles 或现有业务表的读写策略。
- 不保存统计快照、浏览器身份权限副本或跨请求缓存；失效会话不能利用旧表单继续操作。
- 返回目标仅保存中心规范化路径及五类条件。详情自身的 status/sort 仍属于普通列表语义，管理条件嵌入 returnTo，避免混淆。
