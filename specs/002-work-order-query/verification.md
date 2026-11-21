# 阶段 2 实现与验收记录

日期：2026-10-28。范围：工单数据与查询展示；不包含工单处理、图片存储、管理员中心、大盘和助手。

## 实施结果

- 新增 work_orders、work_order_records，两表开启 RLS，仅 authenticated SELECT，无业务写入策略。
- 当前会话身份沿用阶段1 private.valid_session/current_membership/current_project，新增 current_role 及最小读取 helper。普通表/RPC、详情页与抽屉都按当前身份隔离，不叠加本人其他角色或项目。
- 新增状态/排序普通列表、完整只读详情及倒序处理记录；>=1024px 普通点击打开右侧抽屉，窄屏、直链、新标签、刷新为独立详情。返回保留 status/sort，登录回跳仅白名单站内路径。
- seed:demo 复用原账号，新增固定模拟工单16张、记录32条；为 multi001 增加第二项目施工身份，现有两个项目、六账号、九条角色关系。已重复执行，账号密码未重置、样本数量未增加。只有离线种子使用服务端管理密钥。
- 模拟数据和必要权限/浏览器核验材料均位于忽略的 .local/；未新增自动化测试套件或运行时依赖。

## 迁移与资料核对

实施前重新查询云端：仅阶段1迁移及四张基础/身份表，公共基础数据为6资料、2项目、8角色关系。Context7 工具当前不可用，查阅 Supabase 技能、官方 RLS 文档与变更记录，以及 node_modules/next/dist/docs 内的已安装16.4.3文档。

CLI 初次因沙箱不能写用户目录运行信息失败；获准执行后通过 migration new --help 和 migration new work_order_query 生成 `20261028134118_work_order_query.sql`。通过连接器 apply_migration 应用至约定项目后，云端记录版本为 `20261028134223`；本地迁移同步命名为 `supabase/migrations/20261028134223_work_order_query.sql`，避免未来重复迁移。云端历史保留阶段1原迁移。

只读复核：16张工单、32条处理记录、9条角色关系，两张新表RLS开启、各一条SELECT策略；编号序列下一值2017。新增 service_role 专用 sync_work_order_sequence() 仅离线同步编号序列，普通管理员也不能执行；正式应用不使用此函数。

## 验收结果

| 范围 | 结果与依据 |
| --- | --- |
| 规范质量门禁 | requirements.md 16项已勾选、0项未勾选，只读检查，未修改清单 |
| 真实会话权限及数据 | 485项通过；临时记录 `.local/stage2-api-verification.json` |
| 浏览器核心路径 | 40项通过、0个浏览器脚本错误；`.local/stage2-browser-verification.json` |
| 安全回跳 | 7项通过，拒绝外域、协议/双斜线、反斜线、非法编号，合法详情及参数保持 |
| 六种筛选排序 | 质检员和施工方当前范围全部组合与预期一致，紧急置顶，非紧急不按严重程度排序；2002/2006同创建时间按编号稳定排序 |
| 详情与历史 | 三状态字段、六类操作、各条历史顺序及当次归因逐项核对；2004重开清空当前归因且保留首次结果，2010再次解决保留两次结果，2007拒绝后重开保留拒绝原因 |
| 电脑与手机 | 1440px右侧抽屉、390px独立详情，均无核心内容横向溢出；返回保留已结束/最旧筛选，新标签/直链/刷新独立展示 |
| 加载及异常 | 抽屉加载、关闭在途请求、读取失败后重试、空结果、未找到、无权限、会话失效与未选身份JSON反馈通过；列表提供导航pending及加载/错误边界 |
| 登录回跳 | 未登录访问详情后真实登录回到原工单并保留筛选；多身份账号进入选择页，未选择前详情GET拒绝，选定当前项目管理员后回到原详情 |
| 静态检查 | 最终 npm run check 结果见下方交付检查 |

真实会话矩阵覆盖 qc001/A质检、sg001/A施工、sg002/A施工、admin001/A管理员，以及 multi001 的A质检/A施工/A管理员/B管理员/B施工九个身份。每个身份核对两表读取范围、本人资料限制、普通列表角色限制、16张工单详情及全部可见记录、无效编号和直接写入拒绝。sg001不能读2011转派单；multi001施工身份不能因本人发起而读2012；A身份不能读B工单。退出后旧JWT、临时停用sg002成员后的读取均失败，停用成员已恢复。未登录/未选身份无业务数据。

浏览器截图已目视核对：`.local/stage2-initial.png`、`.local/stage2-desktop-drawer.png`、`.local/stage2-mobile-list.png`、`.local/stage2-mobile-detail.png`。本地开发工具曾遮住抽屉关闭按钮，调整按钮位置后关闭、Escape及重试走查通过。默认使用已有 http://127.0.0.1:3000 服务，未终止其他进程。

## 数据库建议与已知限制

- 本次新增表无未启用RLS或缺失SELECT策略问题；新表外键均有覆盖索引。
- 安全建议沿用阶段1状态：[private.login_identities 无普通用户策略](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)是有意仅通过私有受限函数访问；[泄露密码保护未启用](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)未在本次更改认证配置。
- 性能建议中既有身份表两个外键索引提示与新建索引尚未使用的INFO不阻断16单演示规模，不为此扩展无关优化。
- 图片能力留阶段3，本阶段无图片内容；编辑、解决、拒绝、转派和重开只有历史样本，未开放线上操作。管理员通过直链验收，工单中心留阶段4。
- 工单不可见与不存在只披露单编号结果，不返回受限业务字段；不开放成员目录。列表当前完整读取演示集，未引入分页产品能力。
- 种子通过固定标识upsert，出错即停止并可重跑修复，不报告部分写入成功；不提供生产批量导入能力。

## 交付检查

最终 `npm run check` 已通过：Biome检查51个文件，无待修复项；Next.js路由类型生成与 `tsc --noEmit` 通过。`git diff --check` 通过。本次未运行生产构建或部署，未创建提交。

## 扩展钩子

实施前后均无 `.specify/extensions.yml`，无 before_implement 或 after_implement 钩子需要执行。
