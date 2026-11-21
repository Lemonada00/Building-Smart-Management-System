# 管理员工作台契约

## 页面与查询条件

| 页面 | 路径 | 权限及默认行为 |
| --- | --- | --- |
| 工单中心 | /admin/work-orders | 当前admin；裸路径无筛选 |
| 数据大盘 | /dashboard | 当前admin；当前项目全量统计 |
| 共用详情 | /work-orders/{number} | 沿用工单权限；管理员可附安全returnTo |

中心支持 status、severity、discipline、keyword、number，值及规范化见 [data-model.md](../data-model.md)。筛选提交导航到规范化URL；清空及菜单入口回裸路径。窄屏卡片与宽屏表格必须使用相同结果、数量和条件。

关键词和编号分别输入；关键词匹配 description/location/details 任一字段，其他筛选与之取交集。编号使用当前项目实际整数编号（显示 #数字），不采用原型中的 WO- 示例格式。非空非法编号匹配零条，不能清除编号条件后返回全部结果。

## 只读 RPC（实施时新增）

### list_admin_work_orders

输入参数：p_status text、p_severity text、p_discipline text、p_keyword text、p_number text，均默认 null。p_number 使用文本是为了明确保留非法非空输入的零结果语义，验证合法后才转换为整数；超界不触发整数转换异常。

返回单个 jsonb 对象：

```json
{
  "items": [
    {
      "number": 1001,
      "status": "pending",
      "severity": "urgent",
      "discipline": "structure",
      "description": "结构裂缝待复核",
      "createdAt": "2026-10-29T01:00:00Z",
      "assignee": { "id": "施工方用户标识", "name": "责任人姓名" },
      "creator": { "id": "发起人用户标识", "name": "发起人姓名" }
    }
  ],
  "total": 1
}
```

示例仅说明结构，不代表预置账号或实际工单。全部字段必有，空结果为 items=[]、total=0。排序 created_at desc、number desc。使用同一匹配集合汇总完整数组及total，不使用前端当前页计数代替总数。

### get_admin_dashboard

无输入参数。返回单个 jsonb 对象：

```json
{
  "project": {
    "id": "当前项目标识",
    "name": "模拟项目",
    "city": "项目城市",
    "customerName": "客户名称",
    "projectType": "住宅"
  },
  "total": 3,
  "statuses": { "pending": 1, "completed": 1, "rejected": 1 },
  "pendingSeverities": { "minor": 0, "normal": 0, "major": 0, "urgent": 1 },
  "pendingUrgent": 1
}
```

所有指标一次查询获得，所有键始终存在；有效空项目返回真实项目信息和全部零值。身份或项目不存在时拒绝，不能返回伪空项目。

### 共同授权及错误

- 不接收用户或项目权限参数，数据库根据已验证会话唯一身份推导。
- SECURITY INVOKER、固定空search_path，工单RLS继续生效；内部显式校验有效membership、admin角色及当前项目。
- 撤销 PUBLIC、anon 执行权限，只授予 authenticated；非管理员即便直接调用也必须失败。
- 页面与 server-only 读取层独立校验；无登录引导登录，无身份引导选择，非管理员显示无权限；数据库拒绝使用42501，业务读取失败显示中文错误和重试，不能返回正常零值。
- 不放宽 profiles 读取权限，人员姓名通过既有受控辅助函数获取。

## 9 个指标跳转入口

| 点击对象 | 中心查询条件 |
| --- | --- |
| 总数 | 无 |
| 待处理 | status=pending |
| 已完成 | status=completed |
| 已拒绝 | status=rejected |
| 轻微风险 | status=pending&severity=minor |
| 一般风险 | status=pending&severity=normal |
| 严重风险 | status=pending&severity=major |
| 紧急风险 | status=pending&severity=urgent |
| 重点紧急提示 | status=pending&severity=urgent |

重复展示的同口径指标复用同一链接。零值同样可点击；大盘进入中心不携带前次关键词等残留条件。

## 详情、操作与数据更新

- 普通单击且视口≥1024px时打开既有抽屉，保留可访问的真实详情href；修饰键、新标签及窄屏沿用标准链接行为。
- 详情链接示例：`/work-orders/1001?returnTo=%2Fadmin%2Fwork-orders%3Fstatus%3Dpending%26severity%3Durgent`。
- returnTo解析只接受确切 `/admin/work-orders` 路径及五项白名单条件，重建规范化本地URL。外链、协议相对URL、反斜杠、嵌套returnTo及其他路径丢弃，回退裸中心；非管理员忽略管理returnTo。
- safeTarget同步支持规范化管理中心条件及详情returnTo，保证登录/身份选择之后不丢筛选，不扩大可访问路径范围。
- 写入继续使用既有 submitWorkOrderCommand / process_work_order，expectedVersion、原因、字段约束及图片规则全部保留；不新建管理员写接口。
- 操作成功触发中心refresh；详情按既有API重新读取。即使列表变空，抽屉仍可展示最新详情，用户主动关闭后呈现空结果。
- 大盘重新查询必须服务端读取最新值，不复用持久数据缓存。进入时避免旧预取结果，提供明确刷新操作；本阶段不要求后台实时更新或跨页面推送。

## 展示与状态

宽屏九列字段齐全；窄屏可转卡片，保留编号、状态、严重程度、专业、摘要、时间、发起人、责任人及详情入口。紧急突出，完整描述留在详情。筛选草稿与生效条件可区分；提交显示pending、错误保留输入。加载、零值、空结果、无权限和失败均有独立说明。
