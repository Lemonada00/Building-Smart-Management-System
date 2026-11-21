# 实现计划：阶段 2 工单数据与查询展示

**实际 Git 分支**：`master` | **日期**：2026-10-28 | **规范**：[spec.md](spec.md)

**输入**：`specs/002-work-order-query/spec.md`。setup-plan 返回的逻辑功能标识为 `002-work-order-query`，不表示已创建同名 Git 分支。

## 摘要

在现有登录与唯一会话身份上增加只读工单数据、普通列表与共用详情。使用两张业务表和按当前身份限定的读取策略，普通列表默认待处理、最新优先，紧急始终置顶；详情支持宽屏抽屉、窄屏及直链独立页面。复用现有 AppShell 和 Supabase 请求客户端，不新增 ORM、状态管理库或通用业务框架。

## 技术上下文

**语言与版本**：TypeScript 严格模式，Next.js 16.4.3、React 19.3.0；版本沿用 package.json 和 lockfile。

**主要依赖**：Tailwind CSS 4、现有 shadcn/ui、Radix UI、lucide-react；@supabase/supabase-js 2.118.0、@supabase/ssr 0.12.7。

**存储**：沿用 Supabase 云项目 `lvwlxhgsixyrcpdnbgpg`；增加 public.work_orders 与 public.work_order_records，复用 profiles、projects、project_memberships 和 private 会话函数。

**验证方式**：必要人工核心路径走查、临时会话请求核对 RLS 与写入拒绝、npm run check；不新增自动化测试套件。不默认构建或部署。

**目标平台与类型**：Next.js 单体 Web 应用，电脑与手机浏览器，390px / 1440px 核心路径。

**性能目标**：演示人员 1 分钟内完成指定工单查询核对；加载有即时过渡，不新增并发或吞吐验收指标。

**约束**：仅当前身份授权；普通 SSR/浏览器不得使用服务端管理密钥；不共享缓存身份数据；阶段 2 只读，无正式建单、处理操作、图片存储、管理员中心或 AI 调用。

**规模**：现有两项目、六账号、八条角色关系；计划预置 16 张工单及覆盖六类操作的历史，不建设分页产品能力。列表完整读取当前演示集，不以默认返回上限静默截断；未来超过返回上限时须另行明确分页范围。

## 宪章检查

| 门禁 | 研究前 | 设计后依据 |
| --- | --- | --- |
| MVP 范围优先 | 通过 | 仅 FR-001～014；图片、操作、管理员中心按原阶段边界延后 |
| 核心路径正确 | 通过 | 列表六组合、详情历史、会话权限和双宽度路径纳入 quickstart |
| 直接简单 | 通过 | 两表、少量定向读取函数和共用详情；无新运行时依赖、通用服务层或事件系统 |
| 最小验收 | 通过 | 人工核验与 npm run check；不新增测试、覆盖率、无障碍专项或默认部署 |
| 中文文档 | 通过 | 本阶段设计文档均为中文 |

初审与设计后复审均通过，无需例外。技术未知项已在 research.md 解决。

## 项目结构

### 本阶段文档

```text
specs/002-work-order-query/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/read-contract.md
├── quickstart.md
└── checklists/requirements.md
```

tasks.md 由下一步 speckit-tasks 生成，本命令不创建。

### 源码布局（待实现）

```text
app/(workspace)/work-orders/page.tsx
app/(workspace)/work-orders/[number]/page.tsx
app/(workspace)/work-orders/loading.tsx
app/(workspace)/work-orders/error.tsx
app/api/work-orders/[number]/route.ts
components/work-orders/                 # 筛选、列表、详情内容、抽屉
lib/work-orders/types.ts                # 枚举、DTO、筛选规范化
lib/work-orders/queries.ts              # server-only、请求内读取
lib/auth/types.ts                       # 安全回跳范围及详情导航选中规则
components/app-shell.tsx                # 详情归属普通列表选中态
supabase/migrations/                    # 实现时由 CLI 生成迁移文件
scripts/seed-demo.mjs                   # 复用账号准备并调用工单样本准备
scripts/seed-work-orders.mjs            # 固定模拟工单与处理记录
```

保留 catch-all 占位页承载尚未开放模块，静态 work-orders 路由优先承载本阶段业务。不为全局工作区新建平行或拦截路由。

## 阶段 0：研究结论

详见 [research.md](research.md)。已核对本地代码、已安装 Next.js 文档及 Supabase 当前官方文档；只读查询确认云端尚无工单表，现有 profiles 仅本人可读。Context7 当前未提供工具，按项目规则使用上述官方资料。规划未更改数据库。

## 阶段 1：设计与契约

- 数据、约束、授权和演示样本见 [data-model.md](data-model.md)。
- 页面、DTO、只读请求、错误与数据库函数边界见 [contracts/read-contract.md](contracts/read-contract.md)。
- 运行和人工验证见 [quickstart.md](quickstart.md)。
- 先建立并验证数据权限，再准备样本、打通独立详情、实现列表与抽屉，最后按 quickstart 验收及更新 progress.md。任务粒度留给 speckit-tasks。

## 复杂度跟踪

无宪章违规或额外架构。私有提权函数仅用于当前身份、可见工单关联姓名及单编号存在性判断，具体限制见数据模型；不以提权函数替代工单 RLS。
