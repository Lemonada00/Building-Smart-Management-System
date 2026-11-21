import "server-only";
import type {
  AdminDashboard,
  AdminFilters,
  AdminListResult,
} from "@/lib/admin/types";
import { getLoginContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

async function adminClient() {
  const context = await getLoginContext();
  if (context?.activeIdentity?.role !== "admin")
    throw new Error("当前身份无法访问管理员工作台。");
  return createClient();
}
export async function listAdminWorkOrders(
  filters: AdminFilters,
): Promise<AdminListResult> {
  const client = await adminClient();
  const { data, error } = await client.rpc("list_admin_work_orders", {
    p_status: filters.status || null,
    p_severity: filters.severity || null,
    p_discipline: filters.discipline || null,
    p_keyword: filters.keyword || null,
    p_number: filters.number || null,
  });
  if (
    error ||
    !data ||
    !Array.isArray(data.items) ||
    data.total !== data.items.length
  )
    throw new Error("工单中心读取失败，请重试。");
  return data as AdminListResult;
}
export async function getAdminDashboard(): Promise<AdminDashboard> {
  const client = await adminClient();
  const { data, error } = await client.rpc("get_admin_dashboard");
  if (error || !data?.project || !data.statuses || !data.pendingSeverities)
    throw new Error("项目统计读取失败，请重试。");
  return data as AdminDashboard;
}
