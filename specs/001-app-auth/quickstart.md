# 启动与人工验收

1. npm ci；配置 .env.local 的 Supabase URL、Publishable Key 和供离线准备使用的 SUPABASE_SECRET_KEY。
2. 将 supabase/migrations 中本阶段迁移应用至约定云项目；执行 npm run seed:demo。脚本将随机密码保存在 Git 忽略的 .local/demo-accounts.json，不在终端输出密码；重复运行复用账号。
3. npm run dev，打开 http://localhost:3000 。工号和密码见本地账号文件。
4. 用单身份质检员、施工方、管理员依次登录，验证默认助手与菜单矩阵；错误密码有中文提示。
5. 多身份登录前直访 /dashboard；先选择施工方，验证无权限提示；退出重登选择管理员，验证可进入。
6. 身份选择前刷新、业务直链不得绕过；选择后刷新保留；零身份账号不能进入；其他用户身份及同会话换角色请求被拒绝。
7. 390px 和 1440px 下检查登录、身份弹窗、菜单开关、身份信息、退出；所有业务入口明确未开放。
8. 核验匿名表读取和普通账号写入被拒绝，当前项目之外读取为空；退出后的原令牌失去 RPC 访问权限。
9. npm run check；记录实际结果于 verification.md 和 progress.md。不要求自动化测试或部署。
