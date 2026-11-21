# 实施计划：阶段 3 工单处理闭环

**分支**：实际 Git 分支 `master`；setup-plan 返回的 `003-work-order-processing` 是特性定位标识，没有切换分支。
**日期**：2026-10-29
**规范**：[spec.md](spec.md)

## 概述

复用阶段 2 的列表、详情、身份读取和记录展示，实现编辑、解决、拒绝、转派、重开及私有图片。小型表单通过 Server Actions 调用受控数据库函数，数据库事务统一变更工单、图片关联和记录；图片文件由浏览器会话直接上传 Storage，展示通过同源受鉴权读取接口。本阶段已按计划实现并验收，实际迁移与结果见 verification.md。

## 技术上下文

| 项目 | 决策 |
| --- | --- |
| 语言与运行时 | TypeScript 严格模式；当前 Node.js v24.20.0，沿用 npm |
| 主要依赖 | Next.js 16.4.3 App Router、React 19.3.0、Tailwind CSS 4、现有 shadcn/Radix、lucide-react |
| 数据接入 | @supabase/supabase-js 2.118.0、@supabase/ssr 0.12.7；每请求使用现有用户会话客户端 |
| 数据存储 | 现有 Supabase 项目；实查 PostgreSQL 17.11；新增私有 Storage 桶与照片元数据 |
| 验收 | 核心路径人工走查与 npm run check；不新增自动化测试 |
| 目标平台 | 电脑和手机浏览器；1440px、390px；1024px 沿用详情抽屉断点 |
| 项目类型 | 现有单体 Web 应用，延续目录与组件 |
| 性能目标 | 准备好文字的用户在 2 分钟内完成单次处理；上传中可见状态，避免重复提交 |
| 约束 | 当前会话唯一身份；工单变更与记录原子一致；失权后新图片请求拒绝；失败保留输入 |
| 规模 | 两个模拟项目、六账号、现有十六张工单；照片最多 9 张、每张 10 MiB、JPEG/PNG/WebP |

说明：规范中的“10 MB”在实现提示中明确为 10 MiB（10,485,760 字节），各层统一，不另设更小代理上传限制。无未解决技术澄清项。

## 宪章检查

| 门槛 | 研究前 | 设计后 |
| --- | --- | --- |
| 只交付阶段 3，不提前实现建单、管理员中心、大盘和 AI | 通过 | 通过 |
| 核心闭环、转派失权、周期历史完整 | 通过 | 通过：事务、版本、实时图片校验覆盖 |
| 直接简单，复用现有身份/详情，无通用工作流框架 | 通过 | 通过：一条受控命令入口与照片暂存表 |
| 人工核心路径与默认静态检查，不追加测试或部署 | 通过 | 通过 |
| 文档中文、密钥和普通会话边界保持 | 通过 | 通过：管理密钥仅现有离线数据准备使用 |

没有宪章例外。图片暂存与行版本分别直接对应取消/失败一致性和过期提交需求，不是扩展架构。

## 项目结构

### 本阶段文档

```text
specs/003-work-order-processing/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/processing-contract.md
├── quickstart.md
└── tasks.md                         # 后续 speckit-tasks 生成
```

### 应用改动位置（拟定）

```text
app/actions/work-orders.ts            # 小表单命令、候选、照片暂存预留/取消
app/api/work-orders/[number]/route.ts # 原只读详情扩展 DTO
app/api/work-orders/[number]/photos/[photoId]/route.ts # 每请求校验后传输图片
app/(workspace)/work-orders/[number]/page.tsx # 共用交互详情入口
components/work-orders/
  detail.tsx / detail-drawer.tsx / list.tsx / records.tsx
  detail-controller.tsx              # 编辑、弹框、输入/失败状态与刷新
  edit-form.tsx / operation-dialog.tsx / photos.tsx
lib/work-orders/
  types.ts / queries.ts
  mutations.ts / validation.ts / photos.ts
supabase/migrations/                 # 实现时以 CLI 生成阶段 3 迁移
scripts/seed-work-orders.mjs         # 增补模拟照片与必要场景，不重置已有处理
app/globals.css                     # 复用 wo-* 样式，补表单、弹框、照片
progress.md / AGENTS.md              # 实现完成时按实际能力同步
```

允许在实现中合并小文件，避免为目录树强行拆分。保留阶段 2 所有未提交改动，不清理或重置工作区。

## 阶段 0：研究结论

详见 [research.md](research.md)。已核对云端字段、RLS、空桶和 Storage 操作辅助函数；Context7 工具不可用，采用已安装 Next.js 文档、Supabase 技能及官方网络资料。选定：私有受控写函数、版本锁、会话直传暂存照片、同源无缓存图片读取、受操作类型限制的 Storage RLS。

## 阶段 1：设计与契约

1. **写入边界**：public SECURITY INVOKER 包装函数调用 private SECURITY DEFINER 窄函数，后者显式核验会话、身份、访问与动作资格。业务表继续禁止 authenticated 直接写，不能通过任意 UPDATE 绕开记录。
2. **事务与并发**：锁工单，重验资格，再比较 expectedVersion；成功后状态/问题字段/照片关系/版本与一条记录同时提交。重复点击和网络重试携带相同版本，最多一次变更；旧版本返回冲突，刷新后新操作必须使用新版本。
3. **图片边界**：预留暂存元数据后浏览器按会话上传不可变对象；保存前核验对象存在、大小、MIME、工单归属及上传者当前会话。图片删除先改变业务关联，不在保存前删除原文件；暂存及已移除对象不再公开读取，离线数据准备时清理无引用对象。
4. **展示权限**：照片 DTO 仅含同源地址；图片 GET 再校验当前身份，用会话 download 读取私有桶并输出 private,no-store。Storage SELECT 只允许 get_authenticated 操作且照片处于有效关联；禁止生成签名链接、公开读取、对象替换。普通账号也不能直接删除已关联对象。
5. **交互**：一个详情控制器供抽屉和独立页复用，保留草稿直至成功或用户取消；弹框分别收集各动作必填项。成功显式重读详情并刷新列表。转派成功只返回编号/新版本/失权标志，不能因提交后的详情读取失权误报写入失败。
6. **历史**：扩展 changes 键白名单加入 photos，仍用 before/after 字符串，记录图片 ID+名称摘要；旧记录兼容。解决记录保存完整归因和建议，重开清空当前字段但不改历史。

具体字段见 [data-model.md](data-model.md)，接口及错误见 [processing-contract.md](contracts/processing-contract.md)，人工验收见 [quickstart.md](quickstart.md)。

## 实施顺序与交付边界

先数据库权限/命令与 DTO，再处理弹框和闭环，再照片暂存及保存，最后联动刷新和人工走查。后续 tasks.md 按四个用户故事拆分，基础数据库事务和共享详情先行。完成后记录真实验收证据、执行 npm run check，并在同次交付更新 progress.md；规划通过不等于阶段完成。

## 复杂度追踪

无需要豁免的宪章违反项。暂不引入 ORM、队列、Realtime、通用状态机、额外存储服务、断点续传依赖或跨会话草稿。
