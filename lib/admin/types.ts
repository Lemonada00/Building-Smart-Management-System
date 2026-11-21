import {
  disciplineNames,
  type Person,
  type Search,
  severityNames,
  statusNames,
} from "@/lib/work-orders/types";

export type AdminFilters = {
  status: keyof typeof statusNames | "";
  severity: keyof typeof severityNames | "";
  discipline: keyof typeof disciplineNames | "";
  keyword: string;
  number: string;
};
export type AdminWorkOrderRow = {
  number: number;
  status: keyof typeof statusNames;
  severity: keyof typeof severityNames;
  discipline: keyof typeof disciplineNames;
  description: string;
  createdAt: string;
  creator: Person;
  assignee: Person;
};
export type AdminListResult = { items: AdminWorkOrderRow[]; total: number };
export type AdminDashboard = {
  project: {
    id: string;
    name: string;
    city: string;
    customerName: string;
    projectType: string;
  };
  total: number;
  statuses: Record<keyof typeof statusNames, number>;
  pendingSeverities: Record<keyof typeof severityNames, number>;
  pendingUrgent: number;
};
const first = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";
export function normalizeAdminFilters(search: Search): AdminFilters {
  const status = first(search.status);
  const severity = first(search.severity);
  const discipline = first(search.discipline);
  return {
    status: Object.hasOwn(statusNames, status)
      ? (status as AdminFilters["status"])
      : "",
    severity: Object.hasOwn(severityNames, severity)
      ? (severity as AdminFilters["severity"])
      : "",
    discipline: Object.hasOwn(disciplineNames, discipline)
      ? (discipline as AdminFilters["discipline"])
      : "",
    keyword: first(search.keyword).trim(),
    number: first(search.number).trim().replace(/^#/, "").trim(),
  };
}
export function adminListHref(input: Partial<AdminFilters> = {}) {
  const filters = normalizeAdminFilters(input);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) params.set(key, value);
  return `/admin/work-orders${params.size ? `?${params}` : ""}`;
}
export function adminReturnTarget(value: unknown) {
  if (typeof value !== "string" || value.includes("\\") || value.includes("#"))
    return "/admin/work-orders";
  try {
    const url = new URL(value, "https://local.invalid");
    if (
      !value.startsWith("/admin/work-orders") ||
      url.origin !== "https://local.invalid" ||
      url.pathname !== "/admin/work-orders" ||
      url.searchParams.has("returnTo")
    )
      return "/admin/work-orders";
    const search: Search = {};
    for (const key of [
      "status",
      "severity",
      "discipline",
      "keyword",
      "number",
    ]) {
      const item = url.searchParams.get(key);
      if (item !== null) search[key] = item;
    }
    return adminListHref(normalizeAdminFilters(search));
  } catch {
    return "/admin/work-orders";
  }
}
export function adminDetailHref(
  number: number,
  filters: Partial<AdminFilters> = {},
) {
  return `/work-orders/${number}?${new URLSearchParams({ returnTo: adminListHref(filters) })}`;
}
