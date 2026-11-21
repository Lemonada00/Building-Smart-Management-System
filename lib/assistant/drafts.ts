import "server-only";
import type { z } from "zod";
import type {
  DraftCardData,
  DraftForm,
  DraftStatus,
  draftFields,
} from "@/lib/assistant/draft-input";
import { requireChatSession } from "@/lib/assistant/session";
import {
  ChatError,
  type ChatMessage,
  type RuntimeContext,
} from "@/lib/assistant/types";
import { fileType } from "@/lib/assistant/uploads";

type Client = RuntimeContext["client"];
type DraftRow = Omit<DraftForm, "assigneeId" | "uploadIds" | "photoIds"> & {
  id: string;
  revision: number;
  status: DraftStatus;
  assignee_id: string | null;
  selected_upload_ids: string[];
  candidate_upload_ids: string[];
  selected_photo_ids: string[];
};
type Photo = {
  id: string;
  object_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
};
type DraftResponse = {
  draft: DraftRow;
  assignees?: DraftCardData["assignees"];
  workOrderNumber?: number;
  receiptMessageId?: string;
  sessionRevision?: number;
  messages?: ChatMessage[];
};
const privateBucket = "work-order-photos";
const chatBucket = "assistant-chat-images";

async function rpc<T>(
  client: Client,
  op: string,
  sessionId: string,
  draftId: string | null,
  values = {},
) {
  const { data, error } = await client.rpc("assistant_draft", {
    p_op: op,
    p_session: sessionId,
    p_draft: draftId,
    p_values: values,
  });
  if (error?.code === "42501")
    throw new ChatError(403, "当前身份无法操作这个草稿。");
  if (error?.code === "40001")
    throw new ChatError(409, "草稿或对话已更新，请刷新核对后重试。");
  if (error?.message === "INVALID_ASSIGNEE")
    throw new ChatError(400, "请选择当前项目有效的施工方责任人。");
  if (error?.message === "INVALID_PHOTOS")
    throw new ChatError(400, "图片已失效或超过上限，请核对后重试。");
  if (error?.code?.startsWith("22") || error?.code?.startsWith("23"))
    throw new ChatError(400, "请填写有效的建单信息。");
  if (error || !data) throw new ChatError(503, "草稿暂不可用，请稍后重试。");
  return data as T;
}

export async function prepareDraft(
  context: RuntimeContext,
  fields: z.infer<typeof draftFields>,
) {
  const { client, sessionId, sourceMessageId, sessionRevision, uploadIds } =
    context;
  return rpc<{ draftId: string; revision: number; status: DraftStatus }>(
    client,
    "prepare",
    sessionId,
    null,
    {
      ...fields,
      sessionRevision,
      sourceMessageId,
      uploadIds,
    },
  );
}

function photoOption(draftId: string, sessionId: string, photo: Photo) {
  const params = new URLSearchParams({ sessionId, photoId: photo.id });
  return {
    id: photo.id,
    name: photo.original_name,
    url: `/api/chat/drafts/${draftId}/photos?${params}`,
  };
}

async function readUploads(client: Client, sessionId: string) {
  const result = await client
    .from("assistant_uploads")
    .select("id,object_path,original_name,mime_type,size_bytes")
    .eq("session_id", sessionId);
  if (result.error) throw new ChatError(503, "图片信息暂不可用。");
  return result.data as Photo[];
}

export async function getDraftCard(
  sessionId: string,
  draftId: string,
): Promise<DraftCardData> {
  const { client } = await requireChatSession(sessionId);
  const { draft, assignees, workOrderNumber } = await rpc<DraftResponse>(
    client,
    "read",
    sessionId,
    draftId,
  );
  const editing = draft.status === "editing";
  const [uploads, photos] = editing
    ? await Promise.all([
        readUploads(client, sessionId),
        client
          .from("assistant_draft_photos")
          .select("id,original_name")
          .eq("draft_id", draftId)
          .is("source_upload_id", null),
      ])
    : [[], { data: [], error: null }];
  if (photos.error) throw new ChatError(503, "草稿图片暂不可用。");
  const bucket = client.storage.from(chatBucket);
  return {
    id: draft.id,
    revision: draft.revision,
    status: draft.status,
    workOrderNumber,
    form: {
      description: draft.description,
      location: draft.location,
      severity: draft.severity,
      discipline: draft.discipline,
      details: draft.details ?? "",
      assigneeId: draft.assignee_id,
      uploadIds: draft.selected_upload_ids,
      photoIds: draft.selected_photo_ids,
    },
    assignees: assignees ?? [],
    uploads: uploads
      .filter((photo) => draft.candidate_upload_ids.includes(photo.id))
      .map((photo) => ({
        id: photo.id,
        name: photo.original_name,
        url: bucket.getPublicUrl(photo.object_path).data.publicUrl,
      })),
    photos: (photos.data ?? []).map((photo) =>
      photoOption(draftId, sessionId, photo as Photo),
    ),
  };
}

async function stagePhoto(
  client: Client,
  sessionId: string,
  draftId: string,
  bytes: Uint8Array,
  name: string,
  claimedType: string,
  sourceUploadId?: string,
) {
  if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024)
    throw new ChatError(413, "每张图片必须大于 0 且不超过 10 MiB。");
  const mimeType = fileType(bytes);
  if (!mimeType || mimeType !== claimedType)
    throw new ChatError(415, "只支持真实的 JPEG、PNG、WebP 图片。");
  const photo = await rpc<Photo>(client, "photo", sessionId, draftId, {
    name,
    mimeType,
    size: bytes.byteLength,
    sourceUploadId,
  });
  const storage = client.storage.from(privateBucket);
  const { error } = await storage.upload(photo.object_path, bytes, {
    contentType: mimeType,
    cacheControl: "0, no-store",
    upsert: false,
  });
  if (error) {
    // 已成功暂存的聊天图在确认重试时复用，数据库会再次核对真实对象。
    if (!sourceUploadId || (await storage.info(photo.object_path)).error)
      throw new ChatError(503, "图片暂存失败，请重试。");
  }
  return photoOption(draftId, sessionId, photo);
}

export async function uploadDraftPhoto(
  sessionId: string,
  draftId: string,
  file: File,
) {
  const { client } = await requireChatSession(sessionId);
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new ChatError(413, "每张图片必须大于 0 且不超过 10 MiB。");
  return stagePhoto(
    client,
    sessionId,
    draftId,
    new Uint8Array(await file.arrayBuffer()),
    file.name,
    file.type,
  );
}

export async function readDraftPhoto(
  sessionId: string,
  draftId: string,
  photoId: string,
) {
  const { client } = await requireChatSession(sessionId);
  await rpc(client, "read", sessionId, draftId);
  const result = await client
    .from("assistant_draft_photos")
    .select("object_path,mime_type")
    .eq("draft_id", draftId)
    .eq("id", photoId)
    .maybeSingle();
  if (result.error) throw new ChatError(503, "草稿图片暂不可用。");
  if (!result.data) throw new ChatError(404, "草稿图片不存在或已失效。");
  const { data, error } = await client.storage
    .from(privateBucket)
    .download(
      result.data.object_path,
      { cacheNonce: crypto.randomUUID() },
      { cache: "no-store" },
    );
  if (error || !data) throw new ChatError(404, "草稿图片暂不可用。");
  return { data, mimeType: result.data.mime_type as string };
}

export async function mutateDraft(
  input: { sessionId: string; draftId: string; expectedRevision: number },
  op: "save" | "cancel" | "confirm",
  form?: DraftForm,
  sessionRevision?: number,
) {
  const { sessionId, draftId, expectedRevision } = input;
  const { client } = await requireChatSession(sessionId);
  if (op === "confirm") {
    const current = await rpc<DraftResponse>(
      client,
      "read",
      sessionId,
      draftId,
    );
    if (current.draft.status === "created") {
      return rpc<DraftResponse>(client, "confirm", sessionId, draftId);
    }
    if (
      current.draft.status !== "editing" ||
      current.draft.revision !== expectedRevision
    )
      throw new ChatError(409, "草稿已更新，请刷新核对后重试。");
    if (
      !form?.assigneeId ||
      !current.assignees?.some((person) => person.id === form.assigneeId)
    )
      throw new ChatError(400, "请选择当前项目有效的施工方责任人。");
    if (form.uploadIds.length) {
      const uploads = await readUploads(client, sessionId);
      for (const id of form.uploadIds) {
        const photo = uploads.find((item) => item.id === id);
        if (!photo) throw new ChatError(409, "聊天图片已失效，请核对后重试。");
        const publicUrl = client.storage
          .from(chatBucket)
          .getPublicUrl(photo.object_path).data.publicUrl;
        const response = await fetch(publicUrl, {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok)
          throw new ChatError(503, "无法读取所选聊天图片，请重试。");
        await stagePhoto(
          client,
          sessionId,
          draftId,
          new Uint8Array(await response.arrayBuffer()),
          photo.original_name,
          photo.mime_type,
          id,
        );
      }
    }
  }
  return rpc<DraftResponse>(client, op, sessionId, draftId, {
    ...form,
    expectedRevision,
    sessionRevision,
  });
}
