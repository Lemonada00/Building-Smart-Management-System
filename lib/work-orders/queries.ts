import "server-only";
import { getLoginContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import {
  type DetailResult,
  type Filters,
  parseNumber,
  type WorkOrderSummary,
} from "@/lib/work-orders/types";
export async function listWorkOrders(
  filters: Filters,
): Promise<WorkOrderSummary[]> {
  const context = await getLoginContext();
  if (!context?.activeIdentity || context.activeIdentity.role === "admin")
    throw new Error("当前身份无法查看工单列表。");
  const client = await createClient();
  const { data, error } = await client.rpc("list_work_orders", {
    p_status: filters.status,
    p_sort: filters.sort,
  });
  if (error) throw new Error("工单列表读取失败，请稍后重试。");
  return data as WorkOrderSummary[];
}
export async function getWorkOrder(value: string): Promise<DetailResult> {
  const context = await getLoginContext();
  if (!context?.activeIdentity) throw new Error("当前身份已失效，请重新登录。");
  const number = parseNumber(value);
  if (number === null) return { kind: "not_found" };
  const client = await createClient();
  const { data, error } = await client.rpc("get_work_order", {
    p_number: number,
  });
  if (error) throw new Error("工单详情读取失败，请稍后重试。");
  return data as DetailResult;
}
