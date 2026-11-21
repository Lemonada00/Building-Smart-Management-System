import { getLoginContext } from "@/lib/auth/context";
import { getWorkOrder } from "@/lib/work-orders/queries";

const headers = { "Cache-Control": "private, no-store" };
function failure(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers });
}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  try {
    const context = await getLoginContext();
    if (!context)
      return failure(401, "UNAUTHENTICATED", "登录已失效，请重新登录。");
    if (!context.activeIdentity)
      return failure(403, "IDENTITY_REQUIRED", "请先选择有效身份。");
    const result = await getWorkOrder((await params).number);
    if (result.kind === "forbidden")
      return failure(403, "FORBIDDEN", "当前身份无法查看该工单。");
    if (result.kind === "not_found")
      return failure(404, "NOT_FOUND", "未找到该工单。");
    if (result.kind === "ok")
      return Response.json({ data: result.detail }, { headers });
    return failure(500, "READ_FAILED", "工单详情读取失败，请重试。");
  } catch {
    return failure(500, "READ_FAILED", "工单详情读取失败，请重试。");
  }
}
