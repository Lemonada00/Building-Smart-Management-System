# 数据模型

- profiles：id 对应 auth.users，employee_id 唯一，name、department 必填，avatar_url 选填。
- projects：id、name、city、customer_name、project_type、is_active；类型受四项枚举约束。
- project_memberships：id、user_id、project_id、role、is_active；用户、项目、角色组合唯一，角色为 inspector、contractor、admin。
- private.login_identities：session_id 对应 auth.sessions，user_id、membership_id、revoked；会话键唯一，成员关系删除后保留已选状态并使访问失效，不允许重新选另一个身份。

状态：未登录 → 已登录未选身份 → 已固定身份 → 已撤销；已撤销只可重新认证。单身份登录后自动完成选择。资料仅读本人，项目仅读当前身份项目；身份选择列表通过受控函数返回本人有效关系及项目名。普通账号无写入表权限。私有函数固定空 search_path，限定 authenticated 执行并校验 uid 和会话；管理脚本在服务端离线运行。
