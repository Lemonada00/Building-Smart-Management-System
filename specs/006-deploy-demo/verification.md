# 第 7 阶段验收记录

## 本地与云端准备

| 检查 | 实际结果 |
| --- | --- |
| 规范质量 | 通过，见 [需求检查表](checklists/requirements.md)。 |
| 默认检查 | `npm run check` 通过。 |
| 生产构建 | 默认 Turbopack 在沙箱内无法下载 Geist 字体。允许联网重试后，本机 Turbopack 在 CSS 处理阶段启动 Node 子进程失败。联网执行 `npm run build -- --webpack` 成功，生产服务可启动。Vercel 默认构建待验证。 |
| 模拟数据 | 对现有 Supabase 项目执行 `npm run seed:demo` 成功。六个账号、三个项目与 16 张基础样本就绪，已有工单和照片保留。额外的失效草稿照片清理查询发出警告，模拟数据准备继续完成。 |
| 本地文件排除 | 新增 `.vercelignore`，排除本地环境文件、验收凭据、插件配置和原型导出。 |
| Coze 直连 | 使用同一适配器分别以混凝土养护和知识库覆盖内容发起独立查询，两次均返回不可用。尚无可核对的规范来源。 |
| 本地生产服务 | 登录页返回 200，匿名工单请求返回 401。用模拟管理员身份完成文字、模拟图上传和图文对话，两轮均返回 200 并保存会话，Coze 均返回不可用，助手提示无依据。 |
| Vercel | 查询 `jyjy1` 团队项目返回 403，当前连接需该团队授权。暂无公网地址或部署版本。 |

## 待验收

按 [演示步骤](quickstart.md) 完成线上登录、真实咨询、三角色闭环、两种视口及权限走查。此前各阶段本地验收记录保留在对应规格目录。第 6 阶段有来源的知识答复和后续报事仍是完整上线验收的依赖。

## 2026-11-20 实施核查

T001 完成，package.json 与 package-lock.json 根包 engines.node 固定 24.x，本机为 v24.20.0。Vercel 官方支持该主版本，部署时仍需核对实际日志。[版本说明](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

T002 完成，重新查询项目为 ACTIVE_HEALTHY，区域 ap-southeast-1。幂等 seed 成功核实六账号、三项目、16 张基础样本与管理员空项目。无引用失效草稿照片清理仍发出警告，未据此宣称清理完成。

默认检查 npm run check 通过。忽略规则已验证覆盖 .env.local、.local/demo-accounts.json 和 .codex/config.toml。

T003 受阻，目标团队 team_7AGzQ5a3BWAjlRSCXJTtddW5（jyjy1）再次返回 403。无法核实目标项目与 Production 设置，尚无公网候选。遵循当前任务依赖，基础部署实施待团队访问恢复。任务 T004～T023 保持未完成。

## 2026-11-20 部署目标调整

用户指定优先部署 Netlify。新增 netlify.toml，构建命令为 npm run build -- --webpack，发布目录 .next，Node.js 24。使用自动 Next.js OpenNext 适配器。已将 .netlify/ 加入 Git 忽略。生产构建重试通过，首次构建结束时曾出现 Next.js 升级提示。Netlify CLI 正在首次安装，尚未确认账号与站点，公网发布待执行。

Netlify CLI 27.20.1 安装完成。status 确认未登录，已创建官方登录授权请求。本轮 npm run check 与 npm run build -- --webpack 均通过。尚未创建远程站点或上传环境变量，待用户完成 Netlify 账号授权。

## production 发布与可用性

2026-11-20 production 已发布。项目 ID 825a433d-a18e-476d-a282-1106aa4de6e2，团队 lemonada00，部署 ID 6b0042fac6fa426034a2db59。公网入口 https://architecture-intelligence.netlify.app，部署日志 https://app.netlify.com/projects/architecture-intelligence/deploys/6b0042fac6fa426034a2db59。

用户已授权上传 .env.example 对应九项配置，并确认 production 公开访问。Deploy Preview 保持 Private。

生产构建与类型检查通过。Netlify 生成的 Windows CJS 文件 URL 缺少根斜线，修复生成代码后 Edge 打包通过。复用已完成的 Runtime 5.16.6 产物发布，后续构建依赖已固定为 5.16.8。scripts/fix-netlify-windows.mjs 提供同类生成代码修复。最终发布显式选择 .netlify/static 和 functions-internal，Edge manifest 自动参与打包，上传 30 个静态文件、一个服务端函数和一个 Edge Function。

Playwright 真实登录在 1440px 和 390px 均通过，助手页面可加载，授权工单 #2017 读取返回 200，匿名请求返回 401。登录页公网 HTTP 200。浏览器证据及结果保留在忽略目录 .local/netlify-production-check.json、netlify-1440.png 和 netlify-390.png。

追加真实模型查询验证被自动审批拒绝，理由为未明确授权具体私有工单数据发送到 OpenRouter。本轮未执行该追加验证。Coze 有来源答复、10 MiB 图片平台适配与三角色全流程仍按原任务待验，阶段 7 保持进行中。

2026-11-21 用户要求继续部署 Vercel。重新查询 jyjy1 团队仍返回 403，已生成新的团队授权请求。Vercel 上传排除增加 .netlify/，避免上传 Netlify 本地生成物。待团队授权及明确 Vercel 环境变量传输授权后继续。

## 2026-11-21 Vercel production

用户完成 lemonada00 团队授权并明确允许九项环境配置用于 Vercel。项目 prj_bUXHtMikGgRgMElLKUeu2GVY3UM2，部署 dpl_5QuPaGB5tvheHc324bVdYy2PAKBs，状态 READY，区域 sin1，Node.js 24，Webpack 云端构建通过。来源应用代码基线 01ff2f4，通过连接上传 113 个应用文件。

入口 https://architecture-intelligence-lemonada00.vercel.app，别名 https://architecture-intelligence-puce.vercel.app。1440px 与 390px 均通过真实质检员登录、助手加载及 #2017 授权读取；匿名工单请求返回 401。首次 API 客户端遇到本机 DNS 超时，改由浏览器网络请求验证通过。结果在 .local/vercel-production-check.json。知识成功、完整三角色闭环与大图适配仍待验，未把部署成功标记为阶段七全部完成。

2026-11-21 双平台交付复核：Netlify production 6b0042fac6fa426034a2db59 保持 ready，Vercel production dpl_5QuPaGB5tvheHc324bVdYy2PAKBs 保持 READY。AGENTS.md 已包含两个项目、入口、关联和部署命令。npm run check 通过，保留完整 AI 和图片场景待验状态。
