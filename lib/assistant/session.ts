import "server-only";
import {
  referencedNumbers,
  rounds,
  trimHistory,
} from "@/lib/assistant/history";
import {
  ChatError,
  type ChatMessage,
  type ChatSession,
} from "@/lib/assistant/types";
import { getLoginContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export async function chatRuntime() {
  const context = await getLoginContext();
  if (!context?.profile) throw new ChatError(401, "登录已失效，请重新登录。");
  if (!context.activeIdentity) throw new ChatError(403, "请先选择有效身份。");
  return {
    client: await createClient(),
    identity: context.activeIdentity,
    userId: context.profile.id,
  };
}
export async function filterVisibleHistory(messages: ChatMessage[]) {
  const { client } = await chatRuntime();
  const retained: ChatMessage[][] = [];
  for (const group of rounds(messages)) {
    if (!group.some((message) => message.role === "assistant")) {
      retained.push(group);
      continue;
    }
    const results = await Promise.all(
      referencedNumbers(group).map(async (number) => {
        const { data, error } = await client.rpc("get_work_order", {
          p_number: number,
        });
        if (error) throw new ChatError(503, "工单权限核对失败，请稍后重试。");
        return data?.kind === "ok";
      }),
    );
    if (results.every(Boolean)) retained.push(group);
  }
  return retained.flat();
}
export async function loadChatSession(): Promise<ChatSession> {
  const { client } = await chatRuntime();
  const { data, error } = await client.rpc("ensure_assistant_session");
  if (error) throw new ChatError(503, "对话加载失败，请重新登录或稍后重试。");
  const session = data as ChatSession;
  return {
    ...session,
    messages: await filterVisibleHistory(trimHistory(session.messages)),
  };
}
export async function requireChatSession(id: string, revision?: number) {
  const runtime = await chatRuntime();
  const { data, error } = await runtime.client
    .from("assistant_sessions")
    .select("id,revision")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ChatError(503, "对话服务暂不可用。");
  if (!data) throw new ChatError(403, "当前登录无法访问这段对话，请重新登录。");
  if (revision !== undefined && data.revision !== revision)
    throw new ChatError(409, "对话已有更新，请刷新页面后重试；原输入仍保留。");
  return { ...runtime, revision: data.revision as number };
}
export async function saveSnapshot(
  id: string,
  revision: number,
  messages: ChatMessage[],
) {
  const { client } = await requireChatSession(id, revision);
  const { data, error } = await client.rpc("save_assistant_snapshot", {
    p_id: id,
    p_revision: revision,
    p_messages: trimHistory(messages),
  });
  if (error)
    throw new ChatError(
      error.code === "40001" ? 409 : 503,
      "本轮回复未能保存，请刷新核对后重试。",
    );
  return data as number;
}
