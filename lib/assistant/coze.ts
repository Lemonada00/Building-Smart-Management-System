import "server-only";
import { ChatEventType, CozeAPI, RoleType } from "@coze/api";

export async function queryConstructionKnowledge(
  query: string,
  parentSignal: AbortSignal,
) {
  const unavailable = {
    status: "unavailable",
    message: "知识服务暂未取得依据，请稍后重试。",
  } as const;
  const token = process.env.COZE_API_KEY?.trim();
  const baseURL = process.env.COZE_BASE_URL?.trim();
  const botId = process.env.COZE_BOT_ID?.trim();
  if (!token || baseURL !== "https://api.coze.cn" || !botId) return unavailable;
  const signal = AbortSignal.any([parentSignal, AbortSignal.timeout(60000)]);
  try {
    const client = new CozeAPI({ token, baseURL, debug: false });
    const answers = new Map<string, string>();
    let completed = false;
    const stream = client.chat.stream(
      {
        bot_id: botId,
        user_id: crypto.randomUUID(),
        auto_save_history: false,
        additional_messages: [
          { role: RoleType.User, content_type: "text", content: query },
        ],
      },
      { signal, timeout: 60000 },
    );
    for await (const { event, data } of stream) {
      if (
        event === ChatEventType.ERROR ||
        event === ChatEventType.CONVERSATION_CHAT_FAILED ||
        event === ChatEventType.CONVERSATION_CHAT_REQUIRES_ACTION
      )
        return unavailable;
      if (event === ChatEventType.CONVERSATION_CHAT_COMPLETED) {
        completed = true;
        break;
      }
      if (
        event === ChatEventType.CONVERSATION_MESSAGE_COMPLETED &&
        data.role === "assistant" &&
        data.type === "answer" &&
        data.content_type === "text" &&
        data.content.trim()
      ) {
        answers.set(data.id, data.content.trim());
      }
    }
    if (!completed || signal.aborted) return unavailable;
    const markdown = [...answers.values()].join("\n\n");
    const explicitlyUnsubstantiated =
      /未在知识库中检索到[^\n]*(?:规范依据|规范条文)/u.test(markdown) &&
      /未检索到[^\n]*(?:权威规范条文|有效匹配内容)/u.test(markdown);
    if (explicitlyUnsubstantiated) {
      return { status: "empty", message: "知识服务未检索到可核对的规范条文。" };
    }
    return markdown
      ? { status: "ok", markdown }
      : {
          status: "empty",
          message: "知识服务未返回可用依据，请补充条件后重试。",
        };
  } catch {
    return unavailable;
  }
}
