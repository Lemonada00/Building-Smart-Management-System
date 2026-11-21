# 当前迭代启动与验证指南

当前助手运行时与 3 个迁移已实现；验收尚未全部通过，详见 verification.md。开发预览：http://127.0.0.1:3005/assistant。

## 配置已准备

.env.local 六项非空：Supabase URL、Publishable Key、Secret Key；OPENROUTER_BASE_URL、OPENROUTER_API_KEY、OPENROUTER_MODEL。已被 Git 忽略，不提交凭据。
当前模型 inclusionai/ling-3.0-flash-vl 在目录存在并支持 image/tools；OpenRouter /key、Supabase /auth/v1/settings 均 HTTP 200。真实模型查询、图片理解及上传已验证，剩余核心路径见 verification.md；不以连通代替业务验收。不需要 Coze 或其他服务变量。

## 实施启动顺序

1. 按 tasks.md 未勾选任务继续验收；已实现任务按实际状态勾选，Coze 继续延期。
2. Node >=22，按 plan 精确安装依赖并保留 lockfile，AI Elements 用官方 CLI 添加 conversation/message/prompt-input/tool，不绕过 peer 检查。
3. 按 Supabase 技能核对云端现状，再实施会话/快照、上传元数据/RLS、最小只读搜索及独立公开聊天桶。不能修改私有 work-order-photos 模式。
4. npm run dev，用已有三种角色账号登录 /assistant；凭据只从本地忽略文件读取。
5. 环境变量变更后重启服务；运行 npm run check。

## 电脑与手机核心路径

| 路径 | 预期结果 |
| --- | --- |
| 首次进入 | 中文欢迎；useChat 从当前会话 Supabase UIMessage[] hydrate |
| 真实流式发送 | OpenRouter 逐步响应；submitted/streaming 阻止重复发送 |
| 编号/自然语言查询 | createAgent 调用固定工具，真实结果符合当前身份 RLS |
| 管理员“我的” | 先追问本人发起/本人负责/项目全部 |
| 单/多结果 | 单条摘要卡、多条文字编号链接；宽屏抽屉、窄屏详情 |
| 越权和转派 | 不显示受限结果；旧链接重新鉴权，失权轮次不重新输入模型 |
| 真实图文/纯图 | 理解可见事实、不确定则追问；无知识依据不作合规结论 |
| 图片上传 | 9 张/每张 10 MiB/JPEG、PNG、WebP，返回 FileUIPart，预览移除正常 |
| 公开/私有区别 | 聊天桶公开 URL 可读；既有私有工单图片仍需鉴权 |
| 第7轮/刷新/切页 | 只保留 6 轮完整快照，刷新和切页同登录恢复 |
| 退出/更换身份 | 清空当前会话；迟到 onEnd 不复活快照，新登录无旧上下文 |
| 模型/上传/保存失败 | 中文错误、内容不闪空、SDK regenerate 不重复轮次 |
| 知识和建单边界 | Coze 未开放明确说明；建单尚未开放；无助手业务写入 |

将真实模型/图片/工具/快照和浏览器证据写入 verification.md，npm run check 通过后更新 progress.md。当前迭代验收不等于完整阶段 5 Coze 验收通过。
