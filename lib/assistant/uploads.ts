import "server-only";
import type { FileUIPart } from "ai";
import { chatRuntime, requireChatSession } from "@/lib/assistant/session";
import { ChatError, type ChatMessage } from "@/lib/assistant/types";
import { createUploadAdmin } from "@/lib/supabase/admin";

const bucket = "assistant-chat-images";
export function fileType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    Buffer.from(bytes.slice(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  )
    return "image/png";
  if (
    Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.slice(8, 12)).toString() === "WEBP"
  )
    return "image/webp";
  return null;
}
export async function uploadChatFile(
  sessionId: string,
  file: File,
): Promise<FileUIPart> {
  const { client } = await requireChatSession(sessionId);
  if (file.size === 0 || file.size > 10 * 1024 * 1024)
    throw new ChatError(413, "每张图片必须大于 0 且不超过 10 MiB。");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = fileType(bytes);
  if (!type || type !== file.type)
    throw new ChatError(415, "只支持真实的 JPEG、PNG、WebP 图片。");
  const id = crypto.randomUUID();
  const { data: path, error: registerError } = await client.rpc(
    "register_assistant_upload",
    {
      p_session: sessionId,
      p_id: id,
      p_mime: type,
      p_size: file.size,
      p_name: file.name,
    },
  );
  if (registerError || typeof path !== "string")
    throw new ChatError(503, "图片登记失败，请稍后重试。");
  const storage = createUploadAdmin().storage.from(bucket);
  const { error } = await storage.upload(path, bytes, {
    contentType: type,
    cacheControl: "0",
    upsert: false,
  });
  if (error) {
    await client.rpc("remove_assistant_uploads", {
      p_session: sessionId,
      p_ids: [id],
    });
    throw new ChatError(503, "图片上传失败，请保留图片并重试。");
  }
  // 退出或并发清理可能在登记后、实际写入前移除附件归属。
  try {
    const { client: currentClient } = await requireChatSession(sessionId);
    const { data, error: readError } = await currentClient
      .from("assistant_uploads")
      .select("id")
      .eq("session_id", sessionId)
      .eq("id", id)
      .maybeSingle();
    if (readError) throw new ChatError(503, "图片归属核对失败，请重试。");
    if (!data) throw new ChatError(409, "图片已失效，请重新上传。");
  } catch (cause) {
    const removal = await storage.remove([path]).catch(() => null);
    if (removal && !removal.error) {
      await Promise.resolve(
        client.rpc("remove_assistant_uploads", {
          p_session: sessionId,
          p_ids: [id],
        }),
      ).catch(() => {});
    }
    throw cause;
  }
  return {
    type: "file",
    mediaType: type,
    filename: file.name,
    url: storage.getPublicUrl(path).data.publicUrl,
  };
}
export async function cleanUnusedUploads(id: string, messages: ChatMessage[]) {
  const { client } = await requireChatSession(id);
  const { data, error } = await client
    .from("assistant_uploads")
    .select("id,object_path")
    .eq("session_id", id);
  if (error || !data?.length) return;
  const urls = new Set(
    messages.flatMap((m) =>
      m.parts.filter((p) => p.type === "file").map((p) => p.url),
    ),
  );
  const drafts = await client
    .from("assistant_order_drafts")
    .select("candidate_upload_ids")
    .eq("session_id", id)
    .eq("status", "editing");
  if (drafts.error) return;
  const retainedIds = new Set(
    drafts.data.flatMap((draft) => draft.candidate_upload_ids as string[]),
  );
  const admin = createUploadAdmin();
  const unused = data.filter(
    (p) =>
      !retainedIds.has(p.id) &&
      !urls.has(
        admin.storage.from(bucket).getPublicUrl(p.object_path).data.publicUrl,
      ),
  );
  if (!unused.length) return;
  const removed = await admin.storage
    .from(bucket)
    .remove(unused.map((p) => p.object_path));
  if (!removed.error)
    await client.rpc("remove_assistant_uploads", {
      p_session: id,
      p_ids: unused.map((p) => p.id),
    });
}
export async function closeChat() {
  const { client } = await chatRuntime();
  const { data, error } = await client.rpc("close_assistant_session");
  if (error) throw new Error("对话清理失败，请稍后重试退出。");
  if (Array.isArray(data) && data.length) {
    // 已关闭会话的迟到请求不能再写入；失败对象交离线维护，不阻止退出。
    await createUploadAdmin()
      .storage.from(bucket)
      .remove(data as string[]);
  }
}
