# 阶段 3 实施与验收记录

日期：2026-10-29。状态：已完成核心路径验收与默认静态检查。

## 完成范围

实现待处理工单六类问题字段编辑、解决、拒绝、指派、重新打开；当前处理周期和历史结果分离；数据库事务统一更新工单/照片关系/一条处理记录，版本防止旧表单覆盖与重复提交。共用详情控制器同时服务宽屏抽屉、手机独立页和直链；操作入口位于详情顶部，编辑表单替换问题信息区，其余信息只读。

私有照片支持 JPEG/PNG/WebP、每张 10 MiB、每工单 9 张、上传/删除/缩略图/大图。暂存和正式关联分开，保存或取消以业务事务为边界；上传失败保留本地选择，版本冲突保留输入并人工核对，转派后应用图片新请求失权。

开始时工作区已有阶段 2 页面、组件、迁移、seed 及文档改动，全部保留，未重置、提交或部署。requirements.md 16/16 通过且只读未修改；没有 extensions.yml，前置/后置钩子均跳过。忽略文件已覆盖环境变量、.local、依赖与构建输出。

## 已应用迁移

均通过已安装 Supabase CLI 生成文件名，经 Supabase MCP apply_migration 应用到既有项目；未修改已经应用的迁移。

| 文件 | 作用 |
| --- | --- |
| 20261029082507_work_order_processing_base.sql | 工单版本、受控原子命令、资格快照、解决/拒绝 |
| 20261029082934_work_order_processing_reopen.sql | 开放重开操作 |
| 20261029082935_work_order_processing_assign.sql | 当前项目候选与指派 |
| 20261029083036_work_order_processing_photos.sql | 私有照片表/桶/RLS、暂存、取消、编辑事务、图片 DTO |
| 20261029083822_work_order_photo_download_metadata.sql | 适配实际 Storage 认证元数据读取操作，签名仍拒绝 |
| 20261029084151_work_order_photo_no_cache.sql | 保存时校验图片禁止缓存元数据 |
| 20261029090734_work_order_photo_column_access.sql | 普通照片 SELECT 不开放上传会话标识 |

实施前重新核对云端字段、约束、身份函数、RLS 和空桶，确认 Storage operation helper 存在。Context7 当前没有可调用工具，采用安装版 Next.js 文档、Supabase 技能和官方函数/Storage 文档；资料及决策见 research.md。

## 验收证据

临时走查脚本和原始输出仅存 Git 忽略的 .local，不引入正式自动化测试、测试依赖或覆盖率任务。

| 核验 | 通过项 | 证据 |
| --- | ---: | --- |
| 基础流转真实会话 | 22 | .local/stage3-api-verification.json |
| 多周期、照片与转派真实会话 | 57 | .local/stage3-api-extended.json |
| 三角色×三状态×五动作及边界 | 206 | .local/stage3-matrix-verification.json |
| 图片归属、过期、跨会话、并发及撤销令牌 | 26 | .local/stage3-guard-verification.json |
| 浏览器核心路径 | 17 | .local/stage3-browser-verification.json |
| 浏览器失败恢复 | 6 | .local/stage3-browser-failure-verification.json |
| 手机独立详情转派/失权 | 5 | .local/stage3-browser-transfer.json |

共 311 项真实会话/数据核验，28 项浏览器核验；计数含登录与身份前置检查，不把它们称为独立业务场景。

核心结果：

- 解决→重开→再次解决、拒绝→重开→再次处理均通过；重开清空当前归因/建议，历次结果与原因可回看，再次解决不填建议不会沿用旧建议。
- 操作资格与按钮快照一致；非法角色/状态、跨项目、无关施工方、旧版本和直接写表均拒绝。并发相同版本两次提交恰好一次成功，对应记录数正确。
- 转派后原责任人详情、旧表单和新的认证图片读取拒绝；新责任人可继续读图和处理，发起人/管理员保留访问，历史操作人可解析。手机独立页成功提示与 status/sort 均保留。
- 图片暂存不可作为正式详情图片读取；缺失对象、尺寸不符、重复/超量 ID、跨工单、其他会话、已过期暂存均拒绝；取消不能改变已关联照片，删除后图片不再可读。
- 有权用户正常下载通过，createSignedUrl 拒绝、createSignedUrls 逐项拒绝，普通直接删除已关联文件不生效；上传会话列无普通读取权限。撤销身份后的旧 JWT 写入、预留和新的认证图片读取拒绝。
- 浏览器上传失败保留文字与 File 预览；另一个会话更新后旧编辑提交冲突，加载最新内容不抹掉草稿，取消后保留另一会话内容。
- 1440px 桌面与 390px 手机核心流程无横向溢出；抽屉中的操作弹框打开时 Escape 不关闭抽屉，取消后正常关闭；浏览器核心走查无运行时异常。已准备文字的单次操作在 2 分钟内完成并确认结果。
- 图片接口实际响应为 200 image/png、Cache-Control: private, no-store；应用每次先验证工单权限，再以新 cacheNonce 读取 Storage，不以签名地址展示。
- npm run seed:demo 重复执行对比工单、处理记录与 attached 图片完全不变；只补缺失初始样本及照片、清理无引用文件，验收清单输出实时内容。模拟图片为自制且明确标记 DEMO/SIMULATED 的现场示意，不冒充真实工程照片。

本地截图：.local/stage3-desktop-detail.png、.local/stage3-mobile-edit.png。浏览器脚本等待条件已按真实刷新和图片懒加载行为修正，最终成功结果见上表；早期探查失败不计入通过项。

## 完整数据流

| 边界 | 结论与证据 |
| --- | --- |
| 界面→Action | 编辑/解决/拒绝/重开/指派真实点击完成，失败保持表单 |
| Action→数据库 | 使用当前会话 RPC；权限、版本、状态在数据库重验 |
| 数据库→响应 | 工单和唯一记录原子提交；转派返回成功摘要而非越权重读 |
| 响应→界面 | 显式重读详情并刷新列表；失权退出详情并提示成功移交 |
| 照片→Storage→界面 | 预留后用户会话直传，编辑时关联，同源鉴权下载正常 |

## 默认检查与复核

- npm run check：Biome 检查及 next typegen/tsc --noEmit 全通过。
- git diff --check：交付前通过；未跳过提交钩子，本次未请求提交。
- 按 React 最佳实践复核本次组件：服务端函数自行鉴权、无运行时管理密钥、对象 URL 释放、外部事件清理、抽屉显式刷新、组件状态保留与稳定的角色类型。
- Supabase 安全顾问无新增业务表/函数权限警告。保留既有提示：private.login_identities 无直接 RLS 策略属私有受控访问设计；泄露密码保护未开启不在本阶段范围。参考 [RLS 提示](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)、[密码保护配置](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。性能顾问的早期身份表索引/低用量索引提示不扩展处理。

## 已知限制与下一步

- 已下载内容不能从用户设备撤回。直接复用曾下载的 Storage URL 可能命中已有边缘缓存，不能把缓存字节视为一次新授权；应用不展示该地址，所有新同源图片请求先查当前权限，转派/退出后拒绝。
- 图片移除是立即解除业务关联并阻断读取，物理无引用文件在下一次离线 seed 清理；不引入后台任务。草稿不跨刷新、关闭或退出保存。
- 管理员中心、大盘、助手与正式建单仍按后续阶段；本次没有构建、公网部署或提交。下一步为阶段 4 独立 SDD。
