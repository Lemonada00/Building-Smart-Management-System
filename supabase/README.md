# 数据库迁移与演示数据

阶段 1 迁移为 `migrations/20261027132653_app_auth_identity.sql`，已通过 Supabase MCP 应用至项目 `lvwlxhgsixyrcpdnbgpg`，本地版本号与云端历史一致，无需重复应用。

新环境沿用云项目时只需配置 `.env.local`；如重建空数据库，先按迁移顺序应用 SQL，再执行 `npm run seed:demo`。脚本要求此云项目的 `SUPABASE_SECRET_KEY`，仅在本地离线运行，不导入应用运行时代码。

演示项目为云栖未来社区（模拟）、滨江智造园（模拟）。工号 `qc001` 为质检员，`sg001`、`sg002` 为施工方，`admin001` 为管理员，`multi001` 有同项目三角色和第二项目管理员身份，`empty001` 用于零身份走查。

随机密码仅保存在 `.local/demo-accounts.json`；该目录被 Git 忽略。重复执行复用账号、项目及成员关系，不增加重复记录，不重置密码。请保留本地账号文件；已有账号但文件丢失时脚本停止，需从安全备份恢复凭据。

`profiles`、`projects`、`project_memberships` 开启 RLS，仅授权必要读取；客户端不具有写入权限。`private.login_identities` 故意不配置普通用户策略和表权限，仅允许受控私有函数处理；公开 RPC 是 invoker 包装。当前身份绑定登录会话而非账号全局状态，退出后即撤销，不接受客户端提供的用户或项目作为鉴权依据。
