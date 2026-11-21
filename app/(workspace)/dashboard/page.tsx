import { Dashboard } from "@/components/admin/dashboard";
import { AdminDenied } from "@/components/admin/denied";
import { AdminRefresh } from "@/components/admin/refresh";
import { AppShell } from "@/components/app-shell";
import { getAdminDashboard } from "@/lib/admin/queries";
import { requireIdentity } from "@/lib/auth/context";
export default async function DashboardPage() {
  const { profile, identity } = await requireIdentity("/dashboard");
  if (identity.role !== "admin")
    return (
      <AppShell profile={profile} identity={identity} title="无权限访问">
        <AdminDenied />
      </AppShell>
    );
  const data = await getAdminDashboard();
  return (
    <AppShell profile={profile} identity={identity} title="数据大盘">
      <div className="page-heading">
        <div>
          <h1>数据大盘</h1>
          <p>掌握项目质检进度，优先跟进待处理风险</p>
        </div>
        <AdminRefresh />
      </div>
      <Dashboard data={data} />
    </AppShell>
  );
}
