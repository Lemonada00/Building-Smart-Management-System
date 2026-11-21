import { adminReturnTarget } from "@/lib/admin/types";

export type Role = "inspector" | "contractor" | "admin";

export type Identity = {
  id: string;
  project_id: string;
  project_name: string;
  role: Role;
};

export type LoginContext = {
  profile: {
    id: string;
    employee_id: string;
    name: string;
    department: string;
    avatar_url: string | null;
  } | null;
  memberships: Identity[];
  selected: boolean;
  activeIdentity: Identity | null;
};

export type FormState = { message: string; employeeId?: string };

export const roleNames: Record<Role, string> = {
  inspector: "质检员",
  contractor: "施工方",
  admin: "管理员",
};

export const pages = [
  {
    href: "/assistant",
    title: "智能助手",
    roles: ["inspector", "contractor", "admin"],
  },
  {
    href: "/work-orders",
    title: "工单列表",
    roles: ["inspector", "contractor"],
  },
  { href: "/dashboard", title: "数据大盘", roles: ["admin"] },
  { href: "/admin/work-orders", title: "管理员工单中心", roles: ["admin"] },
];

export function safeTarget(value: unknown) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return "/assistant";
  const [path, query] = value.split("?");
  if (path === "/admin/work-orders") return adminReturnTarget(value);
  if (pages.some((page) => page.href === path) && path !== "/work-orders")
    return query ? "/assistant" : path;
  const match = path.match(/^\/work-orders(?:\/([1-9]\d{0,9}))?$/);
  if (!match || (match[1] && Number(match[1]) > 2147483647))
    return "/assistant";
  const params = new URLSearchParams(query);
  if (match[1] && params.has("returnTo"))
    return `${path}?${new URLSearchParams({ returnTo: adminReturnTarget(params.get("returnTo")) })}`;
  const status = params.get("status");
  const sort = params.get("sort");
  const normalizedStatus =
    status === "ended" || status === "all" ? status : "pending";
  return `${path}?status=${normalizedStatus}&sort=${sort === "oldest" ? "oldest" : "newest"}`;
}
