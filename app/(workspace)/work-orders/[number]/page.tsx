import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DetailController } from "@/components/work-orders/detail-controller";
import { adminReturnTarget } from "@/lib/admin/types";
import { requireIdentity } from "@/lib/auth/context";
import { getWorkOrder } from "@/lib/work-orders/queries";
import {
  listHref,
  normalizeFilters,
  parseNumber,
  type Search,
} from "@/lib/work-orders/types";
export default async function DetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<Search>;
}) {
  const { number } = await params;
  const search = await searchParams;
  const filters = normalizeFilters(search);
  const returnTo = adminReturnTarget(
    Array.isArray(search.returnTo) ? search.returnTo[0] : search.returnTo,
  );
  const target =
    parseNumber(number) === null
      ? "/work-orders"
      : search.returnTo
        ? `/work-orders/${number}?${new URLSearchParams({ returnTo })}`
        : `/work-orders/${number}?status=${filters.status}&sort=${filters.sort}`;
  const { profile, identity } = await requireIdentity(target);
  const result = await getWorkOrder(number);
  return (
    <AppShell profile={profile} identity={identity} title="工单详情">
      <Link
        className="wo-return"
        href={identity.role === "admin" ? returnTo : listHref(filters)}
      >
        ← 返回{identity.role === "admin" ? "管理员工单中心" : "工单列表"}
      </Link>
      {result.kind === "ok" ? (
        <DetailController initial={result.detail} />
      ) : (
        <div className="wo-empty">
          <h1>
            {result.kind === "forbidden"
              ? "当前身份无法查看该工单"
              : "未找到该工单"}
          </h1>
          <p>
            {result.kind === "forbidden"
              ? "如需切换项目或角色，请退出后重新登录。"
              : "请核对工单编号或返回列表。"}
          </p>
        </div>
      )}
    </AppShell>
  );
}
