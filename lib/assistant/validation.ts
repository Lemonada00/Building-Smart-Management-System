import "server-only";
import { validateUIMessages } from "ai";
import { z } from "zod";
import type { ChatMessage } from "@/lib/assistant/types";
import { ChatError } from "@/lib/assistant/types";

export const chatInput = z
  .object({
    sessionId: z.uuid(),
    revision: z.number().int().nonnegative(),
    messages: z.array(z.unknown()).min(1).max(30),
  })
  .strip();
export const searchInput = z.object({
  number: z
    .number()
    .int()
    .min(0)
    .max(2147483647)
    .describe("工单编号；没有指定编号时填0"),
  keyword: z.string().max(200).describe("问题关键词；没有关键词时填空字符串"),
  location: z.string().max(200).describe("位置；没有指定位置时填空字符串"),
  status: z.enum(["all", "pending", "completed", "rejected", "ended"]),
  severity: z
    .enum(["all", "minor", "normal", "major", "urgent"])
    .describe("未指定严重程度时填all"),
  scope: z.enum(["visible", "created_by_me", "assigned_to_me"]),
});
export async function parseMessages(value: unknown[]): Promise<ChatMessage[]> {
  const tools = new Set([
    "search_work_orders",
    "prepare_work_order_draft",
    "query_construction_knowledge",
  ]);
  let messages: ChatMessage[];
  try {
    messages = await validateUIMessages<ChatMessage>({ messages: value });
  } catch {
    throw new ChatError(400, "消息格式无效，请刷新页面后重试。");
  }
  if (
    messages.at(-1)?.role !== "user" ||
    messages.filter((m) => m.role === "user").length > 6
  )
    throw new ChatError(400, "请保留最近六轮对话后重试。");
  for (const message of messages) {
    if (!["user", "assistant"].includes(message.role))
      throw new ChatError(400, "消息角色无效。");
    let textLength = 0;
    let images = 0;
    for (const part of message.parts) {
      if (part.type === "text") textLength += part.text.length;
      else if (part.type === "file") {
        images++;
        if (
          message.role !== "user" ||
          !["image/jpeg", "image/png", "image/webp"].includes(part.mediaType)
        )
          throw new ChatError(400, "只支持 JPEG、PNG、WebP 图片。");
      } else if (part.type === "dynamic-tool") {
        if (message.role !== "assistant" || !tools.has(part.toolName))
          throw new ChatError(400, "工具消息无效。");
      } else if (part.type.startsWith("tool-")) {
        if (message.role !== "assistant" || !tools.has(part.type.slice(5)))
          throw new ChatError(400, "工具消息无效。");
      } else if (
        !["step-start", "reasoning", "data-session", "data-saved"].includes(
          part.type,
        )
      )
        throw new ChatError(400, "不支持该消息内容。");
    }
    if (
      images > 9 ||
      (message.role === "user" &&
        (textLength > 4000 || (textLength === 0 && images === 0)))
    )
      throw new ChatError(
        400,
        "每条消息最多 4000 字和 9 张图片，不能发送空消息。",
      );
  }
  if (JSON.stringify(messages).length > 1800000)
    throw new ChatError(413, "对话内容过多，请减少本次内容。");
  return messages;
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? new URL(request.url).host;
  let valid = false;
  try {
    const source = new URL(origin ?? "");
    valid =
      ["http:", "https:"].includes(source.protocol) && source.host === host;
  } catch {}
  if (!valid) throw new ChatError(403, "请从本应用页面发送请求。");
}
