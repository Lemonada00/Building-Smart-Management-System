# 技术研究

## 会话身份

决策：当前身份绑定 JWT session_id，在数据库只允许首次选择并校验 auth.sessions 存在。理由：防止修改 Cookie 和本地状态扩权，也可立即阻断已退出令牌。未采用客户端身份 Cookie 或用户可修改的 metadata；未采用账号级当前身份，因为会影响其他独立设备登录。

## 工号认证

决策：规范化工号映射至内部邮箱，再调用 signInWithPassword；用户不输入邮箱。管理脚本通过 Auth Admin 创建已确认账号，重复执行只复用已有专用模拟账号，不修改非模拟账号。

## 页面与动作

决策：Server Actions + useActionState 提供提交和中文错误；getUser 及数据库 RPC 校验身份，每个页面调用，不仅在 layout 中验证。依据本地 node_modules/next/dist/docs/01-app/02-guides/authentication.md 和 use-server、redirect 文档。

## 资料来源

Context7 工具未提供，采用本地匹配版本文档和官方 Supabase search_docs。官方资料： https://supabase.com/docs/guides/auth/sessions 、https://supabase.com/docs/reference/javascript/auth-signinwithpassword 。官方说明 session_id 对应 auth.sessions；已退出的短期 JWT 仍可能有效，故额外核验会话和本地撤销状态。changelog.md 已通过命令行获取并核对：近期 TLS 密码套件调整不影响当前 Node.js 客户端；当前未使用受 minor release 变更影响的扩展或加密数据。

备选：自建密码认证增加维护，用户级 metadata 不能绑定单次登录，单纯菜单隐藏不能实现权限控制，均不采用。
