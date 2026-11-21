import { writeFile } from "node:fs/promises";
import { seedWorkOrderPhotos } from "./seed-work-order-photos.mjs";

export async function seedWorkOrders(client, projects) {
  const checked = (response, label) => {
    if (response.error) throw new Error(`${label}：${response.error.message}`);
    return response.data;
  };
  const profiles = checked(
    await client.from("profiles").select("id,employee_id"),
    "读取演示人员",
  );
  const person = (employee) => {
    const p = profiles.find((p) => p.employee_id === employee);
    if (!p) throw new Error(`缺少演示人员 ${employee}`);
    return p.id;
  };
  const memberships = checked(
    await client.from("project_memberships").select("*"),
    "读取身份",
  );
  const uid = (index) =>
    `c2000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  const rid = (index, step) =>
    `d2000000-0000-4000-8000-${String(index * 100 + step).padStart(12, "0")}`;
  const titles = [
    "梁底混凝土蜂窝麻面",
    "楼梯踏步表面破损",
    "排水管接口渗漏",
    "墙面抹灰空鼓",
    "楼板钢筋保护层不足",
    "卫生间地漏标高偏高",
    "外墙窗框收口开裂",
    "柱边混凝土露筋",
    "屋面排水坡度不足",
    "模板接缝不严",
    "墙体砌筑灰缝不均",
    "地下室管道支架松动",
    "连廊栏杆节点偏位",
    "水管套管封堵缺失",
    "园区柱面蜂窝",
    "园区排水沟堵塞",
  ];
  const orders = [];
  const records = [];
  for (let index = 1; index <= 16; index++) {
    const projectId = projects[index > 14 ? 1 : 0].id;
    const creator =
      index > 14 || index === 12
        ? "multi001"
        : index === 14
          ? "admin001"
          : "qc001";
    const assignee =
      index > 14 || index === 13
        ? "multi001"
        : index === 11
          ? "sg002"
          : "sg001";
    const status = [2, 5, 8, 10, 16].includes(index)
      ? "completed"
      : [3, 6, 9].includes(index)
        ? "rejected"
        : "pending";
    const created = `2026-10-${String(10 + ([2, 6].includes(index) ? 1 : index)).padStart(2, "0")}T02:00:00.000Z`;
    const order = {
      id: uid(index),
      number: 2000 + index,
      project_id: projectId,
      creator_id: person(creator),
      assignee_id: person(assignee),
      created_at: created,
      status,
      severity: ["urgent", "minor", "normal", "major"][(index - 1) % 4],
      discipline: ["structure", "architecture", "plumbing"][(index - 1) % 3],
      description: `${titles[index - 1]}（模拟）`,
      location: `${index > 14 ? "厂房" : "住宅"} ${(index % 3) + 1}号楼 · ${index + 1}层 · 东侧施工段`,
      details:
        index === 2
          ? null
          : "现场巡检发现该处施工质量问题，请结合现场实际核对。本条为演示模拟数据。",
      root_cause:
        status === "completed"
          ? index === 10
            ? "复查发现第二次整改交底仍未落实"
            : "施工交底未落实，过程检查不足"
          : null,
      prevention:
        status === "completed" ? "加强班前交底，整改后复核并记录。" : null,
      seed_key: `stage2:order:${index}`,
    };
    const member = (id, roles) =>
      memberships.some(
        (m) =>
          m.project_id === projectId &&
          m.user_id === id &&
          m.is_active &&
          roles.includes(m.role),
      );
    if (
      !member(order.creator_id, ["inspector", "admin"]) ||
      !member(order.assignee_id, ["contractor"])
    )
      throw new Error("演示工单人员项目角色不匹配");
    let step = 0;
    const record = (action, actor, changes, extra = {}) => {
      step++;
      records.push({
        id: rid(index, step),
        work_order_id: order.id,
        actor_id: person(actor),
        occurred_at: new Date(
          Date.parse(created) + (step - 1) * 3600000,
        ).toISOString(),
        action,
        reason: null,
        changes,
        root_cause: null,
        prevention: null,
        seed_key: `stage2:record:${index}:${step}`,
        ...extra,
      });
    };
    record("created", creator, {
      status: { before: null, after: "pending" },
      assignee_id: {
        before: null,
        after: person(index === 11 ? "sg001" : assignee),
      },
    });
    if (index === 1)
      record("edited", creator, {
        severity: { before: "normal", after: "urgent" },
        description: {
          before: "梁底表面缺陷（模拟）",
          after: order.description,
        },
      });
    if (index === 4 || index === 10) {
      record(
        "resolved",
        assignee,
        { status: { before: "pending", after: "completed" } },
        { root_cause: "首次浇筑振捣不充分", prevention: "按分层振捣要求复核" },
      );
      record(
        "reopened",
        creator,
        {
          status: { before: "completed", after: "pending" },
          root_cause: { before: "首次浇筑振捣不充分", after: null },
          prevention: { before: "按分层振捣要求复核", after: null },
        },
        { reason: "复查发现局部问题仍未整改到位" },
      );
    }
    if (index === 7) {
      record(
        "rejected",
        assignee,
        { status: { before: "pending", after: "rejected" } },
        { reason: "初次现场核对位置有误" },
      );
      record(
        "reopened",
        creator,
        { status: { before: "rejected", after: "pending" } },
        { reason: "已补充正确位置，请重新处理" },
      );
    }
    if (index === 11)
      record(
        "assigned",
        "sg001",
        { assignee_id: { before: person("sg001"), after: person("sg002") } },
        { reason: "由专业班组负责后续整改" },
      );
    if (status === "completed")
      record(
        "resolved",
        assignee,
        { status: { before: "pending", after: "completed" } },
        { root_cause: order.root_cause, prevention: order.prevention },
      );
    if (status === "rejected")
      record(
        "rejected",
        assignee,
        { status: { before: "pending", after: "rejected" } },
        { reason: "现场核对为未施工区域，暂不具备整改条件" },
      );
    orders.push(order);
  }
  const existing = checked(
    await client
      .from("work_orders")
      .select("id,number,seed_key")
      .in(
        "number",
        orders.map((w) => w.number),
      ),
    "检查样本冲突",
  );
  for (const old of existing) {
    const expected = orders.find((w) => w.number === old.number);
    if (old.id !== expected.id || old.seed_key !== expected.seed_key)
      throw new Error("工单编号已被其他数据占用，停止准备");
  }
  const existingIds = checked(
    await client
      .from("work_orders")
      .select("id,seed_key")
      .in(
        "id",
        orders.map((w) => w.id),
      ),
    "检查样本标识",
  );
  if (
    existingIds.some(
      (w) => !orders.some((o) => o.id === w.id && o.seed_key === w.seed_key),
    )
  )
    throw new Error("样本标识冲突");
  const oldRecords = checked(
    await client
      .from("work_order_records")
      .select("id,seed_key")
      .in(
        "id",
        records.map((r) => r.id),
      ),
    "检查记录标识",
  );
  if (
    oldRecords.some(
      (r) =>
        !records.some(
          (expected) =>
            expected.id === r.id && expected.seed_key === r.seed_key,
        ),
    )
  )
    throw new Error("样本记录标识冲突");
  checked(
    await client
      .from("work_orders")
      .upsert(orders, { onConflict: "id", ignoreDuplicates: true }),
    "准备工单",
  );
  checked(
    await client
      .from("work_order_records")
      .upsert(records, { onConflict: "id", ignoreDuplicates: true }),
    "准备历史记录",
  );
  checked(await client.rpc("sync_work_order_sequence"), "同步编号序列");
  await seedWorkOrderPhotos(client);
  const ids = orders.map((order) => order.id);
  const liveOrders = checked(
    await client.from("work_orders").select("*").in("id", ids),
    "读取当前演示工单",
  );
  const liveRecords = checked(
    await client
      .from("work_order_records")
      .select("*")
      .in("work_order_id", ids),
    "读取当前演示记录",
  );
  const photos = checked(
    await client
      .from("work_order_photos")
      .select("id,work_order_id,original_name,state")
      .in("work_order_id", ids)
      .eq("state", "attached"),
    "读取当前演示照片",
  );
  await writeFile(
    new URL("../.local/demo-work-orders.json", import.meta.url),
    JSON.stringify(
      { orders: liveOrders, records: liveRecords, photos },
      null,
      2,
    ),
  );
  console.log(
    `工单样本就绪：${liveOrders.length} 张，当前处理记录 ${liveRecords.length} 条。`,
  );
}
