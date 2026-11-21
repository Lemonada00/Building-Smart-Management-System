# 交互与接口契约：工单处理闭环

日期：2026-10-29。命名为本阶段拟定契约，接口已按本契约实现，验收见 ../verification.md。

## 通用约束

浏览器只能使用 Publishable Key 与本人会话；普通 SSR、Action、Route Handler 均调用现有 createClient()。每入口校验登录与唯一身份，数据库再次核验业务权限。Server Actions 只接收小型结构化参数，文件字节不进入 Action。

public RPC 包装函数均为 SECURITY INVOKER；受控操作在 private SECURITY DEFINER 函数中执行。所有新函数先撤销 PUBLIC/anon 执行权限，再按需授予 authenticated；业务表不开放普通直接写入。

## 1. 详情与列表

已有 `GET /api/work-orders/{number}` 保留 `{data:WorkOrderDetail}` 和既有错误封装，新增 version、allowedActions，photos 改为图片对象数组。已有 get_work_order、list_work_orders RPC 同步产生兼容 DTO，列表最多使用首图展示。

allowedActions 为当前身份和状态的即时展示快照，不是写权限凭据。所有响应使用 Cache-Control: private,no-store，详情与列表不缓存为跨身份数据。

## 2. 命令 Action 与数据库 RPC

Action `submitWorkOrderCommand(input)`，内部调用 `public.process_work_order(p_number,p_expected_version,p_action,p_payload)`。

公共参数：number 为有效正整数编号，expectedVersion 为读取时取得的正整数，action 为下表枚举；payload 严格按动作允许字段验证，拒绝未知或越权字段。

| action | payload | 必填与效果 |
| --- | --- | --- |
| edit | severity,discipline,description,location,details,photoIds | 前四项非空；details 可空；photoIds 是要保留的完整有序 ID 列表，含新上传；不能带 assignee/status/rootCause 等 |
| resolve | rootCause,prevention | rootCause 非空；prevention 缺失/空白转 null，不保留旧值 |
| reject | reason | 非空 |
| assign | assigneeId,reason | 新责任人和原因非空；必须是同项目活跃施工方，排除原责任人 |
| reopen | reason | 非空；当前责任人不变 |

成功返回 `{ok:true,number,version,accessLost:boolean}`，不包含提交后未经授权的详情。转派给其他人后原施工方 accessLost=true；管理员仍可访问。空编辑返回 `{ok:true,unchanged:true,number,version,accessLost:false}`，不产生记录，并显示“没有修改”。

失败返回 `{ok:false,error:{code,message,fields?}}`。Action 自身不抛出业务错误或在成功写入后因重读失败改报提交失败。

| code | 意义 | 界面行为 |
| --- | --- | --- |
| UNAUTHENTICATED | 会话失效 | 提供重新登录，停止提交 |
| IDENTITY_REQUIRED | 无当前有效身份 | 提供选择身份入口 |
| NOT_FOUND | 工单不存在 | 明确提示 |
| FORBIDDEN | 当前身份无读取/操作权限 | 移除操作入口，不可重试写入 |
| VALIDATION_FAILED | 必填、格式、枚举、候选、照片非法 | 原输入保留，标注对应项 |
| CONFLICT | 版本已变或状态已改变 | 保留草稿，提示加载最新内容后人工核对，不自动覆盖 |
| PHOTO_NOT_READY | 照片不存在或元数据不符 | 保留草稿和可恢复选择，允许重传 |
| WRITE_FAILED | 事务失败或网络结果不确定 | 保留草稿，允许先刷新确认处理记录 |

数据库错误要转成稳定业务 code，不回传原始 SQL 或内部密钥。传输中断不能证明未提交：使用原 expectedVersion 重试，若冲突则读取最新记录确认；不得自动取得新版本并重放旧命令。

## 3. 指派候选

Action `getWorkOrderAssignees(number)` 调用 `public.list_work_order_assignees(p_number)`。

只允许当前身份有权指派该 pending 工单时调用，返回 `{id,name,employeeId,department}[]`，排除当前责任人、无效项目成员及其他项目人员。空数组提示“当前项目没有其他可指派施工方”。提交仍重新验证成员关系，不能信任旧候选。

## 4. 照片上传与取消

1. 选择文件后先本地验证 JPEG/PNG/WebP、1～10485760 字节、编辑后总数≤9；以 Object URL 展示预览，关闭时释放。
2. Action `prepareWorkOrderPhoto({number,name,mimeType,size})` 调用 `public.prepare_work_order_photo`；检查当前待处理编辑权限，生成 staged 元数据，返回 `{photoId,bucket:'work-order-photos',path}`，不增加工单版本/处理记录。
3. 浏览器使用现有会话 `.storage.from(bucket).upload(path,file,{upsert:false,contentType:mimeType,cacheControl:"0, no-store"})`；逐文件显示上传状态。上传失败保留 File，重试可新预留；不得覆盖既有对象。
4. 全部选择照片成功后，在 edit.photoIds 中提交完整保留列表；数据库核对实际对象元数据与预留，并在编辑事务中 staged→attached、被移除 attached→removed。上传尚未成功不得提交为现场图片。
5. 取消调用 `discardWorkOrderPhotos({number,photoIds})`，只使本人当前会话 staged 预留失效，不修改任何 attached 内容。取消请求失败不阻塞退出，正式工单仍未改变，24 小时后预留自动失去提交资格。
6. 上传后保存冲突：保留 staged 和草稿，可在确认最新内容后重用未过期预留；若已失权只能退出，不能再上传/关联。

不能提交自选 object_path、uploaderId、sessionId 或把其他工单图片 ID 混入。失效预留不能重新上传；物理无引用对象由离线辅助清理。

## 5. 图片 GET

`GET /api/work-orders/{number}/photos/{photoId}`：校验参数、登录、当前身份、图片属于该工单且已关联；使用同会话 Storage download。禁止重定向到签名地址，禁止缓存和图片优化代理。

成功返回图片字节与真实 Content-Type，Cache-Control: private,no-store、Vary: Cookie、X-Content-Type-Options: nosniff；不使用 304 缓存捷径。失败不返回图片；登录失效 401，身份/权限不足 403，不存在或已移除 404，存储读取失败 502。图片错误由组件展示“图片暂不可用”，不影响其余工单阅读。

Storage RLS 必须同时阻止普通 SDK createSignedUrl/createSignedUrls，不能只要求应用代码不用它们；必须实际核验 get_authenticated 下载通过而 sign 拒绝。直接 Storage 请求同样经过当前会话与工单权限，不能仅依赖应用 GET 前置检查。

## 6. 共享详情交互

- 纯展示保留现有信息分区与 wo-* 风格；编辑展示六类允许字段，其他字段只读；底部保存/取消。
- 操作弹框按动作提供归因/建议、原因或施工方选择；进行中禁止重复提交与关闭造成状态混乱，失败不清空输入。
- 宽屏抽屉与独立页使用同一个控制器。成功后显式重读详情，并 router.refresh 刷新列表；不能只 refresh 后期待抽屉 useState 自动变化。
- 因转派失权：关闭抽屉或独立页返回允许访问的列表，显示成功且责任已移交；管理员独立详情不跳到无权限的普通列表，返回其既有可访问入口。
- 筛选和排序继续通过已规范化的 URL 参数保存，回跳使用现有安全地址规则；失权后详情 GET 的失败不能反向覆盖提交成功提示。
- 加载最新内容时保留旧草稿供核对；只在明确取消、成功或用户确认采用最新内容时重置表单。


## 已实现补充

- 图片下载实际调用 `.download(path,{cacheNonce:crypto.randomUUID()},{cache:'no-store'})`，同源接口先读当前工单和 attached 关系；上传设置 `cacheControl:'0, no-store'`，保存时核验对应元数据。
- Storage 认证读取允许 get_authenticated 及认证信息读取 get_authenticated_info/head_authenticated_info，保留相同工单权限约束，签名仍禁止。
- 独立页转派后回到保留 status/sort 的列表，显示“工单已成功移交，当前身份不再负责该工单。”；空列表也保留成功提示。
- 已下载或边缘缓存的旧字节无法追溯撤回；应用不直接展示 Storage URL，新同源读取每次校验当前权限。
