import "server-only";
import { createClient } from "@/lib/supabase/server";

const messages: Record<string, string> = {
  UNAUTHENTICATED: "登录已失效，请重新登录。",
  IDENTITY_REQUIRED: "请先选择有效身份。",
  NOT_FOUND: "未找到该工单。",
  FORBIDDEN: "当前身份无法执行该操作，工单可能已移交。",
  CONFLICT: "工单已更新，请加载最新内容并核对后再提交。",
  VALIDATION_FAILED: "填写内容或选择无效，请检查必填项和图片。",
  PHOTO_NOT_READY: "照片尚未上传成功或已过期，请重新上传。",
  WRITE_FAILED: "提交未能确认，请先查看最新记录，避免重复处理。",
};
export async function callWorkOrderRpc(
  name: string,
  args: Record<string, unknown>,
) {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc(name, args);
    if (error) {
      const code =
        Object.keys(messages).find((k) => error.message.includes(k)) ??
        "WRITE_FAILED";
      return { ok: false as const, error: { code, message: messages[code] } };
    }
    return data;
  } catch {
    return {
      ok: false as const,
      error: { code: "WRITE_FAILED", message: messages.WRITE_FAILED },
    };
  }
}
