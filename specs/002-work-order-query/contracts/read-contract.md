# 读取与页面契约

## 页面

| 入口 | 权限与行为 |
| --- | --- |
| /work-orders?status=pending&sort=newest | 质检员、施工方普通列表；管理员展示无权限，不查询普通列表 |
| /work-orders/[number]?status=ended&sort=oldest | 三角色均按工单读取权限；独立详情，查询参数仅决定返回普通列表筛选 |
| GET /api/work-orders/[number] | 宽屏抽屉读取，只返回 JSON，不重定向登录，不开放写方法 |

编号为 1～2147483647 十进制正整数；非法值按未找到处理，不进入存在性检查。status 允许 pending/ended/all，sort 允许 newest/oldest；缺失或非法分别归一 pending/newest。重复参数统一取第一项。页面异步 params/searchParams 在服务端解析，不信任客户端角色。

宽屏阈值 1024px。无修饰键主键点击打开右抽屉，其他点击遵循真实详情链接；窄屏直接跳详情。抽屉关闭不改变列表 URL，打开、关闭或切换编号时取消旧请求并忽略迟到响应，加载或失败不得保留前一工单正文。独立页面只从合法参数构造 /work-orders 返回链接；管理员返回 /admin/work-orders，保持现有占位。safeTarget 仅白名单扩展本页面范围，拒绝协议、双斜线、外域和不合法编号。详情导航按角色归属选中，管理员不新增工单列表菜单。

## 数据库只读 RPC

| 名称 | 输入 | 输出与授权 |
| --- | --- | --- |
| public.list_work_orders | p_status、p_sort | 当前身份可见的 WorkOrderSummary[]；仅普通列表角色，RLS 查询及固定排序，无任意 filter/sql |
| public.get_work_order | p_number | 单一结果判别联合：ok + detail，或 forbidden/not_found；有效身份必需 |

两者 SECURITY INVOKER，内部 SELECT 受 RLS。列表只读当前项目并加当前角色关系筛选，同时仍以 RLS 为最终约束。获取人名调用数据模型中的私有定向 helper，不直接扩大 profiles 权限。禁止客户端提交 project_id、role、user_id 或 session_id 作为授权依据。无有效会话或当前身份返回权限错误，应用按登录状态映射，不对其执行编号存在性查询。

## DTO

- WorkOrderSummary：number、status、severity、discipline、description、location、createdAt、assignee {id,name}、photos（本阶段 []）。
- WorkOrderDetail：上述字段，加 project {id,name}、creator {id,name}、details、rootCause、prevention、records、people（仅当前可见单关联人员 id/name 映射，用于历史责任人变更显示）。
- Record：id、action、actor {id,name}、occurredAt、reason、changes、rootCause、prevention。changes 为业务字段 before/after；人员 id 仅用可见单关联姓名补足。
- 时间使用 ISO 8601 传输，界面统一以 Asia/Shanghai 中文日期时间展示；空选填字段使用 null，空数组为 []，中文标签由共享枚举映射产生。
- 不返回凭据、邮箱、完整人员资料、其他项目成员、seed_key 或内部登录身份表。

## 详情 GET 响应

| HTTP | JSON | 界面 |
| --- | --- | --- |
| 200 | {data: WorkOrderDetail} | 共用详情内容 |
| 401 | {error:{code:'UNAUTHENTICATED',message}} | 登录已失效，提供安全登录入口 |
| 403 | {error:{code:'IDENTITY_REQUIRED',message}} | 需要先选择身份 |
| 403 | {error:{code:'FORBIDDEN',message}} | 当前身份无法查看 |
| 404 | {error:{code:'NOT_FOUND',message}} | 未找到工单 |
| 500 | {error:{code:'READ_FAILED',message}} | 读取失败，请重试 |

message 为固定中文，不直接返回数据库错误。所有响应含 Cache-Control: private, no-store。GET Handler 通过 getLoginContext 检查会话，不调用会产生 HTML 重定向的 requireIdentity；随后调用与页面相同的 server-only 查询函数。页面继续 requireIdentity，使用相同领域结果展示无权限或未找到。错误边界提供重试，未授权数据不进入页面 props 或抽屉缓存。

## 验收映射

列表参数与排序对应 FR-004～006、SC-002；详情字段和历史对应 FR-007～008、SC-003；页面与抽屉对应 FR-009、012、SC-004；所有入口及底层表/函数权限对应 FR-003、010、SC-001、005。图片与处理操作不作为可用能力展示。
