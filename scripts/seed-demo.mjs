import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { seedAdminEmptyProject } from "./seed-admin-empty-project.mjs";
import { seedWorkOrders } from "./seed-work-orders.mjs";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (
  !url ||
  new URL(url).hostname !== "lvwlxhgsixyrcpdnbgpg.supabase.co" ||
  !key
) {
  throw new Error(
    "请为约定 Supabase 项目配置 URL 和服务端 SUPABASE_SECRET_KEY。",
  );
}
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const outputPath = new URL("../.local/demo-accounts.json", import.meta.url);
await mkdir(new URL("../.local/", import.meta.url), { recursive: true });
let saved = { accounts: [] };
try {
  saved = JSON.parse(await readFile(outputPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

function verify(error, operation) {
  if (error) throw new Error(`${operation}失败：${error.message}`);
}

const projects = [
  {
    id: "a1111111-1111-4111-8111-111111111111",
    name: "云栖未来社区（模拟）",
    city: "杭州",
    customer_name: "云栖建设有限公司（模拟）",
    project_type: "住宅",
  },
  {
    id: "b2222222-2222-4222-8222-222222222222",
    name: "滨江智造园（模拟）",
    city: "苏州",
    customer_name: "滨江产业发展有限公司（模拟）",
    project_type: "工业园区",
  },
];
const { error: projectError } = await client.from("projects").upsert(projects);
verify(projectError, "准备模拟项目");
const definitions = [
  {
    employeeId: "qc001",
    name: "张晓明",
    department: "质量管理部",
    identities: [[0, "inspector"]],
  },
  {
    employeeId: "sg001",
    name: "李建国",
    department: "土建施工部",
    identities: [[0, "contractor"]],
  },
  {
    employeeId: "sg002",
    name: "王海峰",
    department: "机电施工部",
    identities: [[0, "contractor"]],
  },
  {
    employeeId: "admin001",
    name: "陈静",
    department: "项目管理部",
    identities: [[0, "admin"]],
  },
  {
    employeeId: "multi001",
    name: "周明远",
    department: "工程管理部",
    identities: [
      [0, "inspector"],
      [0, "contractor"],
      [0, "admin"],
      [1, "admin"],
      [1, "contractor"],
    ],
  },
  {
    employeeId: "empty001",
    name: "林新宇",
    department: "项目筹备组",
    identities: [],
  },
];

const existingUsers = [];
for (let page = 1; ; page++) {
  const { data, error } = await client.auth.admin.listUsers({
    page,
    perPage: 100,
  });
  verify(error, "读取模拟账号");
  existingUsers.push(...data.users);
  if (data.users.length < 100) break;
}

for (const definition of definitions) {
  const email = `${definition.employeeId}@demo.architecture.invalid`;
  let user = existingUsers.find((item) => item.email === email);
  let credential = saved.accounts.find(
    (item) => item.employeeId === definition.employeeId,
  );
  if (user && user.app_metadata.demo_seed !== "stage1") {
    throw new Error(
      `工号 ${definition.employeeId} 已被非模拟账号占用，停止准备。`,
    );
  }
  if (user && !credential) {
    throw new Error(
      `模拟账号 ${definition.employeeId} 已存在，请恢复原 .local/demo-accounts.json；脚本不会自动重置密码。`,
    );
  }
  if (!credential) {
    credential = {
      employeeId: definition.employeeId,
      password: `Demo-${randomBytes(12).toString("base64url")}!`,
    };
    saved.accounts.push(credential);
    // 在创建账号前保存密码，网络失败重试时仍可恢复。
    await writeFile(outputPath, `${JSON.stringify(saved, null, 2)}\n`, {
      mode: 0o600,
    });
  }
  if (!user) {
    const { data, error } = await client.auth.admin.createUser({
      email,
      password: credential.password,
      email_confirm: true,
      app_metadata: { demo_seed: "stage1" },
    });
    verify(error, "创建模拟账号");
    user = data.user;
  }
  const { error: profileError } = await client.from("profiles").upsert({
    id: user.id,
    employee_id: definition.employeeId,
    name: definition.name,
    department: definition.department,
  });
  verify(profileError, "准备用户资料");
  if (definition.identities.length) {
    const { error } = await client.from("project_memberships").upsert(
      definition.identities.map(([projectIndex, role]) => ({
        user_id: user.id,
        project_id: projects[projectIndex].id,
        role,
      })),
      { onConflict: "user_id,project_id,role" },
    );
    verify(error, "准备项目身份");
  }
  console.log(
    `${definition.employeeId}：已就绪（${definition.identities.length} 个身份）`,
  );
}
await seedWorkOrders(client, projects);
await seedAdminEmptyProject(client);
console.log(
  "演示数据准备完成。密码只保存在 Git 忽略的 .local/demo-accounts.json。",
);
