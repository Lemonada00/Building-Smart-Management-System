# 实施计划：公网演示与全流程验收

**实际 Git 分支** `master`  
**功能标识** `006-deploy-demo`（setup-plan 输出的 BRANCH）  
**日期** 2026-11-20  
**规范** [spec.md](spec.md)

## 概要

将现有应用发布至 Netlify，沿用 Supabase 项目与模拟数据，通过真实咨询、确认建单、施工方解决、质检员重开和管理员查看证明核心路径。部署前解决平台图片传输限制，部署后核对权限和两种视口。

## 技术背景

| 项目 | 决策 |
| --- | --- |
| 语言与运行环境 | TypeScript 严格模式，Node.js 版本在实施时按锁文件和 Netlify 支持情况确认并固定 |
| 主要依赖 | Next.js 16.4.3、React 19.3.0、Supabase JS 2.118.0、SSR 0.12.7，精确版本沿用 lockfile |
| 存储 | 原 Supabase 数据库与 Storage，项目 lvwlxhgsixyrcpdnbgpg |
| 验证 | 必要人工走查、npm run check、生产构建及线上业务核验 |
| 目标平台 | Netlify Next.js Node.js 服务端，桌面和手机浏览器 |
| 项目类型 | 单体 Web 应用 |
| 性能与规模 | 公网演示，三角色、六个账号、三项目；390px/1440px；聊天现有 maxDuration 为 120 秒 |
| 约束 | 图片每张最多 10 MiB，工单最多九张；维持现有会话身份及 RLS；真实知识成功与失败均需验证 |

## 宪章检查

研究前和设计后均通过。范围聚焦第七阶段，复用现有认证、工单、草稿与存储。平台适配限于现有图片能力必需的修改。采用中文文档和必要人工验证。没有新增抽象层或质量专项。

## 项目结构

- 本功能文档位于 specs/006-deploy-demo/，包含 plan、research、data-model、quickstart、contracts 与既有 verification。
- app/api/chat/、app/actions/、components/assistant/ 和 lib/assistant/ 为咨询及照片上传适配入口。
- app/api/work-orders/ 与 lib/work-orders/ 为私有照片读取及权限核对入口。
- next.config.ts、package.json、.vercelignore 为构建和部署配置入口。
- supabase/migrations/ 仅在现有权限无法满足受限直传时添加必要迁移。

## 阶段 0：研究结论

见 [research.md](research.md)。历史 Vercel 403、Coze 不可用与本地 Turbopack 失败作为待复核事实。研究发现平台请求体上限与现有 10 MiB 图片经服务端传输冲突，需要在实施阶段完成受限直传及私有大图读取适配。

## 阶段 1：设计

见 [数据模型](data-model.md)和[上线契约](contracts/deployment.md)。正式业务表沿用已有模型。上线候选必须可追溯到提交、环境和部署 ID。服务端环境变量按 .env.example 配置，密钥值独立管理。

## 实施顺序

1. 核对当前云端状态、团队权限与 Coze 文字和图文成功样例。公网部署可先推进，完整验收取决于知识成功路径。
2. 修复平台图片传输冲突，复核上传授权、确认关联、清理及私有读取。
3. 执行默认检查与生产构建。优先复测默认构建，若云端同样失败，采用已验证的 Webpack 并记录项目构建命令。
4. 确认团队、项目、Node.js 版本及环境变量，发布候选并记录版本。核对 Auth URL、Cookie 与身份跳转。
5. 按 quickstart 走查全部成功标准，填写 verification 和 progress。

## 实施入口条件

Netlify 团队访问、真实 Coze 依据、云端构建和图片适配均需实际证据。当前设计已明确处理路线，无待澄清的产品决策。

2026-11-20 切换前历史状态：Vercel 目标团队 jyjy1 的项目查询仍返回 403，项目与 Production 环境尚未核实。已完成 Node.js 24.x 固定及模拟数据复核。准备阶段 T003 受阻。


