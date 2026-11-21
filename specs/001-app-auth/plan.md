# 实施计划：应用框架与登录身份

日期：2026-10-27；规范：[spec.md](spec.md)。沿用当前工作区，不自动提交。

## 摘要

交付真实工号密码认证、单身份自动进入、多身份选择、响应式导航及退出；其他业务页面明确占位。

## 技术上下文

使用现有 Next.js 16.4.3、React 19.3、TypeScript、Tailwind 4、shadcn/ui 和 Supabase SSR，不新增运行时依赖。Server Actions 处理登录、选择和退出；页面每次读取时复核身份，不依赖布局鉴权。工号规范为小写字母、数字、连字符，映射至内部认证邮箱，姓名和部门保存在 profiles。

## 宪章检查

研究前、设计后均通过：范围限阶段 1，直接使用现有框架；中文文档；必要人工走查及 npm run check；不添加自动化测试、覆盖率、无障碍专项或通用架构。

## 设计

公开业务表 profiles、projects、project_memberships 开启 RLS，只授予必要读取；写入由离线准备脚本使用管理密钥完成。当前身份存在 private.login_identities，以经过签名的 JWT session_id 为主键，每个登录会话只能选择一次。私有函数明确校验 auth.uid、auth.sessions、项目和成员关系；公开 RPC 仅使用 SECURITY INVOKER 包装。退出先撤销当前身份，阻断残留访问令牌，再退出认证。

登录页采用原型居中表单、白底浅蓝；宽屏 256px 左侧栏，窄屏抽屉；业务入口按角色显示，未开放能力用说明页呈现。所有鉴权错误可重试。

## 目录

- app/login、app/select-identity：登录和身份选择。
- app/(workspace)/[section]：助手、工单、大盘、管理员中心及越权反馈。
- app/actions/auth.ts、lib/auth/：服务端动作、会话读取与角色菜单。
- components/auth/、components/app-shell.tsx：表单与导航。
- supabase/migrations/：可复现迁移；scripts/seed-demo.mjs：可重复准备模拟数据。
- 本目录 research.md、data-model.md、contracts/auth.md、quickstart.md、tasks.md：设计、任务和验收。

## 实施顺序与验收

数据与权限 → 准备账号 → 登录及身份选择 → 导航及退出 → 浏览器核心路径与权限核查 → npm run check → 更新 progress.md。390px 和 1440px 下走查；真实云端认证，不使用模拟登录。开发服务提供 localhost 预览，公网部署留在阶段 7。
