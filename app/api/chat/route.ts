import { toBaseMessages, toUIMessageStream } from "@ai-sdk/langchain";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  getToolName,
  isToolUIPart,
} from "ai";
import { getAgent } from "@/lib/assistant/agent";
import {
  normalizeKnowledgeReplies,
  resultOf,
  rounds,
  structuredToolOutput,
  trimHistory,
} from "@/lib/assistant/history";
import {
  filterVisibleHistory,
  requireChatSession,
  saveSnapshot,
} from "@/lib/assistant/session";
import { ChatError, type ChatMessage } from "@/lib/assistant/types";
import { cleanUnusedUploads } from "@/lib/assistant/uploads";
import {
  assertSameOrigin,
  chatInput,
  parseMessages,
} from "@/lib/assistant/validation";

// cacheComponents 禁止导出 runtime；沿用 App Router 默认 Node.js 运行环境。
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = chatInput.safeParse(await request.json());
    if (!parsed.success) throw new ChatError(400, "请求格式无效。");
    const { sessionId, revision } = parsed.data;
    const context = await requireChatSession(sessionId, revision);
    const input = await parseMessages(parsed.data.messages);
    const messages = await filterVisibleHistory(trimHistory(input));
    const user = messages.at(-1);
    if (!user || user.role !== "user" || !user.id || user.id.length > 200)
      throw new ChatError(400, "请重新发送当前问题。");
    const fileParts = messages.flatMap((m) =>
      m.parts.filter((p) => p.type === "file"),
    );
    const uploadIds: string[] = [];
    if (fileParts.length) {
      const { data, error } = await context.client
        .from("assistant_uploads")
        .select("id,object_path")
        .eq("session_id", sessionId);
      if (error) throw new ChatError(503, "图片信息核对失败。");
      const prefix =
        process.env.NEXT_PUBLIC_SUPABASE_URL +
        "/storage/v1/object/public/assistant-chat-images/";
      const paths = new Map(
        (data ?? []).map((p) => [prefix + p.object_path, p.id as string]),
      );
      if (fileParts.some((p) => !paths.has(p.url)))
        throw new ChatError(403, "图片不属于当前对话，请重新上传。");
      uploadIds.push(
        ...new Set(
          fileParts.slice(-9).flatMap((part) => {
            const id = paths.get(part.url);
            return id ? [id] : [];
          }),
        ),
      );
    }
    const agent = getAgent({
      ...context,
      sessionId,
      sessionRevision: revision,
      sourceMessageId: user.id,
      uploadIds,
      signal: request.signal,
    });
    const converted = await toBaseMessages(messages);
    const stream = createUIMessageStream<ChatMessage>({
      originalMessages: messages,
      onError: () => "本轮处理或保存失败，请核对登录状态后重试。原消息仍保留。",
      execute: async ({ writer }) => {
        const response = await agent.stream(
          { messages: converted },
          {
            // 当前适配器同时接 tools 与 values 会生成重复工具快照。
            // 官方 values/messages 组合已包含工具调用和结果，无需自建合并。
            streamMode: ["values", "messages"],
            signal: request.signal,
            recursionLimit: 12,
          },
        );
        writer.merge(
          toUIMessageStream(response, {
            onFinish: () => writer.setOutcome({ status: "completed" }),
            onError: (error) => writer.setOutcome({ status: "failed", error }),
            onAbort: () => writer.setOutcome({ status: "aborted" }),
          }),
        );
      },
      onEnd: async ({ messages: finished, outcome }) => {
        if (outcome.status !== "completed") return;
        const reply = normalizeKnowledgeReplies(finished);
        const latest = rounds(reply).at(-1) ?? [];
        const visible = latest.some(
          (message) =>
            message.role === "assistant" &&
            message.parts.some((part) => {
              if (part.type === "text") return Boolean(part.text.trim());
              if (!isToolUIPart(part)) return false;
              const name = getToolName(part);
              if (name === "search_work_orders") {
                return (
                  part.state === "output-error" ||
                  ("output" in part && Boolean(resultOf(part.output)))
                );
              }
              if (name !== "prepare_work_order_draft" || !("output" in part))
                return false;
              const result = structuredToolOutput(part.output);
              return Boolean(result && "draftId" in result);
            }),
        );
        if (!visible) throw new ChatError(503, "本轮未生成可显示的回复。");
        await saveSnapshot(sessionId, revision, reply);
        await cleanUnusedUploads(sessionId, trimHistory(finished)).catch(
          () => {},
        );
      },
    });
    return createUIMessageStreamResponse({
      stream,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const known = error instanceof ChatError;
    return Response.json(
      { error: known ? error.message : "对话服务暂不可用，请稍后重试。" },
      {
        status: known ? error.status : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
