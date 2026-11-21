import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FiltersBar } from "@/components/work-orders/filters";
import { WorkOrderList } from "@/components/work-orders/list";
import { requireIdentity } from "@/lib/auth/context";
import { listWorkOrders } from "@/lib/work-orders/queries";
import {
  listHref,
  normalizeFilters,
  type Search,
} from "@/lib/work-orders/types";
export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const search = await searchParams;
  const filters = normalizeFilters(search);
  const { profile, identity } = await requireIdentity(listHref(filters));
  if (identity.role === "admin")
    return (
      <AppShell profile={profile} identity={identity} title="无权限访问">
        <div className="wo-empty">
          <h1>当前身份无法访问普通工单列表</h1>
          <p>
            <Link href="/admin/work-orders">进入管理员工单中心</Link>
          </p>
        </div>
      </AppShell>
    );
  const orders = await listWorkOrders(filters);
  return (
    <AppShell profile={profile} identity={identity} title="工单列表">
      <div className="page-heading">
        <div>
          <h1>工单列表</h1>
          <p>
            {identity.role === "inspector" ? "我提出的" : "我负责的"} ·{" "}
            {identity.project_name}
          </p>
        </div>
        <span className="wo-count">{orders.length} 张工单</span>
      </div>
      <FiltersBar filters={filters} />
      <WorkOrderList
        key={`${filters.status}:${filters.sort}`}
        filters={filters}
        orders={orders}
        initialNotice={
          search.notice === "assigned"
            ? "工单已成功移交，当前身份不再负责该工单。"
            : ""
        }
      />
    </AppShell>
  );
}
