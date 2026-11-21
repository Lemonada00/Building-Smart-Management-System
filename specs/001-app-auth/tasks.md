# 任务：应用框架与登录身份

依据本目录 spec.md、plan.md、research.md、data-model.md 和 contracts/auth.md。无需新增自动化测试。

## 准备与基础

- [x] T001 完成 specs/001-app-auth/plan.md 及设计、契约与启动说明。
- [x] T002 在 supabase/migrations/ 建立资料、项目、成员和会话身份及最小 RLS/RPC。
- [x] T003 在 scripts/seed-demo.mjs 与 package.json 实现可重复准备模拟项目与账号，凭据仅保存在 .local/。

## 用户故事 1：工号登录（P1）

独立验收：三类单身份正确登录直接进入，错误密码与服务失败明确提示。

- [x] T004 [US1] 在 lib/auth/ 和 app/actions/auth.ts 实现认证、内部工号映射及服务端上下文读取。
- [x] T005 [US1] 在 app/login/page.tsx、components/auth/login-form.tsx 实现原型登录与进行态。

## 用户故事 2：唯一身份（P1）

独立验收：未选择不能进入，选择后刷新保留，同会话换角色与伪造被拒绝。

- [x] T006 [US2] 在 app/select-identity/page.tsx 和 components/auth/identity-form.tsx 实现身份弹窗和零身份、失效状态。
- [x] T007 [US2] 在 lib/auth/context.ts 和 app/(workspace)/ 路由中逐页验证登录、身份与角色，保留合法目标。

## 用户故事 3：响应式框架（P2）

独立验收：三角色菜单、390px/1440px 布局、抽屉关闭及越权直链。

- [x] T008 [US3] 在 components/app-shell.tsx、app/globals.css 实现导航、头像兜底和当前身份。
- [x] T009 [US3] 在 app/(workspace)/ 页面实现业务占位、无权限、加载与失败重试，更新 app/layout.tsx 元信息。

## 用户故事 4：退出重登（P2）

独立验收：退出清理、旧令牌不可访问、重登重新选择。

- [x] T010 [US4] 在 app/actions/auth.ts、components/auth/logout-form.tsx 实现撤销会话身份及退出反馈。

## 收尾

- [x] T011 按 specs/001-app-auth/quickstart.md 完成浏览器与数据库核心路径走查，在 verification.md 记录证据。
- [x] T012 运行 npm run check，更新 AGENTS.md、progress.md 和本 tasks.md 为实际状态。

## 依赖、并行与交付策略

T001 → T002 → T003；T004 → T005/T006 → T007 → T008/T009 → T010 → T011 → T012。基础就绪后，登录表单与身份选择界面可在不同文件并行处理；框架与占位页也可分别处理，本次顺序实施以减少共享文件冲突。最小切片为 US1，但本次必须完成全部四个故事才能标记阶段完成。
