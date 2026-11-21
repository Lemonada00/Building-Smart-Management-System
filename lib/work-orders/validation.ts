import {
  type Command,
  disciplineNames,
  severityNames,
} from "@/lib/work-orders/types";
export const photoLimit = 10485760;
export const photoTypes = ["image/jpeg", "image/png", "image/webp"];
export function validateCommand(input: Command): string | null {
  if (
    !input ||
    !Number.isInteger(input.number) ||
    input.number < 1 ||
    input.number > 2147483647 ||
    !Number.isInteger(input.expectedVersion) ||
    input.expectedVersion < 1
  )
    return "工单编号或版本无效，请刷新。";
  const fields: Record<string, string[]> = {
    edit: [
      "severity",
      "discipline",
      "description",
      "location",
      "details",
      "photoIds",
    ],
    resolve: ["rootCause", "prevention"],
    reject: ["reason"],
    assign: ["assigneeId", "reason"],
    reopen: ["reason"],
  };
  const keys = fields[input.action];
  if (
    !keys ||
    !input.payload ||
    typeof input.payload !== "object" ||
    Array.isArray(input.payload) ||
    Object.keys(input.payload).some((k) => !keys.includes(k))
  )
    return "提交内容包含不允许修改的字段。";
  const p = input.payload;
  for (const [k, v] of Object.entries(p))
    if (k !== "photoIds" && v !== null && typeof v !== "string")
      return "填写内容格式不正确。";
  const required =
    input.action === "edit"
      ? ["severity", "discipline", "description", "location"]
      : input.action === "resolve"
        ? ["rootCause"]
        : input.action === "assign"
          ? ["assigneeId", "reason"]
          : ["reason"];
  if (
    required.some((k) => typeof p[k] !== "string" || !(p[k] as string).trim())
  )
    return "请填写所有必填项，不能仅输入空格。";
  if (
    input.action === "edit" &&
    (!(String(p.severity) in severityNames) ||
      !(String(p.discipline) in disciplineNames) ||
      !Array.isArray(p.photoIds) ||
      p.photoIds.length > 9 ||
      p.photoIds.some((id) => typeof id !== "string"))
  )
    return "请选择有效的严重程度、专业及最多 9 张照片。";
  return null;
}
