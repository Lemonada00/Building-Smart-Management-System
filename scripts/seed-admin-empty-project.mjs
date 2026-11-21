// 补充管理员零值验收项目，不改变两个已有模拟项目和历史工单。
export async function seedAdminEmptyProject(client) {
  const projectId = "e4444444-4444-4444-8444-444444444444";
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id")
    .eq("employee_id", "multi001")
    .single();
  if (profileError) throw new Error("读取空项目演示管理员失败。");
  const { error } = await client.from("projects").upsert({
    id: projectId,
    name: "质检筹备项目（模拟·无工单）",
    city: "杭州",
    customer_name: "质检演示客户（模拟）",
    project_type: "政府项目",
  });
  if (error) throw new Error("准备管理员空项目失败。");
  const { error: membershipError } = await client
    .from("project_memberships")
    .upsert(
      { user_id: profile.id, project_id: projectId, role: "admin" },
      { onConflict: "user_id,project_id,role" },
    );
  if (membershipError) throw new Error("准备空项目管理员关系失败。");
  console.log("管理员空项目已就绪（multi001），不修改已有工单。");
}
