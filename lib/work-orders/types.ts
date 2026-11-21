export const statusNames = {
  pending: "待处理",
  completed: "已完成",
  rejected: "已拒绝",
};
export const severityNames = {
  minor: "轻微",
  normal: "一般",
  major: "严重",
  urgent: "紧急",
};
export const disciplineNames = {
  architecture: "建筑设计专业",
  structure: "结构专业",
  plumbing: "给排水专业",
};
export const actionNames = {
  created: "创建",
  edited: "编辑",
  resolved: "解决",
  rejected: "拒绝",
  assigned: "指派他人",
  reopened: "重新打开",
};
export type Person = { id: string; name: string };
export type Operation = "edit" | "resolve" | "reject" | "assign" | "reopen";
export type WorkOrderPhoto = { id: string; name: string; url: string };
export type Assignee = Person & { employeeId: string; department: string };
export type Command = {
  number: number;
  expectedVersion: number;
  action: Operation;
  payload: Record<string, unknown>;
};
export type CommandResult =
  | {
      ok: true;
      number: number;
      version: number;
      accessLost: boolean;
      unchanged?: boolean;
    }
  | { ok: false; error: { code: string; message: string } };
export type WorkOrderSummary = {
  number: number;
  status: keyof typeof statusNames;
  severity: keyof typeof severityNames;
  discipline: keyof typeof disciplineNames;
  description: string;
  location: string;
  createdAt: string;
  assignee: Person;
  photos: WorkOrderPhoto[];
};
export type WorkOrderRecord = {
  id: string;
  action: keyof typeof actionNames;
  actor: Person;
  occurredAt: string;
  reason: string | null;
  changes: Record<string, { before: string | null; after: string | null }>;
  rootCause: string | null;
  prevention: string | null;
};
export type WorkOrderDetail = WorkOrderSummary & {
  version: number;
  allowedActions: Operation[];
  creator: Person;
  project: { id: string; name: string };
  details: string | null;
  rootCause: string | null;
  prevention: string | null;
  records: WorkOrderRecord[];
  people: Record<string, string>;
};
export type DetailResult =
  | { kind: "ok"; detail: WorkOrderDetail }
  | { kind: "forbidden" | "not_found" };
export type Filters = {
  status: "pending" | "ended" | "all";
  sort: "newest" | "oldest";
};
export type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
export function normalizeFilters(search: Search): Filters {
  const status = first(search.status);
  return {
    status: status === "ended" || status === "all" ? status : "pending",
    sort: first(search.sort) === "oldest" ? "oldest" : "newest",
  };
}
export function parseNumber(value: string) {
  if (!/^[1-9]\d{0,9}$/.test(value)) return null;
  const number = Number(value);
  return number <= 2147483647 ? number : null;
}
export function listHref(filters: Filters) {
  return `/work-orders?status=${filters.status}&sort=${filters.sort}`;
}
export function detailHref(number: number, filters: Filters) {
  return `/work-orders/${number}?status=${filters.status}&sort=${filters.sort}`;
}
export function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
