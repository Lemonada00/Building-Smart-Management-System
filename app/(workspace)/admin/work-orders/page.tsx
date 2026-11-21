import { AdminDenied } from "@/components/admin/denied";
import { AdminReadError } from "@/components/admin/read-error";
import { AdminFiltersBar } from "@/components/admin/work-order-filters";
import { AdminWorkOrderTable } from "@/components/admin/work-order-table";
import { AppShell } from "@/components/app-shell";
import { listAdminWorkOrders } from "@/lib/admin/queries";
import { adminListHref, normalizeAdminFilters } from "@/lib/admin/types";
import { requireIdentity } from "@/lib/auth/context";
import type { Search } from "@/lib/work-orders/types";
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const filters = normalizeAdminFilters(await searchParams);
  const { profile, identity } = await requireIdentity(adminListHref(filters));
  if (identity.role !== "admin")
    return (
      <AppShell profile={profile} identity={identity} title="无权限访问">
        <AdminDenied />
      </AppShell>
    );
  let result = null;
  try {
    result = await listAdminWorkOrders(filters);
  } catch {
    // 保留筛选表单；读取失败不表示当前项目没有工单。
  }
  return (
    <AppShell profile={profile} identity={identity} title="管理员工单中心">
      <div className="page-heading">
        <div>
          <h1>管理员工单中心</h1>
          <p>查看和跟进{identity.project_name}的全部质检工单</p>
        </div>
      </div>
      <AdminFiltersBar key={adminListHref(filters)} filters={filters} />
      {result ? (
        <AdminWorkOrderTable result={result} filters={filters} />
      ) : (
        <AdminReadError />
      )}
    </AppShell>
  );
}
