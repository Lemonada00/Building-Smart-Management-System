# 登录与身份契约

- login(previousState, FormData)：employeeId、password、next；验证后固定单身份或进入身份选择，失败返回 message 和工号，不返回密码。
- selectIdentity(previousState, FormData)：membershipId、next；复核归属，已选其他身份时拒绝，成功进入应用。
- logout(previousState, FormData)：撤销当前身份并退出；失败中文提示。
- get_login_context()：返回本人 profile、本人有效 memberships 和 activeIdentity、selected、revoked。失效或其他用户会话拒绝。
- choose_identity(membership_id uuid)：只允许当前认证会话选择本人有效身份；重复相同选择幂等，不同选择拒绝。
- revoke_login_identity()：撤销本会话，不能重新选择。

页面：/login、/select-identity、/assistant、/work-orders、/dashboard、/admin/work-orders。next 仅接受上述四个业务路径；越权目标保留并展示无权限说明。质检员/施工方有助手、工单列表；管理员有助手、大盘、管理员工单中心。无身份时业务页面跳至身份选择。
