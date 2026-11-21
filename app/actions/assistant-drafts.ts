"use server";
import { z } from "zod";
import { draftForm, draftVersion } from "@/lib/assistant/draft-input";
import { mutateDraft } from "@/lib/assistant/drafts";
import { ChatError } from "@/lib/assistant/types";

const saveInput = draftVersion.extend({ form: draftForm });
const confirmInput = saveInput.extend({
  sessionRevision: z.number().int().nonnegative(),
});

async function runDraft(op: "save" | "cancel" | "confirm", value: unknown) {
  try {
    if (op === "cancel") {
      const parsed = draftVersion.safeParse(value);
      if (!parsed.success)
        return { ok: false, error: "草稿请求无效，请刷新重试。" } as const;
      return { ok: true, data: await mutateDraft(parsed.data, op) } as const;
    }
    const parsed = (op === "confirm" ? confirmInput : saveInput).safeParse(
      value,
    );
    if (!parsed.success)
      return {
        ok: false,
        error: "请核对问题信息、责任人和照片后重试。",
      } as const;
    const { form } = parsed.data;
    if (form.uploadIds.length + form.photoIds.length > 9)
      return { ok: false, error: "最多选择九张照片。" } as const;
    const sessionRevision =
      "sessionRevision" in parsed.data
        ? Number(parsed.data.sessionRevision)
        : undefined;
    return {
      ok: true,
      data: await mutateDraft(parsed.data, op, form, sessionRevision),
    } as const;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ChatError
          ? error.message
          : "操作未完成，已保留输入，请稍后重试。",
    } as const;
  }
}
export async function saveDraft(value: unknown) {
  return runDraft("save", value);
}
export async function cancelDraft(value: unknown) {
  return runDraft("cancel", value);
}
export async function confirmDraft(value: unknown) {
  return runDraft("confirm", value);
}
